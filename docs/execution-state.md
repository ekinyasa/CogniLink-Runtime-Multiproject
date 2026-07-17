# CogniLink Runtime Execution State

**Updated:** 2026-07-17

## Active milestone

**M3A — Decision V2 limited cutover** is at a manual gate. M2B completed with an explicitly approved, one-request controlled shadow validation and a verified full rollback. Decision response authority remains legacy; no M3A work has started.

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

## Next gates

1. Stop at M3A: obtain explicit approval for the Decision V2 authority scope, success metrics, rollback owner, and required manual render validation.
2. Do not cut over Decision V2, renderer, journeys, or Rule Builder before their recorded prerequisites are met.
3. M3A/M3B, M4B/M4C, M5A, M6A/M6B, and Pulse UI each retain their own public-behavior, product, or visual manual gates.

## Change log

- 2026-07-17: Disabled empty real-rule soak in `98de036`; retained generic runtime shadow telemetry.
- 2026-07-17: Established this execution ledger and roadmap.
- 2026-07-17: Completed M1 implementation: request/user-state shadow context, matched-render identity, and engine-override coverage accounting.
- 2026-07-17: Verified M1 implementation `a7c881a` in production; `ea42715` is the post-verification documentation commit confirmed active by health. Inspector found no production rule sources and the public smoke response was unchanged.
- 2026-07-17: Expanded M2–M7 into evidence-based executable contracts without changing runtime code, production routes, flags, or configuration.
- 2026-07-17: Completed M2B with the approved temporary source rule and one Inspector probe. Both decision engines rendered identically; all temporary KV and Pages configuration changes were fully rolled back and verified before the M3A manual gate.
