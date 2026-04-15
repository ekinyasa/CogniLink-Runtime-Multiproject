

# Prompt 50 — Campaign OS System Presentation for Production-Cut Planning

Goal: before implementing the next production-cut prompts, produce a compact but precise system presentation of the CURRENT Campaign OS architecture so future prompts can extend the system safely without breaking routing, attribution, or experiment behavior.

This is not a redesign prompt.
This is not a refactor prompt.
This is a SYSTEM UNDERSTANDING prompt.

You must inspect the existing codebase and summarize how the live system currently works.

We are preparing the next production-cut phase and want to avoid blind prompting.

---

## Production-Cut Scope We Are Planning Toward

The next likely production-cut prompts are:

1. Experiment router extraction
2. Exposure token system
3. Experiment lifecycle cleanup
4. Bandit cron scheduler

Do NOT implement these yet.
First, map the current system so those prompts can be written accurately.

---

## What You Must Produce

Create a structured architecture presentation of the CURRENT system.

Your output must be written for an engineer who already knows the product goals, but needs a trustworthy map of the code before modifying core behavior.

Be concrete.
Use actual file names, actual functions, actual endpoints, actual KV keys, and actual control flow found in the repo.

Do not give vague summaries like “there is some routing logic” or “there seems to be analytics handling.”

---

## Required Output Sections

### 1. Entry Points

List the real entry points involved in campaign routing / experiment routing / conversion ingestion / bandit updates / admin reads.

For each one, include:
- file path
- route / endpoint
- purpose
- major downstream modules it calls

We especially want the real entry points for:
- public alias routing
- experiment variant routing
- `/api/convert`
- `/api/experiment/bandit-update`
- admin experiment read endpoints

---

### 2. Routing Flow Map

Explain the real runtime flow for a public experiment request.

Example target question:

When someone visits:
`/abrand45`

what exact code path runs?

Show step-by-step:
- alias lookup
- campaign resolution
- experiment detection
- variant selection
- hub render or redirect behavior
- exposure recording
- any requestId generation / fingerprinting / bucketing logic

If multiple routing layers exist, separate them clearly.

Important:
Identify exactly where deterministic experiment allocation currently happens.

---

### 3. Determinism Source

We already validated that the router behaves deterministically within a stable browser session.
Now identify HOW that determinism is currently achieved in code.

Answer precisely:
- what identifier is used for bucketing?
- where does it come from?
- is it from cookie, query param, header, generated ID, localStorage, fingerprint, or other?
- where is it persisted, if anywhere?
- what causes the same user to keep seeing the same variant?

If the answer is “it is not explicitly persisted and determinism comes from X”, say that clearly.

Do not speculate. Trace the code.

---

### 4. Exposure Recording Flow

Explain exactly how exposures are currently counted.

We need:
- where exposure increment happens
- whether it happens on page render, variant resolve, click, or another event
- what dimensions are written with it
- whether exposure is deduplicated or not
- whether a refresh increments again
- whether there is already any token / guard / signature logic

This section is critical because we are considering an exposure-token architecture next.

---

### 5. Conversion Flow

Explain exactly how `/api/convert` works right now.

We need:
- request payload shape
- validation behavior
- whether experiment and variant are verified against config
- whether exposure is required before conversion
- whether duplicate conversion protection exists
- what gets written to Analytics Engine / KV / elsewhere
- whether workspace is involved

If any integrity gaps exist, list them plainly.

---

### 6. Experiment Config Structure

Show the actual experiment config structure as it exists now.

Use a real example shape from the codebase (sanitized if needed), including fields like:
- alias
n- state / status
- variants
- weights
- alpha / beta
- winner fields
- shard_count
- timestamps
- anything else materially used

Also explain:
- where config is read from
- where config is written back
- which fields are routing-authoritative vs metadata-only

Important:
Call out explicitly that `variant.weight` is now the routing authority, if that is indeed what the code shows.

---

### 7. Bandit Learning Flow

Explain the full current learning loop:
- where exposures are read from
- where conversions are read from
- how alpha / beta are computed
- where Thompson sampling runs
- how weights are normalized
- where floor enforcement happens
- how updated config is persisted

Also confirm whether:
- router uses alpha/beta at request time (it should not)
- only bandit-update changes weights

---

### 8. Workspace / Namespace Model

Document the current workspace architecture as actually implemented.

We need:
- whether workspace is already active in routing paths
- how keys are namespaced
- whether experiments are isolated by workspace yet
- whether admin reads / writes are workspace-aware

If workspace exists only partially, say exactly where.

---

### 9. Current Production-Cut Risks

After mapping the system, list the top production-cut risks relevant to ONLY these four planned prompts:

1. Experiment router extraction
2. Exposure token system
3. Experiment lifecycle cleanup
4. Bandit cron scheduler

For each risk, include:
- why it matters
- which files/modules it touches
- what must not be broken

Keep this practical.
No generic advice.

---

### 10. Prompt Readiness Notes

End with a short section:

`What the next prompt writer now knows`

Summarize the concrete facts that are now safe to use when writing Prompt 49 / 50 / 51 / 52.

---

## Output Rules

- Do NOT implement code changes.
- Do NOT propose a redesign unless directly necessary to explain a risk.
- Do NOT invent missing architecture.
- If something is unclear, say exactly which file or flow is ambiguous.
- Prefer accuracy over elegance.
- Keep the output structured and engineering-grade.

---

## Why This Prompt Exists

Campaign OS is already working.
The next phase is not about cleverness; it is about safe production-cut hardening.
We want to inspect the real system first, then prompt changes that fit the actual architecture.

Treat this as an architecture reconnaissance pass for the next four production prompts.

---

# Campaign OS — Architecture Presentation
*Produced by Prompt 50. Code-traced, no speculation.*

---

## 1. Entry Points

### Public alias routing
**File:** `functions/[[path]].js`
**Route:** `GET /<alias>` or `GET /<alias>/<modifier>`
**Purpose:** Catch-all public handler — resolves alias to canonical slug, runs A/B routing, renders hub HTML.
**Downstream calls:**
- `parsePath()` + `resolveAlias()` → `alias-router.js`
- `loadABConfig()` + `selectABVariant()` + `getExpState()` → `ab-router.js`
- `incrementExpCounter()` → `exp-counter.js`
- `readCookie()` / `buildSetCookie()` → `cookie-utils.js`
- `loadHubConfig()` + `loadGlobalConfig()` → `alias-router.js` + KV
- `resolveLinks()` → `links.js`
- `renderHub()` → `hub-renderer.js`
- `emitOps()` → `ops-telemetry.js`

### Experiment variant routing (embedded in above)
**File:** `functions/_shared/ab-router.js`
**Route:** N/A (library module called by `[[path]].js`)
**Purpose:** Load and validate A/B config; deterministic bucket selection.
**Downstream calls:**
- `ALIAS_REGISTRY.get("ab_config:<alias>")` — KV read (or in-memory cache hit)
- `cacheGet()` / `cacheSet()` → `kv-cache.js`

### Conversion ingestion
**File:** `functions/api/convert.js`
**Route:** `POST /api/convert`
**Purpose:** Increment conversion counter for a named experiment+variant. No authentication.
**Downstream calls:**
- `loadABConfig()` → `ab-router.js`
- `LINKHUB_CAMPAIGNS.get(expAlias)` — fallback alias resolution
- `incrementExpCounter(env, resolvedAlias, expVariant, "conversion")` → `exp-counter.js`

### Bandit weight update
**File:** `functions/api/experiment/bandit-update.js`
**Route:** `POST /api/experiment/bandit-update`
**Purpose:** Read counters, compute Beta posteriors, run Thompson sampling (N=200 draws), write new weights to KV. Also triggers auto-archive on inactivity.
**Downstream calls:**
- `getExpCounters()` → `exp-counter.js` (reads all shards)
- `computeBanditWeights()` → `bandit.js`
- `ALIAS_REGISTRY.put("ab_config:<alias>", ...)` — KV write
- `cacheDelete("ab_cfg:<alias>")` → `kv-cache.js` — in-memory cache invalidation

### Admin experiment reads
**File:** `functions/api/experiments.js`
**Route:** `GET /api/experiments?alias=<alias>`
**Purpose:** Aggregate counter data + winner detection + lift calculation. Side effect: auto-persists winner to KV when first detected (fire-and-forget).
**Downstream calls:**
- `loadABConfig()` → `ab-router.js`
- `getExpCounters()` → `exp-counter.js`
- `persistDetectedWinner()` (internal) → `ALIAS_REGISTRY.put(...)` via `context.waitUntil()`

