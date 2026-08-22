import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";
import { validateAlias }  from "../../_shared/validators.js";
import { compileRoutes }  from "../../_shared/route-compiler.js";

const GRACE_WINDOW_MS = 5 * 60 * 1000;

/* ── PATCH /api/campaign/:name ──────────────────────────────────────
 * Accepts:
 *   { isActive: boolean }           — archive / restore
 *   { alias: string | null }        — set or clear campaign alias
 *   { isActive: boolean, alias: … } — both at once
 *
 * campaign.isActive is purely for admin panel filtering.
 * It has NO effect on public hub rendering.
 * After alias changes run POST /api/admin/compile-routes to activate routing.
 */
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const name = (params.name || "").trim().toLowerCase();
  if (!name) {
    return new Response(JSON.stringify({ error: "Campaign name is required." }), {
      status: 400, headers: jsonHeaders(),
    });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400, headers: jsonHeaders(),
    });
  }

  const hasIsActive    = typeof body?.isActive === "boolean";
  const hasAlias       = "alias" in (body || {});
  const hasDefaultSlug = "defaultSlug" in (body || {});
  const hasProduct     = "product" in (body || {});

  if (!hasIsActive && !hasAlias && !hasDefaultSlug && !hasProduct) {
    return new Response(JSON.stringify({ error: "Provide isActive (boolean), product (string|null), alias (string|null), and/or defaultSlug (string|null)." }), {
      status: 400, headers: jsonHeaders(),
    });
  }

  const existing = await env.CAMPAIGN_INDEX.get(name, { type: "json" });
  if (!existing) {
    return new Response(JSON.stringify({ error: `Campaign "${name}" not found.` }), {
      status: 404, headers: jsonHeaders(),
    });
  }

  /* ── Parse product if provided ───────────────────────────── */
  const rawProduct = hasProduct
    ? ((body.product || "").trim() || null)
    : undefined;

  /* ── Parse alias if provided ─────────────────────────────── */
  const rawAlias = hasAlias
    ? ((body.alias || "").trim().toLowerCase() || null)
    : undefined; // undefined = no change

  if (rawAlias !== undefined && rawAlias !== null && !validateAlias(rawAlias)) {
    return new Response(
      JSON.stringify({ error: "Alias must use lowercase letters, numbers, and hyphens only (max 48 chars)." }),
      { status: 400, headers: jsonHeaders() }
    );
  }

  /* ── Check alias global uniqueness (skip if unchanged) ──── */
  if (rawAlias !== undefined && rawAlias !== null && rawAlias !== existing.alias && env.CAMPAIGN_AB_ALIAS_INDEX) {
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

  /* ── Parse defaultSlug if provided ──────────────────────── */
  // null = clear; string = set; undefined = no change
  const rawDefaultSlug = hasDefaultSlug
    ? ((body.defaultSlug || "").trim().toLowerCase() || null)
    : undefined;

  /* ── Validate defaultSlug if being set ───────────────────── */
  if (rawDefaultSlug !== undefined && rawDefaultSlug !== null && env.SLUG_LINKS) {
    try {
      const slugRec = await env.SLUG_LINKS.get(rawDefaultSlug, { type: "json" });
      if (!slugRec) {
        return new Response(
          JSON.stringify({ error: `Default slug "${rawDefaultSlug}" not found.` }),
          { status: 404, headers: jsonHeaders() }
        );
      }
      if (slugRec.campaign !== existing.name) {
        return new Response(
          JSON.stringify({ error: `Default slug "${rawDefaultSlug}" does not belong to campaign "${existing.name}".` }),
          { status: 400, headers: jsonHeaders() }
        );
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Could not validate default slug. Try again." }),
        { status: 500, headers: jsonHeaders() }
      );
    }
  }

  /* ── Build updated record ────────────────────────────────── */
  const updated = {
    ...existing,
    ...(hasIsActive    ? { isActive:    body.isActive  } : {}),
    ...(rawProduct     !== undefined ? { product:     rawProduct     } : {}),
    ...(rawAlias       !== undefined ? { alias:       rawAlias       } : {}),
    ...(rawDefaultSlug !== undefined ? { defaultSlug: rawDefaultSlug } : {}),
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.CAMPAIGN_INDEX.put(name, JSON.stringify(updated));
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to update campaign." }), {
      status: 500, headers: jsonHeaders(),
    });
  }

  /* ── Manage alias transitions in CAMPAIGN_AB_ALIAS_INDEX ──────────── */
  let aliasNote;
  if (rawAlias !== undefined && env.CAMPAIGN_AB_ALIAS_INDEX) {
    const oldAlias = existing.alias || null;
    // Delete old alias entry if alias changed
    if (oldAlias && oldAlias !== rawAlias) {
      await env.CAMPAIGN_AB_ALIAS_INDEX.delete(`alias:${oldAlias}`).catch(() => {});
    }
    // Write new alias entry if alias set and changed
    if (rawAlias && rawAlias !== oldAlias) {
      try {
        await env.CAMPAIGN_AB_ALIAS_INDEX.put(`alias:${rawAlias}`, name);
        // auto-compile fires via context.waitUntil below — no manual step needed
      } catch (e) {
        console.error("[api/campaign PATCH] CAMPAIGN_AB_ALIAS_INDEX write error:", e?.message);
        return new Response(
          JSON.stringify({ ok: true, campaign: updated, warning: `Campaign updated but alias "${rawAlias}" could not be saved.` }),
          { headers: jsonHeaders() }
        );
      }
    }
    // Clear alias: remove entry from CAMPAIGN_AB_ALIAS_INDEX if alias explicitly cleared
    if (rawAlias === null && oldAlias) {
      await env.CAMPAIGN_AB_ALIAS_INDEX.delete(`alias:${oldAlias}`).catch(() => {});
      // auto-compile fires via context.waitUntil below — no manual step needed
    }
  }

  // Synchronously compile routes when alias OR defaultSlug changed.
  // Using await (not waitUntil) so the redirect map is valid by the time
  // the client receives the 200 response — no stale routes (SECTION 3).
  if ((rawAlias !== undefined || rawDefaultSlug !== undefined) && env.ROUTE_ALIAS) {
    await compileRoutes(env, { dryRun: false, invalidateCache: true })
      .catch(e => console.warn("[api/campaign PATCH] auto-compile failed:", e?.message));
  }

  return new Response(
    JSON.stringify({ ok: true, campaign: updated }),
    { headers: jsonHeaders() }
  );
}

