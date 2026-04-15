/**
 * analytics.test.js — Analytics API integrity validation.
 *
 * Calls GET /api/admin/analytics and asserts:
 *   - HTTP 200
 *   - ok === true
 *   - campaigns / aliases / slugs / recent are arrays
 *   - recent.length > 0  (events present — run telemetry.test.js first)
 *   - clicks values in campaign/alias/slug rows are Numbers, not strings
 *     (validates the Number(row.clicks) normalization added in 11.md)
 */

export async function run({ baseUrl, adminToken }) {
  // ── Fetch analytics endpoint ────────────────────────────────────────────────
  let res;
  try {
    res = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  } catch (err) {
    return { pass: false, error: `Network error: ${err?.message}` };
  }

  if (res.status !== 200) {
    const text = await res.text().catch(() => "");
    return {
      pass:  false,
      error: `Expected status 200, got ${res.status}. Body: ${text.slice(0, 200)}`,
    };
  }

  // ── Parse JSON ──────────────────────────────────────────────────────────────
  let data;
  try {
    data = await res.json();
  } catch {
    return { pass: false, error: "Response is not valid JSON" };
  }

  // ── ok flag ─────────────────────────────────────────────────────────────────
  if (data.ok !== true) {
    const hint = data.hint ? ` Hint: ${data.hint}` : "";
    return {
      pass:  false,
      error: `ok !== true. Error: "${data.error ?? "(none)"}".${hint}`,
    };
  }

  // ── Warn about AE SQL warnings (non-fatal — test still collects them) ───────
  if (Array.isArray(data.warnings) && data.warnings.length > 0) {
    console.log(`  ⚠  AE warnings: ${data.warnings.join("; ")}`);
  }

  // ── Array presence ───────────────────────────────────────────────────────────
  for (const field of ["campaigns", "aliases", "recent"]) {
    if (!Array.isArray(data[field])) {
      return { pass: false, error: `Field "${field}" is missing or not an array` };
    }
  }

  // ── Summary Validation ──────────────────────────────────────────────────────
  if (typeof data.summary !== "object" || data.summary === null) {
    return { pass: false, error: "Missing summary object" };
  }
  if (typeof data.summary.conversions !== "number") {
    return { pass: false, error: "summary.conversions is not a number" };
  }
  if (!Array.isArray(data.summary.active_experiments)) {
    return { pass: false, error: "summary.active_experiments is not an array" };
  }

  // ── Recent events must be populated ────────────────────────────────────────
  if (data.recent.length === 0) {
    return {
      pass:  false,
      error: "recent[] is empty — run telemetry.test.js first to emit events, then retry",
    };
  }

  // ── Clicks must be numbers ─────────────────────────────────────────────────
  for (const field of ["campaigns", "aliases"]) {
    for (const row of data[field]) {
      if (typeof row.clicks !== "number") {
        return {
          pass:  false,
          error: `"${field}" row has non-numeric clicks: ${JSON.stringify(row)}`,
        };
      }
    }
  }

  return { pass: true };
}
