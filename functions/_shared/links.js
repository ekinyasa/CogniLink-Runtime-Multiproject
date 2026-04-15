export const BASE_LINKS = [];

export const ROUTE_DEFAULTS = {
  ig: {
    utm_source: "instagram",
    utm_medium: "bio",
  },
  youtube: {
    utm_source: "youtube",
    utm_medium: "description",
  },
  spotify: {
    utm_source: "spotify",
    utm_medium: "bio",
  },
};

export const UTM_PRESETS = {
  instagram_bio:    { utm_source: "instagram", utm_medium: "bio" },
  instagram_story:  { utm_source: "instagram", utm_medium: "story" },
  youtube_desc:     { utm_source: "youtube",   utm_medium: "description" },
  spotify_bio:      { utm_source: "spotify",   utm_medium: "bio" },
  paid_meta:        { utm_source: "facebook",  utm_medium: "paid_social" },
  paid_google:      { utm_source: "google",    utm_medium: "cpc" },
  custom:           {},
};

/**
 * Get effective BASE_LINKS with global config baseLinks overrides applied.
 * config.baseLinks = { official: { url, label }, ... }
 * Only url and label are overridable globally; order stays fixed.
 */
export function getEffectiveBaseLinks(config) {
  const cfg = config || {};
  const base = Array.isArray(cfg.baseLinks) ? cfg.baseLinks : [];

  return base.map((link, idx) => {
    return {
      id:         link.id || `bl-${idx}`,
      label:      link.label || "",
      href:       link.url   || "",
      utmContent: `primary_${link.id || idx}`,
      noUtm:      !!link.noUtm,
      isActive:   true,
      order:      link.order !== undefined ? link.order : 10 + idx * 10,
    };
  });
}

/**
 * Resolve the ordered, active link list for a slug — v6.
 *
 * 3-layer merge:
 *   Layer 1 — BASE_LINKS (with global config overrides applied)
 *   Layer 2 — overrides{} per base link id (url, isActive, noUtm, order)
 *             Backward-compat: old string values treated as { url: value }
 *   Layer 3 — custom links[] (ALWAYS additive — appended after base, never replacing)
 *
 * Steps:
 *   1. Get effective BASE_LINKS (with global baseLinks config applied)
 *   2. Apply per-id overrides (normalise string → { url })
 *   3. Append custom links[]
 *   4. Filter out isActive === false
 *   5. Sort by order ASC (default 1000 if undefined)
 *
 * @param {object|null} campaignData - slug record from KV
 * @param {object}      [config]    - global hub config from LANDING_CONFIG
 */
export function resolveLinks(campaignData, config) {
  const base = getEffectiveBaseLinks(config);

  if (!campaignData) {
    const active = base.filter((l) => l.isActive !== false);
    active.sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));
    return active;
  }

  const overrides   = campaignData.overrides || {};
  const customLinks = Array.isArray(campaignData.links) ? campaignData.links : [];

  // Step 1 + 2: Clone effective base + apply per-link overrides
  const mergedBase = base.map((link) => {
    const ovr = overrides[link.id];
    if (ovr === undefined || ovr === null) return { ...link };

    // Backward-compat: old format stored plain strings
    const ovrObj = typeof ovr === "string" ? { url: ovr } : ovr;

    return {
      ...link,
      href:     ovrObj.url      !== undefined ? ovrObj.url      : link.href,
      isActive: ovrObj.isActive !== undefined ? ovrObj.isActive : link.isActive,
      noUtm:    ovrObj.noUtm    !== undefined ? ovrObj.noUtm    : link.noUtm,
      order:    ovrObj.order    !== undefined ? ovrObj.order    : link.order,
    };
  });

  // Step 3: Append custom links with default order if missing
  const appendLinks = customLinks.map((l, idx) => ({
    ...l,
    order: l.order !== undefined ? l.order : 100 + idx * 10,
  }));
  const allLinks = [...mergedBase, ...appendLinks];

  // Step 4: Filter inactive
  const active = allLinks.filter((l) => l.isActive !== false);

  // Step 5: Sort by order ASC (default 1000)
  active.sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));

  return active;
}
