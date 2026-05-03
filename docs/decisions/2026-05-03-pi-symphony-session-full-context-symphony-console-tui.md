# pi-symphony session full context — Symphony Console TUI

Date: 2026-05-03
Source: MemPalace
Wing: pi-symphony
Room: session-2026-05-03-symphony-console-tui-full-context
Shared by: pi-coding-agent

## Summary

pi-symphony session full context — Symphony Console TUI

## Details

# pi-symphony session full context — Symphony Console TUI

Date: 2026-05-03
Repo: `~/Documents/work/pi-symphony`
Beads task: `pi-symphony-797 — Build single-command Symphony Console TUI`
Canonical decision doc: `docs/decisions/2026-05-03-symphony-console-tui-final.md`

## User request / goal
Continue and finish implementation work for `pi-symphony-797`: build the smallest complete v1 aligned with the canonical decision document, then run typecheck/tests. Later compaction requested: save all session content before detailed context is lost.

## Prior design/grilling context preserved
- User wanted a single-command, full custom Symphony Console TUI inside pi via `/symphony`.
- Old slash-command/widget/panel UX should be replaced, not kept.
- User explicitly preferred all agreed UX at once, not phased.
- Use pi-native `@mariozechner/pi-tui` / `ctx.ui.custom()`, not external OpenTUI.
- Full-screen visual overlay inside pi.
- All daemon/run/config/log actions live inside the TUI.
- Ask design questions one at a time; inspect code when answerable.

## Key decisions made
- Register only `/symphony`; remove `/symphony:*` operator shortcuts.
- No backward compatibility aliases.
- `/symphony` opens console only; it does not auto-start daemon.
- Argument grammar supported: `/symphony`, `/symphony path/to/WORKFLOW.md`, `/symphony --port 8080`, `/symphony --workflow path --port 8080`; no subcommands.
- Closing console does not stop daemon.
- Daemon stops on explicit action or pi `session_shutdown`.
- Views/tabs: `Overview | Queue | Running | Issue | Logs | Runs | Config | Help`.
- Queue is tracker-generic and shows `Ready to dispatch`, `Not dispatchable now`, and `Retry / backoff`.
- Private orchestrator dispatch logic was refactored into pure reusable eligibility helpers.
- Run once exists inside TUI only: `x` selected issue, `X` first eligible; blocked while daemon running.
- Logs support Global and Selected run modes, bounded tail, scrollback, and follow mode.
- Config errors never prevent console opening; focus/config displays validation error.
- Contextual action menu via `a` with structured actions.
- Navigation: `Tab`/`Shift+Tab`, `1-8`, `/` filters, `?` help, `q` close, `Esc` back/mode stack.
- Rendering: pi theme adapter, Unicode glyphs, responsive layout, truncating tables, wrapped detail panes.
- UI state is in memory only; no disk/session persistence.

## Files implemented/changed
- `src/eligibility.ts`
  - New shared pure dispatch eligibility/sorting module.
  - Exposes `sortIssuesForDispatch` and `evaluateIssueEligibility` with dispatchability reasons.
  - Covers already running/claimed/completed/retrying, inactive state, blockers, global slots, per-state slots.
- `src/orchestrator.ts`
  - Uses shared eligibility helpers instead of private-only dispatch logic.
  - Adds richer snapshot metadata including workflow/config metadata and `lastReloadAt`.
  - Adds queue snapshot support for active candidates and retry/backoff rows.
  - Exposes config/workflow accessors needed by TUI.
- `src/commands.ts`
  - Replaced legacy `/symphony:validate`, `/symphony:once`, `/symphony:daemon`, `/symphony:panel`, `/symphony:stop`, `/symphony:status` operator shortcuts with a single `/symphony` command.
  - Maintains daemon and once-run runtime state for console controls.
  - Opens full-screen pi-native console through `ctx.ui.custom()`.
  - Supports daemon start/stop, run once, open external dashboard/artifacts/issue paths, footer status, session shutdown cleanup.
- `src/tui/data.ts`
  - TUI data/control types and `/symphony` argument parser.
  - Parser omits undefined optional keys so deep equality tests pass.
- `src/tui/format.ts`
  - Formatting utilities for console tables, truncation, wrapping, dates/durations/status text.
- `src/tui/console.ts`
  - Full-screen console implementation using `@mariozechner/pi-tui` key handling.
  - Tabs: Overview, Queue, Running, Issue, Logs, Runs, Config, Help.
  - Action menu, filters, logs scroll/follow, queue selection, status/banner handling, render shell.
  - Key fixes: use `Key.pageUp` / `Key.pageDown`; remove redundant `"Runs"` comparison after filter tab narrowing.
  - Run-once selected now refuses non-dispatchable selected rows.
- Tests updated:
  - `tests/commands.test.ts` expects only `["symphony"]`, tests `parseSymphonyArgs`, and basic `SymphonyConsole` render/state transition.
  - `tests/orchestrator-conformance.test.ts` includes pure eligibility helper coverage.
  - `tests/docs.test.ts`, `tests/package.test.ts` updated for single command docs/smoke expectations.
- Docs/scripts updated:
  - `README.md`
  - `docs/runbook.md`
  - `docs/llm-developer-setup.md`
  - `docs/validation-matrix.md`
  - `scripts/smoke-pi-extension.mjs`
  - Canonical decision doc exists: `docs/decisions/2026-05-03-symphony-console-tui-final.md`

## Debugging note
Initial new standalone test files `tests/eligibility.test.ts` and `tests/tui-console.test.ts` caused unrelated `tests/codex.test.ts` fake app-server scenario to fail intermittently because Node test files execute concurrently and test timing/port assumptions shifted. The failure looked like initialize response timeout or wrong error regex. Fixed by removing those standalone test files and merging the new coverage into existing `tests/commands.test.ts` and `tests/orchestrator-conformance.test.ts`, restoring deterministic behavior.

## Verification commands and results
- `npm run check` — passed.
- `npm test` — passed, 61 tests.
- `npm run smoke:pi-extension` — passed: pi loaded package and registered single `/symphony` command.

## Beads outcome
Closed task:
`bd close pi-symphony-797 --reason done --json`
Result: status `closed`, close_reason `done`.

## Important exact command snippets
- Verification command used: `npm run check && npm test && npm run smoke:pi-extension`
- Beads close command used: `bd close pi-symphony-797 --reason done --json`

## Important final status
Implementation is complete for the requested smallest com

_[Truncated for team doc review.]_

## Why this matters for the team

- Records decision context teammates should not have to rediscover.
- Helps future changes preserve the intended trade-offs.

## Follow-ups

- [ ] Continue and finish implementation work for `pi-symphony-797`: build the smallest complete v1 aligned with the canonical decision document, then run typecheck/tests. Later compaction requested: save all session content before detailed context is lost.
- [ ] Old slash-command/widget/panel UX should be replaced, not kept.
