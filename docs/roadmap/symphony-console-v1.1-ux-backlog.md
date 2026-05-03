# Symphony Console v1.1 UX improvement backlog

Date: 2026-05-03
Status: Proposed backlog
Depends on: `pi-symphony-797` / `docs/decisions/2026-05-03-symphony-console-tui-final.md`

## Context

v1 shipped the smallest complete single-command Symphony Console inside pi:

- one operator command: `/symphony`
- pi-native full-screen TUI via `@mariozechner/pi-tui` / `ctx.ui.custom()`
- tabs: Overview, Queue, Running, Issue, Logs, Runs, Config, Help
- daemon/run/config/log controls inside the TUI
- shared dispatch eligibility reasons

v1.1 should keep the same command model and focus on UX clarity, debugging speed, and operator confidence rather than new orchestration behavior.

## v1.1 themes

1. **Explain what is happening.** Make Queue, Running, Issue, Logs, and Config answer “why?” without reading raw artifacts.
2. **Make debugging faster.** Add search, jump-to-error, richer run/issue detail, and better artifact/log access.
3. **Polish the console as an app.** Improve layout, visual hierarchy, empty states, help, and action affordances.
4. **Stay keyboard-first.** Mouse support is optional/future; v1.1 should not depend on it.

## Proposed issues

### 1. Richer Issue detail and manual tracker refresh

Add an explicit Issue-detail refresh path that fetches tracker details on demand, without fetching on every render.

Acceptance criteria:

- Issue tab has a visible manual refresh action for selected issue details.
- Refreshed details are cached for the current console session.
- Issue tab clearly distinguishes snapshot/artifact data from freshly fetched tracker data.
- Missing tracker URL/details show graceful empty states.

### 2. Logs search, filters, and jump-to-error

Make Logs useful for live debugging instead of only tail display.

Acceptance criteria:

- Logs tab supports text search within bounded tail.
- Logs can filter by severity/source when structured enough to detect.
- Operator can jump to latest error/current selected run.
- Log file path can be copied/opened through the action menu or visible fallback.

### 3. Config diagnostics and workflow switching guidance

Turn Config into an operator-safe diagnostics surface.

Acceptance criteria:

- Config tab shows actionable fix hints for common validation failures.
- Workflow mismatch while daemon is running explains attached workflow vs requested workflow.
- Switching workflow requires stopping daemon first and gives exact next action.
- Config reload result is visible and timestamped.

### 4. Queue “why not running?” drilldown

Make dispatchability reasons more explanatory and navigable.

Acceptance criteria:

- Queue rows show compact reason badges.
- Selected non-dispatchable row has a detail pane explaining every blocking reason.
- Blocker, slot, retry, claimed/running, and inactive-state reasons are distinct.
- First eligible issue remains obvious.

### 5. Runs history and artifact preview polish

Make Runs a useful postmortem/debug entry point.

Acceptance criteria:

- Runs list shows status, terminal reason, age, workspace, artifact path, and error summary.
- Selected run detail previews key artifact data without dumping huge JSON.
- Raw JSON toggle is available where useful.
- Artifact/workspace/log paths are openable with visible fallback.

### 6. Responsive layout and visual hierarchy polish

Improve the full-screen app feel across terminal sizes.

Acceptance criteria:

- Wide terminals use clearer split panes for list/detail views.
- Compact/minimal breakpoints hide columns deliberately instead of feeling cramped.
- Narrow terminal warning is clear and still allows Overview/Help.
- Header/footer/status bars have consistent priority and truncation behavior.

### 7. Contextual action menu expansion and confirmations

Make `a` the consistent discoverable action surface.

Acceptance criteria:

- Each tab exposes relevant contextual actions.
- Disabled actions include specific reasons.
- Risky actions use confirmation when appropriate, especially stopping active workers.
- Action success/failure is shown in a banner/status line.

### 8. First-run empty states and task-oriented Help

Make the console self-explanatory for new or misconfigured projects.

Acceptance criteria:

- Overview/Queue/Running/Runs/Logs show helpful empty states.
- Help includes task flows: start daemon, run one issue, debug stuck issue, inspect artifacts, fix config.
- Keybindings are grouped by tab/context.
- Missing dashboard/tracker/config states include next steps.

### 9. Lightweight UI state persistence across reopens

Consider persisting only harmless UI preferences between `/symphony` opens.

Acceptance criteria:

- Decision documented: persist or intentionally keep session-only.
- If persisted, include only non-sensitive UI state such as last tab/log mode/filter visibility preferences.
- No issue content, logs, secrets, or private paths are persisted unless explicitly safe.
- Tests cover persistence opt-in/default behavior.

### 10. Mouse support feasibility spike

Investigate whether pi TUI mouse support is reliable enough for tabs/row selection.

Acceptance criteria:

- Document current pi TUI mouse capabilities and limitations.
- Prototype or inspect feasibility for tab click and row selection.
- Decide whether mouse support belongs in v1.1, later, or never.
- No production behavior depends on mouse support until decided.

## Suggested prioritization

P1 for v1.1:

- Queue “why not running?” drilldown
- Logs search, filters, and jump-to-error
- Config diagnostics and workflow switching guidance
- Runs history and artifact preview polish

P2 for v1.1:

- Richer Issue detail and manual tracker refresh
- Responsive layout and visual hierarchy polish
- Contextual action menu expansion and confirmations
- First-run empty states and task-oriented Help

P3 / research:

- Lightweight UI state persistence across reopens
- Mouse support feasibility spike
