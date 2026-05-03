# pi-symphony operator runbook

## 1. Prepare configuration

Create a repository-owned `WORKFLOW.md`. Start from one of:

- `examples/WORKFLOW.linear.md`
- `examples/WORKFLOW.jira.md`
- `examples/WORKFLOW.beads.md`

Set credentials via environment variables, not literal tokens.

## 2. Validate

Inside pi:

```text
/symphony:validate
/symphony:validate path/to/WORKFLOW.md
```

CLI host:

```bash
npm run cli -- --once TEST-ID path/to/WORKFLOW.md
```

Validation checks workflow parsing, typed config defaults, explicit `tracker.kind`, tracker auth presence, project selectors, and Codex command presence. Non-Linear trackers are implementation-defined extensions and must be selected explicitly with `kind: jira` or `kind: beads`.

## 2a. Smoke package and Codex compatibility

Local pi extension load smoke:

```bash
npm run smoke:pi-extension
```

This creates a temporary consumer project, starts `pi --mode rpc --extension <this package>`, verifies the registered `/symphony:*` commands with `get_commands`, then invokes `/symphony:validate` against a temporary `WORKFLOW.md`. If `pi` is unavailable, the script prints `[skip]` and exits successfully so CI can distinguish unavailable tooling from failure.

Codex app-server schema compatibility smoke:

```bash
npm run smoke:codex-schema
```

This runs `codex app-server generate-json-schema --out <tmp>` when `codex` is installed and checks that generated thread/turn start schemas mention the fields pi-symphony sends: `cwd`, `approvalPolicy`, `sandbox`, `threadId`, `input`, and `sandboxPolicy`. If Codex or schema generation is unavailable, the script prints `[skip]` and exits successfully.

Real minimal Codex app-server smoke:

```bash
npm run smoke:codex-app-server
```

This creates a temporary workspace, starts `codex app-server`, sends one harmless prompt (`Reply with OK and do not modify files.`), and verifies `session_started` plus `turn_completed` events. If Codex is installed but not authenticated or model-ready, the script prints `[skip]` and exits successfully.

Beads end-to-end smoke:

```bash
npm run smoke:beads-e2e
```

This initializes a temporary Beads project with `bd init --non-interactive`, creates one safe task, writes a Beads-backed `WORKFLOW.md`, runs the CLI `--once` path with a fake Codex app-server, and verifies workspace creation. If `bd` is unavailable, the script prints `[skip]` and exits successfully.

## 3. Run one issue

Inside pi:

```text
/symphony:once ABC-123
/symphony:once ABC-123 path/to/WORKFLOW.md
```

If no issue id/key is supplied, Symphony selects the first eligible candidate by priority, created time, and identifier.

## 4. Start daemon

Inside pi:

```text
/symphony:daemon
/symphony:daemon --port 8080
/symphony:daemon --port 8080 path/to/WORKFLOW.md
```

CLI host:

```bash
npm run cli -- --port 8080 path/to/WORKFLOW.md
```

Stop from pi:

```text
/symphony:stop
```

The CLI host stops on SIGINT/SIGTERM.

## 5. Observe status

Inside pi:

```text
/symphony:status
```

HTTP dashboard/API when enabled:

- `GET /` — dashboard
- `GET /api/v1/state` — full runtime snapshot
- `GET /api/v1/<issue_identifier>` — current issue details
- `POST /api/v1/refresh` — best-effort immediate poll/reconcile

Logs are structured `key=value` lines with stable issue/session fields where available.

Per-attempt artifacts are written under `.symphony/runs/` next to the workflow file. Each run directory contains:

- `prompt.md` — rendered prompt sent to Codex.
- `events.jsonl` — structured Codex runtime events.
- `metadata.json` — issue/workspace/workflow path metadata.
- `result.json` — normalized run result.

`result.json` fields include:

- `status` — `succeeded`, `failed`, or `cancelled`.
- `terminal_reason` — `succeeded`, `failed`, `timed_out`, `stalled`, `user_input_required`, `cancelled_by_reconciliation`, or `cancelled` when observable.
- `last_event` / `last_error` — final Codex runtime context.

