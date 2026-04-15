/**
 * fixture.js — Isolated test fixture lifecycle for Campaign OS system testing.
 *
 * Creates a fully isolated, self-contained test campaign that:
 *   - Uses a unique alias/slug/campaign so it never collides with production
 *   - Routes correctly through the alias router (ROUTE_ALIAS write)
 *   - Is identifiable as test data ("test-" prefix on all identifiers)
 *   - Is automatically archived after the test run
 *
 * Naming convention:
 *   alias    = "test-{6 hex chars}"              e.g. "test-a1b2c3"
 *   slug     = "test-{timestamp}-igbio"          e.g. "test-1709812345678-igbio"
 *   campaign = "test-{timestamp}"                e.g. "test-1709812345678"
 *              (derived automatically by deriveCampaignFromSlug via "igbio" suffix)
 *
 * All identifiers contain "test" — clearly identifiable as diagnostics data.
 * The "igbio" slug suffix is a known channel suffix so campaign derivation works.
 *
 * ROUTE_ALIAS structure:
 *   ROUTE_ALIAS["route:test-a1b2c3"]        = "test-1709812345678-igbio"
 *   ROUTE_ALIAS["route:test-a1b2c3@offer"]  = "test-1709812345678-igbio"
 *   ROUTE_ALIAS["route:test-a1b2c3@vsl"]    = "test-1709812345678-igbio"
 *   (mirrors how real campaigns work — modifier routes are explicit, no fallback needed)
 *
 * SLUG_LINKS structure (for hub rendering, alias hub parity):
 *   SLUG_LINKS["test-1709812345678-igbio"] = { slug, campaign, isActive, isTest, ... }
 *
 * CAMPAIGN_INDEX structure (for admin UI visibility + test filter):
 *   CAMPAIGN_INDEX["test-1709812345678"] = { name, isActive, isTest, createdAt }
 *
 * Lifecycle:
 *   createFixture(env)         → writes KV entries, returns fixture info
 *   archiveFixture(env, fixture) → deletes route, marks campaign archived
 */

// ── Fixture creation ───────────────────────────────────────────────────────────

/**
 * Create a new isolated test fixture.
 *
 * Writes:
 *   - ROUTE_ALIAS["route:{alias}"]        = slug
 *   - ROUTE_ALIAS["route:{alias}@offer"]  = slug   (explicit modifier route)
 *   - ROUTE_ALIAS["route:{alias}@vsl"]    = slug   (explicit modifier route)
 *   - SLUG_LINKS[slug]                 = { slug, campaign, isActive, isTest, createdAt }
 *   - CAMPAIGN_INDEX[campaign]         = { name, isActive: true, isTest: true, createdAt }
 *
 * @param  {object} env — Cloudflare Pages env bindings
 * @returns {Promise<{alias: string, slug: string, campaign: string, createdAt: string}>}
 */
export async function createFixture(env) {
  const ts  = Date.now();
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  // All identifiers contain "test" for clear identification
  const alias     = `test-${hex}`;                    // e.g. "test-a1b2c3"
  const slug      = `test-${ts}-igbio`;               // e.g. "test-1709812345678-igbio"
  const campaign  = `test-${ts}`;                     // derived from slug by router
  const createdAt = new Date(ts).toISOString();

  const writes = [];

  // Write base + explicit modifier routes — mirrors real campaign structure
  if (env.ROUTE_ALIAS) {
    writes.push(
      env.ROUTE_ALIAS.put(`route:${alias}`,        slug),
      env.ROUTE_ALIAS.put(`route:${alias}@offer`,  slug),
      env.ROUTE_ALIAS.put(`route:${alias}@vsl`,    slug),
    );
  }

  // Write slug record to SLUG_LINKS so alias hub can load config (PART 4)
  if (env.SLUG_LINKS) {
    writes.push(
      env.SLUG_LINKS.put(
        slug,
        JSON.stringify({ slug, campaign, isActive: true, isTest: true, createdAt, updatedAt: createdAt })
      )
    );
  }

  // Write campaign record — enables admin UI filtering
  if (env.CAMPAIGN_INDEX) {
    writes.push(
      env.CAMPAIGN_INDEX.put(
        campaign,
        JSON.stringify({ name: campaign, isActive: true, isTest: true, createdAt })
      )
    );
  }

  await Promise.all(writes);
  return { alias, slug, campaign, createdAt };
}

// ── Fixture archival ───────────────────────────────────────────────────────────

/**
 * Archive a test fixture after the test completes.
 *
 * Writes:
 *   - Deletes ROUTE_ALIAS["route:{alias}"]        — base alias no longer routable
 *   - Deletes ROUTE_ALIAS["route:{alias}@offer"]  — modifier route removed
 *   - Deletes ROUTE_ALIAS["route:{alias}@vsl"]    — modifier route removed
 *   - Deletes SLUG_LINKS[slug]                 — slug record removed
 *   - Updates CAMPAIGN_INDEX[campaign]          — isActive: false (archived)
 *
 * The AE events remain queryable in Analytics Engine (AE is immutable).
 * The campaign record stays in CAMPAIGN_INDEX, hidden by default in admin UI.
 *
 * @param {object} env     — Cloudflare Pages env bindings
 * @param {object} fixture — Result of createFixture()
 */
export async function archiveFixture(env, fixture) {
  const { alias, campaign, createdAt } = fixture;
  const archivedAt = new Date().toISOString();

  const { slug } = fixture;
  const ops = [];

  // Remove all routes — alias + modifier keys return 404 for public traffic
  if (env.ROUTE_ALIAS) {
    ops.push(
      env.ROUTE_ALIAS.delete(`route:${alias}`),
      env.ROUTE_ALIAS.delete(`route:${alias}@offer`),
      env.ROUTE_ALIAS.delete(`route:${alias}@vsl`),
    );
  }

  // Remove slug record from SLUG_LINKS
  if (slug && env.SLUG_LINKS) {
    ops.push(env.SLUG_LINKS.delete(slug));
  }

  // Mark campaign as archived in CAMPAIGN_INDEX
  if (env.CAMPAIGN_INDEX) {
    ops.push(
      env.CAMPAIGN_INDEX.put(
        campaign,
        JSON.stringify({ name: campaign, isActive: false, isTest: true, createdAt, archivedAt })
      )
    );
  }

  await Promise.allSettled(ops);   // best-effort — never throw during cleanup
}
