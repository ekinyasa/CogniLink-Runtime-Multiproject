/**
 * telemetry.test.js — Telemetry event emission.
 *
 * Fires a set of alias_click events by requesting alias routes,
 * then waits for Analytics Engine ingestion before returning PASS.
 *
 * Trigger sequence:
 *   GET /nb        × 2  (base alias, cache-hit on second)
 *   GET /nb/offer  × 1  (modifier path)
 *   GET /nb/vsl    × 1  (modifier path)
 *
 * Analytics Engine ingestion is async — a 2-second wait is added.
 * Run analytics.test.js AFTER this test to validate the emitted events.
 *
 * Note: This test validates that the trigger requests succeed (HTTP 200).
 *       It does NOT assert write-through to Analytics Engine directly.
 */

const TRIGGER_PATHS = ["/nb", "/nb", "/nb/offer", "/nb/vsl"];
const WAIT_MS       = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function run({ baseUrl }) {
  for (const path of TRIGGER_PATHS) {
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
    } catch (err) {
      return { pass: false, error: `Network error on GET ${path}: ${err?.message}` };
    }

    if (res.status !== 200) {
      return {
        pass:  false,
        error: `Trigger request GET ${path} returned ${res.status} — event may not have been emitted`,
      };
    }
  }

  // Wait for Analytics Engine to ingest the emitted events
  process.stdout.write("  (waiting 2s for AE ingestion…) ");
  await sleep(WAIT_MS);
  process.stdout.write("done\n");

  return { pass: true };
}
