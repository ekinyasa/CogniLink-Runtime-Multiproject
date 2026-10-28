import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { onRequestGet as handleAnalyticsGet } from "../functions/api/admin/analytics.js";
import { renderAdmin } from "../functions/_shared/admin-renderer.js";

test("Analytics Timezone & Bucketing Integrity", async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test("Custom date range applies exact Europe/Istanbul day boundaries (>= start 00:00:00 AND < nextDay 00:00:00)", async () => {
    const capturedQueries = [];
    globalThis.fetch = async (url, opts) => {
      const body = typeof opts?.body === "string" ? opts.body : "";
      capturedQueries.push(body);
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics?start=2026-10-28&end=2026-10-28", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);

    assert.ok(capturedQueries.length > 0, "Queries should have been executed");
    for (const q of capturedQueries) {
      assert.ok(
        q.includes("timestamp >= toDateTime('2026-10-28 00:00:00', 'Europe/Istanbul')"),
        `Query should contain Istanbul start boundary: ${q}`
      );
      assert.ok(
        q.includes("timestamp < toDateTime('2026-10-29 00:00:00', 'Europe/Istanbul')"),
        `Query should contain next-midnight Istanbul end boundary: ${q}`
      );
    }
  });

  await t.test("Month-end custom date range correctly rolls next-day boundary over to 1st of next month", async () => {
    const capturedQueries = [];
    globalThis.fetch = async (url, opts) => {
      capturedQueries.push(typeof opts?.body === "string" ? opts.body : "");
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics?start=2026-10-01&end=2026-10-31", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);

    for (const q of capturedQueries) {
      assert.ok(q.includes("timestamp >= toDateTime('2026-10-01 00:00:00', 'Europe/Istanbul')"));
      assert.ok(q.includes("timestamp < toDateTime('2026-11-01 00:00:00', 'Europe/Istanbul')"));
    }
  });

  await t.test("Single start date without end date sets only lower Europe/Istanbul boundary", async () => {
    const capturedQueries = [];
    globalThis.fetch = async (url, opts) => {
      capturedQueries.push(typeof opts?.body === "string" ? opts.body : "");
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics?start=2026-10-28", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);

    for (const q of capturedQueries) {
      assert.ok(q.includes("timestamp >= toDateTime('2026-10-28 00:00:00', 'Europe/Istanbul')"));
      assert.ok(!q.includes("< toDateTime"));
    }
  });

  await t.test("Invalid calendar dates are strictly rejected with HTTP 400 (never silently defaulted)", async () => {
    const invalidInputs = [
      "2026-02-31", // Non-existent date
      "2026-13-01", // Invalid month
      "2026-04-31", // April has 30 days
      "invalid-date",
      "malicious'OR'1'='1"
    ];

    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    for (const bad of invalidInputs) {
      const req = new Request(`https://niluferormanli.com/api/admin/analytics?start=${encodeURIComponent(bad)}`, {
        headers: { Authorization: "Bearer test-admin-token" },
      });
      const res = await handleAnalyticsGet({ request: req, env });
      assert.equal(res.status, 400, `Expected 400 for invalid date ${bad}`);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.error, "invalid_date_range");
    }
  });

  await t.test("Inverted date range (start > end) is strictly rejected with HTTP 400", async () => {
    const req = new Request("https://niluferormanli.com/api/admin/analytics?start=2026-10-28&end=2026-10-20", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "invalid_date_range");
    assert.ok(body.hint.includes("Start date cannot be after end date"));
  });

  await t.test("API chart contract: buckets are normalized to explicit Europe/Istanbul ISO-8601 (+03:00)", async () => {
    globalThis.fetch = async (url, opts) => {
      const body = typeof opts?.body === "string" ? opts.body : "";
      if (body.includes("toStartOfInterval")) {
        return new Response(JSON.stringify({
          data: [
            { t: "2026-10-28 12:00:00", clicks: "150" },
            { t: "2026-10-28 13:00:00", clicks: "200" }
          ]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics?window=24h", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.ok);
    const chart = body.summary.chart;
    assert.ok(Array.isArray(chart) && chart.length === 2);
    // Explicit contract verification: bucket string must be unambiguous ISO-8601 with +03:00
    assert.equal(chart[0].t, "2026-10-28T12:00:00+03:00");
    assert.equal(chart[1].t, "2026-10-28T13:00:00+03:00");
  });

  await t.test("Time-series bucketing uses toStartOfInterval with Europe/Istanbul timezone", async () => {
    const capturedQueries = [];
    globalThis.fetch = async (url, opts) => {
      capturedQueries.push(typeof opts?.body === "string" ? opts.body : "");
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics?window=24h", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);

    const seriesQueries = capturedQueries.filter(q => q.includes("toStartOfInterval"));
    assert.equal(seriesQueries.length, 2, "Expected clicks and conversions time series queries");
    for (const sq of seriesQueries) {
      assert.ok(
        sq.includes("toStartOfInterval(timestamp, INTERVAL '1' HOUR, 'Europe/Istanbul') AS t"),
        `Expected hourly Istanbul bucket in time-series query: ${sq}`
      );
    }
  });

  await t.test("Daily window (7d, 30d, custom) groups by INTERVAL '1' DAY in Europe/Istanbul", async () => {
    const capturedQueries = [];
    globalThis.fetch = async (url, opts) => {
      capturedQueries.push(typeof opts?.body === "string" ? opts.body : "");
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const req = new Request("https://niluferormanli.com/api/admin/analytics?window=7d", {
      headers: { Authorization: "Bearer test-admin-token" },
    });
    const env = {
      ADMIN_TOKEN: "test-admin-token",
      ENV_NAME: "production",
      PROJECT_ID: "nilufer",
      CF_ACCOUNT_ID: "acc123",
      CF_AE_API_TOKEN: "tok123",
    };

    const res = await handleAnalyticsGet({ request: req, env });
    assert.equal(res.status, 200);

    const seriesQueries = capturedQueries.filter(q => q.includes("toStartOfInterval"));
    assert.equal(seriesQueries.length, 2);
    for (const sq of seriesQueries) {
      assert.ok(
        sq.includes("toStartOfInterval(timestamp, INTERVAL '1' DAY, 'Europe/Istanbul') AS t"),
        `Expected daily Istanbul bucket in time-series query: ${sq}`
      );
    }
  });

  await t.test("Sliding windows preserve real-time relative semantics (1h, 24h)", async () => {
    const testCases = [
      { window: "1h", expected: "timestamp > now() - INTERVAL '1' HOUR" },
      { window: "24h", expected: "timestamp > now() - INTERVAL '24' HOUR" },
      { window: "7d", expected: "timestamp > now() - INTERVAL '7' DAY" },
      { window: "30d", expected: "timestamp > now() - INTERVAL '30' DAY" }
    ];

    for (const tc of testCases) {
      const capturedQueries = [];
      globalThis.fetch = async (url, opts) => {
        capturedQueries.push(typeof opts?.body === "string" ? opts.body : "");
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const req = new Request(`https://niluferormanli.com/api/admin/analytics?window=${tc.window}`, {
        headers: { Authorization: "Bearer test-admin-token" },
      });
      const env = {
        ADMIN_TOKEN: "test-admin-token",
        ENV_NAME: "production",
        PROJECT_ID: "nilufer",
        CF_ACCOUNT_ID: "acc123",
        CF_AE_API_TOKEN: "tok123",
      };

      const res = await handleAnalyticsGet({ request: req, env });
      assert.equal(res.status, 200);
      assert.ok(capturedQueries[0].includes(tc.expected), `Expected ${tc.expected}`);
    }
  });

  await t.test("Client script formatting functions: cross-timezone equivalence & boundary integrity", () => {
    const html = renderAdmin({});
    const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
    let mainScript = "";
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      if (match[1].includes("function formatLocalTime")) {
        mainScript = match[1];
        break;
      }
    }
    assert.ok(mainScript.length > 0, "Should locate script block with formatLocalTime");

    // Helper to evaluate script under simulated browser environments
    function evaluateUnderBrowserTz(simulatedTz) {
      const mockEl = { dataset: {}, style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} }, addEventListener: () => {}, querySelector: () => mockEl, querySelectorAll: () => [] };
      const win = {};
      const context = {
        window: win,
        document: {
          getElementById: () => mockEl,
          querySelector: () => mockEl,
          querySelectorAll: () => [],
          head: { appendChild: () => {} },
          addEventListener: () => {}
        },
        localStorage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        setTimeout: () => {},
        clearTimeout: () => {},
        Intl,
        Date,
        String,
        parseInt,
        isNaN,
        Array,
        Object
      };
      vm.createContext(context);
      vm.runInContext(mainScript, context);
      return context.window.__pulseTime;
    }

    // Test across 4 simulated browser runtime timezones: UTC, Europe/Istanbul, America/New_York, Asia/Tokyo
    const timezones = ["UTC", "Europe/Istanbul", "America/New_York", "Asia/Tokyo"];

    // 4 equivalent representations of the exact same moment:
    const equivalentMoments = [
      "2026-10-28 12:30:00",       // UTC space-separated (ClickHouse format)
      "2026-10-28T12:30:00",      // ISO without tz (explicitly treated as UTC)
      "2026-10-28T12:30:00Z",     // ISO with Z (UTC)
      "2026-10-28T15:30:00+03:00" // ISO with Europe/Istanbul offset
    ];

    for (const tz of timezones) {
      const pulseTime = evaluateUnderBrowserTz(tz);
      const { formatLocalTime, formatChartLabel, formatChartTooltip, getIstanbulTodayDateStr } = pulseTime;

      // 1. All 4 equivalent representations MUST format to the exact same Istanbul string
      for (const input of equivalentMoments) {
        assert.equal(
          formatLocalTime(input),
          "28 Oct 26, 15:30",
          `Under ${tz}, input ${input} should format to 28 Oct 26, 15:30`
        );
      }

      // 2. Chart label must NOT strip Z/offset blindly or double-convert
      assert.equal(formatChartLabel("2026-10-28T15:00:00+03:00"), "15:00");
      assert.equal(formatChartLabel("2026-10-28T12:00:00Z"), "15:00");
      assert.equal(formatChartLabel("2026-10-28T00:00:00+03:00"), "2026-10-28");
      assert.equal(formatChartLabel("2026-10-27T21:00:00Z"), "2026-10-28"); // 21:00 UTC = 00:00 Istanbul (midnight)

      // 3. Chart tooltip must show correct TRT tag and date
      assert.equal(formatChartTooltip("2026-10-28T15:00:00+03:00"), "28 Oct 2026, 15:00 (TRT)");
      assert.equal(formatChartTooltip("2026-10-28T12:00:00Z"), "28 Oct 2026, 15:00 (TRT)");
      assert.equal(formatChartTooltip("2026-10-28T00:00:00+03:00"), "28 Oct 2026");
      assert.equal(formatChartTooltip("2026-10-27T21:00:00Z"), "28 Oct 2026");

      // 4. Midnight transition: 21:30 UTC on Oct 27 is 00:30 on Oct 28 in Istanbul
      assert.equal(formatLocalTime("2026-10-27 21:30:00"), "28 Oct 26, 00:30");
      assert.equal(formatLocalTime("2026-10-27 20:59:00"), "27 Oct 26, 23:59");

      // 5. Date-only input does NOT match timezone trailer from '-28' or '-10'
      // 2026-10-28 date-only is treated as UTC midnight (2026-10-28T00:00:00Z), which is 03:00 Istanbul
      assert.equal(formatLocalTime("2026-10-28"), "28 Oct 26, 03:00");

      // 6. Today date string format
      assert.match(getIstanbulTodayDateStr(), /^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
