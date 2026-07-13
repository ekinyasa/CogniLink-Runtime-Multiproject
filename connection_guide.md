# Cloudflare KV & Analytics Engine Connection Guide

This document serves as a complete reference for all KV Namespaces and Cloudflare Analytics Engine (AE) Datasets utilized by the CogniLink Runtime.

---

## 📦 Cloudflare KV Namespaces

### 1. `SLUG_LINKS`
- **What is stored:** Canonical slug campaign configurations, including custom layouts, headers, footers, scripts, tracking defaults, and styling properties.
  - *Key format:* `{slug_name}` (e.g., `trafik-yenileme`)
  - *Value schema:* `{ slug, campaign, defaults: { utm_source, ... }, isActive, links: [...], overrides: {...}, customStyleCss, customHeaderHtml, customFooterHtml, customScript, engineMapId }`
- **Admin Panel Reads/Writes:** 
  - Accessed by **Slugs Editor** (`admin-renderer.js` / `/api/slugs` and `/api/slug/:slug`).
  - Read by the runtime router (`[[path]].js`) during campaign page generation.

### 2. `CAMPAIGN_INDEX`
- **What is stored:** Secondary fast-lookup indexes mapping campaign names to active slugs.
- **Admin Panel Reads/Writes:** 
  - Written/read by the campaign management screens.

### 3. `LANDING_CONFIG`
- **What is stored:** Global system configurations and decision rules.
  - *Key:* `hub_config` (stores `Default Page Title`, `External CSS URL`, and `Global Custom CSS`).
  - *Key:* `engine_config` (stores global Decision Engine maps and fallback redirect paths).
- **Admin Panel Reads/Writes:** 
  - Read and configured in the **General Settings / Config** screen (`/api/config`).
  - Read by `hub-renderer.js` to get default global title and external styling blocks.

### 4. `CAMPAIGN_AB_ALIAS_INDEX`
- **What is stored:** A/B campaign aliases mapped to variants.
- **Admin Panel Reads/Writes:**
  - Written during A/B test setup in the Experiments panel.

### 5. `AB_INDEX`
- **What is stored:** Active A/B test experiment variant traffic allocations.
- **Admin Panel Reads/Writes:**
  - Read and written by the A/B Experiment manager.

### 6. `ROUTE_ALIAS`
- **What is stored:** Routing shorthand directories mapping vanity aliases to canonical slugs.
- **Admin Panel Reads/Writes:**
  - Read/updated in the Routes management panel.

### 7. `APP_CONFIG`
- **What is stored:** Dynamic Components registry and page layout blocks.
  - *Key formats:* 
    - `comp_family:{family_id}` ➔ Family metadata `{ family_id, family_key, family_name, type, status }`
    - `comp_ver:{family_id}:{ver_num}` ➔ Version contents and status `{ component_id, title, body, cta_label, cta_url, status, is_live }`
    - `comp_live` ➔ Array of active live components index mapping.
    - `hub:{page_id}` ➔ Page layout models and sections ordering list.
- **Admin Panel Reads/Writes:**
  - Read/written by the **Components Tab** editor.

### 8. `ANALYTICS_DATA`
- **What is stored:** Cached analytics report stats and graph aggregates.
- **Admin Panel Reads/Writes:**
  - Read by the Analytics Dashboard tab to display traffic graphs.

### 9. `GUARD_CACHE`
- **What is stored:** Security tokens, rate limiting records, and gate logs.
- **Admin Panel Reads/Writes:**
  - Internal system runtime only.

---

## 📊 Cloudflare Analytics Engine (AE) Datasets

### 1. `AE_TRAFFIC`
- **Production Dataset Name:** `cognilink_runtime_traffic_prod`
- **What is stored:** Operational logs, traffic paths, instant redirect events, and ray-IDs.
- **Admin Panel Reads:** Queried by the REST SQL endpoint to display traffic rates and server health summaries.

### 2. `AE_CONVERSION`
- **Production Dataset Name:** `cognilink_runtime_conversion_prod`
- **What is stored:** Direct user actions, CTA clicks, purchases, and form sign-ups.
- **Admin Panel Reads:** Queried to calculate conversion rates and draw performance graphs.

### 3. `AE_EXPERIMENT`
- **Production Dataset Name:** `cognilink_runtime_experiment_prod`
- **What is stored:** A/B exposure events mapping visitor allocations to specific variations.
- **Admin Panel Reads:** Queried to evaluate which variant is winning during active split testing.

---

## 🔑 Variables, Secrets & API Tokens Settings

To run the application, the environment variables must be defined in the following locations:

### A. Cloudflare Pages Dashboard (Production/Preview Environments)
1. Go to **Workers & Pages** ➔ **[Your Pages Project]** ➔ **Settings** ➔ **Environment variables**.
2. Under **Environment variables**, click **Add variables** for both **Production** and **Preview** environments.
3. Configure the following keys:
   - `ADMIN_TOKEN` / `EKIN_ADMIN_TOKEN` / `NILUFER_ADMIN_TOKEN`: Administrative auth token (Secret/Encrypt recommended).
   - `CF_ACCOUNT_ID`: Cloudflare Account ID (String).
   - `CF_AE_API_TOKEN`: Cloudflare API token with `Analytics Engine:Read` permission (Secret).
   - `EXPOSURE_TOKEN_SECRET`: Custom cryptographic key used for variant tracking signature validation (Secret).
   - `GA4_ID`: Google Analytics measurement ID (e.g. `G-XXXXXX`) (String).
   - `META_PIXEL_ID`: Meta Pixel ID (String).
   - `CUSTOM_DOMAIN`: Custom primary domain name mapped to the deployment (e.g. `runtime.ekinyasa.online`) (String).

### B. Local Development Environment
Create or edit the `.dev.vars` file in the root directory of your project (this file is excluded from Git). Add keys in `KEY=value` format:
```env
ADMIN_TOKEN=O+nAq0Kpgq+6zJsIdeU3JY...
CF_ACCOUNT_ID=ab0a0fd02766e5da...
CF_AE_API_TOKEN=cfut_LejbmxSy9OWlz...
EXPOSURE_TOKEN_SECRET=your_local_secret_key
GA4_ID=G-DWCN82754X
META_PIXEL_ID=
CUSTOM_DOMAIN=localhost:8788
```

---

## 🚨 Disaster Recovery (How to Recreate)

If any of the bindings are deleted, follow these instructions to re-initialize them:

### A. KV Namespaces
1. Log in to the **Cloudflare Dashboard**.
2. Navigate to **Workers & Pages** ➔ **KV**.
3. Click **Create Namespace** and input the respective name (e.g. `SLUG_LINKS`).
4. Go to **Workers & Pages** ➔ **[Your Pages Project]** ➔ **Settings** ➔ **Functions**.
5. Find **KV Namespace Bindings** and click **Add Binding**.
6. Set the **Variable name** exactly as shown in the table above (e.g. `SLUG_LINKS`), select the newly created namespace, and click **Save**.

### B. Analytics Engine Datasets
1. Navigate to **Workers & Pages** ➔ **Analytics Engine**.
2. Click **Add Dataset**. Name it using the production dataset name (e.g. `cognilink_runtime_traffic_prod`).
3. Go to **Workers & Pages** ➔ **[Your Pages Project]** ➔ **Settings** ➔ **Functions**.
4. Find **Analytics Engine Bindings** and click **Add Binding**.
5. Set the **Variable name** exactly as shown in the AE section (e.g. `AE_TRAFFIC`), enter the **Dataset Name** (e.g. `cognilink_runtime_traffic_prod`), and click **Save**.

<br>
<hr>
<br>

# Cloudflare KV & Analytics Engine Bağlantı Kılavuzu (Turkish)

Bu belge, CogniLink Runtime tarafından kullanılan tüm KV Veri Tabanı (Namespace) alanları ve Cloudflare Analytics Engine (AE) Veri Setleri için eksiksiz bir referans kılavuzudur.

---

## 📦 Cloudflare KV Namespaces (Veri Tabanı Alanları)

### 1. `SLUG_LINKS`
- **Ne depolanır:** Sayfa yerleşimleri (layouts), özel header'lar, footer'lar, script kodları, izleme (tracking) varsayılanları ve stil özellikleri dahil olmak üzere slug bazlı kampanya yapılandırmaları.
  - *Anahtar formatı:* `{slug_name}` (örneğin: `trafik-yenileme`)
  - *Değer şeması:* `{ slug, campaign, defaults: { utm_source, ... }, isActive, links: [...], overrides: {...}, customStyleCss, customHeaderHtml, customFooterHtml, customScript, engineMapId }`
- **Admin Panel Okuma/Yazma İşlemleri:** 
  - **Slugs Editor** (`admin-renderer.js` / `/api/slugs` ve `/api/slug/:slug`) tarafından yönetilir.
  - Runtime yönlendirici (`[[path]].js`) tarafından kampanya sayfalarını derlerken okunur.

