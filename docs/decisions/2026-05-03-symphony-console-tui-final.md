# Symphony Console TUI final decisions

Date: 2026-05-03
Status: Accepted for implementation
Beads: `pi-symphony-797`

## Goal

Make `pi-symphony` a real full-screen mini-app inside pi, exposed through a single command:

```text
/symphony
```

The TUI replaces the old slash-command/widget/panel operator UX.

## Platform/library decision

- Use pi-native `@mariozechner/pi-tui` through `ctx.ui.custom()`.
- Implement as a full-screen visual overlay (`overlay: true`, effectively full terminal size).
- Do not use external OpenTUI for the embedded pi console.
  - OpenTUI currently targets Bun and owns terminal/input/rendering concerns.
  - pi already owns terminal lifecycle and exposes a compatible TUI component API.
- Follow patterns from pi custom TUI examples and `pi-mcp-adapter` panels.

## Command model

- Register only the interactive operator command:

```text
/symphony [--port 8080] [WORKFLOW.md]
/symphony --workflow path/to/WORKFLOW.md --port 8080
```

- No `/symphony:*` operator shortcuts are required for backward compatibility.
- All operator actions happen inside the TUI.
- Invalid args/config should still open the console, focused on Config with an error banner.
- `/symphony` opens the console only; it does not auto-start the daemon.

## Daemon lifecycle

- Console close does not stop the daemon.
- Daemon continues until explicitly stopped or pi `session_shutdown` occurs.
- If a daemon is already running for workflow A and the console is opened for workflow B:
  - stay attached to the running daemon A
  - show a warning banner
  - require stopping daemon before switching workflows
- Remove old compact below-editor widget.
- Keep only optional pi footer/status while daemon is running.

## Tabs/views

Tab order:

```text
Overview | Queue | Running | Issue | Logs | Runs | Config | Help
```

Navigation:

- `Tab`: next tab
- `Shift+Tab`: previous tab
- `1-8`: direct tab switch
- Persistent top header and bottom help/status bar appear across all tabs.

## Overview

Show:

- daemon status
- running/max agents
- once-run active state
- tokens
- rate-limit summary
- dashboard state/URL
- workflow mismatch/config warnings

## Queue

Queue is tracker-generic, not Linear-specific.

Show active-state tracker candidates and retry/backoff state in sections:

```text
Ready to dispatch
Not dispatchable now
Retry / backoff
```

Show dispatchability reasons, including:

- missing required issue fields
- inactive or terminal state
- already claimed/running
- completed in current daemon session
- blocked by unresolved blockers
- no global slots
- per-state concurrency limit
- retry/backoff active

Implementation decision:

- Refactor dispatch eligibility into pure functions, e.g. `src/eligibility.ts`.
- Use the same eligibility logic in orchestrator, console Queue, and tests.
- Queue fetching should go through orchestrator/config service logic, not duplicate tracker adapter internals in TUI code.

## Running

Show live workers with:

- issue id/key
- state/stage
- PID/session/turn/event
- age
- token counts
- last event/message

Use table-style rows with truncation.

## Issue detail

Hybrid contextual tab:

- Issue tab is always visible.
- If no issue selected, show empty state.
- `Enter` from Queue/Running/Runs selects an issue/run and switches to Issue.
- Use snapshot/artifact data first; do not fetch tracker issue details on every render.
- Possible future/manual refresh can fetch tracker details if needed.

Show:

- selected issue key/title/state/url
- branch/workspace
- artifacts
- run status/terminal reason
- recent events
- errors
- relevant log paths

## Logs

Logs view supports two levels:

```text
Global | Selected run
```

- Global: `.symphony/logs/symphony.log`
- Selected run: run/codex logs for selected issue/run when available
- `g`: global log mode
- `i`: selected issue/run log mode
- Default mode follows latest tail
- `j/k` or `PgUp/PgDown`: scroll back and disable follow
- `End` or `f`: return to follow
- Load a bounded tail, roughly 500–1000 lines

## Runs

Runs view is a recent-run list with lightweight filtering.

- Scan recent `.symphony/runs/*` directories.
- Parse key artifact files lightly:
  - detect `result.json`
  - show status/terminal reason
  - show workspace path
  - show artifact dir
  - list codex/session logs
  - show error summary if present
- Do not render huge raw JSON by default.
- `v`: toggle raw result JSON where useful.
- `p`: open artifact path.

