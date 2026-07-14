# CogniLink Health & Diagnostics Troubleshooting Guide

This guide details the common errors encountered during **Health / System self-tests** and the **Pulse analytics tab**, explaining their root causes, the dynamic dataset fixes applied, and security guidelines.

---

## 1. ✖ Router / Modifier Routing FAIL (HTTP 404)
- **Error symptoms:**
  - `Router ✖ FAIL`
  - `Modifier routing ✖ FAIL`
  - `Warnings: Smoke: Router: /nb → HTTP 404` or `/nb/offer → HTTP 404`
- **Root Cause:**
  - The health self-tests query the default test route alias `nb` to verify routing infrastructure.
  - If the vanity alias `nb` is deleted or missing from the `ROUTE_ALIAS` KV namespace, these requests return `HTTP 404`.
- **How to Fix:**
  1. Log in to the **CogniLink Admin Panel**.
  2. Navigate to the **Routes** or **Vanity Aliases** tab.
  3. Create/re-create the **`nb`** alias mapping it to any valid canonical campaign slug.
  4. Save/Compile the routing rules.

---

## 2. ✖ Analytics Ingest FAIL / AE SQL Error 403: Authorization Error
- **Error symptoms:**
  - `Analytics ingest ✖ FAIL`
  - `Consistency probe ✖ FAIL`
  - `[Analytics API] Partial query failures detected: Error: AE SQL error 403: Authorization error`
  - **Pulse tab** fails to load/render analytics.
- **Root Cause:**
  - **Mismatch of Dataset Names (Resolved):** In previous CogniLink versions, the dataset was hardcoded as `linkhub_ops_events` (in `test-runner.js`, `health.js`, `manual-test.js`, and `background-test.js`). 
  - Additionally, `experiments.js` and `bandit-update.js` constructed `ae_traffic_production` instead of `cognilink_runtime_traffic_prod` when `ENV_NAME` was set to `production`.
  - Since these legacy/constructed datasets did not exist on your new Cloudflare account, Cloudflare returned a 403 authorization error.
- **Applied Fix:**
  - All occurrences were updated to dynamically check if the environment is production (`ENV_NAME === 'production'`) and query `cognilink_runtime_traffic_prod` / `cognilink_runtime_conversion_prod` accordingly.
- **What to double check if 403 persists:**
  1. Go to your **Cloudflare Dashboard** ➔ **Workers & Pages** ➔ **[Your Pages App]** ➔ **Settings** ➔ **Environment variables**.
  2. Ensure `CF_ACCOUNT_ID` matches your Cloudflare Account ID exactly.
  3. Verify `CF_AE_API_TOKEN` is set as an encrypted Secret.
  4. Ensure the API token carries the **`Account ➔ Account Analytics ➔ Read`** permission.

---

## 3. 🛡️ wp-admin / wp-content Scans & Bot Activities
- **What is happening:**
  - You may notice entries inside `cognilink_runtime_traffic_prod` under `blob1` containing paths like `wp-admin`, `wp-includes`, `wp-content`, or `actuator`.
- **Is this a breach?**
  - **No.** This is normal automated bot scanner activity attempting to locate WordPress vulnerability files.
  - Since CogniLink uses a **wildcard route handler** (`[[path]].js`) to serve dynamic campaigns, any request that doesn't match a static asset (including `/wp-admin`) falls through to the routing engine. The router treats `wp-admin` as a campaign slug, tries to look it up in KV, and logs the access attempt as a `traffic_memory` event in the Analytics Engine.
- **How to protect KV & AE from Scanner spam:**
  1. **Configure Cloudflare WAF (Recommended):** Add WAF Rules in the Cloudflare Dashboard (`Security ➔ WAF`) to block requests containing `wp-admin`, `.php`, `wp-content` or standard WordPress paths.
  2. **Fast-Failure in Router:** WAF rules stop the execution at the edge, saving KV read operations and Analytics Engine data points.

<br>
<hr>
<br>

# CogniLink Sistem Sağlığı & Hata Teşhis Kılavuzu (Turkish)

Bu kılavuz, **Sistem Sağlık Testleri (Health/Self-Tests)** ve **Pulse Analitik Sekmesinde** karşılaşılan yaygın hataları, bunların nedenlerini, veri seti düzeltmelerini ve güvenlik önlemlerini açıklamaktadır.

