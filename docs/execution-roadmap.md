# CogniLink Runtime Execution Roadmap

**Authority order:** production code and tests, current runtime documents, this roadmap, historical notes.

## Verified baseline — 2026-07-17

- Last health-verified active production commit before this roadmap update: `64cdbc53d36249f421b1b8343d86f6687b9a864d`.
- M1 implementation commit: `a7c881aa8f42a750c36723b4d72226ae92326100`; M1 verification/documentation commit: `ea42715d0e891ca792068605cfd7ff18a08cc467`.
- Runtime Adapter, Runtime Diff, Inspector, compatibility view, non-authoritative Decision V2 evaluation, generic runtime-diff telemetry, and summary endpoints are implemented and tested.
- `RUNTIME_CONTEXT_READ_ENABLED=true` serves the legacy-compatible view. Legacy `handleDecision()` and `renderHub()` remain the response authorities.
- Read-only inventory found six `SLUG_LINKS` records, two `APP_CONFIG` pages, and no page, global, or engine legacy decision rules or overrides. There is no production population for real-rule comparison.
- Production flags: `REAL_RULE_SHADOW_ENABLED=false`, `SHADOW_TELEMETRY_ENABLED=true`, and `SHADOW_TELEMETRY_SAMPLE_RATE=0.1`.
- `REAL_RULE_SHADOW_ENABLED` gates converted real-legacy-rule comparison. It is separate from non-authoritative Decision V2 evaluation. `SHADOW_TELEMETRY_ENABLED` and `SHADOW_TELEMETRY_SAMPLE_RATE` govern generic runtime-diff telemetry and do not create comparable Decision V2 evidence.

## Documentation reconciliation

| Source | Code reality | Roadmap decision |
| --- | --- | --- |
| `runtime_adapter.md` proposes a router/decision/renderer cutover. | Only the compatibility view is read; legacy decision and renderer still serve users. | Split authority changes into limited and full cutovers with separate gates. |
| `runtime_data_model.md` proposes `page:` storage. | Runtime repository reads `APP_CONFIG["hub:<id>"]`. | `hub:` is the active contract; no key migration is assumed. |
| `runtime_diff.md` and `runtime_inspector.md` describe future `AE_SHADOW_LOGS` and query-token Inspector access. | Generic telemetry and summary use `AE_TRAFFIC`; Inspector requires an authenticated header. | Do not add a dataset or restore query-token access. |
| `decision_rule_model.md` describes a future rule language and visual builder. | V2 evaluator and compatibility mapper exist; no production rule population or Rule Builder contract exists. | Treat rule-source evidence and Rule Builder as separate gated work. |
| Historical Campaign OS roadmap describes routing, experiment, and fixture capabilities. | It is archived and broader than the current runtime transition. | Do not infer unverified fixtures, cleanup, or productization work into this roadmap. |
| Journey documents describe a future engine. | `journey-router.js` and admin CRUD exist, but traversal is explicitly heuristic. | Split semantics design from hardening; do not treat the POC as a product contract. |

## Milestone contract rules

- A milestone may start automatically only when its prerequisites and manual-gate requirements are satisfied.
- “Read-only production verification” may issue authenticated Inspector/admin reads and ordinary public GET requests only. It never changes KV, flags, datasets, or response authority.
- A limited cutover must be reversible by a configuration/code switch and retain the previous authority as fallback. A full cutover needs a separately approved rollback plan.
- Generic runtime-diff telemetry is health evidence only. It must never be reported as comparable Decision V2 evidence unless `source_count > 0` and the comparator produced a status.
- A normal production route must not receive behavior solely to generate telemetry. A genuine product rule, controlled test route, or synthetic proof requires the manual decision recorded in M2A.

## Completed milestones

### M0 — Execution governance — complete

Execution rules, state ledger, and the production verification workflow are established.

### M1 — Decision V2 shadow-context parity — complete

V2 receives immutable request/user-state inputs compatible with legacy evaluation; matched renders and engine-override conversion accounting have regression coverage. Public decision authority remains legacy.

## Executable milestones

### M2A — Rule source and evidence design — manual gate

