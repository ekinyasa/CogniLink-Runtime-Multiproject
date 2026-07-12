#!/usr/bin/env node
const BASE_URL    = (process.env.CAMPAIGN_OS_BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "test-admin-token";

console.log("\nCogniLink Components Test Runner");
console.log(`Base URL  : ${BASE_URL}`);
console.log("─".repeat(45));
console.log("Calling /api/admin/components-test…\n");

try {
  const res = await fetch(`${BASE_URL}/api/admin/components-test`, {
    method:  "GET",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });

  if (res.status === 401) {
    console.error("✖  Unauthorized — check ADMIN_TOKEN.\n");
    process.exit(1);
  }

  const data = await res.json();
  console.log("Results:\n");
  (data.tests || []).forEach(t => {
    const icon = t.ok ? "✓" : "✖";
    console.log(`${icon}  ${t.name} : ${t.message}`);
  });
  console.log("─".repeat(45));
  if (data.ok) {
    console.log("\nALL TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.error("\n✖  SOME TESTS FAILED!\n");
    process.exit(1);
  }
} catch (err) {
  console.error(`✖  Network/Execution error: ${err.message}\n`);
  process.exit(1);
}