## Config

Config view shows curated/operator-safe summary first:

- workflow path
- tracker kind/project/states
- max agents/per-state limits
- workspace root
- codex command/timeouts
- server/dashboard port
- hooks
- validation state
- reload errors

Raw resolved config is optional:

- `v`: validate/reload or toggle raw depending context/action menu wording
- redact secrets and show env var names, not values
- `e`: open workflow file when opener is available

Validation decision:

- validation runs automatically on config load
- explicit validate/reload action also exists in Config
- invalid config opens console and disables start/run actions

Config reload decision:

- show hot-reload state visibly and safely
- daemon keeps last good config if already running
- add `last_reload_at` and resolved metadata to `SymphonyOrchestrator.snapshot()`

## Help

Help includes both:

- keybindings
- compact runbook/troubleshooting

Cover:

- start daemon
- stop daemon safely
- run once
- why queue issue is not dispatching
- dashboard disabled
- config invalid
- logs/artifacts locations

## Actions and keybindings

Core keys:

```text
q          close console immediately unless confirmation modal active
Esc        cancel/clear/back through mode stack; close only when no mode/back target
r          refresh current view
R          refresh all
Tab        next tab
Shift+Tab  previous tab
1-8        switch tabs
j/k        move selection or scroll logs
Enter      open selected issue/run detail
/          filter current list view
?          Help
```

Daemon/control keys:

```text
d          start daemon when config valid/unambiguous
s          stop daemon; confirm only if workers are running
o          open dashboard URL and show URL/status
x          run once selected eligible issue
X          run once first eligible issue
u          open selected tracker issue URL when available
```

Run-once behavior:

- `x`: run once for highlighted eligible issue.
- `X`: run once for first eligible issue.
- Once mode and daemon mode are mutually exclusive in v1.
- If daemon is running, block run-once and show message.
- Run-once does not start dashboard/daemon.

Destructive confirmation:

- Confirm stopping daemon only when active workers are running.
- Do not confirm start, refresh, open URL/path, validate, or run once.

## Action menu

Add reusable contextual action menu on `a`.

Action model:

```ts
type ConsoleAction = {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  run(): Promise<void> | void;
};
```

- Current view supplies contextual actions.
- Disabled actions are visible and dimmed with reason.
- `Enter` runs selected action.
- `Esc` closes menu.

## Filtering

- `/` enters lightweight filter mode for Queue, Running, and Runs.
- Typed text filters by issue id/title/state/status/path.
- `Esc` clears/exits filter.
- Filter state is per-tab and preserved while console remains open.

## Opening paths and URLs

- Try system opener:
  - macOS: `open`
  - Linux: `xdg-open`
  - Windows: `start`
- Always show visible URL/path fallback in status/banner.
- Support selected tracker issue URL with `u` where available.
- Beads may not have a URL; show graceful empty state.

## Rendering/UX rules

- Use pi theme colors from the `ctx.ui.custom()` callback through a local style adapter.
- Use Unicode box/glyphs by default; avoid emoji as core indicators.
- Tables truncate wide rows.
- Detail panes wrap long content.
- Logs truncate horizontally by default.
- Every rendered line must fit the width using `truncateToWidth`, `visibleWidth`, and wrapping helpers.
- Keyboard-only for v1; no mouse interactions.
- One selected/current issue in v1; no multi-select.

Responsive behavior:

- `<80 cols`: compact mode, hide lower-priority columns.
- `<60 cols`: minimal stacked key/value mode.
- `<40 cols`: show narrow-terminal warning with Overview/Help only.

## State preservation

Preserve lightweight console state in memory for current pi session:

- active tab
- selected issue/run
- list cursors
- filters
- log mode

Do not persist UI state to disk/session entries in v1.

## Implementation structure

Remove old `src/commands.ts` panel/widget helper implementation.

Add/organize:

```text
src/eligibility.ts
src/tui/console.ts
src/tui/actions.ts
src/tui/data.ts
src/tui/format.ts
src/tui/views/*.ts
```

Tests should cover:

- only `/symphony` command registration
- args parsing/config error behavior
- render/state transitions
- tab navigation/mode stack
- eligibility reasons
- Queue categorization
- log follow/scroll behavior
- command docs/smoke expectations updated

## Rollout decision

Implement all at once. No backward compatibility requirement for old `/symphony:*` operator shortcuts or old panel/widget UI.
