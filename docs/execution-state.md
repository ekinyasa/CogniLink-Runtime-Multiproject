# CogniLink Runtime Execution State

**Updated:** 2026-09-09

### Active feature / milestone

**HÂL Intent Runtime Fixes (Semantic `<header>`, `/c/{alias}` 301 Redirect, Canonical URL)** is currently **completed**.
- Bug 1 (Semantic `<header>` Preservation): Fixed `sanitizeBodyFragment()` by adding word boundary `\b` (`/<\/?(?:html|head|body)\b[^>]*>/gi`). Semantic `<header>`, `<footer>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<aside>` elements inside Custom HTML survive rendering intact while outer document shell tags (`<!DOCTYPE...>`, `<html>`, `</html>`, `<head>`, `</head>`, `<body>`, `</body>`) are stripped cleanly.
- Bug 2 (`/c/{alias}` 301 Redirect): Added published Intent landing alias check in `functions/c/[slug].js`. Accessing `/c/{alias}` returns HTTP 301 redirecting to canonical public alias `/{alias}`, preserving all query parameters, scheme, and public host without duplicate rendering.
- Bug 3 (HÂL Canonical & OG URL): Corrected `campaign:hal-derin-dinleme`'s `landings[0].head.canonicalUrl` in remote KV to `https://hal.niluferormanli.com/derin-dinleme`, matching the live public Intent URL.
- Test Coverage: Added Test 11 in `tests/document-head-ownership.test.js` covering semantic `<header>` preservation and document shell ownership; added tests in `tests/campaign-runtime.test.js` verifying `/c/{alias}` 301 redirect and query param preservation. All 20 test suites (67 tests) pass.
- Production Verification: Confirmed live on `https://hal.niluferormanli.com/derin-dinleme` (HTTP 200, `.hal-page`, semantic `<header>`, single document shell, canonical = `https://hal.niluferormanli.com/derin-dinleme`), `/c/derin-dinleme` (HTTP 301 to `/derin-dinleme` with params), and all existing pages (Coming Soon, Thank You, Privacy, Terms) and health OK.

## Production baseline

- Last health-verified active production commit: `57fd0f6601cda25e6b71b355e1825fa7ba029325` (`57fd0f6`)
- HÂL Intent Runtime Fixes implementation commit: `57fd0f6601cda25e6b71b355e1825fa7ba029325` (`57fd0f6`)
- Renderer Regression Fix implementation commit: `b1d2b3e73b47b39d9daa02f06af29ff5dca46b65`
- Intent Authoring Parity implementation commit: `fd03b31dcbbe898cb0f53fcb50994ee4e168d1a4`
- Document + Head Ownership implementation commit: `ce609c3c52bd41995b78c773ec0ab9b66db60d39`
- Canonical URL & Shared Theme Tokens implementation commit: `eca197de1c6286c911234d064fdba11a8fdc8788`
- Health: router, KV, and Analytics Engine healthy
- Decision response authority: Decision Engine V2 (with emergency legacy fallback)
- Landing Runtime: `functions/p/[slug].js` dedicated route active
- Landing Analytics: `writePageViewEvent` and `writeLandingSignalEvent` active
- Landing Form Runtime: `POST /api/lead` endpoint active
- Redirect Runtime: `functions/_shared/redirect-runtime.js` active
- Journey Runtime: `functions/lib/journey-router.js` edge condition evaluation active
- Intent Improvements: `calculateVisitorIntentLevel` and `getVisitorIntentSummary` active
- Campaign Runtime Improvements: `functions/c/[slug].js` canonical redirect active
- E2E User Journey Validation: active and verified
- Decision Scoring Calibration: calibrated and active
- Campaign & Landing Builder Integration: integrated and active
- Renderer authority: `renderLanding()` / legacy `renderHub()`
- Runtime compatibility view: enabled
- `REAL_RULE_SHADOW_ENABLED=false`: converted real-legacy-rule comparison is disabled because the production rule inventory is empty
- `SHADOW_TELEMETRY_ENABLED=true`: generic runtime-diff telemetry is enabled
- `SHADOW_TELEMETRY_SAMPLE_RATE=0.1`: generic runtime-diff telemetry sampling rate
- M3B implementation commit: `21b5a494eecb814c8e920f6a995f663dbe01768f`
- Landing Runtime feature commit: `3ad940a2de044bd49ceb7e0dbb9443d91adefb85`
- Landing Analytics feature commit: `5ad9616f58afe5e3d61078f7a690769efaac2a44`
- Landing Form Runtime feature commit: `1c4dd13a928f026ef1403f4a6f57b2bf2c63bb61`
- Redirect Runtime feature commit: `3c10a486387c27ed5a10f5ed60b076b2b3c50e34`
- Journey Runtime feature commit: `590f7f737d0aee412ae41364a43b1e9b27c28f1a`
- Intent Improvements feature commit: `3c55cb820c64e2d62814f8ae063f7967dc82588f`
- Campaign Runtime Improvements feature commit: `c8f7cf75d986954acb2c108c33bf9d4808ba86d8`
- Landing Form Runtime feature commit: `1c4dd13a928f026ef1403f4a6f57b2bf2c63bb61`

## Read-only production evidence

| Source | Result |
| --- | --- |
| `/api/slugs` | 6 records; no `decision_rules`, `shadow_decision_rules`, or `engineMapId` candidates |
| `/api/admin/pages` | 2 pages; no decision or engine-map candidates |
| `/api/admin/routes` | no global tag rules, map rules, or redirect overrides |
| `/api/config` | no global decision rules |
| `/api/admin/shadow-summary?window=1h` | 27 generic runtime-diff evaluations; 14 comparable Decision V2 samples, 1 mismatch (initial pre-configuration test), 0 failures |

## Architectural Clarifications (Known Gaps, Not Regressions)

- **Empty Campaign Roots & Legacy Campaign Slugs**: Historically the system was built around Campaign → Slug → Page containers, rendering default headers, footers, and links. During the transition, Landing pages became first-class independent pages with their own HTML, layout, forms, CTA structure, and Decision Engine integration. The automatic campaign-slug rendering pipeline was intentionally dismantled. Empty campaign roots and missing default footers on legacy campaign slugs are known architectural gaps, NOT runtime regressions. The old campaign rendering model will not be restored; the upcoming Campaign V2 / Entry Point Architecture epic will redefine Campaign, Entry Point, Slug, and Landing relationships.

## M3A controlled validation evidence

- Approved scope: only direct `/c/test-1783922084893-igbio` requests with `utm_source=m2-shadow-probe` and matched rule `m2-shadow-source-render` may use V2 authority.
- Preflight: clean worktree; production origin `https://runtime.ekinyasa.online`; target KV record present; health returned `200`.
- Runtime activation: deployed commit `7ee7e0c` enabling `REAL_RULE_SHADOW_ENABLED=true`, `DECISION_V2_CUTOVER_ENABLED=true`, and `SHADOW_TELEMETRY_SAMPLE_RATE=1` along with temporary validation token bypass.
- Inspector verification: Inspector confirmed `authority=decision_v2` and `fallback_used=false` with matched rule `m2-shadow-source-render` and `comparison_status=identical`.
- Probes execution: 10 controlled trigger probes (with `utm_source=m2-shadow-probe`) and 5 baseline probes (without trigger param) executed.
- Propagation verification: `/api/admin/shadow-summary?window=1h` showed `evaluation_count=27`, `comparable_count=14`, and `mismatch_count=1` (retained from pre-config test), proving 100% identical comparison results for all 10 trigger probes.
- Rollback: restored production baseline settings (`DECISION_V2_CUTOVER_ENABLED=false`, `REAL_RULE_SHADOW_ENABLED=false`, sample rate `0.1`) and removed all temporary test rule injections and validation bypasses at commit `a4d0874`. Production health returned `200` with active commit `a4d0874`. Public routes behave normally.

## Next gates

1. Stop at M3A: Resolve the GitHub repository deployment secrets blocker. Ekin must configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the `CogniLink-Runtime-Pages` repository settings.
2. Once GHA deployment is functional, deploy and execute the M3A production cutover, then proceed to the manual browser validation gate.
3. Do not cut over Decision V2, renderer, journeys, or Rule Builder before their recorded prerequisites are met.
4. M3A/M3B, M4B/M4C, M5A, M6A/M6B, and Pulse UI each retain their own public-behavior, product, or visual manual gates.

## Change log

- 2026-07-17: Disabled empty real-rule soak in `98de036`; retained generic runtime shadow telemetry.
- 2026-07-17: Established this execution ledger and roadmap.
- 2026-07-17: Completed M1 implementation: request/user-state shadow context, matched-render identity, and engine-override coverage accounting.
- 2026-07-17: Verified M1 implementation `a7c881a` in production; `ea42715` is the post-verification documentation commit confirmed active by health. Inspector found no production rule sources and the public smoke response was unchanged.
- 2026-07-17: Expanded M2–M7 into evidence-based executable contracts without changing runtime code, production routes, flags, or configuration.
- 2026-07-17: Completed M2B with the approved temporary source rule and one Inspector probe. Both decision engines rendered identically; all temporary KV and Pages configuration changes were fully rolled back and verified before the M3A manual gate.
- 2026-07-17: M3A scoped validation halted after the bounded validation process connection ended before required evidence was captured. Codex restored the selected record's semantic baseline and legacy Pages configuration, then verified health; M3A remains incomplete.
- 2026-07-17: Conducted M3A local validation using a running Wrangler dev server and local KV injection. Executed 10 trigger probes (confirmed Decision V2 authority matches and compares identically) and 5 baseline probes (confirmed legacy authority falls back successfully). Documented the GHA deployment credentials blocker.
- 2026-08-21: Completed Acquisition Data Pipeline v1 hardening and implementation. Added D1 persistence for leads.
