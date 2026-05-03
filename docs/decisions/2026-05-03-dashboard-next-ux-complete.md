# Dashboard next UX complete

Date: 2026-05-03
Issue: `pi-symphony-evc`

## Outcome

The HTTP dashboard follow-up UX backlog is implemented and all child slices are closed. The single `/symphony` command model is preserved; dashboard access remains through the configured HTTP server, and JSON APIs remain available.

## Implemented

- Live dashboard polling from `/api/v1/state` every 3 seconds.
- Visual `/issue/:identifier` telemetry pages with useful 404s.
- Embedded redacted log tail from active/retry run artifacts.
- Recent `.symphony/runs` artifact browser.
- Deterministic failure triage cards.
- `/api/v1/queue` endpoint and dashboard queue cards.
- Manual dashboard refresh control using `POST /api/v1/refresh`.
- Responsive and accessibility polish: skip link, landmarks, focus states, reduced-motion handling.
- Sanitized dashboard summary export/download.
- Persisted theme toggle with alternate paper theme.

## Verification

- `npm run check`
- `npm test`
