# 2026-05-03 pi-symphony ROI hardening session

Implemented and closed Beads epic `pi-symphony-0y2`.

## Closed tasks

- `pi-symphony-0y2.1` — real pi extension load smoke.
- `pi-symphony-0y2.2` — Codex app-server schema compatibility check.
- `pi-symphony-0y2.3` — real minimal Codex app-server smoke.
- `pi-symphony-0y2.4` — Beads end-to-end smoke.
- `pi-symphony-0y2.5` — per-attempt run artifact bundles.
- `pi-symphony-0y2.6` — HTTP event/artifact observability.
- `pi-symphony-0y2.7` — Linear live smoke profile.
- `pi-symphony-0y2.8` — Jira Cloud live smoke profile.

## Added smoke scripts

- `npm run smoke:pi-extension`
- `npm run smoke:codex-schema`
- `npm run smoke:codex-app-server`
- `npm run smoke:beads-e2e`
- `npm run smoke:linear-live`
- `npm run smoke:jira-live`
- `npm run smoke:live`

Linear and Jira live smokes are opt-in and read-only.

## Runtime observability changes

- Per-attempt artifacts are written under `.symphony/runs/`:
  - `prompt.md`
  - `events.jsonl`
  - `metadata.json`
  - `result.json`
- Configured tracker secrets and obvious token/password patterns are redacted before artifact writes.
- Running/retry snapshots include artifact paths.
- Recent per-issue events are tracked with a bounded 50-event ring buffer.
- Dashboard renders recent event/artifact summaries from snapshot data.

## Verification

Final verification passed:

```bash
npm run smoke
npm run smoke:live
npm run check
npm test
```

Final test count: 44 passing tests.

Beads status: 18 total issues, 18 closed, 0 open/in-progress/blocked/ready.