### 2. `CAMPAIGN_INDEX`
- **Ne depolanır:** Kampanya isimlerini aktif slug değerlerine hızlıca eşleştiren ikincil indeks kayıtları.
- **Admin Panel Okuma/Yazma İşlemleri:** 
  - Kampanya yönetim ekranları tarafından yazılır ve okunur.

### 3. `LANDING_CONFIG`
- **Ne depolanır:** Sistem genelindeki global ayarlar ve karar mekanizması kuralları.
  - *Anahtar:* `hub_config` (Global `Default Page Title`, `External CSS URL` ve `Global Custom CSS` bilgilerini depolar).
  - *Anahtar:* `engine_config` (Global Decision Engine haritalarını ve fallback yönlendirme yollarını depolar).
- **Admin Panel Okuma/Yazma İşlemleri:** 
  - **Genel Ayarlar / Config** ekranından yönetilir (`/api/config`).
  - `hub-renderer.js` tarafından varsayılan başlık ve global CSS bloklarını derlemek için okunur.

### 4. `CAMPAIGN_AB_ALIAS_INDEX`
- **Ne depolanır:** Kampanya takma adlarının (alias) A/B test varyasyonlarına yönlendirme eşleştirmeleri.
- **Admin Panel Okuma/Yazma İşlemleri:**
  - Deneyler (Experiments) panelinde A/B test kurulumu sırasında yazılır.

### 5. `AB_INDEX`
- **Ne depolanır:** Aktif A/B test deneylerinin varyant bazlı trafik dağıtım ayarları.
- **Admin Panel Okuma/Yazma İşlemleri:**
  - A/B Deney yöneticisi tarafından okunur ve güncellenir.

### 6. `ROUTE_ALIAS`
- **Ne depolanır:** Kısa/estetik takma adları (vanity alias) kanonik slug yollarına eşleştiren yönlendirme tabloları.
- **Admin Panel Okuma/Yazma İşlemleri:**
  - Rotalar (Routes) yönetim panelinde düzenlenir.

### 7. `APP_CONFIG`
- **Ne depolanır:** Dinamik Bileşenler (Components) kütüphanesi ve sayfa şablonu (layout) sıralamaları.
  - *Anahtar formatları:* 
    - `comp_family:{family_id}` ➔ Bileşen ailesi ana bilgileri `{ family_id, family_key, family_name, type, status }`
    - `comp_ver:{family_id}:{ver_num}` ➔ Bileşen versiyon detayları `{ component_id, title, body, cta_label, cta_url, status, is_live }`
    - `comp_live` ➔ Aktif canlı bileşenlerin indeks eşleşme listesi.
    - `hub:{page_id}` ➔ Sayfa yerleşim modelleri ve sıralanmış bölüm listesi.
- **Admin Panel Okuma/Yazma İşlemleri:**
  - **Bileşenler (Components) sekmesi** düzenleyicisi tarafından yazılır ve okunur.

### 8. `ANALYTICS_DATA`
- **Ne depolanır:** Önbelleğe alınmış analiz raporları ve grafik veri özetleri.
- **Admin Panel Okuma/Yazma İşlemleri:**
  - Okunur by the Analytics Dashboard tab to display traffic graphs.

### 9. `GUARD_CACHE`
- **Ne depolanır:** Güvenlik anahtarları, istek sınırlandırma (rate limit) kayıtları ve geçiş logları.
- **Admin Panel Okuma/Yazma İşlemleri:**
  - Yalnızca sistem çalışma zamanında (runtime) dahili olarak kullanılır.

---

## 📊 Cloudflare Analytics Engine (AE - Analiz Motoru) Veri Setleri

### 1. `AE_TRAFFIC`
- **Üretim (Production) Veri Seti Adı:** `cognilink_runtime_traffic_prod`
- **Ne depolanır:** Sunucu bazlı operasyon logları, trafik yolları, hızlı yönlendirme sinyalleri ve ray-ID bilgileri.
- **Admin Panel Okuma İşlemleri:** SQL REST API uç noktası üzerinden sorgulanarak trafik hızları ve sunucu sağlığı raporlarını gösterir.

### 2. `AE_CONVERSION`
- **Üretim (Production) Veri Seti Adı:** `cognilink_runtime_conversion_prod`
- **Ne depolanır:** Kullanıcı aksiyonları, CTA buton tıklamaları, satın almalar ve form kayıtları.
- **Admin Panel Okuma İşlemleri:** Dönüşüm oranlarını hesaplamak ve performans grafiklerini çizmek için sorgulanır.

