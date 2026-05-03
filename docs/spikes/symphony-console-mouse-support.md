# Spike: Symphony Console mouse support feasibility

Date: 2026-05-03
Status: Complete — defer
Beads: `pi-symphony-kbh.10`

## Question

Should Symphony Console v1.1 add mouse interactions for tab clicks and row selection?

## Findings

Inspected the current pi TUI public types and docs:

- `node_modules/@mariozechner/pi-tui/dist/tui.d.ts`
- `node_modules/@mariozechner/pi-tui/dist/keys.d.ts`
- `node_modules/@mariozechner/pi-tui/dist/terminal.d.ts`
- `node_modules/@mariozechner/pi-tui/dist/stdin-buffer.d.ts`
- pi TUI docs/examples previously used for the console implementation

The public `Component` API exposes:

- `render(width): string[]`
- optional `handleInput(data: string): void`
- optional `wantsKeyRelease`
- `invalidate()`

There is no documented typed mouse event API, click coordinate model, hit-testing helper, or overlay mouse routing API in the public `Component`/`TUI` declarations. `stdin-buffer.d.ts` mentions buffering escape sequences such as SGR mouse sequences, but that is lower-level input buffering, not a supported app-level mouse contract.

## Feasibility

A prototype could parse raw SGR mouse escape sequences in `handleInput`, but that would require Symphony Console to own:

- terminal mouse mode enable/disable lifecycle
- SGR mouse escape parsing
- coordinate mapping across pi overlays, borders, headers, scrollback, and viewport offsets
- hit-testing for tabs, rows, action menus, and confirmation overlays
- fallback behavior for terminals that do not emit mouse events

That would be brittle and outside the current pi-native TUI abstraction.

## Decision

Do **not** add mouse support in v1.1.

Keep Symphony Console keyboard-first. Revisit only when pi TUI exposes a documented mouse/click event API with coordinates and overlay routing semantics.

## Consequences

- No production behavior depends on mouse support.
- v1.1 UX polish remains focused on keyboard discoverability: action menu, grouped Help, clearer empty states, and better visual hierarchy.
- Future mouse support should start with tabs and row selection only after the platform API is stable.

## Future acceptance criteria before implementing mouse

- Public pi TUI mouse event type exists.
- Mouse mode lifecycle is handled by pi TUI/terminal layer, not by Symphony Console.
- Overlay coordinates are routed to the focused component or supplied with absolute and local positions.
- Tests/examples exist for click tabs and row selection.
