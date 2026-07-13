# CogniLink Health & Diagnostics Troubleshooting Guide

This guide details the common errors encountered during **Health / System self-tests** and the **Pulse analytics tab**, explaining their root causes and how to resolve them.

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
  - Direct Cloudflare Analytics Engine REST SQL query authentication failure.
  - The API token used to query the Analytics Engine (`CF_AE_API_TOKEN`) is either missing, incorrect, expired, or lacks read permissions.
- **How to Fix:**
  1. Go to your **Cloudflare Dashboard** ➔ **Workers & Pages** ➔ **[Your Pages App]** ➔ **Settings** ➔ **Environment variables**.
  2. Ensure `CF_ACCOUNT_ID` matches your Cloudflare Account ID exactly.
  3. Verify `CF_AE_API_TOKEN` is set as an encrypted Secret.
  4. Ensure the API token carries the **`Analytics Engine:Read`** permission at the account level. If not, generate a new token at `My Profile` ➔ `API Tokens` with the correct template.

---

## 3. ✖ Telemetry Ingest FAIL / Manual Validation Timeout
- **Error symptoms:**
  - `Telemetry ingest ✖ FAIL`
  - `Manual validation timeout` or `stage: analytics (AE timeout)`
- **Root Cause:**
  - Telemetry logs rely on the router tests succeeding first. If the router returned 404 (due to missing `nb` alias), no telemetry events are ever generated.
  - Alternatively, Cloudflare Analytics Engine is experiencing temporary ingestion delays. Ingestion of data points into SQL databases can take up to 60–90 seconds.
- **How to Fix:**
  1. First, resolve the **Router 404** issue by ensuring the `nb` alias is configured.
  2. Allow up to 2 minutes for Cloudflare's internal buffers to flush before triggering a self-test again.

<br>
<hr>
<br>

# CogniLink Sistem Sağlığı & Hata Teşhis Kılavuzu (Turkish)

Bu kılavuz, **Sistem Sağlık Testleri (Health/Self-Tests)** ve **Pulse Analitik Sekmesinde** karşılaşılan yaygın hataları, bunların nedenlerini ve nasıl düzeltileceğini açıklamaktadır.

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
  - **Pulse sekmesinin** grafik yükleyememesi veya analitik verileri çekememesi.
- **Temel Neden:**
  - Cloudflare Analytics Engine SQL sorgulama uç noktasının kimlik doğrulama hatasıdır.
  - Analytics Engine verilerini çekmek için kullanılan `CF_AE_API_TOKEN` anahtarı geçersiz, eksik, süresi dolmuş veya okuma yetkisi olmayan bir tokendir.
- **Nasıl Düzeltilir:**
  1. **Cloudflare Dashboard** ➔ **Workers & Pages** ➔ **[Pages Projeniz]** ➔ **Settings** ➔ **Environment variables** bölümüne gidin.
  2. `CF_ACCOUNT_ID` değerinin Cloudflare Hesap ID'niz ile birebir eşleştiğini doğrulayın.
  3. `CF_AE_API_TOKEN` değişkeninin doğru bir şekilde şifrelenmiş Secret olarak eklendiğinden emin olun.
  4. Bu API Token'ın **`Analytics Engine:Read`** yetkisine sahip olduğunu kontrol edin. Yetki yoksa `My Profile` ➔ `API Tokens` sayfasından bu yetkiyle yeni bir token oluşturup güncelleyin.

---

## 3. ✖ Telemetri Girişi Hatası / Manuel Doğrulama Zaman Aşımı
- **Hata Belirtileri:**
  - `Telemetry ingest ✖ FAIL`
  - `Manual validation timeout` veya `stage: analytics (AE timeout)`
- **Temel Neden:**
  - Telemetri testleri, yönlendiricinin başarılı olmasına bağlıdır. Eğer yönlendirici 404 dönüyorsa telemetri verisi üretilemez.
  - Cloudflare Analytics Engine sistemindeki geçici gecikmeler. Gönderilen verilerin SQL sorgu veri tabanına işlenmesi 60 ila 90 saniye sürebilir.
- **Nasıl Düzeltilir:**
  1. Öncelikle yönlendirici 404 hatasını çözmek için **`nb`** kısayolunun tanımlandığından emin olun.
  2. Cloudflare veri işleme tamponlarının boşalması için testleri yeniden tetiklemeden önce yaklaşık 2 dakika bekleyin.
