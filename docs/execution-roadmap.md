# CogniLink Runtime Execution Roadmap

**Authority order:** production code and tests, current runtime documents, this roadmap, historical notes.

## Verified baseline — 2026-07-17

- Last health-verified active production commit: `ea42715d0e891ca792068605cfd7ff18a08cc467` (M1 verification/documentation production commit).
- M1 implementation commit: `a7c881aa8f42a750c36723b4d72226ae92326100`.
- Runtime Adapter, Runtime Diff, Inspector, compatibility view, non-authoritative Decision V2 evaluation, generic runtime-diff telemetry, and summary endpoints are implemented and tested.
- `RUNTIME_CONTEXT_READ_ENABLED=true` serves the legacy-compatible view. Legacy `handleDecision()` and `renderHub()` remain the response authorities.
- Production contains six `SLUG_LINKS` records, two `APP_CONFIG` pages, and no page, global, or engine legacy decision rules or overrides. Real-rule comparison therefore has no sample population.
- Production flags: `REAL_RULE_SHADOW_ENABLED=false`, `SHADOW_TELEMETRY_ENABLED=true`, and `SHADOW_TELEMETRY_SAMPLE_RATE=0.1`.
- `REAL_RULE_SHADOW_ENABLED` gates converted real-legacy-rule comparison; it is distinct from non-authoritative Decision V2 evaluation and from generic runtime-diff telemetry.
- `SHADOW_TELEMETRY_ENABLED` and `SHADOW_TELEMETRY_SAMPLE_RATE` govern generic runtime-diff telemetry only; they do not create comparable Decision V2 evidence.

## Documentation reconciliation

| Source | Code reality | Roadmap decision |
| --- | --- | --- |
| `runtime_adapter.md` calls for a full router/decision/renderer cutover. | Only the compatibility view is read; legacy decision and renderer still serve users. | Treat cutover as a gated future milestone. |
| `runtime_data_model.md` proposes `page:` storage. | Runtime repository reads `APP_CONFIG["hub:<id>"]`. | `hub:` is the active contract; no key migration without a data-migration gate. |
| `runtime_diff.md` describes telemetry as a future `AE_SHADOW_LOGS` task. | Telemetry and summary use `AE_TRAFFIC` and are production-verified. | Mark this historical step complete and do not create a new dataset. |
| Decision documents assume rules can be compared in production. | The production rule inventory is empty. | Block real-rule soak and cutover until a real rule source exists. |
| Journey documentation describes a future engine. | A minimal `journey-router.js` and admin CRUD already exist, but routing is heuristic. | Treat journey work as hardening after renderer work, not a greenfield build. |

## Milestones

### M0 — Execution governance — complete

Create the execution roadmap, state ledger, and persistent repository rules. Keep historical notes as non-authoritative evidence.

### M1 — Decision V2 shadow-context parity — complete

**Goal:** Give V2 the same immutable request and pre-decision user-state inputs used by the legacy evaluator, without changing the public response.

**Scope:** Build a pure shadow context, use it in both runtime entry points, preserve legacy matched-render identity, count derived engine overrides as converted sources, and add parity regression tests for UTM/campaign and user-state conditions.

**Exit:** Full tests pass; production Inspector remains shadow-only and normal public responses are unchanged.

### M2A — Rule source and evidence design — manual gate

**Goal:** Evaluate a genuine product rule, a controlled test route, and synthetic evidence before selecting a production legacy-rule source and an evidence design.

**Gate:** The selected route and test design require explicit product/configuration approval. Never add user-facing behavior solely to produce telemetry; do not automate production KV/config mutation.

**Exit criteria:** An approved rule source, route, expected behavior, rollback, and evidence method are recorded.

### M2B — Comparable production shadow soak — blocked by M2A

**Goal:** After an approved legacy rule source is available, gather comparable Decision V2 evidence without changing normal response authority.

**Prerequisites:** M2A complete; the approved production configuration is in place; real-rule comparison is explicitly authorized.

**Exit criteria:** At least one route reports `source_count > 0`; converted or unsupported coverage is visible; and the summary has nonzero comparable samples without decision failures.

### M3 — Decision V2 response cutover — manual gate

**Prerequisites:** M1 and M2B complete; explicit approval for a public behavior change; rollback plan verified.

**Scope after approval:** Switch only the decision authority, retain legacy fallback and instrumentation, and verify production parity before widening traffic.

### M4 — Renderer V2 readiness and cutover — blocked by M3

Preserve renderer byte/behavior compatibility first, then require a separate visual/manual gate before any public renderer authority change.

### M5 — Journey Engine hardening — blocked by M4

Replace the current heuristic traversal only after decision and renderer contracts are stable. This requires journey semantics and product ownership decisions.

### M6 — Rule Builder — blocked by M2B/M3

Expose only rule grammar that has production conversion coverage. Unsupported semantics such as `notTags` must remain explicitly unsupported until the engine contract changes.

### M7 — Pulse / Shadow Health — blocked by M3

Improve operator visibility only after real comparison data exists. Do not alter Pulse UI during M0–M3 preparation.

## Deferred and excluded

- Lead Engine and new product features are out of scope.
- No new datasets, telemetry contracts, production KV mutations, or renderer rewrites are implied by this roadmap.
