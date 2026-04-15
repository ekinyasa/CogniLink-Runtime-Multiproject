/**
 * functions/admin/campaign/[campaign].js — Auth-guarded campaign landing page.
 *
 * GET /admin/campaign/:campaign
 *
 * Requires ADMIN_TOKEN authentication via either:
 *   - ?token=<ADMIN_TOKEN>               (browser navigation from admin panel links)
 *   - Authorization: Bearer <ADMIN_TOKEN> (programmatic / API access)
 *
 * Returns 403 if unauthorized.
 * Returns campaign info and slug list for authenticated admins.
 *
 * Moved from /nilufer/campaign/:campaign (Prompt 41).
 * /nilufer/campaign/:campaign now permanently redirects here.
 */

const SEC_HEADERS = {
  "Content-Type":           "text/html;charset=UTF-8",
  "Cache-Control":          "no-store",
  "X-Robots-Tag":           "noindex,nofollow",
  "X-Content-Type-Options": "nosniff",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Verify admin token from Authorization header or ?token= query param. */
function verifyAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const authHeader = (request.headers.get("Authorization") || "").trim();
  if (authHeader.startsWith("Bearer ") && authHeader.slice(7) === env.ADMIN_TOKEN) return true;
  const token = new URL(request.url).searchParams.get("token") || "";
  return token === env.ADMIN_TOKEN;
}

