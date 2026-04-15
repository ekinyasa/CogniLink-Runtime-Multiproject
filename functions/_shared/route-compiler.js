/**
 * route-compiler.js — Deterministic ROUTE_ALIAS compiler.
 *
 * Reads truth sources and writes a compiled flat routing index to ROUTE_ALIAS.
 * For ops/admin use only — NEVER called on the hot public routing path.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Truth sources (read during compile):                                    │
 * │    CAMPAIGN_AB_ALIAS_INDEX    alias:<alias>           → campaign_name            │
 * │                      slug_alias:<alias>       → canonical_slug (direct) │
 * │    CAMPAIGN_INDEX <campaign_name>          → JSON record (optional   │
 * │                                                 existence validation)   │
 * │    SLUG_LINKS     <canonical_slug>        → slug record              │
 * │                                                                          │
 * │  Compiled output (written to ROUTE_ALIAS):                               │
 * │    ROUTE_ALIAS  route:<alias>  → canonical_slug (first active slug)     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Two alias types compiled:
 *   1. Campaign aliases  — alias:<alias> → campaign_name
 *      Resolved to the first active slug found for that campaign
 *      (earliest createdAt wins). Produces one route:<alias> entry.
 *
 *   2. Slug aliases      — slug_alias:<alias> → canonical_slug (direct)
 *      No campaign resolution. Validated against SLUG_LINKS.
 *      Produces a single route:<alias> → canonical_slug entry.
 *
 * Compilation rules:
 *   - Duplicate route keys across both phases → hard error
 *   - canonical_slug must pass validateCanonicalSlug() format check
 *   - If ANY error: ROUTE_ALIAS is not written (atomic, fail-safe)
 *   - Re-run any time: process is fully idempotent
 *
 * Observability:
 *   Emits one structured console.log("[compile] {...}") with counts + duration.
 *   These logs do NOT touch AE_CONVERSION or AE_TRAFFIC AE datasets.
 *
 * Legacy note:
 *   AB_INDEX is no longer required. It was a legacy namespace from a
 *   prior architecture that stored richer campaign records
 *   (campaign_id, default_channel, channels, modifier_map). The current system
 *   uses CAMPAIGN_INDEX + SLUG_LINKS as the authoritative truth sources.
 */

import { validateCanonicalSlug } from "./validators.js";
import { invalidateRoutes }      from "./route-cache.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Extract campaign_name from a raw CAMPAIGN_AB_ALIAS_INDEX value.
 * Supports: plain string OR JSON object { campaign_id, ... } (legacy compat).
 */
function extractCampaignName(rawValue) {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      // Legacy format stored campaign_id — treat as campaign name
      return typeof parsed.campaign_id === "string" ? parsed.campaign_id : null;
    } catch (_) {
      return null;
    }
  }
  return trimmed || null;
}

/**
 * Paginate-list all keys with a given prefix from a KV namespace.
 *
 * @param  {object} ns
 * @param  {string} prefix
 * @returns {Promise<string[]>}
 */
