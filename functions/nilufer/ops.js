/**
 * functions/nilufer/ops.js — Routing ops dashboard.
 *
 * GET /nilufer/ops
 *
 * Shows current routing state for quick debugging:
 *   - CAMPAIGN_AB_ALIAS_INDEX: what is registered (alias:* + slug_alias:*)
 *   - ROUTE_ALIAS: what is compiled and live (route:*)
 *   - Discrepancies: registered aliases that have no compiled route
 *
 * No authentication — ops state only (no secrets, no user data).
 * No frameworks. Plain HTML table.
 * No KV writes.
 */

const SEC_HEADERS = {
  "Content-Type":           "text/html;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Robots-Tag":           "noindex,nofollow,noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options":        "DENY",
  "Referrer-Policy":        "no-referrer",
};

/** Paginate-list all keys with optional prefix from a KV namespace. */
async function listAllKeys(ns, prefix = "") {
  const keys  = [];
  let cursor  = undefined;
  do {
    const opts = { limit: 1000 };
    if (prefix)            opts.prefix = prefix;
    if (cursor !== undefined) opts.cursor = cursor;
    const page = await ns.list(opts);
    for (const k of page.keys) keys.push(k.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function badge(ok, label) {
  const color = ok ? "#16a34a" : "#dc2626";
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:.7rem;padding:.1rem .4rem;border-radius:.25rem;font-weight:600">${esc(label)}</span>`;
}

export async function onRequestGet(context) {
  const { env } = context;

  const AR = env.CAMPAIGN_AB_ALIAS_INDEX;
  const RT = env.ROUTE_ALIAS;

  if (!AR || !RT) {
    return new Response(
      `<html><body><p style="font-family:monospace;padding:2rem;color:#dc2626">
        KV bindings missing: ${[!AR && "CAMPAIGN_AB_ALIAS_INDEX", !RT && "ROUTE_ALIAS"].filter(Boolean).join(", ")}
      </p></body></html>`,
      { status: 503, headers: SEC_HEADERS }
    );
  }

  const t0 = Date.now();

  // Load all data in parallel
  const [aliasKeys, slugAliasKeys, routeKeys] = await Promise.all([
    listAllKeys(AR, "alias:").catch(() => []),
    listAllKeys(AR, "slug_alias:").catch(() => []),
    listAllKeys(RT, "route:").catch(() => []),
  ]);

  // Fetch all values in parallel
  const [aliasValues, slugAliasValues, routeValues] = await Promise.all([
    Promise.all(aliasKeys.map(k => AR.get(k, { type: "text" }).catch(() => null))),
    Promise.all(slugAliasKeys.map(k => AR.get(k, { type: "text" }).catch(() => null))),
    Promise.all(routeKeys.map(k => RT.get(k, { type: "text" }).catch(() => null))),
  ]);

  // Build lookup maps
  /** @type {Map<string, string>}  alias → campaign_name */
  const aliasMap = new Map();
  for (let i = 0; i < aliasKeys.length; i++) {
    const alias = aliasKeys[i].slice("alias:".length);
    aliasMap.set(alias, aliasValues[i] || "(null)");
  }
  /** @type {Map<string, string>}  alias → canonical_slug */
  const slugAliasMap = new Map();
  for (let i = 0; i < slugAliasKeys.length; i++) {
    const alias = slugAliasKeys[i].slice("slug_alias:".length);
    slugAliasMap.set(alias, slugAliasValues[i] || "(null)");
  }
  /** @type {Map<string, string>}  routeKey → canonical_slug */
  const routeMap = new Map();
  for (let i = 0; i < routeKeys.length; i++) {
    const key = routeKeys[i].slice("route:".length);
    routeMap.set(key, routeValues[i] || "(null)");
  }

  const duration = Date.now() - t0;
  const now      = new Date().toISOString();

  // Build campaign alias rows
  let campRows = "";
  if (aliasMap.size === 0) {
    campRows = `<tr><td colspan="4" style="color:#9ca3af;font-style:italic">No campaign aliases registered</td></tr>`;
  } else {
    for (const [alias, campaignName] of aliasMap) {
      const compiled   = routeMap.get(alias);
      const isCompiled = compiled !== undefined;
      campRows += `<tr>
        <td><code>/${esc(alias)}</code></td>
        <td>${esc(campaignName)}</td>
        <td>${isCompiled ? badge(true, "compiled") : badge(false, "not compiled")}</td>
        <td>${isCompiled ? `<code>${esc(compiled)}</code>` : `<span style="color:#9ca3af">—</span>`}</td>
      </tr>`;
    }
  }

  // Build slug alias rows
  let slugRows = "";
  if (slugAliasMap.size === 0) {
    slugRows = `<tr><td colspan="4" style="color:#9ca3af;font-style:italic">No slug aliases registered</td></tr>`;
  } else {
    for (const [alias, canonicalSlug] of slugAliasMap) {
      const compiled   = routeMap.get(alias);
      const isCompiled = compiled !== undefined;
      slugRows += `<tr>
        <td><code>/${esc(alias)}</code></td>
        <td><code>${esc(canonicalSlug)}</code></td>
        <td>${isCompiled ? badge(true, "compiled") : badge(false, "not compiled")}</td>
        <td>${isCompiled ? `<code>${esc(compiled)}</code>` : `<span style="color:#9ca3af">—</span>`}</td>
      </tr>`;
    }
  }

  // All compiled routes (for cross-reference)
  let routeRows = "";
  if (routeMap.size === 0) {
    routeRows = `<tr><td colspan="2" style="color:#9ca3af;font-style:italic">ROUTE_ALIAS is empty — run Compile Routes</td></tr>`;
  } else {
    for (const [routeKey, slug] of routeMap) {
      routeRows += `<tr>
        <td><code>/${esc(routeKey)}</code></td>
        <td><code>/c/${esc(slug)}</code></td>
      </tr>`;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Routing Ops</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,monospace;background:#f9fafb;color:#111;padding:2rem 1.5rem;font-size:.875rem}
h1{font-size:1.125rem;font-weight:700;margin-bottom:.25rem}
.sub{color:#6b7280;font-size:.8rem;margin-bottom:2rem}
h2{font-size:.875rem;font-weight:600;margin:1.75rem 0 .75rem;padding:.5rem .75rem;background:#f3f4f6;border-left:3px solid #111;border-radius:.25rem}
table{width:100%;border-collapse:collapse;margin-bottom:.5rem;background:#fff;border:1px solid #e5e7eb;border-radius:.375rem;overflow:hidden}
th{text-align:left;padding:.5rem .75rem;font-size:.75rem;font-weight:600;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb}
td{padding:.5rem .75rem;border-bottom:1px solid #f3f4f6;vertical-align:middle}
tr:last-child td{border-bottom:none}
code{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:.8rem;background:#f3f4f6;padding:.1rem .3rem;border-radius:.2rem}
.back{display:inline-block;margin-bottom:1.5rem;font-size:.8rem;color:#6b7280;text-decoration:none}
.back:hover{color:#111}
.stats{display:flex;gap:1.5rem;margin-bottom:1.5rem;flex-wrap:wrap}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:.375rem;padding:.625rem 1rem;min-width:100px}
.stat-n{font-size:1.25rem;font-weight:700}
.stat-l{font-size:.7rem;color:#6b7280;margin-top:.1rem}
</style>
</head>
<body>
<a href="/nilufer" class="back">← Studio Panel</a>
<h1>Routing Ops</h1>
<p class="sub">Snapshot at ${esc(now)} · loaded in ${duration}ms</p>

<div class="stats">
  <div class="stat"><div class="stat-n">${aliasMap.size}</div><div class="stat-l">Campaign aliases</div></div>
  <div class="stat"><div class="stat-n">${slugAliasMap.size}</div><div class="stat-l">Slug aliases</div></div>
  <div class="stat"><div class="stat-n">${routeMap.size}</div><div class="stat-l">Compiled routes</div></div>
  <div class="stat" style="border-color:${routeMap.size < aliasMap.size + slugAliasMap.size ? "#fca5a5" : "#bbf7d0"}">
    <div class="stat-n">${(aliasMap.size + slugAliasMap.size) - routeMap.size}</div>
    <div class="stat-l">Not yet compiled</div>
  </div>
</div>

<h2>Campaign Aliases (CAMPAIGN_AB_ALIAS_INDEX → alias:*)</h2>
<table>
  <thead><tr><th>Public route</th><th>→ Campaign</th><th>Status</th><th>Compiled slug</th></tr></thead>
  <tbody>${campRows}</tbody>
</table>

<h2>Slug Aliases (CAMPAIGN_AB_ALIAS_INDEX → slug_alias:*)</h2>
<table>
  <thead><tr><th>Public route</th><th>→ Slug</th><th>Status</th><th>Compiled slug</th></tr></thead>
  <tbody>${slugRows}</tbody>
</table>

<h2>ROUTE_ALIAS (live compiled routes)</h2>
<table>
  <thead><tr><th>Public route</th><th>→ Canonical slug</th></tr></thead>
  <tbody>${routeRows}</tbody>
</table>

</body>
</html>`;

  return new Response(html, { status: 200, headers: SEC_HEADERS });
}
