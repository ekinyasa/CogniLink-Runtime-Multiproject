name = "linkhub"
compatibility_date = "2024-09-23"
pages_build_output_dir = "./public"

# ─────────────────────────────────────────────────────────────────────────────
# ACTIVE KV NAMESPACES (real IDs — verified in production)
# ──────────────────────────────────────────────────────────────────────────────

# Slug records (legacy hub + c/<slug> routes)
[[kv_namespaces]]
binding = "LINKHUB_SLUGS"
id = "9719a15a3c074d82a2f452926003ca9c"
preview_id = "9719a15a3c074d82a2f452926003ca9c"

# Campaign registry (used by /api/campaign/* endpoints)
[[kv_namespaces]]
binding = "LINKHUB_CAMPAIGNS"
id = "6a5341e1e6a2401e9dc13133965c6ac2"
preview_id = "6a5341e1e6a2401e9dc13133965c6ac2"

# Global hub design config (theme CSS, header/footer text)
[[kv_namespaces]]
binding = "LINKHUB_CONFIG"
id = "3b55ec01257a4482bc650a4058ee2c2a"
preview_id = "3b55ec01257a4482bc650a4058ee2c2a"

# ──────────────────────────────────────────────────────────────────────────────
# ANALYTICS ENGINE DATASETS
# No 'id' field required — binding name + dataset name is sufficient.
# Both datasets are active; they MUST remain separate (never mixed).
# ──────────────────────────────────────────────────────────────────────────────

# Marketing click events (outbound link tracking via /api/event)
[[analytics_engine_datasets]]
binding = "LINKHUB_EVENTS"
dataset = "linkhub_events"

# Ops telemetry (routing outcomes, compilation events — internal only)
[[analytics_engine_datasets]]
binding = "LINKHUB_OPS"
dataset = "linkhub_ops_events"

# ──────────────────────────────────────────────────────────────────────────────
# CAMPAIGN OS — KV NAMESPACES (pending creation)
#
# These bindings are required for alias routing (/<alias> and /<alias>/<modifier>).
# Until created and bound, the catch-all handler returns 404 for all alias routes.
# All other routes (ig.js, youtube.js, spotify.js, c/<slug>, api/*) remain unaffected.
#
# Steps to activate:
#   1. Run:
#        wrangler kv:namespace create ALIAS_REGISTRY
#        wrangler kv:namespace create CAMPAIGN_REGISTRY
#        wrangler kv:namespace create ROUTE_TABLE
#        wrangler kv:namespace create HUB_CONFIG
#
#   2. Uncomment the blocks below and fill in the IDs printed by step 1.
#      Use the same ID for both 'id' and 'preview_id' (as done above).
#
#   3. Also uncomment the matching blocks in [env.production] at the bottom.
#
#   4. After binding, seed data and run compileRoutes() to populate ROUTE_TABLE.
#
# [[kv_namespaces]]
# binding    = "ALIAS_REGISTRY"      # truth source: alias → campaign_id
# id         = ""
# preview_id = ""
#
# [[kv_namespaces]]
# binding    = "CAMPAIGN_REGISTRY"   # truth source: campaign_id → JSON record
# id         = ""
# preview_id = ""
#
# [[kv_namespaces]]
# binding    = "ROUTE_TABLE"         # compiled routing index (only KV read on hot path)
# id         = ""
# preview_id = ""
#
# [[kv_namespaces]]
# binding    = "HUB_CONFIG"          # per-slug hub rendering config
# id         = ""
# preview_id = ""
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
# ENVIRONMENT VARIABLES
# Sensitive values (ADMIN_TOKEN, META_PIXEL_ID) must be set in the
# Cloudflare Pages dashboard → Settings → Environment variables, not here.
# ──────────────────────────────────────────────────────────────────────────────
[vars]
GA4_ID = "G-DWCN82754X"
# META_PIXEL_ID            = ""       # set in Pages dashboard for production
# ADMIN_TOKEN              = ""       # REQUIRED — set in Pages dashboard, never commit
# ROUTE_CACHE_TTL          = "60"     # Workers Cache TTL in seconds       (default: 60)
# ALIAS_CACHE_TTL_MS       = "60000"  # module-level Map TTL in ms         (default: 60000)
# ENABLE_LEGACY_HUB_FALLBACK = "false" # read LINKHUB_SLUGS as hub config fallback (default: OFF)

# ──────────────────────────────────────────────────────────────────────────────
# PRODUCTION ENVIRONMENT
# Mirrors the default block above with production-specific overrides.
# ──────────────────────────────────────────────────────────────────────────────
[env.production]

[[env.production.kv_namespaces]]
binding = "LINKHUB_SLUGS"
id = "9719a15a3c074d82a2f452926003ca9c"

[[env.production.kv_namespaces]]
binding = "LINKHUB_CAMPAIGNS"
id = "6a5341e1e6a2401e9dc13133965c6ac2"

[[env.production.kv_namespaces]]
binding = "LINKHUB_CONFIG"
id = "3b55ec01257a4482bc650a4058ee2c2a"

# Campaign OS KV — uncomment once IDs are available (same IDs as default block):
# [[env.production.kv_namespaces]]
# binding = "ALIAS_REGISTRY"
# id = ""
#
# [[env.production.kv_namespaces]]
# binding = "CAMPAIGN_REGISTRY"
# id = ""
#
# [[env.production.kv_namespaces]]
# binding = "ROUTE_TABLE"
# id = ""
#
# [[env.production.kv_namespaces]]
# binding = "HUB_CONFIG"
# id = ""

[[env.production.analytics_engine_datasets]]
binding = "LINKHUB_EVENTS"
dataset = "linkhub_events"

[[env.production.analytics_engine_datasets]]
binding = "LINKHUB_OPS"
dataset = "linkhub_ops_events"

[env.production.vars]
GA4_ID = "G-DWCN82754X"
META_PIXEL_ID = "2082393229208465"