---

## 1. ✖ Yönlendirici / Modifikatör Rota Hatası (HTTP 404)
- **Hata Belirtileri:**
  - `Router ✖ FAIL`
  - `Modifier routing ✖ FAIL`
  - `Warnings: Smoke: Router: /nb → HTTP 404` veya `/nb/offer → HTTP 404`
- **Temel Neden:**
  - Sistem kendi altyapısını test etmek için varsayılan olarak **`nb`** takma adını (alias) çağırır.
  - Eğer `nb` takma adı `ROUTE_ALIAS` KV veri tabanında bulunmuyorsa veya silinmişse yönlendirici `HTTP 404` döner.
- **Nasıl Düzeltilir:**
  1. **CogniLink Yönetim Paneline** giriş yapın.
  2. Rotalar (Routes) veya Kısayollar sekmesine gidin.
  3. **`nb`** adında yeni bir kısayol oluşturup bunu aktif bir kampanya/slug sayfasına yönlendirin.
  4. Değişiklikleri kaydedip rotaları derleyin (Compile).

---

## 2. ✖ Analiz Girişi Hatası / AE SQL Error 403: Authorization Error
- **Hata Belirtileri:**
  - `Analytics ingest ✖ FAIL`
  - `Consistency probe ✖ FAIL`
  - `[Analytics API] Partial query failures detected: Error: AE SQL error 403: Authorization error`
  - **Pulse sekmesinin** analitik verileri çekememesi.
- **Temel Neden:**
  - **Eski Veri Seti Adları (Çözüldü):** Eski CogniLink sürümlerinde `linkhub_ops_events` veri seti adı test dosyalarında (`test-runner.js`, `health.js`, `manual-test.js` ve `background-test.js`) statik olarak tanımlanmıştı.
  - Ek olarak, `experiments.js` ve `bandit-update.js` dosyalarında `ENV_NAME = production` olduğunda `ae_traffic_production` aranıyordu.
  - Bu veri setleri yeni hesabınızda mevcut olmadığı için Cloudflare 403 hata kodu dönüyordu.
- **Uygulanan Düzeltme:**
  - Tüm sorgular güncellenerek üretim ortamında `cognilink_runtime_traffic_prod` / `cognilink_runtime_conversion_prod` veri setleri dinamik olarak hedeflendi.
- **Hata Devam Ederse Kontrol Edilecekler:**
  1. Cloudflare Pages panelinden `CF_ACCOUNT_ID` değerinizi doğrulayın.
  2. `CF_AE_API_TOKEN` anahtarının Pages üzerinde Secret olarak eklendiğinden emin olun.
  3. Bu anahtarın Cloudflare panelinde **`Account ➔ Account Analytics ➔ Read`** yetkisi taşıdığını doğrulayın.

---

## 3. 🛡️ wp-admin / wp-content Taramaları & Bot Hareketleri
- **Olay Nedir:**
  - `cognilink_runtime_traffic_prod` veri setindeki sorgularda `wp-admin`, `wp-includes`, `wp-content` veya `actuator` gibi isteklerin loglandığını görebilirsiniz.
- **Bu Bir Güvenlik İhlali mi?**
  - **Hayır.** Bu durum, internetteki açıkları tarayan otomatik botların web sitenize yaptığı standart isteklerdir.
  - CogniLink joker yönlendirme (`[[path]].js`) kullandığı için statik dosya dışındaki tüm istekleri yönlendiriciye iletir. Yönlendirici `wp-admin` ifadesini bir kampanya kısayolu sanıp KV'de arar ve bu giriş denemesini telemetri amaçlı `AE_TRAFFIC` veri tabanına kaydeder.
- **KV ve AE Veri Tabanlarını Bu Taramalardan Nasıl Koruruz?**
  1. **Cloudflare WAF Kuralları (Önerilen):** Cloudflare Dashboard üzerinden `Security ➔ WAF` sekmesine gidin. `wp-admin`, `.php`, `wp-content` içeren tüm istekleri engelleyecek (Block) bir kural tanımlayın.
  2. Bu sayede tarama istekleri daha sunucuya ulaşmadan kenarda (Edge) kesilir; gereksiz KV sorgularının ve AE veri yazımlarının önüne geçilir.