**File:** `functions/api/ab.js`
**Route:** `GET /api/ab?alias=<alias>`, `PUT /api/ab`, `DELETE /api/ab?alias=<alias>`
**Purpose:** Raw A/B config CRUD (admin-only). PUT validates alias against ALIAS_REGISTRY and each variant slug against LINKHUB_SLUGS.
**Downstream calls:**
- `validateABConfig()` → `ab-router.js`
- `ALIAS_REGISTRY.get/put/delete("ab_config:<alias>")`
- `cacheDelete()` → `kv-cache.js`

---

## 2. Routing Flow Map

**Request:** `GET /abrand45`

**Step 1 — `[[path]].js` receives request**
```
requestId = request.headers.get("cf-ray") || crypto.randomUUID()
```

**Step 2 — Path parsing**
```
parsePath("/abrand45") → { alias: "abrand45", modifier: null }
```

**Step 3 — Alias resolution (`resolveAlias` in `alias-router.js`)**
```
buildRouteKey("abrand45", null) → "abrand45"
routeCacheGet("abrand45")       → Workers Cache lookup (edge CDN)
  HIT  → return cached canonicalSlug
  MISS → ROUTE_TABLE.get("route:abrand45", { type: "text" }) → "ab-rand-45-igbio"
         routeCacheSet("abrand45", "ab-rand-45-igbio", env)  (fire-and-forget)
```

**Step 4 — Back in `[[path]].js`: A/B routing**
```
loadABConfig("abrand45", env)
  → cacheGet("ab_cfg:abrand45")           (in-memory, 60s TTL)
  → ALIAS_REGISTRY.get("ab_config:abrand45", { type: "json" })  on miss

getExpState(abConfig) → "RUNNING"
```

**Step 5 — Variant selection (RUNNING path)**
```
cookieName    = "exp_abrand45"
cookieVariant = readCookie(request, "exp_abrand45")

IF cookieVariant in validSlugs:
  finalSlug     = cookieVariant         // returning visitor
  newAssignment = false

ELSE:
  finalSlug     = selectABVariant(abConfig, requestId)
                  → hex    = last 8 hex chars of cf-ray
                  → bucket = parseInt(hex, 16) % 100
                  → walk variants by cumulative weight → return slug
  newAssignment = true
```

**Step 6 — Counter increment**
```
context.waitUntil(
  incrementExpCounter(env, "abrand45", finalSlug, "exposure")
)
// fire-and-forget, does not block response
```

**Step 7 — Hub config + render**
```
[hubConfig, globalConfig] = await Promise.all([
  loadHubConfig(finalSlug, env, ttlMs),  // HUB_CONFIG["hub:<slug>"] or LINKHUB_SLUGS fallback
  loadGlobalConfig(env, ttlMs),           // LINKHUB_CONFIG["hub_config"]
])
renderHub({ ..., utm_experiment: "abrand45", utm_variant: finalSlug, ... })
```

**Step 8 — Response**
```
Set-Cookie: exp_abrand45=<slug>; Path=/; Max-Age=2592000; SameSite=Lax; Secure
Cache-Control: no-store  (when newAssignment = true)
```

**Where deterministic experiment allocation happens:**
`selectABVariant()` in `ab-router.js`, called from `[[path]].js` line ~304. It is purely a function of `abConfig.variants[].weight` and `requestId`. No KV read, no external state.

---

## 3. Determinism Source

**Identifier used for bucketing:** `cf-ray` header (`request.headers.get("cf-ray")`) or `crypto.randomUUID()` fallback for local dev.

**Where it comes from:** Assigned by Cloudflare's edge network per request. Changes on every new request.

**Is it persisted?** No. `cf-ray` is not stored anywhere.

**How does the same user keep seeing the same variant?**

Via cookie. On first visit:
```
selectABVariant(abConfig, cfRay) → slug
Set-Cookie: exp_<alias>=<slug>; Max-Age=2592000; Secure; SameSite=Lax
```

On return visits:
```
readCookie(request, "exp_" + alias) → slug  (O(1), no KV read)
```
Cookie survives 30 days. If the cookie is absent or the stored slug is no longer in the valid variants list, a fresh bucket assignment is made using the current cf-ray.