### 3. `AE_EXPERIMENT`
- **Üretim (Production) Veri Seti Adı:** `cognilink_runtime_experiment_prod`
- **Ne depolanır:** Ziyaretçilerin hangi A/B test varyasyonuna maruz kaldığını gösteren gösterim (exposure) verileri.
- **Admin Panel Okuma İşlemleri:** A/B test raporlarında hangi varyasyonun kazandığını belirlemek için sorgulanır.

---

## 🔑 Değişkenler, Gizli Anahtarlar ve API Token Tanımlamaları

Uygulamanın çalışması için gerekli ortam değişkenleri (environment variables) şu konumlarda tanımlanmalıdır:

### A. Cloudflare Pages Paneli (Production & Preview Ortamları)
1. **Workers & Pages** ➔ **[Pages Projeniz]** ➔ **Settings** ➔ **Environment variables** sayfasına gidin.
2. **Environment variables** başlığı altında hem **Production** hem de **Preview** ortamları için **Add variables** butonuna tıklayın.
3. Aşağıdaki değişkenleri tanımlayın:
   - `ADMIN_TOKEN` / `EKIN_ADMIN_TOKEN` / `NILUFER_ADMIN_TOKEN`: Yönetici doğrulama anahtarı (Şifrelenmiş/Secret yapılması önerilir).
   - `CF_ACCOUNT_ID`: Cloudflare Hesap ID'niz (Metin/String).
   - `CF_AE_API_TOKEN`: `Analytics Engine:Read` iznine sahip API anahtarı (Secret).
   - `EXPOSURE_TOKEN_SECRET`: A/B test trafik doğrulamasında kullanılan kriptografik anahtar (Secret).
   - `GA4_ID`: Google Analytics ölçüm kimliği (Örn: `G-XXXXXX`) (String).
   - `META_PIXEL_ID`: Meta Pixel kimlik numarası (String).
   - `CUSTOM_DOMAIN`: Dağıtıma bağlı ana alan adınız (Örn: `runtime.ekinyasa.online`) (String).

### B. Yerel Geliştirme Ortamı (Local Dev)
Projenizin ana dizininde `.dev.vars` adında bir dosya oluşturun veya düzenleyin (bu dosya Git yedeğine dahil edilmez). Değişkenleri `ANAHTAR=değer` formatında ekleyin:
```env
ADMIN_TOKEN=O+nAq0Kpgq+6zJsIdeU3JY...
CF_ACCOUNT_ID=ab0a0fd02766e5da...
CF_AE_API_TOKEN=cfut_LejbmxSy9OWlz...
EXPOSURE_TOKEN_SECRET=yerel_kripto_anahtarim
GA4_ID=G-DWCN82754X
META_PIXEL_ID=
CUSTOM_DOMAIN=localhost:8788
```

---

## 🚨 Kurtarma Prosedürü (Silinme Durumunda Yeniden Ekleme)

Eğer bu bağlantılardan veya veri tabanlarından biri silinirse, aşağıdaki adımlarla yeniden oluşturabilirsiniz:

### A. KV Namespaces (KV Alanları)
1. **Cloudflare Dashboard** paneline giriş yapın.
2. Sol menüden **Workers & Pages** ➔ **KV** sekmesine gidin.
3. **Create Namespace** butonuna tıklayarak ilgili adı girin (Örn: `SLUG_LINKS`).
4. **Workers & Pages** ➔ **[Pages Projeniz]** ➔ **Settings** ➔ **Functions** yolunu izleyin.
5. **KV Namespace Bindings** alanını bulun ve **Add Binding** butonuna tıklayın.
6. **Variable name** alanına tabloda belirtilen ismi birebir yazın (Örn: `SLUG_LINKS`), ardından az önce oluşturduğunuz KV alanını listeden seçerek **Save** butonuna tıklayın.

### B. Analytics Engine Datasets (AE Veri Setleri)
1. Sol menüden **Workers & Pages** ➔ **Analytics Engine** sekmesine gidin.
2. **Add Dataset** butonuna tıklayın. Veri seti adını üretim adı ile oluşturun (Örn: `cognilink_runtime_traffic_prod`).
3. **Workers & Pages** ➔ **[Pages Projeniz]** ➔ **Settings** ➔ **Functions** yolunu izleyin.
4. **Analytics Engine Bindings** alanını bulun ve **Add Binding** butonuna tıklayın.
5. **Variable name** alanına AE başlığında belirtilen ismi yazın (Örn: `AE_TRAFFIC`), **Dataset Name** alanına ise üretim veri seti adını yazıp (Örn: `cognilink_runtime_traffic_prod`) kaydedin.
