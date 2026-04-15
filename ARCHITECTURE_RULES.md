# CogniLink: Core Architecture Rules & AI Context

Bu dosya, CogniLink projesinde çalışan her yapay zeka (LLM) asistanı veya geliştirici için "Kuzey Yıldızı" (North Star) niteliğindedir. Uygulamada herhangi bir değişiklik yapmadan önce **MUTLAKA** bu kurallara uyulmalıdır.

## 🎯 Ana Hedef (The Prime Directive)
Uygulama; **güvenli, anlık çok yüksek trafik stresine (milyonlarca tıklama) çökmeden dayanabilen, veri kaybı yaşatmayan, stabil ve Cloudflare ekosisteminde çok düşük maliyet üreten** bir link yönlendirme ve analiz/A-B test motoru olmalıdır.

## 🚫 1. KV Veritabanı "Write" (Yazma) Kuralları [KRİTİK]
- **Yönlendirme Esnasında KV'ye Yazmak YASAKTIR (No KV Writes on Critical Path):** `c/[slug].js`, static hub'lar veya redirect yapan herhangi bir Worker içerisinde Cloudflare KV'ye veri **yazılamaz**.
- Cloudflare KV, saniyede maksimum 1 yazma (1 write/sec) limitine sahiptir. Yüksek trafikte KV'ye sayaç (counter) yazmak, isteklerin throttling yemesine, veri kaybına ve ölümcül darboğazlara neden olur.
- KV sadece **OKUMA (Read)** amaçlıdır. Yönlendirme mantığı, slug verileri ve konfigürasyonlar KV'den `Cache-Control` header'ları ile önbelleğe alınarak okunur.
- Admin panelinden yapılan "Kampanya oluşturma" gibi nadir değişikliklerde KV'ye yazmak normaldir (Admin panel trafiği düşüktür).

## 📊 2. Telemetri ve Sayım (Analytics & Counters)
- Tüm anlık yüksek hacimli veriler (Tıklamalar, sayfa görüntülenmeleri, A/B test gösterimleri, dönüşümler) **SADECE Cloudflare Analytics Engine (AE)** ortamına yazılmalıdır.
- AE, devasa veriyi asenkron (waitUntil) yutar ve maliyetsizdir.
- Admin Panel istatistikleri doğrudan Cloudflare GraphQL/SQL API üzerinden AE'den okunmalıdır.
- **UYARI:** AE verileri ortalama 3-5 dakika gecikmelidir (Batching). Panellerde her zaman *"Veriler 3-5 dakika gecikmeli güncellenmektedir"* (Data Freshness) ibaresi yer almalıdır.

## 🧠 3. Smart A/B (Multi-Armed Bandit) Mimari Modeli
A/B testlerinin kendi kendine öğrenip trafiği iyi varyanta kaydırması için şu döngü (loop) KESİNLİKLE korunmalıdır:
1. **Veri Toplama:** Edge router, gösterimleri (exposures) ve tıklamaları AE'ye fırlatır. Dönüşümler (conversions) de AE'ye işlenir. (Sıfır gecikme, sınırsız ölçek).
2. **Karar Verme (Hesaplama):** Bir `Cron Trigger` (ör. her 5 veya 10 dakikada bir çalışır), AE'den son istatistikleri çeker, Thompson Sampling vb. kullanarak yeni yönlendirme ağırlıklarını (weights) hesaplar.
3. **Sonucu Kaydetme:** Cron, hesapladığı yeni ağırlıkları saniyede 1 write limitini aşmayacak şekilde tek bir KV anahtarına (örn. `campaign:xyz:weights`) kaydeder.
4. **Yönlendirme Uygulaması:** Edge router (`c/[slug].js`), gelen ziyaretçiyi yönlendirirken KV'deki bu hesaplanmış güncel "ağırlıkları" okur ve trafiği anında rastgele dağıtır.

## 🔗 4. Bütünlük ve Entegrasyon
- Harici entegrasyonlar (Kartra dönüşümleri vb.) için `api/convert.js` her zaman A/B alias, varyant bilgisi ve utm etiketlerini bekler; bunları alıp AE'ye kaydeder.
- Mevcut `event.js` (outbound clicks) Analytics Engine'e zaten bağlıdır, bu koruncak ve A/B gösterimleri de AE modeline geçirilecektir.
- Kodu gereksiz paketlere boğmayın. Sürekli Edge-Native (0 dependency) kalmaya çalışın. Orjinal `_shared/` dosya mimarisi korunmalıdır.
