# npm publish prep and dashboard UX follow-up

Date: 2026-05-03

## Summary

This session completed a large UX/publish-prep pass for `pi-symphony`.

## Beads closed

- `pi-symphony-jz8` — Symphony Console next UX improvements.
- `pi-symphony-w12` — Polish HTTP dashboard operator UI.
- `pi-symphony-evc` — Dashboard next UX improvements.
- `pi-symphony-91a` — Remove raw JSON affordances from dashboard UI.

## Dashboard UX decisions

- The human dashboard should be visual-first and should not route operators to raw JSON as a primary UI affordance.
- Machine JSON APIs remain available for integrations.
- The dashboard now exposes visual system facts, issue facts, workload/queue/artifact/log panels, manual refresh, safe summary export, and theme toggle.

## npm publish prep

- The npm package name is `symphony-pi` so the published name does not expose a personal npm scope.
- The previous attempted scope `@juhas96/symphony-pi` failed with `E404 Scope not found` because `juhas96` is a GitHub identity, not the authenticated npm scope.
- The package is publish-ready as an unscoped public package with `prepublishOnly` validation.

## Verification run

- `npm run check`
- `npm test`
- `npm run smoke:pi-extension`
- `npm publish --dry-run`

All passed after switching to the unscoped `symphony-pi` npm package name.

## Git

Pushed to `origin/main`:

- `d599e66` — Prepare pi-symphony npm package and polish UX
- `765827b` — Use npm scope jkbjhs for package

## Publish command

```bash
npm publish
```
