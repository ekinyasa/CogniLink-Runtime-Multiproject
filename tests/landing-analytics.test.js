import test from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import {
  writeClickEvent,
  writePageViewEvent,
  writeLandingSignalEvent
} from "../functions/_shared/analytics.js";
import { OPS_EVENTS, isSyntheticOrProbeRequest } from "../functions/_shared/ops-telemetry.js";
import { onRequestGet as catchAllHandler } from "../functions/[[path]].js";
import { onRequestGet as landingHandler } from "../functions/l/[slug].js";
import { onRequestPost as signalHandler } from "../functions/api/decision/signal.js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js test runner if missing
if (!globalThis.crypto?.subtle?.timingSafeEqual) {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.subtle) globalThis.crypto.subtle = {};
  globalThis.crypto.subtle.timingSafeEqual = function (a, b) {
    if (a.byteLength !== b.byteLength) return false;
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
  };
}

class MemoryKV {
  constructor() { this.store = new Map(); }
  async get(key, opts) {
    if (!this.store.has(key)) return null;
    const val = this.store.get(key);
    if (opts?.type === "json") {
      try { return JSON.parse(val); } catch (_) { return null; }
    }
    return val;
  }
  async put(key, val) {
    this.store.set(key, typeof val === "string" ? val : JSON.stringify(val));
  }
  async delete(key) { this.store.delete(key); }
  async list(opts = {}) {
    const prefix = opts.prefix || "";
    const keys = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) keys.push({ name: k });
    }
    return { keys, list_complete: true };
  }
}

function createTelemetryMocks() {
  const trafficPoints = [];
  const conversionPoints = [];
  return {
    trafficPoints,
    conversionPoints,
    AE_TRAFFIC: {
      writeDataPoint(dp) { trafficPoints.push(dp); }
    },
    AE_CONVERSION: {
      writeDataPoint(dp) { conversionPoints.push(dp); }
    }
  };
}

