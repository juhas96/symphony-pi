# 2026-05-03 pi-symphony implementation session

This note preserves team-useful context from the implementation session before context compaction. It contains no secrets or private credentials.

## Goal

Implement `pi-symphony` as a pi extension/package according to the OpenAI Symphony draft specification, while supporting additional pluggable trackers for Jira Cloud and Beads.

## Key user decisions and clarifications

- The package is a **pi extension first**, not merely a standalone daemon.
- The extension should support pluggable trackers beyond the OpenAI draft's Linear focus:
  - Linear (spec-compatible core tracker)
  - Jira Cloud with email/API token auth
  - Beads via local `bd` CLI
- The optional `linear_graphql` app-server tool was initially deferred in the first implementation pass; later conformance work implemented advertisement and handling for Linear sessions. See `docs/validation-matrix.md`.
- After initial implementation, highest-ROI hardening was identified and converted into Beads tasks.

## Implemented architecture

Package entrypoints and commands:

- `src/index.ts` registers the extension.
- `src/commands.ts` exposes pi commands:
  - `/symphony:validate`
  - `/symphony:once`
  - `/symphony:daemon`
  - `/symphony:stop`
  - `/symphony:status`
- `package.json` contains:
  - `pi.extensions: ["./src/index.ts"]`
  - CLI binary `pi-symphony` via `bin/pi-symphony.mjs`

Core modules:

- `src/config.ts` — `WORKFLOW.md` discovery, YAML front matter parsing, defaults, `$VAR` resolution, validation.
- `src/template.ts` — strict Liquid prompt rendering with `issue` and `attempt`.
- `src/tracker.ts` — `TrackerAdapter` plus Linear, Jira Cloud, and Beads implementations.
- `src/workspace.ts` — sanitized workspace keys, root containment, hook execution, hook timeout/failure semantics, hook log redaction/truncation.
- `src/codex.ts` — Codex app-server JSONL client.
- `src/orchestrator.ts` — dispatch, retries, reconciliation, stall detection, state snapshots.
- `src/http.ts` — optional dashboard/API.
- `src/cli.ts` — standalone CLI host for daemon/smoke use.
- `src/logger.ts` and `src/types.ts` — shared support.

## Tracker behavior

- Linear adapter:
  - Candidate query filters with `project: { slugId: { eq: $projectSlug } }`.
  - State refresh query uses `$ids: [ID!]`.
  - Pagination, GraphQL errors, non-200 status, and missing cursor paths are tested.
- Jira Cloud adapter:
  - Uses Basic auth with `email:api_token`.
  - Supports generated JQL or custom `tracker.jql`.
  - Normalizes labels, priorities, status, ADF descriptions, and blockers.
- Beads adapter:
  - Shells out from workflow directory.
  - Uses `ready_command`, `bd list --json`, and `bd show <id> --json` style commands.
  - Normalizes flexible field names from Beads JSON.

## Codex app-server behavior

- Client performs `initialize`, `initialized`, `thread/start`, `turn/start`, and streams notifications until `turn/completed`.
- Handles:
  - `turn_failed`
  - `turn_cancelled`
  - `response_timeout`
  - `turn_timeout`
  - `port_exit`
  - `turn_input_required`
- Unsupported app-server server/tool requests receive structured errors and do not stall the run.
- `tool/requestUserInput` fails fast with `turn_input_required`.
- stderr diagnostics stay separate from JSONL stdout parsing.

## HTTP and CLI

HTTP is optional via `server.port`, `/symphony:daemon --port`, or CLI `--port`.

Endpoints:

- `GET /`
- `GET /api/v1/state`
- `GET /api/v1/<issue_identifier>`
- `POST /api/v1/refresh`

CLI:

- `npm run cli -- [--port 8080] [path-to-WORKFLOW.md]`
- `npm run cli -- --once ABC-123 [path-to-WORKFLOW.md]`
- `./bin/pi-symphony.mjs --help`

## Documentation added

- `README.md`
- `docs/tracker-extensions.md`
- `docs/validation-matrix.md`
- `docs/security.md`
- `docs/runbook.md`
- `docs/llm-developer-setup.md`
- `examples/WORKFLOW.linear.md`
- `examples/WORKFLOW.jira.md`
- `examples/WORKFLOW.beads.md`

## Test coverage and verification

Final verification performed:

```bash
npm run check
npm test
./bin/pi-symphony.mjs --help
```

Final test count at the end of implementation: 42 passing tests.

Coverage includes:

- config and template parsing
- command registration
- CLI parser/main behavior
- fake Codex app-server protocol
- HTTP dashboard/API
- orchestrator sorting/eligibility/retry/reconciliation/stall behavior
- tracker adapter conformance for Linear/Jira/Beads
- workspace safety/hooks/redaction
- docs and examples
- package metadata/local extension smoke

## Beads work completed

Initial implementation epic:

- `pi-symphony-a09` — Complete pi-symphony implementation to spec conformance — closed.

Closed children:

- `pi-symphony-a09.1` — Harden Codex app-server runner protocol handling.
- `pi-symphony-a09.2` — Complete tracker adapter conformance tests.
- `pi-symphony-a09.3` — Finish orchestrator scheduling and reconciliation conformance.
- `pi-symphony-a09.4` — Complete workspace safety and hook conformance.
- `pi-symphony-a09.5` — Decide and implement linear_graphql app-server tool extension (initial decision: deferred; superseded by later conformance work).
- `pi-symphony-a09.6` — Polish HTTP API and CLI host lifecycle.
- `pi-symphony-a09.7` — Write operator docs and WORKFLOW examples.
- `pi-symphony-a09.8` — Prepare pi package release and consumption checks.

Follow-up ROI epic:

- `pi-symphony-0y2` — Highest ROI hardening for pi-symphony — open.

Children created:

- `pi-symphony-0y2.1` — Add real pi extension load smoke.
- `pi-symphony-0y2.2` — Add Codex app-server schema compatibility check.
- `pi-symphony-0y2.3` — Add real minimal Codex app-server smoke.
- `pi-symphony-0y2.4` — Add Beads end-to-end smoke.
- `pi-symphony-0y2.5` — Add per-attempt run artifact bundles.
- `pi-symphony-0y2.6` — Improve HTTP event and artifact observability.
- `pi-symphony-0y2.7` — Add Linear live smoke profile.
- `pi-symphony-0y2.8` — Add Jira Cloud live smoke profile.

Current ready ROI tasks:

- `pi-symphony-0y2.1` — Add real pi extension load smoke.
- `pi-symphony-0y2.2` — Add Codex app-server schema compatibility check.

## Highest ROI order

Recommended order captured in Beads:

1. pi extension load smoke
2. Codex schema generation check
3. real minimal Codex app-server smoke
4. Beads end-to-end smoke
5. per-attempt run artifact bundle
6. HTTP event/artifact surfacing
7. Linear live smoke
8. Jira Cloud live smoke

## Known gaps

- No real Codex app-server smoke yet.
- No real pi extension load smoke yet.
- No live Linear/Jira credential-backed smoke yet.
- No durable per-attempt artifact bundle yet.
- HTTP event history is still limited.
- `linear_graphql` is no longer a gap; it is advertised and handled for Linear sessions with valid auth.