/* ── DELETE /api/campaign/:name ─────────────────────────────────────
 * Permanent delete — only allowed within 5-minute grace window.
 * Returns 403 after grace window expires.
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  const name = (params.name || "").trim().toLowerCase();
  if (!name) {
    return new Response(JSON.stringify({ error: "Campaign name is required." }), {
      status: 400, headers: jsonHeaders(),
    });
  }

  const record = await env.CAMPAIGN_INDEX.get(name, { type: "json" });
  if (!record) {
    return new Response(JSON.stringify({ error: `Campaign "${name}" not found.` }), {
      status: 404, headers: jsonHeaders(),
    });
  }

  if (!record.createdAt) {
    return new Response(JSON.stringify({ error: "Grace window expired." }), {
      status: 403, headers: jsonHeaders(),
    });
  }

  const created = new Date(record.createdAt).getTime();
  if (isNaN(created) || Date.now() - created > GRACE_WINDOW_MS) {
    return new Response(JSON.stringify({ error: "Grace window expired." }), {
      status: 403, headers: jsonHeaders(),
    });
  }

  /* ── Cascade: find and delete all slugs for this campaign ─── */
  const deletedSlugs = [];
  try {
    let cursor;
    do {
      const listOpts = { limit: 1000 };
      if (cursor) listOpts.cursor = cursor;
      const listResult = await env.SLUG_LINKS.list(listOpts);

      const candidates = listResult.keys.filter(
        (k) => !k.name.startsWith("count:") && !k.name.startsWith("webhook:")
      );

      await Promise.all(
        candidates.map(async ({ name: slugKey }) => {
          try {
            const rec = await env.SLUG_LINKS.get(slugKey, { type: "json" });
            if (rec && rec.campaign === name) {
              await env.SLUG_LINKS.delete(slugKey);
              deletedSlugs.push(slugKey);
            }
          } catch (e) {
            console.warn("[cascade delete] error on slug", slugKey, e?.message);
          }
        })
      );

      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);
  } catch (e) {
    console.warn("[cascade delete] slug scan error:", e?.message);
    // Non-fatal — continue to delete campaign itself
  }

  await env.CAMPAIGN_INDEX.delete(name);
  return new Response(
    JSON.stringify({ ok: true, deletedCampaign: name, deletedSlugs }),
    { headers: jsonHeaders() }
  );
}