- **Goal:** Select an evidence design for a real legacy rule without creating production behavior merely to produce telemetry.
- **Why now:** Production inventory contains no legacy rule source, so the existing generic telemetry cannot prove Decision V2 compatibility.
- **Prerequisites:** M1 complete; current inventory and flag baseline recorded.
- **In scope:** Evaluate three choices: an existing genuine product rule when one becomes available; a deliberately approved controlled test route; or synthetic repository evidence that validates code but does not claim production soak. Record target route, rule semantics, affected users, expected legacy outcome, comparison method, retention window, and rollback owner.
- **Out of scope:** Adding a rule, changing a route, enabling real-rule comparison, modifying KV/config, or treating synthetic tests as production evidence.
- **Repository evidence:** `functions/_shared/rule-repository.js` reads page, shadow-page, and engine-map sources only when `REAL_RULE_SHADOW_ENABLED=true`; `tests/real-rule-soak.test.js` and `tests/runtime-route-compatibility.test.js` cover those shapes; production admin inventory found none.
- **Implementation steps:** 1. Re-run read-only inventory immediately before the decision. 2. Document each viable source and its public impact. 3. Reject telemetry-only behavior. 4. Obtain explicit approval for exactly one option, route, semantics, and rollback. 5. Record the decision in `docs/execution-state.md`.
- **Automated acceptance criteria:** Repository tests for rule conversion, comparison, and Inspector context pass; proposed legacy shape has a deterministic fixture; no runtime/config diff exists before approval.
- **Read-only production verification:** Inspect `/api/slugs`, `/api/admin/pages`, `/api/admin/routes`, `/api/config`, and `/api/admin/shadow-summary?window=1h`; confirm current flags via Inspector on an existing route.
- **Manual gate:** Product/configuration decision is mandatory. Options: (A) wait for a genuine product rule — no new impact; (B) approve a controlled route/rule — introduces only the explicitly described route behavior; (C) accept synthetic proof — zero production impact but no production soak claim. Recommended option: **A**; it produces representative evidence without inventing user behavior.
- **Rollback plan:** No mutation is performed in M2A. Any later selected rule must have its removal/reversion procedure approved before M2B starts.
- **Exit criteria:** One option, route, legacy semantics, expected public impact, evidence method, rollback, and explicit approval are recorded.
- **Next milestone unlock condition:** M2B unlocks only after M2A exit criteria and the approved source are actually present.

### M2B — Comparable production shadow soak — completed 2026-07-17

- **Goal:** Observe converted real legacy rules and compare legacy and V2 decisions without changing normal response authority.
- **Why now:** This is the missing evidence required before any Decision V2 authority work; it must follow an approved source rather than manufacture traffic behavior.
- **Prerequisites:** M2A complete; approved source is present; approved production configuration change is complete; real-rule comparison is explicitly authorized; rollback is ready.
- **In scope:** Enable only the approved real-rule comparison path, collect a bounded number of read-only requests consistent with the approved rule, inspect conversion coverage and comparator outcomes, and read the AE summary.
- **Out of scope:** Decision V2 authority, renderer changes, new telemetry contracts/datasets, widening traffic, or unrelated rule changes.
- **Repository evidence:** `rule-repository.js`, `rule-compat.js`, `decision-comparator.js`, Inspector `metadata.realRuleShadow`, and `/api/admin/shadow-summary` already expose conversion and comparison information. `notTags` is intentionally unsupported and must remain visible as unsupported rather than being silently applied.
- **Implementation steps:** 1. Verify the approved rule through Inspector. 2. Confirm `source_count > 0` and conversion/unsupported accounting. 3. Issue only the approved low-volume reads. 4. Observe `identical`, `semantic_mismatch`, `not_comparable`, `legacy_error`, or `v2_error`. 5. Read the summary after AE delay. 6. Stop on mismatch/failure and preserve evidence.
- **Automated acceptance criteria:** Full rule-compatibility, comparator, repository, route compatibility, and telemetry suites pass against fixtures for the approved rule shape.
- **Read-only production verification:** Authorized Inspector on the selected route; normal public GET comparison for unchanged legacy response; `/api/admin/shadow-summary?window=1h`; health endpoint.
- **Manual gate:** None after M2A approval, unless results require a new route/rule, a flag/config change outside the approved design, or an observed mismatch needs a product decision.
- **Rollback plan:** Disable/remove only the approved rule/config change and restore the prior `REAL_RULE_SHADOW_ENABLED` state; do not roll back unrelated generic telemetry flags.
- **Exit criteria:** At least one selected route shows `source_count > 0`; converted or unsupported coverage is visible; comparable samples are nonzero; no unresolved decision failure exists; normal public behavior remains legacy.
- **Next milestone unlock condition:** M3A unlocks only with a written parity assessment, explicit cutover scope, and product approval for public behavior change.
- **Execution result:** The explicitly approved controlled route used one temporary page rule and one Inspector request. It produced one converted, comparable `identical` render result with no unsupported rules. The target KV value, expiration, and metadata were restored and verified; both temporary Pages flags were restored through a second production deployment. By explicit approval, the Inspector response—not Analytics SQL—was the single-probe evidence source.

### M3A — Decision V2 limited cutover — manual gate

- **Goal:** Move an explicitly bounded, approved decision scope from legacy authority to V2 while retaining legacy fallback and observability.
- **Why now:** Limited authority is safer than a global switch once M2B proves a representative source, but it is still a public behavior change.
- **Prerequisites:** M1 and M2B complete; no unresolved comparator failure; selected route/rule scope and success metrics approved; explicit rollback owner.
- **In scope:** Implement a narrowly scoped authority boundary, legacy fallback on V2 error, deterministic route/rule targeting, tests for both authority paths, and read-only verification of the approved scope.
- **Out of scope:** Global Decision V2 authority, renderer authority, unrelated route/config changes, new data models, or changing unsupported semantics.
- **Repository evidence:** `functions/[[path]].js` and `functions/c/[slug].js` invoke legacy `handleDecision()` as authority and V2 only as shadow; `decision-controller.js` preserves legacy decision identity; existing comparator tests cover parity states.
- **Implementation steps:** 1. Design the explicit scope and switch without assuming an existing cutover flag. 2. Add pure/unit and route regression tests. 3. Verify legacy fallback deterministically. 4. Deploy only after manual approval. 5. Validate approved public requests, Inspector, health, and summary. 6. Halt on any unexpected action/redirect/render difference.
- **Automated acceptance criteria:** Full test suite passes; targeted tests prove V2 authority only within scope, legacy outside scope, and legacy fallback on V2 exception; `git diff --check` is clean.
- **Read-only production verification:** Health active commit; approved route smoke matrix; authenticated Inspector; shadow summary; compare headers/status/redirect destination with the approved expected behavior.
- **Manual gate:** Explicit public-behavior approval for the selected scope and rollback trigger is mandatory; manual browser verification is required if render output is involved.
- **Rollback plan:** Disable the scoped authority switch and immediately return the selected scope to legacy `handleDecision()`; retain evidence and do not alter rule data.
- **Exit criteria:** Approved limited scope remains stable through the agreed observation window, fallback is proven, no unresolved mismatch/failure exists, and product owner accepts results.
- **Next milestone unlock condition:** M3B unlocks only after explicit approval to expand from the limited scope to full Decision V2 authority.
- **Approved scope (2026-07-17):** Only direct `/c/test-1783922084893-igbio` requests with `utm_source=m2-shadow-probe` and matched rule `m2-shadow-source-render` may use V2 authority. All other routes and rule sources remain legacy. Codex owns automatic rollback; Ekin owns the post-observation browser gate.
- **Execution result (2026-07-17):** The first scoped validation halted when its bounded execution connection ended before the required probe matrix and observation evidence could be captured. Codex removed the temporary target rule, restored legacy configuration, and verified the selected record's semantic state and health. Because the original raw preimage existed only in the ended process memory, byte-for-byte restoration cannot be certified; no M3A success or browser gate is claimed. M3A remains incomplete and M3B stays locked until an explicitly approved retry/recovery procedure addresses this evidence-integrity gap. Update: The rollback integrity and legacy baseline state has been verified as rollback_verified.

### M3B — Decision V2 full authority — manual gate

