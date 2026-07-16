import assert from "node:assert/strict";
import { verifyAdminDebug } from "../functions/_shared/runtime-debug-auth.js";

function runTests() {
  console.log("Starting Runtime Debug Auth Tests...\n");
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ FAIL: ${name}`);
      console.error(e);
      failed++;
    }
  }

  const env = { ADMIN_TOKEN: "secret_token_123" };

  function mockRequest(urlStr, headersObj) {
    const headers = new Map(Object.entries(headersObj || {}));
    return {
      url: urlStr,
      headers: {
        get: (k) => {
          // Headers are case-insensitive in reality, mock exactly for the exact keys tested
          for (const [key, value] of headers.entries()) {
            if (key.toLowerCase() === k.toLowerCase()) return value;
          }
          return null;
        }
      }
    };
  }

  test("1. geçerli Bearer token + runtime-debug=1 → Inspector JSON (true)", () => {
    const req = mockRequest("https://app.com/?runtime-debug=1", {
      "Authorization": "Bearer secret_token_123"
    });
    assert.equal(verifyAdminDebug(req, env), true);
  });

  test("2. geçerli X-Admin-Token + runtime-debug=1 → Inspector JSON (true)", () => {
    const req = mockRequest("https://app.com/?runtime-debug=1", {
      "X-Admin-Token": "secret_token_123"
    });
    assert.equal(verifyAdminDebug(req, env), true);
  });

  test("3. token yok + runtime-debug=1 → normal legacy response (false)", () => {
    const req = mockRequest("https://app.com/?runtime-debug=1", {});
    assert.equal(verifyAdminDebug(req, env), false);
  });

  test("4. yanlış token + runtime-debug=1 → normal legacy response (false)", () => {
    const req = mockRequest("https://app.com/?runtime-debug=1", {
      "X-Admin-Token": "wrong_token"
    });
    assert.equal(verifyAdminDebug(req, env), false);
  });

  test("5. doğru token fakat runtime-debug yok → normal legacy response (false)", () => {
    const req = mockRequest("https://app.com/", {
      "Authorization": "Bearer secret_token_123"
    });
    assert.equal(verifyAdminDebug(req, env), false);
  });

  test("6. eski admin-verify query parametresi → normal legacy response (false)", () => {
    const req = mockRequest("https://app.com/?runtime-debug=1&admin-verify=secret_token_123", {});
    assert.equal(verifyAdminDebug(req, env), false);
  });

  test("7. missing env.ADMIN_TOKEN returns false safely", () => {
    const req = mockRequest("https://app.com/?runtime-debug=1", {
      "X-Admin-Token": "secret_token_123"
    });
    assert.equal(verifyAdminDebug(req, {}), false);
  });

  console.log("\n── Test Summary ──");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
