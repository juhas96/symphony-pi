# pi-symphony validation matrix

This document tracks conformance against the OpenAI Symphony draft plus pi-symphony implementation-defined extensions.

## Core implemented

- WORKFLOW.md discovery, YAML front matter parsing, defaults, `$VAR` resolution, explicit `tracker.kind` dispatch validation, and strict Liquid prompt rendering.
- Tracker adapter interface with Linear, Jira Cloud, and Beads implementations.
- Workspace root containment, sanitized per-issue paths, lifecycle hooks, hook timeout handling, and terminal cleanup path.
- Orchestrator dispatch sorting, eligibility, concurrency checks, retry scheduling, active-run reconciliation, and stall detection.
- Codex app-server JSONL client covering initialize/initialized, thread/start, schema-compatible `thread/name/set` issue labels, turn/start, turn/completed, timeouts, process exits, high-trust approval auto-resolution, user-input-required failure, and unsupported server requests.
- Operator-visible structured logs.
- Optional HTTP dashboard/API and CLI host.
- Normalized run artifact `status` and `terminal_reason`, issue snapshot terminal reason, and `{ label, path, url }` Codex log links.

## Optional extension decisions

### `linear_graphql` app-server tool

Status: **advertised and handled for Linear sessions**.

Schema/protocol finding: Codex 0.128.0 generated schemas expose dynamic tool call handling via server request `item/tool/call`, `DynamicToolCallParams`, `DynamicToolSpec`, and `DynamicToolCallResponse`. The generated `ThreadStartParams` schema omits the `dynamic_tools` field, but a runtime protocol probe confirms `thread/start.params.dynamic_tools` is accepted by Codex 0.128.0. `smoke:codex-schema` now checks both the generated dynamic-tool shapes and this startup probe.

Current behavior:

- pi-symphony advertises `linear_graphql` with `thread/start.params.dynamic_tools` when `tracker.kind: linear` has configured Linear auth.
- `item/tool/call` with `tool: "linear_graphql"` is handled when `tracker.kind: linear` has configured Linear auth.
- `linear_graphql` accepts either a raw GraphQL query string or `{ query, variables }` where `variables` is an object.
- Empty queries, multiple GraphQL operations, invalid variables, missing Linear auth, and non-Linear trackers return `success=false` with a structured error payload.
- Linear top-level GraphQL `errors` return `success=false` while preserving the GraphQL response body for debugging.
- Any unsupported server request from app-server receives a structured JSON-RPC error response: `unsupported_tool_call: <method>`.
- Unsupported dynamic `item/tool/call` requests receive `success=false` content with `unsupported_tool_call: <tool>`.
- `tool/requestUserInput`, `item/tool/requestUserInput`, and MCP elicitation requests receive a structured error response and the run fails as `turn_input_required` so autonomous runs do not stall indefinitely.
- Command execution, file-change, and permission approval callbacks are auto-approved under the documented high-trust policy.

## Real integration profile

These checks are not run in unit tests and require credentials/tools:

- Linear smoke with `LINEAR_API_KEY` and a test project slug.
- Jira Cloud smoke with `JIRA_EMAIL`, `JIRA_API_TOKEN`, and a test project key.
- Beads smoke in a repository with an initialized `.beads` database.
- Codex app-server smoke with an installed Codex CLI matching the documented app-server protocol.

Latest local profile on 2026-05-03:

- `npm run smoke:codex-schema`: passed against generated Codex 0.128.0 schemas, including `thread/name/set`, approval request/response, user-input, and dynamic tool-call shapes.
- `npm run smoke:codex-app-server`: passed a real minimal app-server turn.
- `npm run smoke:beads-e2e`: passed against a temporary Beads repo.
- `npm run smoke:pi-extension`: passed package load and single `/symphony` command registration.
- `npm run smoke:linear-live`: passed against Linear project slugId `2a0adbaa8b1f`; read-only profile reported `candidates=0`, `terminal=29`, and refreshed `FVC-35`.
- `npm run smoke:jira-live`: skipped; required opt-in env/Jira credentials were unavailable.