- **Goal:** Make V2 the normal decision authority while retaining a documented emergency legacy fallback during stabilization.
- **Why now:** Full authority is considered only after a successful limited cutover; no code or historical document proves readiness by itself.
- **Prerequisites:** M3A complete; stable approved observation window; full route/rule coverage assessment; product approval; rollback rehearsal or equivalent deterministic proof.
- **In scope:** Expand the approved decision authority boundary, retain telemetry/Inspector diagnostics, maintain fallback, and update runtime documentation/tests.
- **Out of scope:** Renderer authority, Journey semantics, Rule Builder UI, data migration, and deleting legacy code during the stabilization period.
- **Repository evidence:** Legacy decision authority is centralized through `handleDecision()` at runtime entry points, while `evaluateDecision()` is pure and tested. No current full-authority switch exists, so implementation details must be designed and reviewed rather than assumed.
- **Implementation steps:** 1. Define exhaustive route classes and exclusions. 2. Implement authority/fallback boundary and tests. 3. Run limited rehearsal where safe. 4. Deploy only after gate. 5. Verify public decision effects, Inspector, telemetry, and error fallback. 6. Keep legacy path intact until a later retirement decision.
- **Automated acceptance criteria:** Full suite plus route-class matrix passes; fallback test proves response preservation; tests cover redirect, render, block, default, invalid, and unsupported-rule behavior.
- **Read-only production verification:** Health, route-class smoke matrix, Inspector comparison data where rules exist, AE summary, and low-risk response/header/redirect checks.
- **Manual gate:** Explicit approval for global public decision authority and an agreed monitoring/rollback window.
- **Rollback plan:** Restore legacy authority globally through the approved boundary; do not delete or migrate rule data; capture diagnostics before any further change.
- **Exit criteria:** Full authority is approved, stable for the agreed window, fallback remains available, and no unresolved production discrepancy exists.
- **Next milestone unlock condition:** M4A unlocks after M3B stabilization because renderer compatibility must consume a stable decision contract.

### M4A — Renderer V2 compatibility — blocked by M3B

- **Goal:** Define and test a non-authoritative Renderer V2 against the current `renderHub()` contract.
- **Why now:** Renderer work must follow a stable decision authority; current rendering remains legacy and no Renderer V2 implementation is present.
- **Prerequisites:** M3B complete; canonical render inputs and representative legacy fixtures identified; rendering comparison strategy approved for sensitive HTML/CSS output.
- **In scope:** Pure renderer boundary, deterministic fixture/snapshot or semantic-output tests, component ordering/escaping/UTM/experiment coverage, and diagnostics that do not expose HTML or secrets in telemetry.
- **Out of scope:** Changing production renderer authority, visual redesign, Pulse UI, component schema migration, or production config mutation.
- **Repository evidence:** `functions/_shared/hub-renderer.js` is current authority; `functions/api/admin/components-test.js` exercises renderer components; runtime entry points call `renderHub()` after legacy decisions. No V2 renderer module or production parity corpus exists.
- **Implementation steps:** 1. Extract the observable renderer contract from fixtures and current output. 2. Build V2 as a pure non-authoritative module. 3. Add deterministic and safety tests. 4. Compare selected legacy/V2 outputs locally without emitting page bodies. 5. Record known intentional differences only with approval.
- **Automated acceptance criteria:** Renderer contract tests cover normal, not-found, components, custom layout, UTM, experiment, escaping, and deterministic output; public runtime regression tests remain green.
- **Read-only production verification:** Inspector/public GETs collect only status, headers, redirect behavior, and approved visual artifacts; no production V2 renderer output is served.
- **Manual gate:** None for pure compatibility work; a manual browser/visual gate is required before any route can serve Renderer V2.
- **Rollback plan:** Renderer V2 remains unreachable from normal runtime until M4B; remove only its non-authoritative use if tests expose a defect.
- **Exit criteria:** Contract coverage and approved parity assessment are complete; no normal response path invokes Renderer V2.
- **Next milestone unlock condition:** M4B unlocks only after a visual test plan, selected route scope, and public behavior approval.

### M4B — Renderer V2 limited cutover — manual gate

