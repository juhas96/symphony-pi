# Symphony Console next UX backlog

Date: 2026-05-03
Status: Proposed backlog after v1.1
Depends on: `pi-symphony-kbh` / Symphony Console v1.1 UX improvements

## Context

v1.1 completed the first UX polish pass: explainable Queue, searchable Logs, Config diagnostics, Runs artifact preview, contextual actions, responsive basics, richer Issue refresh, onboarding Help, and explicit decisions on state persistence and mouse support.

The next UX round should make Symphony Console feel more like a polished operator console and reduce time-to-debug for failed or stuck runs.

## Themes

1. **Operator console polish** — improve visual hierarchy and reduce table fatigue.
2. **Faster failure debugging** — correlate runs, logs, and issue state.
3. **Safer orchestration control** — make destructive and pre-dispatch decisions clearer.
4. **Action discoverability at scale** — avoid keybinding overload as capabilities grow.

## Proposed slices

### 1. Visual design system pass

Improve the console’s look and hierarchy without changing behavior.

Acceptance criteria:

- Status badges/pills are consistent across Queue, Running, Runs, Config, and Logs.
- Section dividers, titles, and dim/accent usage follow one local style vocabulary.
- Important warnings/errors visually outrank secondary metadata.
- Existing tests continue to pass; snapshot/render assertions cover key status labels.

### 2. True wide-terminal split-pane layouts

Use wide terminals more effectively by showing list/detail side by side.

Acceptance criteria:

- Queue, Running, and Runs use list-left/detail-right layout above a documented width threshold.
- Existing stacked layout remains for compact/narrow terminals.
- Selection and action menu behavior works in both layouts.
- Render tests cover wide and compact widths.

### 3. Run timeline view

Make a run’s lifecycle obvious from artifacts and runtime snapshots.

Acceptance criteria:

- Selected run shows chronological stages: claimed, workspace, codex/session, key events, result.
- Durations between stages are shown when timestamps are available.
- Failure/stall/timeout point is highlighted.
- Timeline works from Runs and Issue detail.

### 4. Runs-to-Logs correlation

Let operators jump from a failed/stuck run to relevant log context.

Acceptance criteria:

- Selected failed run can switch Logs into selected-run mode with context around the latest error.
- Runs detail shows a “jump to logs” action when logs exist.
- Logs selected-run mode clearly identifies the source run/artifact.
- Tests cover run selection → logs mode/context behavior.

### 5. Command palette

Add a searchable action palette to reduce keybinding/action-menu overload.

Acceptance criteria:

- `:` opens a command palette listing global and tab-specific actions.
- Typing filters actions by label/description.
- Enter runs the selected enabled action; disabled actions show reasons.
- Existing `a` action menu remains available.

### 6. Inline config linting and fix snippets

Make Config errors more concrete than generic hints.

Acceptance criteria:

- Config diagnostics include the likely config field path when known.
- Common errors include copyable/example YAML snippets.
- Secret-related snippets never include actual secret values.
- Tests cover representative config codes and snippets.

### 7. Queue simulation mode

Preview what the daemon would dispatch before starting it.

Acceptance criteria:

- Queue can show “if daemon tick ran now” dispatch order.
- Slot allocation by global and per-state limits is visible.
- Simulation uses the same eligibility logic as real dispatch.
- No tracker mutation or daemon start occurs during simulation.

### 8. Failure triage assistant

Summarize likely failure category and next action for selected failed/stuck run.

Acceptance criteria:

- Runs/Issue detail classifies common failures: config, tracker, codex timeout, user input required, hook failure, workspace failure, stall.
- Suggested next operator action is shown.
- Classification is deterministic and based on existing artifacts/log excerpts.
- Tests cover representative failure categories.

### 9. Safer destructive flow details

Make stop/abort confirmation more informative for active workers.

Acceptance criteria:

- Stop daemon confirmation lists affected running issue identifiers.
- Confirmation differentiates idle stop from active-worker abort.
- Multiple active workers require a stronger confirmation affordance than single idle stop.
- Tests cover idle, one-worker, and multi-worker stop flows.

### 10. Export selected run debug bundle

Package a safe debug bundle for sharing or bug reports.

Acceptance criteria:

- Selected run can export a bundle containing redacted result summary, log excerpts, metadata, and config summary.
- Secrets and obvious tokens are redacted.
- Bundle path is shown and openable.
- Tests cover bundle contents and redaction.

### 11. Live activity indicators

Make active daemon/worker liveness easier to scan.

Acceptance criteria:

- Header or Running rows show a lightweight activity indicator for active workers.
- “Last event age” is visible and warns when quiet beyond configured stall threshold.
- Indicators do not rely on animation for correctness.
- Tests cover stale/active visual states with deterministic timestamps.

### 12. Tracker-specific niceties behind generic core

Add useful tracker-specific fields while preserving generic behavior.

Acceptance criteria:

- Linear, Jira, and Beads may show extra fields when available.
- Generic Issue/Queue layout still works when fields are absent.
- Tracker-specific fields are clearly secondary to generic dispatch state.
- Tests cover absent-field fallback.

## Suggested priority

P1:

- True wide-terminal split-pane layouts
- Run timeline view
- Runs-to-Logs correlation
- Failure triage assistant

P2:

- Visual design system pass
- Command palette
- Inline config linting and fix snippets
- Safer destructive flow details
- Live activity indicators

P3:

- Export selected run debug bundle
- Tracker-specific niceties behind generic core
- Queue simulation mode
