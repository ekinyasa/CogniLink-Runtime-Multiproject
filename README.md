# CogniLink — Campaign Attribution & A/B Engine (v17)

CogniLink is a high-performance, edge-native attribution engine designed for **dynamic campaign routing**, **A/B experimentation**, and **link-in-bio hubs**. 

Built on Cloudflare Workers/Pages, it handles 170+ Requests Per Second (RPS) with <10ms processing latency, providing a professional-grade alternative to traditional link management tools.

---

## 🏗 Architecture Overview

The system operates across three distinct logic layers to ensure maximum performance and data integrity.

### 1. Edge Routing (Public Path)
- **Technology:** Cloudflare Workers + KV.
- **Logic:** Resolves inbound aliases (e.g., `/sumrc-exp`) to the correct variant based on weighted probability.
- **Weight Persistence:** Reads from `AB_INDEX` (KV) for real-time traffic distribution.
- **Decided State:** When an experiment is "DECIDED," the router bypasses probabilistic logic to enforce a 100% winner lock-in.

### 2. Adaptive Bandit Engine (Decision Layer)
The "Brain" of the system that rebalances traffic based on performance.
- **Hybrid Sampling (v14):**
  - **Low Volume:** Uses Thompson Sampling (Beta Distribution) for exploration.
  - **High Volume (n > 500):** Switches to **Normal Approximation** (Central Limit Theorem) to avoid CPU timeouts on large datasets.
- **Performance:** Analyzes 70,000+ records in <10ms simulation time.

### 3. Resilient Route Compiler
The background sync mechanism that builds the flat routing index.
- **Skip & Proceed Logic:** If a campaign or alias has missing metadata, the compiler skips the entry instead of failing globally. This prevents unrelated errors (e.g., a missing 'silbeni' campaign) from blocking the entire router update.

---

## 📊 Analytics & Data Integrity

### Sampling-Aware SQL Logic
Cloudflare Analytics Engine (AE) uses sampling in high-traffic scenarios. CogniLink is built to handle this accurately:
- **`SUM(_sample_interval)`:** Every query for Traffic and Conversions uses the sample interval as a multiplier to extrapolate the true population totals.
- **Dataset Separation:** Traffic (`ae_traffic`) and Events (`ae_conversion`) are queried separately to ensure clean attribution without data leakage.

---

## 🛠 Operational Guide

### A/B Experiment Lifecycle
1. **DRAFT:** Create the experiment with variants and initial weights (e.g., 50/50).
2. **RUNNING:** Activate the experiment. Live traffic begins flowing.
3. **Update Bandit Weights:** Click this button in the Admin Panel to pull AE data and run the Thompson Sampling simulation. The engine will update KV weights (`AB_INDEX`) based on the latest conversion rates.
4. **DECIDED:** Once a winner is clear, click "Set Winner." The router will lock 100% of traffic to that variant.

---

## 🧪 Validation & Stress Testing

We have verified the system's performance and accuracy through rigorous stress testing.

### Dynamic Pivot Stress Test (v15)
- **Load:** ~170 Requests Per Second (RPS) for 7 minutes.
- **Scenario:** Rapid performance shift between variants.
- **Result:** Algoritma 60% → 50% → 40% adımlarıyla (step-wise) ağırlık kaydırarak yeni trende başarıyla adapte oldu.

### Winner Enforcement Audit (v17)
- **Check:** 200/200 raw log audit.
- **Result:** %100 Success. Once an experiment is decided, zero traffic leakage occurs to losing variants.

### Performance Metrics
- **Max Throughput:** 170+ Requests Per Second (RPS).
- **Simulation Latency:** <10ms for 70,000+ record sets.
- **Attribution Accuracy:** 100% deterministic (Link-level `utm_content`).

---

## 🔧 Troubleshooting

### 503 Service Unavailable (Timeout)
- **Cause:** CPU limit exceeded during 1000-trial Beta simulations on 50k+ data points.
- **Solution:** Switched to **Hybrid Sampling** (Normal Approximation) for large N and reduced trials to 400.

### 422 Unprocessable Entity (Compiler Block)
- **Cause:** A single missing campaign name in the registry used to crash the entire `compile-routes` process.
- **Solution:** Implemented **Skip & Proceed** logic. Broken metadata is logged and skipped, allowing the rest of the router to function normally.

---

## 📦 KV Namespaces & Bindings

| Binding | Purpose |
|---|---|
| `AB_INDEX` | A/B configurations and live weights |
| `LINKHUB_SLUGS` | Static slug records |
| `LINKHUB_CAMPAIGNS` | Official campaign registry |
| `ROUTE_ALIAS` | Compiled flat routing table (read by Edge) |

---

## 📜 Development
To run locally:
```bash
wrangler pages dev ./public --kv AB_INDEX --kv LINKHUB_SLUGS --kv LINKHUB_CAMPAIGNS --kv ROUTE_ALIAS
```

*Final Audit Status: v17.0.0 — Certified for High Volume Production Usage.*