- **Goal:** Serve Renderer V2 for an explicitly approved limited scope while preserving legacy rendering fallback.
- **Why now:** HTML/CSS output is user-visible, so a limited scope and manual visual verification are required even after automated compatibility passes.
- **Prerequisites:** M4A complete; selected route(s), expected visual output, accessibility/browser matrix, and rollback criteria approved.
- **In scope:** Scoped renderer authority boundary, legacy fallback, visual regression evidence, response/header checks, and short observation window.
- **Out of scope:** Global renderer switch, layout redesign, component data migration, unrelated decision changes, or telemetry-only route behavior.
- **Repository evidence:** Legacy `renderHub()` centralizes output; renderer component test endpoint exists; current automated suite does not constitute visual acceptance for a new renderer.
- **Implementation steps:** 1. Add explicit scope/fallback. 2. Add route and renderer tests. 3. Deploy after gate. 4. Run approved manual browser checks. 5. Verify low-risk public responses and health. 6. Halt on visual, accessibility, status, or header regression.
- **Automated acceptance criteria:** Full suite passes; scoped V2/legacy selection and fallback tests pass; no unrelated response-path regression.
- **Read-only production verification:** Health, approved public GET smoke matrix, headers/status, Inspector where applicable, and evidence collection that does not alter configuration.
- **Manual gate:** Mandatory browser/visual and accessibility acceptance for every selected route; explicit approval for public renderer behavior.
- **Rollback plan:** Switch selected routes back to `renderHub()`; preserve original route/config data; do not roll back Decision V2 unless independently required.
- **Exit criteria:** Manual acceptance passes, no regression appears during the agreed window, and legacy fallback is confirmed.
- **Next milestone unlock condition:** M4C unlocks only with product approval to make Renderer V2 normal authority.

### M4C — Renderer V2 full authority — manual gate

- **Goal:** Make Renderer V2 the normal renderer after successful limited validation, retaining emergency legacy fallback during stabilization.
- **Why now:** A full switch requires direct evidence from M4B; it is not implied by unit or snapshot tests.
- **Prerequisites:** M4B complete; broad visual/accessibility evidence; full route inventory; approved rollback and monitoring window.
- **In scope:** Expand renderer authority, maintain fallback, keep compatibility tests current, and document known exclusions.
- **Out of scope:** Deleting legacy renderer, data-model migration, UI redesign, and unrelated feature work.
- **Repository evidence:** Current authority is `renderHub()` and no V2 renderer exists yet; therefore full-authority design cannot assume a specific switch or renderer architecture.
- **Implementation steps:** 1. Define route-class rollout. 2. Implement and test normal authority plus emergency fallback. 3. Obtain gate. 4. Deploy and run manual visual matrix. 5. Verify health and public smoke. 6. Keep legacy renderer available through the agreed stabilization period.
- **Automated acceptance criteria:** Full test suite and renderer route-class regressions pass; fallback is deterministic; no output body is sent to telemetry.
- **Read-only production verification:** Health, public smoke matrix, header/status checks, approved manual visual checks, and error monitoring through existing read-only diagnostics.
- **Manual gate:** Explicit global renderer approval and browser/visual acceptance.
- **Rollback plan:** Restore `renderHub()` as authority using the approved boundary; do not mutate content/config data automatically.
- **Exit criteria:** Full renderer authority is stable for the agreed window and fallback remains documented.
- **Next milestone unlock condition:** M5A unlocks because Journey semantics should be designed against stable decision and rendering contracts.

### M5A — Journey semantics design — manual gate

- **Goal:** Define product-owned Journey semantics before altering the existing heuristic traversal.
- **Why now:** Current journey routing is a POC based on `cold`, `warm`, `hot`, `conv`, and `post` node types, not a validated product contract.
- **Prerequisites:** M4C complete; Journey owner identified; representative journey data and intended state semantics available.
- **In scope:** Define node/edge schema, entry selection, condition grammar, precedence, loops, missing-node behavior, page mapping, analytics needs within existing contracts, and migration/rollback strategy.
- **Out of scope:** Changing live journeys, adding Journey UI, Lead Engine, session/lead data migration, or inferring semantics from node labels.
- **Repository evidence:** `functions/lib/journey-router.js` documents its simple heuristic; `functions/api/admin/journeys.js` provides authenticated CRUD under `journey:` keys; no Journey tests or semantic specification are present.
- **Implementation steps:** 1. Inventory journey records read-only. 2. Write examples and counterexamples with product owner. 3. Define a versioned runtime contract. 4. Decide migration compatibility and fallback. 5. Add fixtures only after semantics approval.
- **Automated acceptance criteria:** A proposed contract has deterministic fixtures for entry, precedence, loop prevention, invalid graph, and fallback; no runtime changes occur in this milestone.
- **Read-only production verification:** Authenticated GET of existing journey inventory only, health, and route smoke checks; do not POST/DELETE journeys.
- **Manual gate:** Product ownership must approve semantics and any future migration effect.
- **Rollback plan:** No mutation in M5A; retain heuristic behavior until M5B passes.
- **Exit criteria:** Approved semantic contract, compatibility policy, test matrix, and rollback plan exist.
- **Next milestone unlock condition:** M5B unlocks only after semantics approval and a safe compatibility implementation plan.

