# Analytics Engine (AE) Data Flow & Testing Guide

This document defines how CogniLink records and reads performance telemetry.

## 1. Datasets & Events Mapping

### AE_TRAFFIC (Dataset: `ae_traffic_${env}`)
Focused on arrivals and routing. **Consolidated to 1 write per hit.**

| Event Name (`index1`) | Occurrence | Blobs Mapping | Use Case |
| :--- | :--- | :--- | :--- |
| **`traffic_memory`** | Every public alias hit | `blob1`: Alias<br>`blob2`: Slug (Final)<br>`blob4`: Campaign<br>`blob5`: UTM Source<br>`blob6`: UTM Medium<br>`blob7`: Request ID<br>`blob8`: Metadata (JSON) | Primary traffic stats, recent events table, and source attribution. |

### AE_CONVERSION (Dataset: `ae_conversion_${env}`)
Focused on the experiment funnel and conversion pipeline.

| Event Name (`index1`) | Occurrence | Blobs Mapping | Use Case |
| :--- | :--- | :--- | :--- |
| **`exposure`** | Bucket assignment | `blob1`: Alias<br>`blob2`: Variant Slug | A/B test denominator. |
| **`click`** | Hub link click | `blob1`: Alias<br>`blob2`: Variant Slug<br>`blob3`: Source | CTR tracking in experiments. |
| **`conversion`** | Lead/Sale event | `blob1`: Campaign<br>`blob5`: Event Name | ROI/Success tracking. |

---

## 2. Read/Write Flow

```mermaid
graph TD
    A[Visitor] -->|GET /alias| B[Worker: [[path]].js]
    B -->|resolveAlias| C{Routing}
    C -->|Success| D[AE_TRAFFIC: traffic_memory]
    D --> E[Render Hub HTML]
    
    E -->|Click Link| F[api/convert.js]
    F -->|Log Click| G[AE_CONVERSION: click]
    
    H[Admin Dashboard] -->|api/admin/analytics| I[AE SQL Query]
    I -->|Read traffic_memory| H
    I -->|Read AE_CONVERSION| H
```

---

## 3. High-Traffic Stress Testing Guidelines (k6/Gemini)

To get accurate results during 100+ RPS stress tests, follow these rules:

### A. Canonical URLs (Avoid Redirects)
The system enforces `HTTPS` and `WWW`. If your test hits `http://example.com/alias`, the Worker will return a `301 Redirect`, doubling the latency and potentially causing `k6 Check` failures.
- **Rule**: Always target `https://www.yourdomain.com/alias` directly.

### B. Bot Mitigation & IP Throttling
Cloudflare Workers and Managed Rules may throttle rapid requests from a single IP.
- **Rule**: If possible, use k6's distributed load or ensure the test IP is whitelisted in Cloudflare WAF during the test period.
- **Rule**: Set a unique `User-Agent` (e.g., `k6-stress-test`) to easily filter out test data in the dashboard.

### C. AE Ingestion Buffer (700ms)
Analytics Engine has an ingestion lag of approximately 700ms - 2s.
- **Rule**: Do not query the dashboard immediately after the test stops. Wait 5-10 seconds to ensure all events are indexed.

### D. Single-Write Verification
After a 10k request run, use the SQL console:
```sql
SELECT index1, COUNT() FROM ae_traffic_dev WHERE timestamp > now() - INTERVAL '15' MINUTE GROUP BY index1
```
- **Expectation**: `traffic_memory` count should exactly match your k6 request count. `alias_click` and `route_resolved` should be 0 (for new traffic).
## A/B Test & Conversion Testing Guidelines

### 1. Triggering Metrics (Manual Testing)

| Metric | Action | Analytics Event |
| :--- | :--- | :--- |
| **Exposure** | Visit alias: `https://[domain]/[alias]` | `traffic_memory` (ab_active: 1) |
| **Hub Click** | Click any button on the Hub page | `traffic_memory` (event_type: hub_link_click) |
| **Conversion** | Call `/api/convert` (see below) | `counter` (event: conversion) |

#### How to Trigger Conversion (curl)
To test a conversion for an active experiment, use the following payload. 
> [!IMPORTANT]
> if `EXPOSURE_TOKEN_SECRET` is configured, you **must** include the `exp_token` found in the landing page URL.

```bash
curl -X POST https://dev.ekinyasa.online/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "event": "purchase",
    "experiment": "your-alias",
    "variant": "target-slug",
    "exp_token": "VALID_TOKEN_FROM_URL"
  }'
```

---

### 2. Epsilon Movement (Traffic Shifting)

The system automatically shifts traffic from underperforming variants to winners (Exploitation).

#### Rebalance Thresholds
- **Minimum Volume**: Rebalancing only triggers after the experiment reaches **500 total exposures**.
- **Probabilistic Trigger**: A rebalance check happens automatically with a **1/500 probability** on every visit (to stay lightweight).
- **Manual Trigger**: Admins can force a rebalance by hitting `POST /api/experiment/bandit-update` with an admin token.

#### How to Simulate a Traffic Shift
1.  **Generate Baseline**: Send 600 visits to the alias (300 to Variant A, 300 to Variant B).
2.  **Generate Winner**: For Variant B, trigger 20 conversions using the curl above. For Variant A, trigger 0.
3.  **Trigger Rebalance**: Perform ~100 more visits or run the `bandit-update` cron.
4.  **Observe**: In the Admin "A/B Routing" tab, you will see Variant B's weight increase (e.g., from 50% to 80%).
