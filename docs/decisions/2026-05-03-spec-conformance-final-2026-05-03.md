# spec-conformance-final-2026-05-03

Date: 2026-05-03
Source: MemPalace
Wing: pi-symphony
Room: spec-conformance-final-2026-05-03
Shared by: pi-coding-assistant

## Summary

VERBATIM SESSION CHECKPOINT 2026-05-03

## Details

VERBATIM SESSION CHECKPOINT 2026-05-03

User asked: "start with implementation of pi-symphony-0us until it is closed".
Important constraint discovered: git worktree setup was not useful because only Beads files were tracked and source files were untracked; implementation proceeded in current workspace.

Initial epic: pi-symphony-0us — "Close remaining Symphony spec conformance gaps". Children originally 0us.1 through 0us.9.

Closed initial children:
- pi-symphony-0us.1 — Enforce explicit tracker.kind for dispatch conformance.
- pi-symphony-0us.2 — Add Codex issue title/metadata startup payload.
- pi-symphony-0us.3 — Implement explicit Codex approval request policy handling.
- pi-symphony-0us.4 — Decide or implement linear_graphql app-server tool with real schema context.
- pi-symphony-0us.5 — Add normalized run terminal reasons to artifacts and snapshots.
- pi-symphony-0us.6 — Align HTTP log/artifact response shape with spec.
- pi-symphony-0us.7 — Run before_remove hook only for existing workspace directories.
- pi-symphony-0us.8 — Audit structured logging for required issue/session context.

Created and closed decision bead:
- pi-symphony-0us.4.1 — "Decision: defer linear_graphql until Codex advertises stable dynamic tool registration". Later superseded by actual runtime probe showing dynamic_tools is accepted even though generated schema omits it.

Initial remaining blocker:
- pi-symphony-0us.9 — Run and record real Linear/Jira live conformance profile. Left blocked/open because Jira credentials were missing. Linear later passed.

User asked: "check current implemenation against @SPEC.md what we are missing ?"
Findings then included: after_run not guaranteed for prompt/artifact failures; token accounting may count delta last_token_usage; logs missing some issue/session context; shutdown may schedule retries after stop; numeric config validation incomplete; reload success logging misleading; optional linear_graphql not fully advertised/implemented; Jira live smoke missing.

User asked: "how can i setup linear to do smoke test" and then added .env. Linear smoke initially skipped because LINEAR_PROJECT_SLUG was set to project name fivecta, but Linear project slugId was 2a0adbaa8b1f. Updated .env LINEAR_PROJECT_SLUG=2a0adbaa8b1f. Linear smoke result: [ok] Linear live smoke: candidates=0 terminal=29 refreshed=FVC-35. Do not record or expose LINEAR_API_KEY. .env is ignored.

User asked: "prepare beads for those including linear_grappql". Created beads:
- pi-symphony-0us.10 — Guarantee after_run for all workspace-created attempts.
- pi-symphony-0us.11 — Ignore delta-style Codex usage when aggregating token totals.
- pi-symphony-0us.12 — Add required issue and session context to lifecycle logs.
- pi-symphony-0us.13 — Suppress retry scheduling during orchestrator shutdown.
- pi-symphony-0us.14 — Validate numeric workflow config fields consistently.
- pi-symphony-0us.15 — Make workflow reload logging reflect failed reloads accurately.
- pi-symphony-0us.16 — Implement linear_graphql Codex client-side tool extension.

User asked: "start". Implemented and closed 0us.10 through 0us.16. Key code changes:
- src/workspace.ts: added WorkspaceHookContext; hook logs include issue_id and issue_identifier; removeForIssue accepts context.
- src/orchestrator.ts: added stopping guard; after_run finally now covers prompt rendering after workspace creation; startup cleanup and terminal cleanup pass issue context; reload returns boolean and watcher logs success only if reload succeeded; token accounting ignores delta-style usage via revised Codex usage extraction; shutdown retry scheduling suppressed.
- src/config.ts: positive integer validation for polling.interval_ms, hooks.timeout_ms, agent.max_turns, max_concurrent_agents, max_retry_backoff_ms, codex.turn_timeout_ms, codex.read_timeout_ms; codex.stall_timeout_ms accepts <=0 to disable; server.port validated 0..65535.
- src/codex.ts: activeSession context for stderr/malformed logs; dynamic tool handler for item/tool/call; parseLinearGraphqlArgs; dynamicToolFailure; LinearTrackerClient used for linear_graphql.
- src/tracker.ts: LinearTrackerClient.linearGraphql validates non-empty single-operation query and variables object; preserves GraphQL error bodies.
- scripts/check-codex-schema.mjs: verifies generated dynamic tool request/response shapes.

Then user asked: "can we actually fix that linear_graphql". Investigation:
- `codex app-server generate-ts` generated v2/ThreadStartParams.ts without dynamic_tools.
- `codex app-server generate-json-schema` generated DynamicToolSpec definitions and DynamicToolCall schemas but omitted dynamic_tools property from v2/ThreadStartParams.json.
- Cloned openai/codex source showed app-server ThreadStartParams destructures dynamic_tools and tests use `ThreadStartParams { dynamic_tools: Some(vec![dynamic_tool]) }`.
- Runtime probe showed Codex 0.128.0 accepts `thread/start` with `dynamic_tools` even without experimentalApi. Probe response returned thread.id successfully.

Final linear_graphql fix:
- src/codex.ts now includes dynamicToolSpecs(); when config.tracker.kind === "linear" and apiKey exists, threadStartParams includes `dynamic_tools: [{ name: "linear_graphql", description: ..., inputSchema: { type:"object", properties:{ query:{type:"string"}, variables:{type:"object", additionalProperties:true}}, required:["query"], additionalProperties:false }, deferLoading:false }]`.
- item/tool/call handler executes Linear GraphQL through configured endpoint/auth.
- Tests assert thread/start sends dynamic_tools for Linear sessions and not for Beads sessions.
- scripts/check-codex-schema.mjs now performs runtime startup probe `assertThreadStartAcceptsDynamicTools` in addition to generated schema checks.

Docs updated:
- README.md: linear_graphql advertised on thread/start for Linear sessions with auth.
- docs/security.md: linear_graphql advertised/handled; use least-privilege Linear token and isolated project scope.
- docs/validation-

_[Truncated for team doc review.]_

## Why this matters for the team

- Records decision context teammates should not have to rediscover.
- Helps future changes preserve the intended trade-offs.

## Follow-ups

- [ ] pi-symphony-0us.2 — Add Codex issue title/metadata startup payload.
- [ ] pi-symphony-0us.5 — Add normalized run terminal reasons to artifacts and snapshots.
- [ ] pi-symphony-0us.12 — Add required issue and session context to lifecycle logs.
- [ ] Then user asked: "can we actually fix that linear_graphql". Investigation:
- [ ] Final linear_graphql fix:
