/**
 * modifier.test.js — Modifier routing validation.
 *
 * Tests that /alias/modifier routes resolve to the hub correctly.
 * The modifier-fallback logic (Step 6a in alias-router.js) must return
 * the base alias slug when no modifier-specific ROUTE_TABLE entry exists.
 *
 * Tests:
 *   GET /nb/offer  → 200, HTML
 *   GET /nb/vsl    → 200, HTML
 *   GET /nb/test   → 200, HTML
 */

const MODIFIER_ROUTES = ["/nb/offer", "/nb/vsl", "/nb/test"];

export async function run({ baseUrl }) {
  for (const path of MODIFIER_ROUTES) {
    let res;

    try {
      res = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
    } catch (err) {
      return { pass: false, error: `Network error on GET ${path}: ${err?.message}` };
    }

    if (res.status !== 200) {
      return {
        pass:  false,
        error: `Expected status 200, got ${res.status} for GET ${path}`,
      };
    }

    const body = await res.text().catch(() => "");
    if (!body.includes("<html") && !body.includes("<!DOCTYPE")) {
      return { pass: false, error: `GET ${path} did not return an HTML hub page` };
    }
  }

  return { pass: true };
}