test("1. Low-level Telemetry Helpers", async (t) => {
  await t.test("writeClickEvent writes click datapoint to AE_CONVERSION", () => {
    const { AE_CONVERSION, conversionPoints } = createTelemetryMocks();
    writeClickEvent({ AE_CONVERSION }, {
      slug: "landing-1",
      link_id: "cta-1",
      utm_source: "google",
      utm_medium: "cpc",
      dest_host: "example.com"
    });
    assert.equal(conversionPoints.length, 1);
    assert.equal(conversionPoints[0].indexes[0], "click");
    assert.equal(conversionPoints[0].blobs[0], "landing-1");
    assert.equal(conversionPoints[0].blobs[1], "cta-1");
  });

  await t.test("writePageViewEvent writes traffic_memory datapoint to AE_TRAFFIC with aligned blobs", () => {
    const { AE_TRAFFIC, trafficPoints } = createTelemetryMocks();
    writePageViewEvent({ AE_TRAFFIC }, {
      alias: "teklif-al",
      slug: "kasko-yenileme-v1",
      modifier: "fiyat",
      utm_campaign: "kasko-2026",
      utm_source: "google",
      utm_medium: "cpc",
      request_id: "req-xyz-123"
    });
    assert.equal(trafficPoints.length, 1);
    const dp = trafficPoints[0];
    assert.equal(dp.indexes[0], "traffic_memory");
    assert.equal(dp.blobs[0], "teklif-al");            // blob1: alias
    assert.equal(dp.blobs[1], "kasko-yenileme-v1");     // blob2: canonical_slug
    assert.equal(dp.blobs[2], "fiyat");                // blob3: modifier
    assert.equal(dp.blobs[3], "kasko-2026");           // blob4: campaign
    assert.equal(dp.blobs[4], "google");               // blob5: utm_source
    assert.equal(dp.blobs[5], "cpc");                  // blob6: utm_medium
    assert.equal(dp.blobs[6], "req-xyz-123");          // blob7: request_id
  });

  await t.test("writeLandingSignalEvent classifies signals and verified conversions strictly", () => {
    const { AE_CONVERSION, conversionPoints } = createTelemetryMocks();

    // 1. Explicit verified conversion (from lead flow)
    writeLandingSignalEvent({ AE_CONVERSION }, {
      type: "conversion",
      meta: { campaign: "campaign-a", source: "ig-bio", page_type: "thankyou" }
    });
    assert.equal(conversionPoints.length, 1);
    assert.equal(conversionPoints[0].indexes[0], "conversion");

    // 2. Click actions
    writeLandingSignalEvent({ AE_CONVERSION }, {
      type: "click_hard",
      meta: { campaign: "campaign-a", source: "hero" }
    });
    assert.equal(conversionPoints.length, 2);
    assert.equal(conversionPoints[1].indexes[0], "click");

    // 3. Form submit is treated as a behavioral signal (NOT a verified lead conversion)
    writeLandingSignalEvent({ AE_CONVERSION }, {
      type: "form_submit",
      meta: { campaign: "campaign-a", source: "contact-form" }
    });
    assert.equal(conversionPoints.length, 3);
    assert.equal(conversionPoints[2].indexes[0], "signal", "form_submit must NOT be stored as conversion");
    assert.equal(conversionPoints[2].blobs[1], "form_submit");

    // 4. Behavioral warmth signals
    writeLandingSignalEvent({ AE_CONVERSION }, {
      type: "engagement",
      meta: { campaign: "campaign-a", source: "landing" }
    });
    assert.equal(conversionPoints.length, 4);
    assert.equal(conversionPoints[3].indexes[0], "signal", "engagement must be stored as signal");
    assert.equal(conversionPoints[3].blobs[1], "engagement");
  });

  await t.test("isSyntheticOrProbeRequest identifies health probes, prefetch and crawler bots", () => {
    assert.equal(isSyntheticOrProbeRequest(null), false);
    assert.equal(isSyntheticOrProbeRequest(new Request("https://example.com/")), false);

    // Health probe headers
    const reqProbe1 = new Request("https://example.com/", {
      headers: { "x-cognilink-probe": "health" }
    });
    assert.equal(isSyntheticOrProbeRequest(reqProbe1), true);

    const reqProbe2 = new Request("https://example.com/", {
      headers: { "User-Agent": "CogniLink-HealthCheck/1.0" }
    });
    assert.equal(isSyntheticOrProbeRequest(reqProbe2), true);

    // Browser prefetch
    const reqPrefetch1 = new Request("https://example.com/", {
      headers: { "Sec-Purpose": "prefetch" }
    });
    assert.equal(isSyntheticOrProbeRequest(reqPrefetch1), true);

    const reqPrefetch2 = new Request("https://example.com/", {
      headers: { "Purpose": "prefetch" }
    });
    assert.equal(isSyntheticOrProbeRequest(reqPrefetch2), true);

    // Crawler bots
    const reqBot = new Request("https://example.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }
    });
    assert.equal(isSyntheticOrProbeRequest(reqBot), true);
  });
});

