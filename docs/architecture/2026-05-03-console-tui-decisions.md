# console-tui-decisions

Date: 2026-05-03
Source: MemPalace
Wing: pi-symphony
Room: console-tui-decisions
Shared by: pi-coding-agent

## Summary

Symphony Console TUI design decisions from 2026-05-03 grilling session:

## Details

Symphony Console TUI design decisions from 2026-05-03 grilling session:

- Use pi-native `@mariozechner/pi-tui` full-screen overlay; do not use external OpenTUI for the embedded pi console.
- `/symphony` opens the console only; it does not auto-start the daemon.
- `/symphony` accepts workflow/port args as start context, e.g. `/symphony --port 8080 path/to/WORKFLOW.md`.
- If a daemon is already running for workflow A and `/symphony` requests workflow B, the console stays attached to running daemon A and shows a warning; user must stop daemon first to switch.
- Issue detail is a hybrid contextual tab: `Issue` remains visible, `Enter` from list tabs selects an issue and switches to it, and no selected issue shows an empty state.
- Queue has two sections: eligible tracker issues and retry/backoff.
- The pi TUI reads runtime state directly from the in-process `SymphonyOrchestrator`; HTTP remains for browser dashboard only.
- Refresh is hybrid: Overview/Running auto-refresh ~1s; Queue slower; Logs auto-tail when active; Runs/Config refresh on tab entry and manual refresh.
- `r` refreshes current view; `R` force-refreshes all.
- `d` starts daemon immediately only when config is valid/unambiguous; invalid/mismatch cases block and show guidance.
- `s` stops immediately only when idle; confirms if workers are running.
- `o` opens dashboard and also shows URL; if disabled, show guidance.
- Logs should support global `.symphony/logs/symphony.log` plus selected issue/run logs.

## Why this matters for the team

- Explains system structure and design constraints for future contributors.
- Reduces onboarding and review ambiguity.

## Follow-ups

- [ ] Logs should support global `.symphony/logs/symphony.log` plus selected issue/run logs.

---

## Additional note — 19:15

Date: 2026-05-03
Source: MemPalace
Wing: pi-symphony
Room: console-tui-decisions
Shared by: pi-coding-agent

### Summary

Additional Symphony Console TUI decisions from 2026-05-03 grilling session:

### Details

Additional Symphony Console TUI decisions from 2026-05-03 grilling session:

- Use only `/symphony` as the interactive operator command; remove `/symphony:*` operator shortcuts from the UX.
- All controls live inside the TUI: start/stop daemon, run once, validate config, refresh, open dashboard, inspect queue/running/runs/logs/config/help.
- Run once from inside the TUI: `x` runs once for the highlighted eligible issue; `X` runs once for the first eligible issue.
- Daemon mode and once mode are mutually exclusive in v1; disable run-once while daemon is active.
- Add contextual action menu on `a` and Help/`?` for discoverability.
- Open paths and URLs through system opener when possible, with a visible status/banner fallback showing the exact path/URL.
- Support opening selected tracker issue URL with `u` where available.
- Queue wording and behavior should be tracker-generic, not Linear-specific.
- Add lightweight `/` filtering for Queue, Running, and Runs views.
- Logs should support scrolling with follow mode, not only live tail.

### Why this matters for the team

- Explains system structure and design constraints for future contributors.
- Reduces onboarding and review ambiguity.

### Follow-ups

- [ ] Add contextual action menu on `a` and Help/`?` for discoverability.
- [ ] Queue wording and behavior should be tracker-generic, not Linear-specific.
- [ ] Add lightweight `/` filtering for Queue, Running, and Runs views.
- [ ] Logs should support scrolling with follow mode, not only live tail.

---

## Additional note — 19:17

Date: 2026-05-03
Source: MemPalace
Wing: pi-symphony
Room: console-tui-decisions
Shared by: pi-coding-agent

### Summary

More Symphony Console TUI decisions from 2026-05-03 grilling session:

### Details

More Symphony Console TUI decisions from 2026-05-03 grilling session:

- Tables truncate wide rows; detail panes wrap long content.
- Use pi theme colors via a local style adapter; avoid fixed ANSI as primary styling.
- Use Unicode box/glyphs by default; avoid emoji as core indicators.
- Use a persistent top header and bottom help/status bar across tabs.
- Support responsive layout with compact/minimal breakpoints for narrow terminals.
- Support only one selected/current issue in v1.
- Tab navigation: `Tab` forward, `Shift+Tab` backward, `1-8` direct tab switch.
- `Esc` follows mode-stack/back behavior; `q` fast-closes the console.
- Remove old compact widget; keep only optional pi footer/status while daemon runs.
- Closing the console does not stop the daemon; daemon stops on pi session shutdown.
- Workflow/config changes hot-reload visibly and safely in the console.
- Add `last_reload_at` and resolved workflow metadata to `SymphonyOrchestrator.snapshot()`.
- Queue eligible issue fetching should go through orchestrator/config service logic, not duplicate tracker adapter logic in TUI.
- Queue should show all active-state candidates with dispatch eligibility/reasons.
- Refactor daemon dispatch eligibility into pure functions, e.g. `src/eligibility.ts`, used by orchestrator, TUI, and tests.

### Why this matters for the team

- Explains system structure and design constraints for future contributors.
- Reduces onboarding and review ambiguity.

### Follow-ups

- [ ] Add `last_reload_at` and resolved workflow metadata to `SymphonyOrchestrator.snapshot()`.
- [ ] Queue eligible issue fetching should go through orchestrator/config service logic, not duplicate tracker adapter logic in TUI.
- [ ] Queue should show all active-state candidates with dispatch eligibility/reasons.
