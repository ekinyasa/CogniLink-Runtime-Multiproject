import { verifyToken, unauthorized, validateCampaignName, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }  from "../../_shared/validators.js";
import { compileRoutes }  from "../../_shared/route-compiler.js";

/**
 * POST /api/campaign
 *
 * Creates a new campaign.
 * Body: { name, alias?, workspace? }
 *   name      — required, must be unique in CAMPAIGN_INDEX
 *   alias     — optional campaign alias (written to CAMPAIGN_AB_ALIAS_INDEX as alias:<alias> → name)
 *               must be globally unique across all alias types
 *               after saving, run POST /api/admin/compile-routes to activate routing
 *   workspace — optional namespace (default: "default"). Affects admin panel + analytics
 *               filtering only — does not change router behavior.
 *
 * Returns 409 if campaign or alias already exists.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await verifyToken(request, env))) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const rawName      = (body?.name      || "").trim().toLowerCase();
  const rawAlias     = (body?.alias     || "").trim().toLowerCase() || null;
  const rawWorkspace = (body?.workspace || "default").trim().toLowerCase() || "default";

  /* ── Validate name ────────────────────────────────────── */
  const nameErr = validateCampaignName(rawName);
  if (nameErr) {
    return new Response(JSON.stringify({ error: nameErr }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  /* ── Validate workspace ──────────────────────────────── */
  if (rawWorkspace.length > 48 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(rawWorkspace) && rawWorkspace.length > 1) {
    return new Response(
      JSON.stringify({ error: "Workspace must use lowercase letters, numbers, and hyphens only (max 48 chars)." }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Validate alias format (if provided) ─────────────── */
  if (rawAlias !== null && !validateAlias(rawAlias)) {
    return new Response(
      JSON.stringify({ error: "Alias must use lowercase letters, numbers, and hyphens only (max 48 chars)." }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Check campaign uniqueness ───────────────────────── */
  const existing = await env.CAMPAIGN_INDEX.get(rawName);
  if (existing !== null) {
    return new Response(
      JSON.stringify({ error: `Campaign "${rawName}" already exists.` }),
      { status: 409, headers: jsonHeaders() }
    );
  }

  /* ── Check alias global uniqueness ──────────────────── */
  if (rawAlias !== null && env.CAMPAIGN_AB_ALIAS_INDEX) {
    const [existingCampaignAlias, existingSlugAlias] = await Promise.all([
      env.CAMPAIGN_AB_ALIAS_INDEX.get(`alias:${rawAlias}`,      { type: "text" }).catch(() => null),
      env.CAMPAIGN_AB_ALIAS_INDEX.get(`slug_alias:${rawAlias}`, { type: "text" }).catch(() => null),
    ]);
    if (existingCampaignAlias !== null || existingSlugAlias !== null) {
      return new Response(
        JSON.stringify({ error: `Alias "${rawAlias}" is already in use. Choose a different alias.` }),
        { status: 409, headers: jsonHeaders() }
      );
    }
  }

  /* ── Store campaign record ───────────────────────────── */
  const record = {
    name:      rawName,
    alias:     rawAlias,
    isActive:  true,
    workspace: rawWorkspace,
    createdAt: new Date().toISOString(),
  };

  try {
    await env.CAMPAIGN_INDEX.put(rawName, JSON.stringify(record));
  } catch (e) {
    console.error("[api/campaign POST] KV write error:", e?.message);
    return new Response(JSON.stringify({ error: "Failed to create campaign." }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  /* ── Write alias to CAMPAIGN_AB_ALIAS_INDEX (if provided) ─────── */
  if (rawAlias !== null && env.CAMPAIGN_AB_ALIAS_INDEX) {
    try {
      await env.CAMPAIGN_AB_ALIAS_INDEX.put(`alias:${rawAlias}`, rawName);
    } catch (e) {
      console.error("[api/campaign POST] CAMPAIGN_AB_ALIAS_INDEX write error:", e?.message);
      // Non-fatal: campaign is created. Alias write failed — user must retry.
      return new Response(
        JSON.stringify({
          ok: true, campaign: record,
          warning: `Campaign created but alias "${rawAlias}" could not be saved. Retry or add manually.`,
        }),
        { status: 201, headers: jsonHeaders() }
      );
    }
  }

  // Auto-compile routes so routing activates immediately (PART 1)
  if (rawAlias !== null && env.ROUTE_ALIAS) {
    context.waitUntil(
      compileRoutes(env, { dryRun: false, invalidateCache: true })
        .catch(e => console.warn("[api/campaign POST] auto-compile failed:", e?.message))
    );
  }

  return new Response(
    JSON.stringify({ ok: true, campaign: record }),
    { status: 201, headers: jsonHeaders() }
  );
}