**What causes determinism:** The cookie, not cf-ray.
cf-ray is a random number source for initial assignment. It is uniformly distributed across buckets (`% 100`) which produces the desired weighted distribution, but it is not a stable per-user identifier.

**Summary:** The system is sticky within a browser session via a first-party cookie. It is NOT deterministic across browsers, devices, or incognito sessions. There is no fingerprinting, no user ID, and no server-side session.

---

## 4. Exposure Recording Flow

**Where:** `functions/[[path]].js`
```js
context.waitUntil(incrementExpCounter(env, alias, finalSlug, "exposure"));
```

**When:** After variant selection, gated on experiment state:
- `RUNNING` → counter increments ✓
- `PAUSED` → counter does NOT increment (explicit guard: `if (expState !== "PAUSED")`)
- `DECIDED` → counter does NOT increment (decided fast-path bypasses counter block entirely)
- `ARCHIVED` → counter does NOT increment (archived fast-path bypasses counter block entirely)
- `DRAFT` → counter does NOT increment (DRAFT branch is a no-op)

**What is written:**
```
Key:   exp:<alias>:<slug>:exposure:<shard>   (shard = Math.floor(Math.random() * 10))
Value: String(current + 1)
```
Dimensions stored: alias, slug, type. No timestamp. No requestId. No session ID.

**Deduplication:** None. Every page render increments. A page refresh increments again.

**Existing token/guard logic:** None. There is no exposure token, no idempotency key, no deduplication mechanism of any kind.

**KV write pattern:** Read-modify-write (not atomic). Sharded across 10 keys per metric to reduce hot-key contention. Occasional race condition at high traffic is accepted by design.

---

## 5. Conversion Flow

**Endpoint:** `POST /api/convert`
**Authentication:** None (public endpoint, no `Authorization` header required)

**Request payload:**
```json
{ "event": "signup", "experiment": "abrand45", "variant": "ab-rand-45-igbio" }
```
- `event` — string, logged only, not written to KV or Analytics Engine
- `experiment` — A/B alias (or campaign name as fallback)
- `variant` — variant slug

**Validation steps:**
1. JSON parse — 400 on failure
2. `experiment` and `variant` must be non-empty strings — 400 if missing
3. `experiment` must pass `validateAlias()` (format: `[a-z0-9-]{1,48}`) — 400 if invalid
4. `loadABConfig(expAlias, env)` — must return non-null config — 404 if not found
5. Fallback: if config is null, try `LINKHUB_CAMPAIGNS.get(expAlias)` → get `alias` field → retry `loadABConfig(resolvedAlias, env)`
6. `variant` must be in `abConfig.variants.map(v => v.slug)` — 404 if not found

**What gets written:**
```
incrementExpCounter(env, resolvedAlias, expVariant, "conversion")
Key: exp:<alias>:<slug>:conversion:<shard>
```
Written via `context.waitUntil()` — fire-and-forget, does not block 204 response.

**What does NOT happen:**
- `event` is only `console.log`'d — not written to Analytics Engine, not stored in KV
- No Analytics Engine write at all
- No workspace involvement

**Integrity gaps (current state):**
1. **No prior exposure required.** A landing page can call `/api/convert` for any valid experiment+variant without that user ever having been exposed. No server-side linkage between exposure and conversion.
2. **No duplicate protection.** Same client can call `/api/convert` multiple times and each call increments the counter independently.
3. **Public endpoint.** Any actor who knows a valid alias+variant can inflate conversion counters. The only guard is alias/variant format validation against live config.
4. **Event field is discarded.** The `event` parameter is accepted in the payload but has zero effect on routing, counting, or analytics writes.

---

## 6. Experiment Config Structure

**KV namespace:** `ALIAS_REGISTRY`
**KV key:** `ab_config:<alias>`