### M5B — Journey Engine hardening — blocked by M5A

- **Goal:** Replace or constrain heuristic traversal with the approved deterministic Journey contract while preserving safe fallback.
- **Why now:** The existing POC is insufficient for product semantics, but implementation must not precede M5A.
- **Prerequisites:** M5A complete; approved schema; fixture corpus; explicit decision on existing `journey:` record compatibility.
- **In scope:** Pure resolver hardening, graph validation, deterministic traversal, loop/invalid-data fallback, tests, and migration compatibility code if approved.
- **Out of scope:** New Journey UI, uncontrolled journey data rewrite, Lead Engine, or public behavior expansion beyond approved journeys.
- **Repository evidence:** `resolveJourneyDestination()` currently selects one outbound node using user-state heuristics; entry point imports it in `functions/[[path]].js`; admin CRUD can mutate data and must not be used without a gate.
- **Implementation steps:** 1. Implement pure validated resolver. 2. Add comprehensive unit and route tests. 3. Preserve legacy heuristic fallback for unversioned records if approved. 4. Deploy only after any behavior gate. 5. Verify approved routes and diagnostics.
- **Automated acceptance criteria:** Tests cover all approved semantics, invalid graphs, deterministic tie-breaks, loops, fallback, and no input mutation; full suite passes.
- **Read-only production verification:** Health, selected public route smoke, authorized Inspector where relevant, and read-only journey inventory.
- **Manual gate:** Required if any live journey resolution can change; also required for any journey data migration.
- **Rollback plan:** Restore heuristic resolver or prior compatibility branch; do not rewrite journey records automatically.
- **Exit criteria:** Approved Journeys behave deterministically, fallbacks are proven, and no unapproved route changes occur.
- **Next milestone unlock condition:** M6A can proceed independently after M2B, but M6B cannot affect Journey semantics without M5B compatibility.

### M6A — Rule Builder contract — blocked by M2B

- **Goal:** Specify the smallest authoring contract that maps only to V2 semantics with production conversion evidence.
- **Why now:** The evaluator supports a bounded grammar, while production has no real-rule samples and the historical visual-builder proposal is not an implemented contract.
- **Prerequisites:** M2B complete; conversion evidence for supported legacy shapes; product ownership for rule authoring and validation behavior.
- **In scope:** Supported fields/operators/actions, priority/tie-break behavior, validation errors, unsupported reporting, persistence boundary, audit requirements, simulator requirements, and compatibility mapping policy.
- **Out of scope:** Building UI, accepting unknown operators, silently translating unsupported `notTags`, changing runtime grammar, or writing rules to production.
- **Repository evidence:** `decision-engine-v2.js` supports deterministic JSON conditions/actions; `rule-compat.js` maps bounded legacy properties and reports unsupported shapes; `tests/rule-compat.test.js` and `tests/real-rule-soak.test.js` cover conversion. No Rule Builder module or UI exists.
- **Implementation steps:** 1. Derive a contract from evaluator and converter tests. 2. List supported and rejected semantics. 3. Define validation/simulation inputs and outputs. 4. Define storage/audit ownership without implementing mutation. 5. Obtain product approval.
- **Automated acceptance criteria:** Contract fixtures are executable against evaluator/converter tests; unsupported rules fail explicitly; no runtime/config code changes occur.
- **Read-only production verification:** Inspect existing rule inventory and summary only; confirm no builder route or configuration mutation has been introduced.
- **Manual gate:** Product approval is required for authoring workflow, persistence/audit policy, and any future route affected by a created rule.
- **Rollback plan:** No mutation in M6A; retain existing legacy/manual rule paths.
- **Exit criteria:** Approved versioned grammar, validation matrix, unsupported policy, simulator boundary, and persistence/audit decision are recorded.
- **Next milestone unlock condition:** M6B unlocks only after M6A approval and a separate mutation/UI scope approval.

### M6B — Rule Builder implementation — blocked by M6A; M5B required if Journey state is exposed