/** Paginate-list all non-meta slug keys from SLUG_LINKS. */
async function listAllSlugs(LS) {
  const keys  = [];
  let cursor  = undefined;
  do {
    const opts = { limit: 1000 };
    if (cursor !== undefined) opts.cursor = cursor;
    const page = await LS.list(opts);
    for (const k of page.keys) {
      if (!k.name.startsWith("count:") && !k.name.startsWith("webhook:")) {
        keys.push(k.name);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!verifyAdmin(request, env)) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Forbidden</title></head>
<body style="font-family:system-ui;padding:3rem 2rem;max-width:480px;margin:0 auto;text-align:center">
  <p style="font-size:1.5rem;font-weight:700;margin-bottom:.5rem">Access Denied</p>
  <p style="color:#6b7280">Admin authentication required.</p>
  <p style="margin-top:2rem"><a href="/admin" style="color:#111;font-size:.875rem">← Studio Panel</a></p>
</body></html>`,
      { status: 403, headers: SEC_HEADERS }
    );
  }

  const campaignName = (params.campaign || "").toLowerCase().trim();
  if (!campaignName || !env.SLUG_LINKS) {
    return new Response("Not Found", { status: 404, headers: SEC_HEADERS });
  }

  // ── Load campaign record ──────────────────────────────────────────────────
  let campaignRecord = null;
  if (env.CAMPAIGN_INDEX) {
    try {
      campaignRecord = await env.CAMPAIGN_INDEX.get(campaignName, { type: "json" });
    } catch (_) {}
  }

  if (!campaignRecord && env.CAMPAIGN_INDEX) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title></head>
<body style="font-family:system-ui;padding:3rem 2rem;max-width:480px;margin:0 auto">
  <p style="font-size:1.5rem;font-weight:700;margin-bottom:.5rem">${esc(campaignName)}</p>
  <p style="color:#6b7280">Campaign not found.</p>
  <p style="margin-top:2rem"><a href="/admin" style="color:#111;font-size:.875rem">← Studio Panel</a></p>
</body></html>`,
      { status: 404, headers: SEC_HEADERS }
    );
  }

  // ── Load all slugs for this campaign ──────────────────────────────────────
  let allKeys = [];
  try { allKeys = await listAllSlugs(env.SLUG_LINKS); } catch (_) {}

  const records = await Promise.all(
    allKeys.map(k =>
      env.SLUG_LINKS.get(k, { type: "json" })
        .then(rec => ({ key: k, rec }))
        .catch(() => ({ key: k, rec: null }))
    )
  );

  const campaignSlugs = records
    .filter(({ rec }) => rec && rec.campaign === campaignName)
    .sort((a, b) => {
      const ta = a.rec?.createdAt || "";
      const tb = b.rec?.createdAt || "";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

  const isActive = campaignRecord?.isActive !== false;

  // ── Build slug rows ───────────────────────────────────────────────────────
  let slugRows = "";
  if (campaignSlugs.length === 0) {
    slugRows = `<p style="color:#9ca3af;font-style:italic;margin-top:1rem">No slugs found for this campaign.</p>`;
  } else {
    slugRows = campaignSlugs.map(({ key, rec }) => {
      const slug        = rec?.slug || key;
      const active      = rec?.isActive !== false;
      const src         = rec?.defaults?.utm_source || "";
      const med         = rec?.defaults?.utm_medium || "";
      const slugAlias   = rec?.alias || "";
      const meta        = [src, med].filter(Boolean).join(" · ") || "—";
      const statusBadge = active
        ? ""
        : `<span style="display:inline-block;background:#fee2e2;color:#dc2626;font-size:.7rem;padding:.1rem .35rem;border-radius:.2rem;margin-left:.5rem">disabled</span>`;

      return `<div style="display:flex;align-items:center;justify-content:space-between;
                  padding:.625rem 0;border-bottom:1px solid #f3f4f6;gap:.75rem">
        <div>
          <a href="/c/${esc(slug)}" target="_blank" rel="noopener noreferrer"
             style="font-size:.875rem;font-weight:500;color:#111;text-decoration:none;font-family:ui-monospace,'SF Mono',monospace">
            /c/${esc(slug)}
          </a>${statusBadge}
          <div style="font-size:.75rem;color:#6b7280;margin-top:.15rem">${esc(meta)}</div>
        </div>
        <div style="display:flex;gap:.375rem;flex-shrink:0">
          ${slugAlias
            ? `<a href="/${esc(slugAlias)}" target="_blank" rel="noopener noreferrer"
                 style="font-size:.75rem;border:1px solid #e5e7eb;border-radius:.25rem;
                        padding:.2rem .5rem;color:#111;text-decoration:none;white-space:nowrap">
                 /${esc(slugAlias)}
               </a>`
            : ""
          }
          <a href="/c/${esc(slug)}" target="_blank" rel="noopener noreferrer"
             style="font-size:.75rem;border:1px solid #e5e7eb;border-radius:.25rem;
                    padding:.2rem .5rem;color:#111;text-decoration:none;white-space:nowrap">
            open ↗
          </a>
        </div>
      </div>`;
    }).join("");
  }

  const createdFmt = campaignRecord?.createdAt
    ? new Date(campaignRecord.createdAt).toLocaleDateString()
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(campaignName)} — Campaign</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,Arial,sans-serif;
  background:#f9fafb;color:#111;padding:2.5rem 1.5rem;min-height:100dvh}
.container{max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;
  border-radius:.5rem;padding:1.75rem}
</style>
</head>
<body>
<div class="container">
  <p style="font-size:.8rem;color:#6b7280;margin-bottom:1.25rem">
    <a href="/admin" style="color:#6b7280;text-decoration:none">← Studio Panel</a>
  </p>
  <p style="font-size:1.25rem;font-weight:700;margin-bottom:.25rem">${esc(campaignName)}</p>
  <p style="font-size:.8rem;color:#9ca3af;margin-bottom:1.75rem">
    Campaign${createdFmt ? " · created " + esc(createdFmt) : ""}${!isActive ? " · <span style=\"color:#dc2626\">archived</span>" : ""}
  </p>
  <p style="font-size:.8125rem;font-weight:600;color:#6b7280;margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.04em">
    Links (${campaignSlugs.length})
  </p>
  ${slugRows}
</div>
</body>
</html>`;

  return new Response(html, { status: 200, headers: SEC_HEADERS });
}
