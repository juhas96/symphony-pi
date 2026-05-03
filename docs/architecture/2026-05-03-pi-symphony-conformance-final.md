# pi-symphony SPEC conformance session final checkpoint

Date: 2026-05-03

## Scope

This checkpoint records the final state of the SPEC.md conformance work performed for `pi-symphony-0us` after the user asked what was missing, requested Beads for the gaps, started implementation, and then asked whether `linear_graphql` could be fully fixed.

## Beads status

- Closed implementation/conformance children: `pi-symphony-0us.1` through `.8`, `.10` through `.16`.
- Remaining open child: `pi-symphony-0us.9`, blocked only by intentionally deferred Jira live smoke.
- Linear live smoke passed after correcting `.env` `LINEAR_PROJECT_SLUG` from project name `fivecta` to Linear project slugId `2a0adbaa8b1f`.
- Epic `pi-symphony-0us` remains in progress because `.9` is blocked.

## Final implemented changes

- Required explicit `tracker.kind` and preserved explicit Linear/Jira/Beads extension behavior.
- Added Codex issue identification via `thread/name/set`.
- Implemented high-trust Codex approval handling for command, file-change, and permission approval callbacks.
- Added normalized run `status` and `terminal_reason` values.
- Aligned HTTP/debug log shapes to `{ label, path, url }` Codex log entries.
- Tightened `before_remove` so it only runs for existing workspace directories.
- Added structured issue/session context to lifecycle logs.
- Guaranteed `after_run` after workspace creation even for prompt-render failures.
- Ignored delta-style Codex usage payloads such as `last_token_usage` for aggregate totals.
- Suppressed retry scheduling during orchestrator shutdown.
- Added validation for numeric runtime config values.
- Fixed workflow reload logging so success is logged only on successful reload and invalid reload keeps last good config.
- Implemented and advertised `linear_graphql` for Linear sessions with configured auth.

## `linear_graphql` details

- Runtime probe showed Codex 0.128.0 accepts `thread/start.params.dynamic_tools` even though generated `ThreadStartParams` omits the field.
- pi-symphony now advertises `linear_graphql` in `thread/start.params.dynamic_tools` when `tracker.kind: linear` and Linear auth are configured.
- pi-symphony handles Codex `item/tool/call` for `tool: "linear_graphql"`.
- The handler accepts either raw query string arguments or `{ query, variables }`.
- It rejects empty queries, multiple operations, invalid variables, missing auth, non-Linear trackers, and unsupported tools with `success=false` structured outputs.
- It preserves Linear GraphQL response bodies when top-level GraphQL `errors` are returned.

## Verification evidence

- `npm run check` passed.
- `npm test` passed with 56 tests.
- `npm run smoke` passed: pi extension, Codex schema plus dynamic-tool startup probe, real Codex app-server, Beads E2E.
- `npm run smoke:linear-live` passed: `candidates=0 terminal=29 refreshed=FVC-35`.
- `npm run smoke:jira-live` remains skipped/deferred due no Jira env/credentials/project selector.

## Important caution

Do not commit `.env` or any Linear/Jira credentials. `.env` is ignored. The only recorded Linear project value is the non-secret project slugId used for the live smoke.