- **Goal:** Implement the approved Rule Builder contract without broadening runtime semantics or bypassing validation.
- **Why now:** Implementation should follow verified rule semantics and stable Journey compatibility; it is not ready merely because Decision V2 code exists.
- **Prerequisites:** M6A complete; M5B compatibility decision if rules can reference Journey state; explicit production mutation and UI scope approval.
- **In scope:** Validated authoring API/UI only to the approved contract, simulator/dry-run path, audit handling, tests, and guarded persistence workflow.
- **Out of scope:** New rule operators/actions, Pulse UI changes, automatic production publishing, mass rule migration, or Lead Engine.
- **Repository evidence:** Existing admin endpoints authenticate with shared auth, but no builder contract/module exists. `functions/api/admin/journeys.js` demonstrates that admin POST can mutate `APP_CONFIG`, which is a guarded risk rather than precedent for automatic writes.
- **Implementation steps:** 1. Implement pure validator/simulator. 2. Add API/UI only after scope approval. 3. Add mutation guard and audit behavior. 4. Test failure paths and authorization. 5. Run controlled non-production validation. 6. Stop for production publishing approval.
- **Automated acceptance criteria:** Validator, simulator, authorization, persistence guard, unsupported-rule, and no-mutation-on-invalid-input tests pass; full suite passes.
- **Read-only production verification:** Before any publishing gate, verify only endpoint availability/auth behavior and ensure no production rule/config changed.
- **Manual gate:** Required for UI/browser acceptance, production persistence, any route/rule publication, and irreversible audit/storage decisions.
- **Rollback plan:** Disable builder publishing, preserve existing runtime behavior, and revert only the approved builder deployment; never bulk-delete rules automatically.
- **Exit criteria:** Approved authoring path is validated, audited, and either remains non-production or has separately verified controlled production publication.
- **Next milestone unlock condition:** M7 can use builder health signals only after real rule data and approved operational metrics exist.

### M7 — Pulse / Shadow Health — blocked by M2B and M3B

- **Goal:** Improve operational visibility for real comparison and authority health using existing safe data boundaries.
- **Why now:** Current generic telemetry has no comparable sample population; operator health work is meaningful only after real evidence and stable Decision V2 authority.
- **Prerequisites:** M2B and M3B complete; agreed operator questions, existing-data query feasibility, and explicit scope for any Pulse UI work.
- **In scope:** Define health metrics from existing Inspector, `/api/admin/shadow-summary`, health endpoint, and `AE_TRAFFIC`; improve read-only operational documentation or endpoints only if no new telemetry contract/dataset is needed.
- **Out of scope:** Pulse UI implementation without explicit approval, new datasets, new telemetry contracts, user-facing behavior, or changing sampling solely to manufacture evidence.
- **Repository evidence:** `/api/admin/shadow-summary` and authenticated Inspector exist; generic telemetry uses `AE_TRAFFIC`; Pulse UI is not part of the currently approved implementation scope.
- **Implementation steps:** 1. Confirm comparable sample population. 2. Define actionable counters and thresholds from existing fields. 3. Add read-only tests/documentation where justified. 4. Request separate UI/manual-browser approval before touching Pulse. 5. Verify no sensitive rule/HTML/user data enters telemetry.
- **Automated acceptance criteria:** Existing telemetry contract/auth/redaction tests pass; any added read-only aggregation tests prove zero-safe rates and category separation; no new dataset or event schema is introduced.
- **Read-only production verification:** Health endpoint, Inspector, summary windows, and low-volume public smoke; validate that reported comparison metrics distinguish `not_comparable` from mismatch/failure.
- **Manual gate:** Pulse UI, visual design, alert policy, and any new operator-facing surface require explicit product and browser-test approval.
- **Rollback plan:** Revert read-only presentation/query changes; retain existing telemetry flags and datasets; do not mutate production event data.
- **Exit criteria:** Approved health definitions accurately report real comparable evidence, failures, and generic runtime-diff telemetry separately; any UI work has its own completed gate.
- **Next milestone unlock condition:** No further runtime-transition milestone is automatically unlocked; legacy retirement, data migration, and product expansion require new roadmap decisions.

## Deferred and excluded

- Lead Engine, new product features, data-model/KV cleanup migrations, adaptive experimentation, and archived Campaign OS productization work are excluded.
- No new datasets, telemetry contracts, production KV mutations, production configuration mutations, or renderer rewrites are implied by planning work.
