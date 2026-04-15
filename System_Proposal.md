# CogniLink v17: The Campaign Attribution & A/B Engine

## 1. System Definition
CogniLink is a professional, high-performance, edge-native routing engine designed for **dynamic campaign attribution**, **A/B experimentation**, and **high-traffic link redirection**. Built to run entirely on the Cloudflare Workers/Pages global edge network, it offers <1ms routing overhead and handles 170+ Requests Per Second (RPS) with deterministic accuracy and zero data leakage.

## 2. Technical Architecture & Key Features

### 🧩 Layered Edge Routing
- **Public Path:** Inbound aliases (e.g., `/sumrc-exp`) are resolved in real-time by a flat, high-speed routing index (`ROUTE_ALIAS`).
- **Probabilistic Logic:** Weighted traffic distribution is computed on-the-fly for experiments in the `RUNNING` state.
- **Winner Enforcement:** Once an experiment is `DECIDED`, the engine bypasses probabilistic logic to lock 100% of traffic to the winner, ensuring zero-latency and 100% enforcement.

### 🧠 Adaptive Bandit Engine (v14+)
The decision-making brain of the system, optimizing weights based on real-time performance.
- **Hybrid Sampling Strategy:**
  - **Low Volume (Explore):** Uses **Thompson Sampling** (Beta Distribution) for deep statistical exploration when data is sparse.
  - **High Volume (Efficient):** Automatically switches to **Normal Approximation** (Central Limit Theorem) for datasets > 500 records. This saves 90% of CPU cycles, preventing 503 Worker Timeouts on large tests (e.g., 70k+ records).
- **Processing Power:** Capable of analyzing massive AE datasets in <10ms simulation time.

### 🛡 Resilient Route Compiler
The background sync mechanism that builds the routing index.
- **Fault-Tolerance ("Skip & Proceed"):** Decouples the routing build from metadata errors. If a specific campaign alias (e.g., 'silbeni') is missing or broken in the registry, the compiler logs the skip and proceeds with the rest of the build. This ensures that weight updates for healthy experiments are never blocked by unrelated config issues.

### 📊 Sampling-Aware Analytics
Integration with **Cloudflare Analytics Engine (AE)** for real-time telemetry.
- **Accurate Population Estimation:** Uses `SUM(_sample_interval)` to correctly extrapolate total Traffic and Conversions even when Cloudflare is sampling heavily.
- **Partitioned Fetching:** Separates traffic (`ae_traffic`) and conversion (`ae_conversion`) datasets to prevent attribution collisions and ensure 100% data integrity.

### 🍱 Modernized Operator UI
- **Unified Terminology:** Aligned all panels to a single standard: **TRAFFIC** (Views) vs. **CLICKS** (Interactions) for absolute clarity.
- **Active Experiments Grid:** A dynamic 3+1 grid system with "Show All/Less" toggles, sorted by `created_at` (DESC) for maximum visibility of recent work.
- **Real-Time Visibility:** Displays `simulation_ms` and confidence levels during manual bandit triggers.

---

## 3. Performance Metrics (v17 Certified)
- **Max Throughput:** 170+ Requests Per Second (RPS).
- **Database Scalability:** Cursored KV pagination handles thousands of experiments without hardcoded limits.
- **Decision Speed:** Adaptive logic processes 70k+ records within the tight 10ms-50ms Workers CPU windows.

---
---

# CogniLink v17: Kampanya İlişkilendirme ve A/B Motoru

## 1. Sistem Tanımı
CogniLink; **dinamik kampanya yönlendirmesi**, **A/B testleri** ve **yüksek trafikli link yönetimi** için tasarlanmış profesyonel, edge-native bir yönlendirme motorudur. Tamamen Cloudflare Workers/Pages global edge ağında çalışan sistem, <1ms işlem gecikmesiyle saniyede 170'den fazla isteği (RPS) %100 doğruluk ve sıfır veri sızıntısı ile yönetebilir.

## 2. Teknik Mimari ve Temel Özellikler

