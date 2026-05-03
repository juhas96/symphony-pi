# pi-symphony-0us implementation checkpoint

Date: 2026-05-03

## Summary

The pi-symphony-0us implementation pass closed all implementation and conformance gap children except `pi-symphony-0us.9`, which remains blocked only by the intentionally deferred Jira live smoke.

## Implemented changes

Initial pass:

- Require explicit `tracker.kind` during dispatch config resolution; Linear, Jira, and Beads remain supported only when explicitly selected.
- Add Codex issue identification via schema-compatible `thread/name/set` using `<issue.identifier>: <issue.title>`.
- Auto-resolve Codex command, file-change, and permission approval callbacks under the documented high-trust policy; user-input and elicitation requests fail fast.
- Normalize run artifact `status` and `terminal_reason`, including timeout, stall, reconciliation cancellation, user-input-required, and generic failure cases.
- Expose issue/snapshot log links as `{ label, path, url }` objects while keeping artifact path pointers for prompt/events/metadata/result files.
- Run `before_remove` only for existing workspace directories; missing paths skip the hook and non-directory paths skip with a warning before forced removal.
- Add issue/session context to representative Codex lifecycle logs without logging secrets.

Second conformance pass:

- Guarantee `after_run` runs best-effort after workspace creation, including prompt-render failures before Codex starts.
- Ignore delta-style Codex usage payloads such as `last_token_usage` when aggregating token totals.
- Add issue context to workspace hook logs and session context to Codex diagnostics when known.
- Suppress retry scheduling during orchestrator shutdown.
- Validate polling interval, Codex read/turn timeouts, and HTTP server port values consistently.
- Make workflow reload logging report success only on successful reload while preserving the last known good config after invalid reloads.
- Implement `linear_graphql` handling for Codex `item/tool/call` requests against configured Linear auth.
- Advertise `linear_graphql` on `thread/start.params.dynamic_tools` for Linear sessions with auth. Codex 0.128.0 generated `ThreadStartParams` omits this field, but a runtime protocol probe confirms the app-server accepts it.

## Verification

- `npm run check` passed.
- `npm test` passed: 56 tests.
- `npm run smoke` passed: pi extension, Codex schema plus dynamic-tool startup probe, real Codex app-server, and Beads E2E smokes.
- `npm run smoke:linear-live` passed against Linear project slugId `2a0adbaa8b1f` and refreshed `FVC-35`.
- `npm run smoke:jira-live` remains skipped because Jira credentials/endpoint/project selector are intentionally not configured.

## Remaining blocker

`pi-symphony-0us.9` is blocked/open by the deferred Jira live smoke. Linear live proof has passed.