async function listAllKeys(ns, prefix) {
  const keys  = [];
  let cursor  = undefined;
  do {
    const listOpts = { prefix, limit: 1000 };
    if (cursor !== undefined) listOpts.cursor = cursor;
    const page = await ns.list(listOpts);
    for (const k of page.keys) keys.push(k.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

/**
 * Load all active slug records from SLUG_LINKS and build a Map:
 *   campaign_name → { slug: canonical_slug, createdAt: string }
 *
 * When multiple active slugs exist for a campaign, the one with the
 * earliest createdAt is chosen (deterministic tiebreak: slug key name).
 *
 * Used by Phase A to resolve campaign alias → first active canonical_slug.
 *
 * @param  {object} LS  SLUG_LINKS KV namespace
 * @returns {Promise<Map<string, { slug: string, createdAt: string }>>}
 */
async function buildCampaignSlugMap(LS) {
  /** @type {Map<string, { slug: string, createdAt: string }>} */
  const map = new Map();

  // Paginate all slug keys, skip meta keys
  const allKeys = [];
  let cursor    = undefined;
  do {
    const listOpts = { limit: 1000 };
    if (cursor !== undefined) listOpts.cursor = cursor;
    const page = await LS.list(listOpts);
    for (const k of page.keys) {
      if (!k.name.startsWith("count:") && !k.name.startsWith("webhook:")) {
        allKeys.push(k.name);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  if (allKeys.length === 0) return map;

  // Parallel fetch all records
  const records = await Promise.all(
    allKeys.map((k, idx) =>
      LS.get(k, { type: "json" })
        .then(rec => ({ key: k, rec }))
        .catch(() => ({ key: k, rec: null }))
    )
  );

  // Build campaign → earliest active slug map
  for (const { key, rec } of records) {
    if (!rec || !rec.campaign) continue;
    if (rec.isActive === false) continue;

    const campaignName  = rec.campaign;
    const canonicalSlug = rec.slug || key; // slug field is authoritative
    const createdAt     = rec.createdAt || "";
    const existing      = map.get(campaignName);

    // Keep earliest (string ISO comparison); slug key name as tiebreaker
    if (
      !existing ||
      createdAt < existing.createdAt ||
      (createdAt === existing.createdAt && canonicalSlug < existing.slug)
    ) {
      map.set(campaignName, { slug: canonicalSlug, createdAt });
    }
  }

  return map;
}

// ── Main compiler ─────────────────────────────────────────────────────────────

/**
 * Rebuild ROUTE_ALIAS from truth sources.
 *
 * @param {object} env
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]          — validate only; no KV writes
 * @param {boolean} [opts.invalidateCache=true]  — purge Workers Cache on success
 *
 * @returns {Promise<{
 *   ok:             boolean,
 *   written:        number,
 *   compiled:       number,
 *   errors:         string[],
 *   skipped:        string[],
 *   routes_preview: string[],
 *   stats:          { campaign_aliases: number, slug_aliases: number, duration_ms: number }
 * }>}
 */
export async function compileRoutes(env, opts = {}) {
  const t0 = Date.now();
  const { dryRun = false, invalidateCache = true } = opts;

  const AR = env.CAMPAIGN_AB_ALIAS_INDEX;
  const RT = env.ROUTE_ALIAS;
  const LS = env.SLUG_LINKS;
  const LC = env.CAMPAIGN_INDEX;   // optional — used for campaign existence validation

  const missing = [
    !AR && "CAMPAIGN_AB_ALIAS_INDEX",
    !RT && "ROUTE_ALIAS",
    !LS && "SLUG_LINKS",
  ].filter(Boolean);

  if (missing.length) {
    return {
      ok: false, written: 0, compiled: 0,
      errors: [`Required KV bindings not bound: ${missing.join(", ")}`],
      skipped: [], routes_preview: [],
      stats: { campaign_aliases: 0, slug_aliases: 0, duration_ms: Date.now() - t0 },
    };
  }

  const errors  = [];
  const skipped = [];
  /** @type {Map<string, string>}  routeKey (no "route:" prefix) → canonical_slug */
  const compiled = new Map();

  let campaignAliasCount = 0;
  let slugAliasCount     = 0;

  // ══ PHASE A: Campaign aliases (alias:* → campaign_name) ═══════════════════
  //
  // Step 1: Pre-load campaign → first_active_slug from SLUG_LINKS.
  // Step 2: For each alias:X in CAMPAIGN_AB_ALIAS_INDEX, resolve to canonical_slug.

  let campaignSlugMap;
  try {
    campaignSlugMap = await buildCampaignSlugMap(LS);
  } catch (e) {
    return {
      ok: false, written: 0, compiled: 0,
      errors: [`Failed to load slug map from SLUG_LINKS: ${e?.message}`],
      skipped: [], routes_preview: [],
      stats: { campaign_aliases: 0, slug_aliases: 0, duration_ms: Date.now() - t0 },
    };
  }

  let aliasKeys = [];
  try {
    aliasKeys = await listAllKeys(AR, "alias:");
  } catch (e) {
    return {
      ok: false, written: 0, compiled: 0,
      errors: [`Failed to list CAMPAIGN_AB_ALIAS_INDEX (alias:*): ${e?.message}`],
      skipped: [], routes_preview: [],
      stats: { campaign_aliases: 0, slug_aliases: 0, duration_ms: Date.now() - t0 },
    };
  }
  campaignAliasCount = aliasKeys.length;

  if (aliasKeys.length > 0) {
    const aliasValues = await Promise.all(
      aliasKeys.map(k => AR.get(k, { type: "text" }).catch(e => ({ __error: e?.message })))
    );

    for (let i = 0; i < aliasKeys.length; i++) {
      const aliasKey = aliasKeys[i];
      const alias    = aliasKey.slice("alias:".length);
      const rawValue = aliasValues[i];

      if (!rawValue || typeof rawValue !== "string") {
        if (rawValue?.__error) errors.push(`alias:${alias} — KV read failed: ${rawValue.__error}`);
        else skipped.push(`alias:${alias} — empty or null value`);
        continue;
      }

      const campaignName = extractCampaignName(rawValue);
      if (!campaignName) {
        errors.push(`alias:${alias} — cannot extract campaign name from value`);
        continue;
      }

      // Optional: validate campaign exists in CAMPAIGN_INDEX
      let campaignRecord = null;
      if (LC) {
        try {
          campaignRecord = await LC.get(campaignName, { type: "json" });
          if (!campaignRecord) {
            skipped.push(`alias:${alias} — campaign "${campaignName}" not found in CAMPAIGN_INDEX (skipped)`);
            continue;
          }
        } catch (e) {
          // Non-fatal: CAMPAIGN_INDEX read error → log skip and proceed
          skipped.push(`alias:${alias} — CAMPAIGN_INDEX read failed (${campaignName}): ${e?.message}`);
        }
      }

      // Resolve canonical slug: prefer campaign.defaultSlug if set and valid, else first active
      const entry = campaignSlugMap.get(campaignName);
      if (!entry) {
        skipped.push(`alias:${alias} — no active slug found for campaign "${campaignName}" (skipped)`);
        continue;
      }

      let canonicalSlug = entry.slug;

      // PART 2: Honor campaign.defaultSlug when set
      const preferredSlug = campaignRecord?.defaultSlug;
      if (preferredSlug && validateCanonicalSlug(preferredSlug)) {
        try {
          const preferredRec = await LS.get(preferredSlug, { type: "json" });
          if (
            preferredRec &&
            preferredRec.isActive !== false &&
            preferredRec.campaign === campaignName
          ) {
            canonicalSlug = preferredSlug;
          } else {
            skipped.push(`alias:${alias} — defaultSlug "${preferredSlug}" invalid/inactive; falling back to "${canonicalSlug}"`);
          }
        } catch (_) {
          // Non-fatal: fall back to first active slug
        }
      }
      if (!validateCanonicalSlug(canonicalSlug)) {
        errors.push(`alias:${alias} — canonical_slug "${canonicalSlug}" fails format validation`);
        continue;
      }

      if (compiled.has(alias)) {
        errors.push(`alias:${alias} — duplicate route key`);
        continue;
      }

      compiled.set(alias, canonicalSlug);
    }
  }

  // ══ PHASE B: Slug aliases (slug_alias:* → canonical_slug, direct) ═════════

  let slugAliasKeys = [];
  try {
    slugAliasKeys = await listAllKeys(AR, "slug_alias:");
  } catch (e) {
    // Non-fatal: slug aliases are optional
    skipped.push(`slug_alias listing failed — skipping phase B: ${e?.message}`);
  }
  slugAliasCount = slugAliasKeys.length;

  if (slugAliasKeys.length > 0) {
    const slugAliasValues = await Promise.all(
      slugAliasKeys.map(k => AR.get(k, { type: "text" }).catch(e => ({ __error: e?.message })))
    );

    for (let i = 0; i < slugAliasKeys.length; i++) {
      const key      = slugAliasKeys[i];
      const alias    = key.slice("slug_alias:".length);
      const rawValue = slugAliasValues[i];

      if (!rawValue || typeof rawValue !== "string") {
        if (rawValue?.__error) errors.push(`slug_alias:${alias} — KV read failed: ${rawValue.__error}`);
        else skipped.push(`slug_alias:${alias} — empty or null value`);
        continue;
      }

      const canonicalSlug = rawValue.trim();

      if (!validateCanonicalSlug(canonicalSlug)) {
        errors.push(`slug_alias:${alias} — invalid canonical_slug format: "${canonicalSlug}"`);
        continue;
      }

      // Validate slug exists and is active in SLUG_LINKS
      try {
        const slugRecord = await LS.get(canonicalSlug, { type: "json" });
        if (!slugRecord) {
          // PROMPT 73: Non-fatal skip for newly created slugs to avoid 404s due to KV lag.
          // If we just wrote the slug but LS.get() hasn't seen it yet, we still compile the route.
          skipped.push(`slug_alias:${alias} — "${canonicalSlug}" not found in SLUG_LINKS (proceeding anyway)`);
        } else if (slugRecord.isActive === false) {
          skipped.push(`slug_alias:${alias} — "${canonicalSlug}" is inactive (isActive=false, skipped)`);
          continue;
        }
      } catch (_) {
        // SLUG_LINKS read error is non-fatal — proceed without validation
      }

      // Duplicate check across both phases
      if (compiled.has(alias)) {
        errors.push(`slug_alias:${alias} — route key "${alias}" already defined by a campaign alias`);
        continue;
      }
      compiled.set(alias, canonicalSlug);
    }
  }

  // ══ Observability log (console/Logpush only — no AE write) ════════════════
  console.log("[compile]", JSON.stringify({
    campaign_aliases: campaignAliasCount,
    slug_aliases:     slugAliasCount,
    routes_compiled:  compiled.size,
    errors:           errors.length,
    skipped:          skipped.length,
    dry_run:          dryRun,
    duration_ms:      Date.now() - t0,
  }));

  const stats = {
    campaign_aliases: campaignAliasCount,
    slug_aliases:     slugAliasCount,
    duration_ms:      Date.now() - t0,
  };

  // ══ Build routes preview (for admin debugging) ════════════════════════════
  const routes_preview = [...compiled.entries()].map(([k, v]) => `route:${k} → ${v}`);

  // ══ Abort write if any errors (atomic: all-or-nothing) ════════════════════
  if (errors.length > 0) {
    return { ok: false, written: 0, compiled: compiled.size, errors, skipped, routes_preview, stats };
  }

  if (dryRun) {
    return { ok: true, written: 0, compiled: compiled.size, errors: [], skipped, routes_preview, stats };
  }

  // ══ Write all entries to ROUTE_ALIAS in parallel ═══════════════════════════
  const writeErrors = [];
  await Promise.all(
    [...compiled.entries()].map(([routeKey, slug]) =>
      RT.put(`route:${routeKey}`, slug).catch(e => {
        writeErrors.push(`Write failed [route:${routeKey}]: ${e?.message}`);
      })
    )
  );

  if (writeErrors.length) {
    return {
      ok: false, written: compiled.size - writeErrors.length,
      compiled: compiled.size, errors: writeErrors, skipped, routes_preview, stats,
    };
  }

  // ══ Invalidate Workers Cache for all written route keys ════════════════════
  if (invalidateCache) {
    await invalidateRoutes([...compiled.keys()]);
  }

  return { ok: true, written: compiled.size, compiled: compiled.size, errors: [], skipped, routes_preview, stats };
}
