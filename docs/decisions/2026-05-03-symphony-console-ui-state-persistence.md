# Decision: keep Symphony Console UI state session-only for v1.1

Date: 2026-05-03
Status: Accepted
Beads: `pi-symphony-kbh.9`

## Context

The v1 Symphony Console intentionally kept UI state in memory only. The v1.1 backlog asked whether harmless UI preferences should persist between `/symphony` opens.

Candidate state included:

- last active tab
- log mode/filter/search
- selected issue/run
- list cursors
- filters
- raw JSON toggles

## Decision

Do **not** persist Symphony Console UI state in v1.1. Keep it session-only/in-memory.

## Rationale

- Even apparently harmless UI state can include sensitive or noisy project context: issue identifiers, private workspace paths, artifact paths, log paths, filters copied from error text, and selected run names.
- Persistence adds config/schema/versioning work without improving the core operator loop enough for v1.1.
- The console now has stronger first-run guidance, empty states, action menus, and task-oriented Help, reducing the need to remember prior state.
- `/symphony` should remain safe to open in shared/team repos without writing operator-local UI traces into project files.

## Consequences

- Reopening `/symphony` starts with default UI state.
- The daemon/runtime state still lives in the process as before; only visual console preferences reset.
- If persistence is revisited later, it should be explicit opt-in and store only non-sensitive preferences outside the repository, with tests for redaction and migration behavior.

## Future revisit criteria

Reconsider persistence only if operators repeatedly need it after v1.1, and only for a short allowlist such as:

- last tab category, not selected issue/run
- preferred log mode, not log path/search text
- raw view preference, not raw content

Do not persist issue content, logs, secrets, private paths, search strings, or artifact identifiers by default.
