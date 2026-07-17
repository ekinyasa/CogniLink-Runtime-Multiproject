# CogniLink Runtime Working Rules

## Sources of truth

1. Running production code and automated tests
2. Current runtime and architecture documents
3. `docs/execution-roadmap.md` and `docs/execution-state.md`
4. Historical notes under `promt_history/`

When sources disagree, preserve current runtime behavior and record the discrepancy in the execution roadmap.

## Milestone workflow

- Keep work scoped to one milestone per commit.
- Run the relevant tests, inspect `git diff --check` and the final diff before committing.
- Update both execution documents when a milestone changes state.
- Push only passing, reviewed commits. A push deploys production: wait for the active commit in `/api/admin/health`, then run the milestone's read-only production verification.
- Do not start the next milestone if production verification fails.

## Production safety

- Never read, print, persist, hash, or report secret values. Do not inspect secret files or shell history.
- Do not mutate production KV/configuration unless the active milestone explicitly requires it and the user has approved that irreversible or user-visible change.
- Keep Decision V2 shadow-only until its readiness gate is satisfied. Do not change normal runtime decisions, renderer behavior, Pulse UI, datasets, or telemetry contracts as incidental work.
- Stop for manual browser/visual validation, public behavior changes, data migrations, product decisions, missing access, explicit manual gates, or an unresolved technical contradiction.

## Scope boundaries

- Prioritize the runtime transition path: Decision V2 safety, Decision V2 cutover, Renderer V2, Journey hardening, Rule Builder, then shadow health.
- Do not begin Lead Engine or unrelated product work.
- Prefer small pure helpers and focused tests over broad refactors.
