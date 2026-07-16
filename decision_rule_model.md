# CogniLink Decision Rule Model (Language Specification)

This document outlines the Domain-Agnostic Rule Language specification that the Decision Engine evaluates to produce outcomes.

---

## 1. Rule Felsefesi (Philosophy)

Seçilen model: **Hybrid JSON-based Pipeline (JSON Rules with Nested Condition Logic)**

**Neden bu model? Neden Alternatifler Değil?**
- **Expression Tabanlı (`"utm == 'email' && score > 50"`) Değil:** Çalıştırma anında (Edge'de) string'i AST'ye (Abstract Syntax Tree) parse etmek ciddi CPU maliyeti (latency) yaratır. Ayrıca UI üzerinden (Admin) expression yazmak zordur, hata payı yüksektir.
- **Tree (Ağaç) Tabanlı Değil:** Karar ağaçlarında yollar karmaşıklaştıkça kuralın neden çalıştığını (audit) bulmak imkansızlaşır.
- **JSON Pipeline:** Kuralların JSON objesi olarak tanımlanıp yukarıdan aşağı (priority order) değerlendirilmesi Cloudflare Workers ortamı için sıfır-parser (Sadece `JSON.parse`) gerektirir. Makine için en hızlı, Admin Visual Builder için en uygun yapıdır.

---

## 2. Rule Yapısı (Structure)

Bir `Rule`, sadece çalışma anında (runtime) karar vermek için gerekli olan minimum alanları barındırır.

```json
{
  "id": "rule_retargeting_bounce",
  "name": "Retargeting Bounce Rule",
  "priority": 100,
  "condition": { ... },
  "action": { ... }
}
```

*Gereksiz Alanlar (Anti-Pattern):* `expires`, `audience`, `enabled`, `stop`.
Neden? Çünkü bu işlemler **Admin/Publisher API**'nin sorumluluğudur. Eğer bir kural kapalıysa veya tarihi geçmişse, Admin API bu kuralı Runtime'a gönderilen JSON dizisinden (KV'den) çıkartır. Runtime'ın tarihi geçmiş kuralı parse edip if-check'ine sokması Edge için performans israfıdır. Ek olarak, sistem daima ilk eşleşmede duracağı için (First Match Wins) ekstra bir `stop` flag'ine gerek yoktur.

---

## 3. Conditions (Durum Değerlendirmeleri)

Decision Engine, bağlamı 4 ana kategoride ele alır:

1. **State / Behavior:** Kullanıcının geçmiş izleri (`session.tags`, `lead.status`).
2. **Context (Campaign/Page):** O anki isteğin özellikleri (`context.utm_source`, `context.path`).
3. **Environment:** Çevresel veriler (`env.device`, `env.country`, `env.time_of_day`).
4. **Journey:** Kullanıcının funnel'daki güncel adımı (`journey.step_id`).

Condition'lar, `and` / `or` gruplamalarıyla iç içe (nested) mantık kurabilir:

```json
"condition": {
  "and": [
    { "field": "context.utm_medium", "operator": "equals", "value": "email" },
    { "field": "state.tags", "operator": "contains", "value": "watched_vsl" }
  ]
}
```

Eğer kural herkes için geçerliyse (Fallback kuralı):
`"condition": "always"`

---

## 4. Operators (Operatörler)

Edge üzerinde güvenli ve hızlı değerlendirme için ReDoS (Regex Denial of Service) yaratabilecek RegExp veya Matches gibi karmaşık operatörler **desteklenmez**. Yalnızca deterministik, o(1) veya o(n) karmaşıklığındaki operatörler bulunur:

- **Eşleşme:** `equals`, `not_equals` (UTM, Device, ID kıyaslamaları)
- **Liste / Küme:** `contains`, `not_contains`, `in`, `not_in` (Tag kontrolü)
- **Sayısal:** `greater_than`, `less_than`, `between` (Görüntüleme sayısı, Skor)
- **Varlık:** `exists`, `not_exists` (Bir UTM parametresinin verilip verilmediği)

---

## 5. Actions (Aksiyonlar)

Action objesi, Decision Engine'in Renderer'a ve State Manager'a ne yapması gerektiğini bildirdiği kısımdır. Action, Renderer'a hiçbir zaman HTML veya CSS dictte etmez. Sınır çok nettir: **"Şunu sakla, bu temayı kullan"** der, Renderer uygular.

```json
"action": {
  "type": "render", 
  "overrides": {
    "hidden_components": ["comp_hard_sales"],
    "layout_variant": "soft_pitch",
    "theme": "dark"
  },
  "state_mutations": {
    "add_tags": ["soft_pitch_viewed"],
    "remove_tags": ["new_visitor"]
  }
}
```

**Aksiyon Tipleri:**
- `render`: Mevcut sayfayı belirtilen modifikasyonlarla (overrides) çiz.
- `redirect`: Anında belirtilen hedef URL'ye HTTP 302 yönlendir. (Renderer by-pass edilir).
- `block`: Güvenlik, spam tespiti veya invalid traffic için HTTP 403 döner.

---

## 6. Priority Model (Öncelik ve Akış)

- **Sıralama:** Kurallar sisteme girdikten sonra `priority` değerine göre (En yüksekten en düşüğe) sıralanır.
- **First Match Wins:** Decision Engine yukarıdan aşağıya condition'ları okur. Koşulu sağlanan (true) **ilk kuralı bulduğunda motor çalışmayı durdurur** (Short-circuit). O kuralın Action objesi `Decision` objesi olarak dönülür.
- **Neden Birleştirme Yok? (No Action Merging):** İki farklı kuralın override'larını birleştirmek (merge), "Hangi kural bu componenti gizledi?" sorusunun yanıtını (Auditability) kaybettirir. Sistem deterministic olmak zorundadır.

---

## 7. Composition (Bileşim ve Kapsam)

- **Inheritance Yok:** Bir kural başka bir kuralı `extend` (kalıtım) edemez. Kalıtım, kuralları debug etmeyi (Trace) imkansızlaştırır. Kurallar "Flat" (Düz) tutulur.
- **Condition Sharing:** Ortak logic'ler sadece `and`/`or` gruplarıyla kural içinde oluşturulur.

---

## 8. Validation (Doğrulama ve Güvenlik)

Sistemin çökmemesi için 2 katmanlı defans hattı kurulur:
1. **Admin / Publisher Doğrulaması:** Kural JSON Schema Validation (Zod veya Ajv) kullanılarak doğrulanmadan KV'ye yazılamaz. Yanlış bir operatör veya geçersiz field KV'ye giremez.
2. **Runtime Fallback:** Cloudflare Edge'de çalışırken beklenmeyen bir Type Error oluşursa, Decision Engine `try/catch` ile hatayı yutar (swallow) ve anında `"condition": "always"` olan Default Render kuralını (Fallback) çalıştırır. Production'da sayfa hiçbir zaman hata koduna (500) düşmez.

---

## 9. Gelecek Entegrasyonlar (Future Scope)

- **Visual Rule Builder:** JSON yapısı sayesinde, Admin panelinde pazarlamacılar için "Sürükle-Bırak" (If-This-Then-That) tarzı Node-Based arayüzler kolayca eklenebilir.
- **Rule Simulator (Dry Run):** Geliştiriciler sahte bir `State` ve `Context` JSON'ı vererek, "Bu kullanıcıya hangi kural eşleşirdi?" testini API üzerinden simüle edebilir.
- **AI Rule Generation:** "Google'dan gelen mobil kullanıcıları X formuna yönlendir" gibi düz metin promptlar, LLM'ler tarafından kolayca bu açık şemaya dönüştürülebilir.
- **Rule Versioning & Audit:** Her JSON değişiklik bir Git History (veya Log) olarak tutularak, "Dün satışlar neden düştü?" sorusunun cevabı kolayca Rollback edilebilir.
