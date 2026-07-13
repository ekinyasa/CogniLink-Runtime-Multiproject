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

## 🔑 Required Credentials & Settings

To allow querying and writing to the Analytics Engine, the following variables must be configured in your Cloudflare Pages Dashboard environment:
- `CF_ACCOUNT_ID`: Your Cloudflare Account ID (needed to access the SQL Endpoint at `https://api.cloudflare.com/client/v4/accounts/.../analytics_engine/sql`).
- `CF_AE_API_TOKEN`: Cloudflare API Token carrying `Analytics Engine:Read` permissions.
- `ADMIN_TOKEN` / `EKIN_ADMIN_TOKEN` / `NILUFER_ADMIN_TOKEN`: Tokens for API administrative access validation.

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
