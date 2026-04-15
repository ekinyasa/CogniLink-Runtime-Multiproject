#!/usr/bin/env node
/**
 * Campaign OS Test Runner v2 — thin CLI wrapper
 *
 * Delegates all test logic to POST /api/admin/smoke-test so there is a single
 * canonical test engine (functions/_shared/test-runner.js). The CLI simply
 * calls the endpoint and renders the structured result.
 *
 * The individual test files (router.test.js, modifier.test.js, etc.) created
 * in 12.md are preserved for standalone ad-hoc use, but run-tests.js now
 * avoids duplicated logic by deferring to the server-side engine.
 *
 * Requires Node 18+ (native fetch).
 *
 * Usage:
 *   export CAMPAIGN_OS_BASE_URL="https://campaign-os.pages.dev"
 *   export ADMIN_TOKEN="your-admin-token"
 *   node tests/run-tests.js
 *
 * Exit codes:
 *   0 — all smoke tests pass
 *   1 — one or more smoke tests failed or network error
 */

const BASE_URL    = (process.env.CAMPAIGN_OS_BASE_URL || "").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

if (!BASE_URL) {
  console.error("\n✖  CAMPAIGN_OS_BASE_URL is not set.");
  console.error("   export CAMPAIGN_OS_BASE_URL=https://your-deployment.pages.dev\n");
  process.exit(1);
}

if (!ADMIN_TOKEN) {
  console.error("\n✖  ADMIN_TOKEN is not set.");
  console.error("   export ADMIN_TOKEN=your-admin-token\n");
  process.exit(1);
}

// ── Call the smoke-test endpoint ───────────────────────────────────────────────

console.log("\nCampaign OS Test Runner v2");
console.log(`Base URL  : ${BASE_URL}`);
console.log("─".repeat(45));
console.log("Calling /api/admin/smoke-test…\n");

let data;
try {
  const res = await fetch(`${BASE_URL}/api/admin/smoke-test`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  if (res.status === 401) {
    console.error("✖  Unauthorized — check ADMIN_TOKEN.\n");
    process.exit(1);
  }

  data = await res.json();
} catch (err) {
  console.error(`✖  Network error: ${err?.message ?? String(err)}\n`);
  process.exit(1);
}

// ── Render results ─────────────────────────────────────────────────────────────

const CHECKS = [
  ["router test",         data.router],
  ["modifier routing",    data.modifier],
  ["telemetry emission",  data.telemetry],
  ["analytics integrity", data.analytics],
];

for (const [label, result] of CHECKS) {
  const icon = result === "pass" ? "✓" : "✖";
  console.log(`${icon}  ${label}`);
}

if (data.warnings && data.warnings.length > 0) {
  console.log("\nWarnings:");
  data.warnings.forEach(w => console.log(`  ⚠  ${w}`));
}

console.log("─".repeat(45));

if (data.ok) {
  console.log(`\nALL TESTS PASS  (${data.duration_ms ?? "?"}ms)\n`);
  process.exit(0);
} else {
  console.log(`\nSOME TESTS FAILED  (${data.duration_ms ?? "?"}ms)\n`);
  process.exit(1);
}
