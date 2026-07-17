# CogniLink Runtime Execution State

**Updated:** 2026-07-17

## Active milestone

**M3A — Decision V2 limited cutover** is currently **blocked at the production deployment gate**. Scoped local validation was successfully executed and verified (10 trigger probes and 5 baseline probes passed with 100% correct authority and identical results). However, production deployment via the GitHub Actions pipeline is blocked because the required secrets (`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`) are missing/not configured in the repository settings. The repository remains on the safe rollback baseline.

## Production baseline

- Last health-verified active production commit before the executable-roadmap documentation update: `64cdbc53d36249f421b1b8343d86f6687b9a864d`
- M1 implementation commit: `a7c881aa8f42a750c36723b4d72226ae92326100`
- M1 verification/documentation production commit: `ea42715d0e891ca792068605cfd7ff18a08cc467`
- Health: router, KV, and Analytics Engine healthy
- Decision response authority: legacy `handleDecision()`
- Renderer authority: legacy `renderHub()`
- Runtime compatibility view: enabled
- `REAL_RULE_SHADOW_ENABLED=false`: converted real-legacy-rule comparison is disabled because the production rule inventory is empty
- `SHADOW_TELEMETRY_ENABLED=true`: generic runtime-diff telemetry is enabled
- `SHADOW_TELEMETRY_SAMPLE_RATE=0.1`: generic runtime-diff telemetry sampling rate
- M2B temporary configuration deployment commit: `6a6a6bbd680d515c15731821f846d0aa7d617dc4` (no application-code change)
- M2B rollback deployment health-verified active commit: `6a6a6bbd680d515c15731821f846d0aa7d617dc4`
- M3A scoped implementation commit: `b5d2fc7`
- M3A rollback configuration and health-verified active production commit: `5f21d9f63c505d74313f566d8b50dc43bfab29bf`

## Read-only production evidence

| Source | Result |
| --- | --- |
| `/api/slugs` | 6 records; no `decision_rules`, `shadow_decision_rules`, or `engineMapId` candidates |
| `/api/admin/pages` | 2 pages; no decision or engine-map candidates |
| `/api/admin/routes` | no global tag rules, map rules, or redirect overrides |
| `/api/config` | no global decision rules |
| `/api/admin/shadow-summary?window=1h` | 3 generic runtime-diff evaluations; 0 comparable Decision V2 samples, mismatches, or failures |

## M2B controlled validation evidence

- Approved scope: only `SLUG_LINKS["test-1783922084893-igbio"]`, `REAL_RULE_SHADOW_ENABLED`, and `SHADOW_TELEMETRY_SAMPLE_RATE` changed temporarily; no other KV key, Pages project, environment variable, or Cloudflare resource was changed.
- Preflight: clean worktree; production origin `https://runtime.ekinyasa.online`; target had no `decision_rules`, no expiration, and JSON metadata; health returned `200`.
- Temporary rule conversion: Inspector reported `legacy_action=render`, `v2_action=render`, `source_count=1`, `converted_count=1`, `unsupported_count=0`, `comparison_status=identical`, `rule_source=page_config`, and `matched_rule_id=m2-shadow-source-render`.
- Runtime activation: Inspector confirmed `REAL_RULE_SHADOW_ENABLED=true` and sampling rate `1` after a controlled deployment of the verified repository HEAD. The request correlation identifier was captured only in process memory and not persisted.
- Rollback: the target value was byte-equal to its preimage; expiration matched; metadata was JSON-semantically equal; `decision_rules` was absent; both Pages flags matched baseline; health returned `200`; and the normal public route status/location matched its preimage behavior.
- Evidence method: the explicitly approved Inspector response was the single-probe authority. Analytics SQL was not used and no Account Analytics permission was requested.

## M3A approved authority scope

- Scope: only direct `/c/test-1783922084893-igbio` requests with `utm_source=m2-shadow-probe` and matched rule `m2-shadow-source-render` may use Decision V2 authority.
- Authority contract: V2 action is used only after an identical legacy comparison, one converted supported rule, and a valid V2 action. All other routes, sources, rules, errors, unsupported results, and invalid actions retain legacy authority.
- Fallback and rollback owner: Codex. Any action mismatch, scope escape, fallback failure, 5xx, health failure, or unexpected response difference requires immediate return to legacy authority.
- Observation contract: at least 10 controlled trigger probes, 5 triggerless baseline probes, 15 minutes of production checks, and health/diagnostic verification.
- Manual gate owner: Ekin. Browser validation is mandatory before recording M3A completion or considering M3B.

## M3A failed validation and safety rollback

- The scoped implementation commit was `b5d2fc7`. The selected target record temporarily received only the approved `decision_rules` entry, and the scoped Pages authority flags were enabled for the validation window.
- The validation process connection ended before it produced the required ten trigger probes, five baseline probes, fifteen-minute observation, or a complete diagnostic record. No successful M3A result is claimed.
- Codex immediately restored legacy baseline configuration: `DECISION_V2_CUTOVER_ENABLED=false`, `REAL_RULE_SHADOW_ENABLED=false`, sampling restored to `0.1`, and all selected cutover identifiers cleared.
- Read-only recovery verification: rollback_verified. Confirmed the selected record has no `decision_rules`, metadata remains a JSON object, no expiration is present, and production health returned `200`.
- The original target value was held only in the bounded process memory that became unavailable. The recovery write removed only `decision_rules` from the current JSON record, so semantic restoration is verified but raw byte-for-byte preimage equality cannot be certified. This integrity caveat blocks completion and requires an explicit retry/recovery decision before M3A resumes.

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