**Current full config shape:**
```json
{
  "variants": [
    {
      "slug":   "ab-rand-45-igbio",
      "weight": 65,
      "alpha":  8,
      "beta":   3
    },
    {
      "slug":   "ab-rand-45b-igbio",
      "weight": 35,
      "alpha":  2,
      "beta":   7
    }
  ],
  "state":          "RUNNING",
  "status":         "open",
  "winner":         null,
  "shard_count":    10,
  "created_at":     1704067200,
  "decided_at":     null,
  "archived_at":    null,
  "last_active_at": 1704067200,
  "stats_snapshot": {
    "total_exposures":   450,
    "total_conversions": 32,
    "variants": [
      { "slug": "ab-rand-45-igbio",  "exposures": 280, "conversions": 22, ... },
      { "slug": "ab-rand-45b-igbio", "exposures": 170, "conversions": 10, ... }
    ],
    "snapshotted_at": "2024-01-15T12:00:00.000Z"
  },
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

**Routing-authoritative fields:**

| Field | Role |
|-------|------|
| `variant.weight` | **SOLE routing authority.** Router bucket walks cumulative weights. |
| `state` | Lifecycle filter. Controls whether routing runs at all and which fast-path applies. |
| `winner` | Routing target when state is `DECIDED` or `ARCHIVED`. |

**Metadata-only fields (never read by router):**

| Field | Written by |
|-------|-----------|
| `variant.alpha` / `variant.beta` | `bandit-update.js` — for admin UI and learning only |
| `status` | `experiments.js` (auto-persist) — simplified two-state legacy field |
| `decided_at` / `archived_at` / `last_active_at` | Lifecycle transitions + bandit-update |
| `stats_snapshot` | `bandit-update.js` — frozen counter snapshot |
| `shard_count` | `ab.js` PUT — tells counter reader how many shards to aggregate |

**`variant.weight` is the routing authority.** Code confirmation in `ab-router.js`:
```js
// "Routing authority: variant.weight only.
//  alpha/beta fields ... are explicitly ignored here"
export function selectABVariant(config, requestId) {
  const hex    = String(requestId || "").replace(/[^0-9a-f]/gi, "").slice(-8) || "0";
  const bucket = parseInt(hex, 16) % 100;
  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.weight;   // ← ONLY weight is used
    if (bucket < cumulative) return variant.slug;
  }
  ...
}
```

**Config writers (all write `ALIAS_REGISTRY.put("ab_config:<alias>", ...)`):**

| Who | What changes |
|-----|-------------|
| `PUT /api/ab` | Full create/replace (variants, state=DRAFT for new, preserve for existing) |
| `POST /api/experiment/activate` | `state: RUNNING`, stamps `created_at` |
| `POST /api/experiment/pause` | `state: PAUSED` |
| `POST /api/experiment/resume` | `state: RUNNING` |
| `POST /api/experiment/archive` | `state: ARCHIVED`, stamps `archived_at` |
| `POST /api/experiment/promote` | `state: ARCHIVED`, preserves `winner` |
| `POST /api/experiment/bandit-update` | `variants[].weight`, `variants[].alpha/beta`, `last_active_at`, `stats_snapshot` — or full archive |
| `GET /api/experiments` (side-effect) | `state: DECIDED`, `winner`, `decided_at` — fire-and-forget |

---

## 7. Bandit Learning Flow

**Full loop (triggered by `POST /api/experiment/bandit-update`):**

**Step 1 — Load current config (bypass in-memory cache)**
```js
existing = await env.ALIAS_REGISTRY.get("ab_config:<alias>", { type: "json" })
```
Only runs if `getExpState(existing) === "RUNNING"`. Returns 400 for any other state.

**Step 2 — Read counters**
```js
getExpCounters(env, alias, slugs, shardCount)
```
Reads: legacy unsharded key + 10 shards per metric per variant.
Total KV reads: `N_variants × 3 metrics × (10 shards + 1 legacy)` = `2 × 3 × 11 = 66` reads for a 2-variant experiment — all parallel via `Promise.all`.

**Step 3 — Compute Beta posteriors**
```js
alpha = conversions + 1                      // Jeffreys uninformative prior
beta  = Math.max(exposures - conversions, 0) + 1
```
Stored into `variantsWithPosterior` array.

**Step 4 — Thompson sampling (in `bandit.js`)**
```js
computeBanditWeights(variantsWithPosterior, EXPLORATION_FLOOR_PCT=5, draws=200)
```
- N=200 Beta draws per variant, averaged → stable expected-value estimate
- Exploration floor: `floor = max(1, min(5, floor(100/N)))` — min 5% per variant
- Budget = `100 - floor * N` distributed proportionally to averaged samples
- Largest-remainder method converts floats to integers that sum exactly to 100

**Step 5 — Auto-archive check**
If `!hasNewActivity && inactiveSecs > 14 * 86400`:
- Archives immediately (writes `state: ARCHIVED` + `stats_snapshot`)
- Returns 200 with `{ auto_archived: true }`
- Does NOT compute new weights

**Step 6 — Write updated config**
```js
ALIAS_REGISTRY.put("ab_config:<alias>", JSON.stringify({
  ...existing,
  variants:       updatedVariants,   // slug, weight, alpha, beta
  last_active_at: now,
  stats_snapshot: { total_exposures, total_conversions, variants: counters, ... },
  updatedAt:      new Date().toISOString(),
}))
cacheDelete("ab_cfg:<alias>")  // immediate in-memory cache invalidation
```

**Step 7 — Router picks up**
Next request to `loadABConfig("abrand45", env)` finds cache empty → reads fresh KV record → new weights take effect. Lag ≤ 60s (one cache TTL window).

**Confirmed:**
- Router does NOT read `alpha/beta` at request time ✓ (confirmed in `selectABVariant()`)
- Only `bandit-update.js` changes weights ✓ (all other writers preserve existing `variants[]`)

---

## 8. Workspace / Namespace Model

**Current status: workspace isolation does NOT exist anywhere in the routing or experiment paths.**

| Component | Workspace-aware? |
|-----------|-----------------|
| ALIAS_REGISTRY KV keys | No — global flat namespace |
| ROUTE_TABLE KV keys | No — `route:<alias>` |
| HUB_CONFIG KV keys | No — `hub:<slug>` |
| exp counter keys | No — `exp:<alias>:<slug>:<type>:<shard>` |
| `GET /api/experiments` | No — reads by alias only |
| `PUT /api/ab` | No — no workspace field |
| `POST /api/experiment/*` | No — no workspace field |
| `POST /api/convert` | No — no workspace field |
| Admin panel | No — lists all experiments globally |

The KV namespace bindings themselves (`ALIAS_REGISTRY`, `LINKHUB_CAMPAIGNS`, etc.) could serve as workspace-level isolation if separate bindings per workspace were introduced, but that is not the current architecture.

`CAMPAIGN_REGISTRY` binding exists in `wrangler.toml` and is bound in production, but is not referenced in any routing, experiment, or counter code that was inspected. Its role is not currently visible in the production path.

`functions/nilufer/` and `functions/nilufer/campaign/[campaign].js` are brand-specific routes but do not introduce workspace isolation — they are dedicated path handlers, not a multi-tenant model.

---

## 9. Current Production-Cut Risks

### Risk 1 — Experiment Router Extraction

**Why it matters:** The A/B routing block in `[[path]].js` (lines 229–322) is the only place where state-gated variant selection, sticky cookie logic, and counter emission are co-located. Extracting it requires moving all three without breaking their sequencing.

**Files it touches:**
- `functions/[[path]].js` — source of extraction
- New file (e.g., `functions/_shared/exp-router.js`) — extraction target
- `functions/_shared/ab-router.js` — already extracted; new module would compose with it

**What must not be broken:**
- Cookie read must happen before `selectABVariant()` — otherwise stickiness fails
- `newAssignment = true` must only be set when the cookie path was NOT taken
- `Set-Cookie` header is set based on `newAssignment` — must remain in `[[path]].js` response layer
- `emitOps(AB_SELECTED)` must fire only for RUNNING/PAUSED, not DECIDED/ARCHIVED/DRAFT
- Counter increment must be gated `expState !== "PAUSED"` — easy to forget when refactoring

### Risk 2 — Exposure Token System

**Why it matters:** Currently, conversions have zero binding to exposures. Anyone can send a conversion for any valid experiment+variant. An exposure token would create a server-signed receipt at exposure time that is required for conversion acceptance.

**Files it touches:**
- `functions/[[path]].js` — must generate and embed token at exposure time
- `functions/api/convert.js` — must accept and validate token
- Landing page integration — must forward token (via URL param, cookie, or body)

**What must not be broken:**
- Existing LP integrations that call `/api/convert` without a token need a grace period or explicit opt-in per experiment
- Token must NOT be required for experiments that don't opt in (backward compat)
- `context.waitUntil()` pattern for counter writes must be preserved
- Counter key format must remain unchanged — `exp:<alias>:<slug>:conversion:<shard>`

**Critical discovery:** The token encoding must include alias + variant + expiry at minimum. Where to transmit it to the LP (URL param via hub link UTMs vs. cookie vs. header) must be decided before implementation.

### Risk 3 — Experiment Lifecycle Cleanup

**Why it matters:** The lifecycle has two unsupervised write paths that auto-modify experiment state:
1. `GET /api/experiments` auto-persists winner as a side effect of a read (fire-and-forget KV write)
2. `POST /api/experiment/bandit-update` auto-archives on inactivity

These can produce conflicting writes if called concurrently or if the admin calls both in quick succession.

**Files it touches:**
- `functions/api/experiments.js` — `persistDetectedWinner()` side effect
- `functions/api/experiment/bandit-update.js` — auto-archive logic
- `functions/api/experiment/_lifecycle.js` — shared state machine
- All lifecycle endpoint files (`activate.js`, `pause.js`, `resume.js`, `archive.js`, `promote.js`)

**What must not be broken:**
- State machine invariants: ARCHIVED must remain terminal
- `applyLifecycleTransition()` idempotency (returns `{ noop: true }` if already in target state)
- The `winner` field must be preserved through all transitions that don't explicitly clear it

### Risk 4 — Bandit Cron Scheduler

**Why it matters:** `bandit-update` is currently a manual admin call. A cron must call it automatically for all RUNNING experiments. The call requires `ALIAS_REGISTRY.list()` to enumerate experiments (not currently implemented in any code path inspected).

**Files it touches:**
- New: `functions/api/experiment/bandit-cron.js` (or scheduled handler in `wrangler.toml`)
- `functions/api/experiment/bandit-update.js` — must be callable without HTTP request context
- `wrangler.toml` — `[triggers] crons` block needed

**What must not be broken:**
- `bandit-update.js` currently calls `request.json()` to get `{ alias, dry_run }`. A cron call cannot do this — the bandit update logic must be refactored to accept `alias` directly, not via HTTP body.
- Auto-archive must not fire spuriously if the cron runs before traffic data is available (cold start experiments)
- CPU budget: N=200 draws × 2 variants = 400 Beta samples per experiment. Each Beta sample calls `gammaSample()` (rejection sampling loop). For 10 experiments this is ~4000 Beta samples. Must measure against Workers CPU time limit.
- The `cacheDelete()` call after KV write is module-level in `kv-cache.js` — it only invalidates the local isolate's cache. A cron running in a separate isolate won't invalidate the cache in the routing isolate. Routing will pick up new weights within 60s when the cache TTL expires naturally.

---

## 10. Prompt Readiness Notes

**What the next prompt writer now knows:**

**Routing:**
- `variant.weight` is the single routing authority — confirmed in code (`selectABVariant()` in `ab-router.js`)
- Routing is deterministic within a session via cookie `exp_<alias>` (30d, Secure, SameSite=Lax)
- First-visit randomness comes from cf-ray — uniform across buckets, but NOT deterministic across sessions
- In-memory KV cache has 60s TTL — config changes propagate within 60s of `cacheDelete()`

**Exposure:**
- No deduplication — every page render increments
- No exposure token of any kind exists
- Counter key: `exp:<alias>:<slug>:exposure:<shard>` (10 shards, randomly chosen write)
- Reads aggregate legacy key + all 10 shards via `Promise.all`

**Conversion:**
- Public endpoint, no auth
- No prior exposure required
- No duplicate protection
- `event` field is logged only — not written anywhere
- Fallback: accepts campaign name in `experiment` field (via LINKHUB_CAMPAIGNS lookup)

**Lifecycle:**
- State machine is in `_lifecycle.js` — transitions are: DRAFT→RUNNING, RUNNING→PAUSED, RUNNING→ARCHIVED, PAUSED→RUNNING, PAUSED→ARCHIVED, DECIDED→PAUSED, DECIDED→ARCHIVED
- ARCHIVED is terminal — no transitions out
- Two auto-write side effects exist: `experiments.js` (winner → DECIDED) and `bandit-update.js` (inactivity → ARCHIVED)

**Workspace:**
- Not implemented anywhere in routing, experiments, counters, or conversions
- All KV keys are global flat strings — no tenant prefix