test("2. Full Handler Runtime Integration", async (t) => {
  // Shared environment setup for handler tests
  const setupEnv = async () => {
    const { trafficPoints, conversionPoints, AE_TRAFFIC, AE_CONVERSION } = createTelemetryMocks();
    const appConfig = new MemoryKV();
    const landingConfig = new MemoryKV();
    const routeAlias = new MemoryKV();

    // 1. Static homepage and coming-soon page
    await appConfig.put("static_page:sp_coming_soon", {
      page_id: "sp_coming_soon",
      name: "Coming Soon",
      slug: "coming-soon",
      status: "published",
      live_version_id: "ver_cs_1"
    });
    await appConfig.put("static_page_ver:sp_coming_soon:ver_cs_1", {
      version_id: "ver_cs_1",
      page_id: "sp_coming_soon",
      title: "Coming Soon",
      status: "published",
      customBodyHtml: "<p>Coming Soon Content</p>"
    });
    await appConfig.put("static_slug:coming-soon", {
      page_id: "sp_coming_soon",
      version_id: "ver_cs_1"
    });

    // 2. Published intent campaign with homepage and landing versions
    const halCampaign = {
      id: "camp-hal",
      slug: "hal",
      name: "HÂL Intent",
      product: "hal",
      homepageLandingId: "landing-hal-home",
      mainLandingId: "landing-hal-home",
      landings: [
        {
          id: "landing-hal-home",
          slug: "hal-ana-sayfa",
          alias: "hal-home",
          status: "published",
          customBodyHtml: "<p>Hal Intent Homepage</p>"
        },
        {
          id: "landing-evdeki-ses",
          slug: "evdeki-ses-duyuru-v1",
          alias: "duyuru",
          status: "published",
          customBodyHtml: "<p>Evdeki Ses Landing</p>"
        },
        {
          id: "landing-draft-only",
          slug: "taslak-landing",
          alias: "taslak",
          status: "draft",
          customBodyHtml: "<p>Draft Content</p>"
        }
      ]
    };
    await appConfig.put("campaign:camp-hal", halCampaign);
    await appConfig.put("landing:hal-ana-sayfa", { campaignId: "camp-hal", landingId: "landing-hal-home" });
    await appConfig.put("landing:evdeki-ses-duyuru-v1", { campaignId: "camp-hal", landingId: "landing-evdeki-ses" });
    await appConfig.put("landing:taslak-landing", { campaignId: "camp-hal", landingId: "landing-draft-only" });

    // Route alias mapping for alias rewrite
    await routeAlias.put("route:duyuru", "/l/evdeki-ses-duyuru-v1");

    const env = {
      ADMIN_TOKEN: "admin-secret-token",
      ROOT_DOMAIN: "niluferormanli.com",
      APP_CONFIG: appConfig,
      LANDING_CONFIG: landingConfig,
      ROUTE_ALIAS: routeAlias,
      AE_TRAFFIC,
      AE_CONVERSION,
    };

    return { env, trafficPoints, conversionPoints };
  };

  await t.test("Intent Homepage: published renders and emits 1 traffic_memory event", async () => {
    const { env, trafficPoints } = await setupEnv();
    const req = new Request("https://hal.niluferormanli.com/?utm_source=instagram&utm_medium=bio", {
      headers: { "cf-ray": "ray-intent-1" }
    });

    const res = await catchAllHandler({
      request: req,
      env,
      params: { path: [] },
      waitUntil() {}
    });

    assert.equal(res.status, 200);
    assert.equal(trafficPoints.length, 1, "Published intent homepage must emit exactly one traffic_memory event");
    assert.equal(trafficPoints[0].indexes[0], "traffic_memory");
    assert.equal(trafficPoints[0].blobs[1], "hal-ana-sayfa", "canonical_slug matches landing version");
    assert.equal(trafficPoints[0].blobs[3], "hal", "campaign matches intent campaign");
    assert.equal(trafficPoints[0].blobs[4], "instagram", "utm_source matches");
  });

  await t.test("Intent Homepage: suppresses traffic telemetry for preview and synthetic health probes", async () => {
    const { env, trafficPoints } = await setupEnv();

    // Case A: Preview request
    const reqPreview = new Request("https://hal.niluferormanli.com/?preview_version=v2", {
      headers: { Authorization: "Bearer admin-secret-token" }
    });
    trafficPoints.length = 0;
    const resPreview = await catchAllHandler({
      request: reqPreview,
      env,
      params: { path: [] },
      waitUntil() {}
    });
    assert.equal(resPreview.status, 200);
    assert.equal(trafficPoints.length, 0, "Preview request must NOT emit traffic_memory");

    // Case B: Synthetic probe request (e.g. Health check / Uptime monitor)
    const reqProbe = new Request("https://hal.niluferormanli.com/", {
      headers: { "x-cognilink-probe": "health", "User-Agent": "CogniLink-HealthCheck/1.0" }
    });
    trafficPoints.length = 0;
    const resProbe = await catchAllHandler({
      request: reqProbe,
      env,
      params: { path: [] },
      waitUntil() {}
    });
    assert.equal(resProbe.status, 200);
    assert.equal(trafficPoints.length, 0, "Synthetic probe must NOT emit traffic_memory");
  });

  await t.test("Direct Landing Route: /l/[slug] emits 1 event for published, 0 for preview, draft or synthetic probe", async () => {
    const { env, trafficPoints } = await setupEnv();

    // 1. Published direct visit
    trafficPoints.length = 0;
    const reqPub = new Request("https://niluferormanli.com/l/evdeki-ses-duyuru-v1?utm_source=newsletter", {
      headers: { "cf-ray": "ray-landing-pub" }
    });
    const resPub = await landingHandler({
      request: reqPub,
      env,
      params: { slug: "evdeki-ses-duyuru-v1" },
      waitUntil() {}
    });
    assert.equal(resPub.status, 200);
    assert.equal(trafficPoints.length, 1);
    assert.equal(trafficPoints[0].indexes[0], "traffic_memory");
    assert.equal(trafficPoints[0].blobs[0], "duyuru", "alias from landing version");
    assert.equal(trafficPoints[0].blobs[1], "evdeki-ses-duyuru-v1");
    assert.equal(trafficPoints[0].blobs[4], "newsletter");

    // 2. Draft direct visit (returns 404, 0 emitted)
    trafficPoints.length = 0;
    const reqDraft = new Request("https://niluferormanli.com/l/taslak-landing");
    const resDraft = await landingHandler({
      request: reqDraft,
      env,
      params: { slug: "taslak-landing" },
      waitUntil() {}
    });
    assert.equal(resDraft.status, 404);
    assert.equal(trafficPoints.length, 0);

    // 3. Prefetch visit (returns 200, 0 emitted)
    trafficPoints.length = 0;
    const reqPrefetch = new Request("https://niluferormanli.com/l/evdeki-ses-duyuru-v1", {
      headers: { "Sec-Purpose": "prefetch" }
    });
    const resPrefetch = await landingHandler({
      request: reqPrefetch,
      env,
      params: { slug: "evdeki-ses-duyuru-v1" },
      waitUntil() {}
    });
    assert.equal(resPrefetch.status, 200);
    assert.equal(trafficPoints.length, 0, "Prefetch request must NOT emit traffic_memory");
  });

  await t.test("Alias Rewrite Chain: [[path]].js -> /l/[slug] forwards alias header and emits exactly once", async () => {
    const { env, trafficPoints } = await setupEnv();

    // Mock global fetch to simulate internal rewrite request handling
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (reqOrUrl, init) => {
        const req = typeof reqOrUrl === "string" ? new Request(reqOrUrl, init) : reqOrUrl;
        const u = new URL(req.url);
        if (u.pathname.startsWith("/l/")) {
          const slug = u.pathname.replace("/l/", "");
          return landingHandler({
            request: req,
            env,
            params: { slug },
            waitUntil() {}
          });
        }
        return origFetch(reqOrUrl, init);
      };

      trafficPoints.length = 0;
      const reqAlias = new Request("https://niluferormanli.com/duyuru?utm_source=twitter", {
        headers: { "cf-ray": "ray-alias-rewrite" }
      });

      const resAlias = await catchAllHandler({
        request: reqAlias,
        env,
        params: { path: ["duyuru"] },
        waitUntil() {}
      });

      assert.equal(resAlias.status, 200);
      assert.equal(trafficPoints.length, 1, "Exactly one traffic_memory event must be emitted across the whole rewrite chain");
      assert.equal(trafficPoints[0].indexes[0], "traffic_memory");
      assert.equal(trafficPoints[0].blobs[0], "duyuru", "Forwarded x-cognilink-alias must be preserved in blob1");
      assert.equal(trafficPoints[0].blobs[1], "evdeki-ses-duyuru-v1", "canonical_slug must be preserved in blob2");
      assert.equal(trafficPoints[0].blobs[4], "twitter", "utm_source must be preserved in blob5");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  await t.test("Static Pages & Health Check Probe: /coming-soon emits on normal visit, ignores health probe", async () => {
    const { env, trafficPoints } = await setupEnv();

    // 1. Normal human visit to /coming-soon
    trafficPoints.length = 0;
    const reqNormal = new Request("https://niluferormanli.com/coming-soon", {
      headers: { "cf-ray": "ray-cs-human", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }
    });
    const resNormal = await catchAllHandler({
      request: reqNormal,
      env,
      params: { path: ["coming-soon"] },
      waitUntil() {}
    });
    assert.equal(resNormal.status, 200);
    assert.equal(trafficPoints.length, 1);
    assert.equal(trafficPoints[0].indexes[0], "traffic_memory");
    assert.equal(trafficPoints[0].blobs[0], "coming-soon");

    // 2. Health check probe from /api/admin/health (probe path is coming-soon on Nilüfer)
    trafficPoints.length = 0;
    const reqHealth = new Request("https://niluferormanli.com/coming-soon", {
      headers: {
        "x-cognilink-probe": "health",
        "User-Agent": "CogniLink-HealthCheck/1.0"
      }
    });
    const resHealth = await catchAllHandler({
      request: reqHealth,
      env,
      params: { path: ["coming-soon"] },
      waitUntil() {}
    });
    assert.equal(resHealth.status, 200);
    assert.equal(trafficPoints.length, 0, "Health check probe to /coming-soon must NOT inflate view counters");
  });

  await t.test("Decision Redirect 302: emits ROUTE_REDIRECT, not TRAFFIC_MEMORY", async () => {
    const { env, trafficPoints } = await setupEnv();

    // Decision rule that redirects
    await env.APP_CONFIG.put("hub:yenileme-hub", {
      id: "yenileme-hub",
      slug: "yenileme-hub",
      decision_rules: [
        {
          id: "rule-redirect",
          condition: null,
          action: "redirect",
          target: "https://niluferormanli.com/l/evdeki-ses-duyuru-v1"
        }
      ]
    });
    await env.ROUTE_ALIAS.put("route:yenileme", "yenileme-hub");

    trafficPoints.length = 0;
    const reqRedirect = new Request("https://niluferormanli.com/yenileme");
    const resRedirect = await catchAllHandler({
      request: reqRedirect,
      env,
      params: { path: ["yenileme"] },
      waitUntil() {}
    });

    assert.equal(resRedirect.status, 302);
    assert.equal(trafficPoints.length, 1);
    assert.equal(
      trafficPoints[0].indexes[0],
      OPS_EVENTS.ROUTE_REDIRECT,
      "Instant redirects must be recorded as route_redirect, NOT traffic_memory"
    );
  });

  await t.test("Client Signal Endpoint: /api/decision/signal does not duplicate AE_TRAFFIC writes", async () => {
    const { env, trafficPoints, conversionPoints } = await setupEnv();

    // Client posts page_view: updates decision warmth, but does NOT emit to AE_TRAFFIC
    trafficPoints.length = 0;
    conversionPoints.length = 0;

    const reqPageView = new Request("https://niluferormanli.com/api/decision/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page_view",
        meta: { campaign: "camp-hal", source: "landing" }
      })
    });
    const resPageView = await signalHandler({
      request: reqPageView,
      env,
      context: { env }
    });
    assert.equal(resPageView.status, 200);
    assert.equal(trafficPoints.length, 0, "signal.js page_view must NOT write duplicate traffic_memory to AE_TRAFFIC");
    assert.equal(conversionPoints.length, 0);

    // Client posts behavioral engagement signal: writes to AE_CONVERSION as signal
    const reqEngagement = new Request("https://niluferormanli.com/api/decision/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "engagement",
        score: 45,
        meta: { campaign: "camp-hal", source: "landing" }
      })
    });
    const resEngagement = await signalHandler({
      request: reqEngagement,
      env,
      context: { env }
    });
    assert.equal(resEngagement.status, 200);
    assert.equal(conversionPoints.length, 1);
    assert.equal(conversionPoints[0].indexes[0], "signal");
  });
});