### 🧩 Katmanlı Edge Yönlendirme (Edge Routing)
- **Public Path:** Gelen kısa linkler (örn: `/sumrc-exp`), yüksek hızlı düz bir yönlendirme indeksi (`ROUTE_ALIAS`) üzerinden anında çözümlenir.
- **Olasılıksal Mantık:** `RUNNING` durumundaki deneyler için ağırlıklı trafik dağılımı çalışma anında (on-the-fly) hesaplanır.
- **Winner Enforcement:** Bir deney `DECIDED` (Karar Verildi) durumuna geçtiğinde, motor olasılıksal mantığı baypas ederek trafiği %100 oranında kazanana kilitler.

### 🧠 Adaptive Bandit Engine (v14+)
Sistemin karar verme mekanizmasıdır ve performansa göre ağırlıkları optimize eder.
- **Hibrit Örnekleme Stratejisi:**
  - **Düşük Hacim (Explore):** Veri kısıtlıyken derin istatistiksel keşif için **Thompson Sampling** (Beta Dağılımı) kullanır.
  - **Yüksek Hacim (Efficient):** 500+ kayıtlı veri setlerinde otomatik olarak **Normal Yakınsama** (Merkezi Limit Teoremi) moduna geçer. Bu, CPU döngülerini %90 oranında tasarruf ederek 70k+ kayıtlı devasa testlerde Workers CPU limiti nedeniyle oluşan "503 Timeout" hatalarını kalıcı olarak çözer.
- **İşlem Gücü:** Muazzam AE veri setlerini <10ms simülasyon süresinde analiz etme kapasitesine sahiptir.

### 🛡 Dayanıklı Router Derleyici (Resilient Route Compiler)
Yönlendirme indeksini inşa eden arka plan senkronizasyon mekanizmasıdır.
- **Hata Toleransı ("Skip & Proceed"):** İndeks inşasını meta-veri hatalarından ayırır. Eğer bir kampanya (örn: 'silbeni') eksik veya bozuksa, derleyici bunu loglayıp atlar ve geri kalan inşaya devam eder. Bu, sağlam deneylerin ağırlık güncellemelerinin alakasız hatalar tarafından engellenmesini (422 Blockage) önler.

### 📊 Sampling-Aware Analitik
Gerçek zamanlı telemetri için **Cloudflare Analytics Engine (AE)** entegrasyonu.
- **Doğru Popülasyon Hesaplama:** Cloudflare'in yoğun trafik altında yaptığı örneklemeyi telafi etmek için `SUM(_sample_interval)` formülünü kullanır. 
- **Parçalı Veri Çekme:** Trafik (`ae_traffic`) ve Dönüşüm (`ae_conversion`) setlerini ayrı ayrı sorgulayarak ilişkilendirme çakışmalarını önler ve %100 veri bütünlüğü sağlar.

### 🍱 Modernize Edilmiş Operatör Arayüzü
- **Birleşik Terminoloji:** Tüm paneller tek bir standarda çekilmiştir: **TRAFFIC** (Görüntüleme) vs. **CLICKS** (Tıklama).
- **Dinamik Grid Sistemi:** "Tümünü Göster/Gizle" özellikli, son yaratılan deneyleri (`created_at`) en üstte gösteren modern 3+1 grid yapısı.
- **Gerçek Zamanlı İzleme:** Manuel bandit tetiklemeleri sırasında `simulation_ms` (simülasyon süresi) ve güven düzeylerini anlık olarak raporlar.

---

## 3. Performans Metrikleri (v17 Onaylı)
- **Maksimum Kapasite:** Saniyede 170+ İstek (RPS).
- **Veritabanı Ölçeklenebilirliği:** Cursored KV sayfalama sayesinde binlerce deneyi limitlere takılmadan yönetir.
- **Karar Hızı:** Adaptive mantık sayesinde 70k+ kayıtlı veri setlerini milisaniyeler içinde işler.

---
*Son Denetim Durumu: v17.0.0 — Yüksek Hacimli Üretim Kullanımı İçin Sertifikalandırılmıştır.*