Issue detail responses expose log links as `logs.codex_session_logs` objects with `{ label, path, url }`, plus artifact paths for `prompt.md`, `events.jsonl`, `metadata.json`, and `result.json`. Running and retry rows include artifact/log pointers from the snapshot alone.

`.symphony/runs/` is mutable local output and should stay ignored by git. pi-symphony redacts configured tracker secrets and obvious token/password patterns before writing artifacts, but operators should still avoid placing sensitive data in issue descriptions or prompt templates.

## 6. Understand retries

- Clean worker exit schedules a short continuation retry (~1s) so the daemon can re-check whether the issue remains active.
- Failed worker exits use exponential backoff: `min(10000 * 2^(attempt - 1), agent.max_retry_backoff_ms)`.
- Slot exhaustion requeues with `no available orchestrator slots`.
- Candidate disappearance releases the claim.

## 7. Cleanup behavior

- Workspaces are reused for non-terminal active work.
- Startup cleanup removes workspaces for terminal issues returned by the tracker.
- Active-run reconciliation cleans workspace when an issue becomes terminal.
- Non-active/non-terminal states stop the worker without cleanup.
- `hooks.before_remove` runs only when the sanitized workspace path exists and is a directory; missing paths skip the hook silently and non-directory paths skip the hook with a warning before forced removal.

## 8. Real integration profile

Run these checks before production:

### Linear

Required:

- `LINEAR_API_KEY`
- `LINEAR_PROJECT_SLUG` or `PI_SYMPHONY_LINEAR_PROJECT_SLUG` for an isolated test project
- `PI_SYMPHONY_LIVE_LINEAR=1` to opt in

Optional:

- `LINEAR_ACTIVE_STATES` comma-separated list, default `Todo,In Progress`
- `LINEAR_TERMINAL_STATES` comma-separated list, default `Done,Closed,Canceled,Cancelled`
- `LINEAR_ENDPOINT`, default `https://api.linear.app/graphql`

Smoke:

```bash
PI_SYMPHONY_LIVE_LINEAR=1 LINEAR_API_KEY=... LINEAR_PROJECT_SLUG=... npm run smoke:linear-live
```

The Linear live smoke is read-only. It fetches active candidates, verifies empty-state behavior, fetches terminal-state issues, then refreshes one returned issue by GraphQL ID. If no safe issue exists in the isolated project, it prints `[skip]` instead of mutating Linear.

### Jira Cloud

Required:

- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `JIRA_ENDPOINT`
- `JIRA_PROJECT_KEY` or `JIRA_JQL`
- `PI_SYMPHONY_LIVE_JIRA=1` to opt in

Optional:

- `JIRA_ACTIVE_STATES` comma-separated list, default `To Do,In Progress`
- `JIRA_TERMINAL_STATES` comma-separated list, default `Done,Canceled`

Smoke:

```bash
PI_SYMPHONY_LIVE_JIRA=1 JIRA_EMAIL=... JIRA_API_TOKEN=... JIRA_ENDPOINT=https://your-org.atlassian.net JIRA_PROJECT_KEY=ABC npm run smoke:jira-live
```

The Jira live smoke is read-only. It uses Jira Cloud email/API-token auth, sets adapter `page_size: 1` to exercise pagination, fetches candidates/terminal issues, and refreshes one returned issue by key. If no safe issue exists for the supplied project/JQL, it prints `[skip]` instead of mutating Jira.

### Beads

Required:

- Initialized `.beads` database in the workflow directory
- `bd ready --json` returns at least one safe test issue for `/symphony:once`

Smoke:

```text
/symphony:validate examples/WORKFLOW.beads.md
```

If credentials or external services are unavailable, mark real integration checks as skipped rather than passed.

Latest local profile on 2026-05-03:

- Codex app-server smoke: passed with installed `codex-cli 0.128.0`.
- Beads E2E smoke: passed against a temporary `.beads` database.
- Linear live smoke: passed against project slugId `2a0adbaa8b1f`; read-only profile reported `candidates=0`, `terminal=29`, and refreshed `FVC-35`.
- Jira live smoke: skipped because `PI_SYMPHONY_LIVE_JIRA`, Jira credentials, endpoint, and project selector were not available in the environment.
