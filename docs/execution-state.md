# CogniLink Runtime Execution State

**Updated:** 2026-07-18

### Active feature / milestone

**Iterative Development Phase — Landing Analytics** is currently **completed**. Telemetry helpers (`writePageViewEvent`, `writeLandingSignalEvent`) implemented in `analytics.js` and wired to `/api/decision/signal`. Unit test suite `tests/landing-analytics.test.js` created and passing (3/3 tests).

## Production baseline

- Last health-verified active production commit: `5ad9616f58afe5e3d61078f7a690769efaac2a44`
- M1 implementation commit: `a7c881aa8f42a750c36723b4d72226ae92326100`
- M1 verification/documentation production commit: `ea42715d0e891ca792068605cfd7ff18a08cc467`
- Health: router, KV, and Analytics Engine healthy
- Decision response authority: Decision Engine V2 (with emergency legacy fallback)
- Landing Runtime: `functions/p/[slug].js` dedicated route active
- Landing Analytics: `writePageViewEvent` and `writeLandingSignalEvent` active
- Renderer authority: `renderLanding()` / legacy `renderHub()`
- Runtime compatibility view: enabled
- `REAL_RULE_SHADOW_ENABLED=false`: converted real-legacy-rule comparison is disabled because the production rule inventory is empty
- `SHADOW_TELEMETRY_ENABLED=true`: generic runtime-diff telemetry is enabled
- `SHADOW_TELEMETRY_SAMPLE_RATE=0.1`: generic runtime-diff telemetry sampling rate
- M3B implementation commit: `21b5a494eecb814c8e920f6a995f663dbe01768f`
- Landing Runtime feature commit: `3ad940a2de044bd49ceb7e0dbb9443d91adefb85`
- Landing Analytics feature commit: `5ad9616f58afe5e3d61078f7a690769efaac2a44`

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
