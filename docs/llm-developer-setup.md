# LLM developer setup guide

Use this guide when asking an LLM coding agent to install and configure `pi-symphony` in another repository.

`pi-symphony` is a pi package/extension. It loads a repository-owned `WORKFLOW.md`, polls an issue tracker, creates one workspace per issue, launches `codex app-server`, and exposes a single `/symphony` operator console in pi.

## What the LLM should do

1. Review this package before installing it. Pi packages run code with local user privileges.
2. Install `pi-symphony` into the target repository's project pi settings.
3. Add a target-repository `WORKFLOW.md` based on the tracker in use.
4. Add local runtime artifacts to the target repository's `.gitignore`.
5. Open `/symphony` and inspect Config validation.
6. Run one safe issue from the `/symphony` Queue before starting the daemon.

## Prerequisites

On the developer machine:

- Node.js and npm.
- pi installed and usable from the target repository.
- Codex CLI installed, authenticated, and able to run `codex app-server`.
- Tracker credentials supplied by environment variables, never committed to git.

For Linear, either export the variable before starting pi or place it in the target repository's ignored `.env` next to `WORKFLOW.md`:

```bash
export LINEAR_API_KEY=...
```

```dotenv
LINEAR_API_KEY=...
```

For Jira Cloud:

```bash
export JIRA_EMAIL=...
export JIRA_API_TOKEN=...
export JIRA_ENDPOINT=https://your-org.atlassian.net
```

For Beads:

```bash
bd init --non-interactive
```

## Install the pi package

From the target repository, install the package into project settings so the team can share the configuration:

```bash
pi install -l npm:@jkbjhs/symphony-pi
```

GitHub SSH also works:

```bash
pi install -l https://github.com/juhas96/symphony-pi
```

For local development against a checkout of this repository:

```bash
pi install -l /absolute/path/to/pi-symphony
```

To try without writing settings:

```bash
pi -e npm:@jkbjhs/symphony-pi
```

Project installs are written under `.pi/settings.json`; commit that file only after reviewing that it references the intended package source. Pin to a tag or commit when you need reproducible team installs.

## Add target-repo ignores

Ensure the target repository ignores local Symphony output and secrets:

```gitignore
.env
.symphony/runs/
.symphony/workspaces/
.symphony/logs/
```

Keep workspaces, run artifacts, and operator logs local. `prompt.md`, `events.jsonl`, `metadata.json`, `result.json`, and `symphony.log` can contain operational context and should not be committed.

## Create `WORKFLOW.md`

Start from one of this package's examples:

- `examples/WORKFLOW.linear.md`
- `examples/WORKFLOW.jira.md`
- `examples/WORKFLOW.beads.md`

Minimal Linear workflow:

```md
---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: YOUR_LINEAR_PROJECT_SLUG
  active_states: [Todo, In Progress]
  terminal_states: [Done, Closed, Canceled, Cancelled, Duplicate]

workspace:
  root: .symphony/workspaces

hooks:
  after_create: |
    git clone git@github.com:your-org/your-repo.git .

agent:
  max_concurrent_agents: 1
  max_turns: 5

codex:
  command: codex app-server
  approval_policy: never
  turn_sandbox_policy:
    type: workspaceWrite
    writableRoots: []
    networkAccess: true
---
You are working on Linear issue {{ issue.identifier }}: {{ issue.title }}.

Issue URL: {{ issue.url }}

Description:
{{ issue.description }}

Follow the repository instructions, make the smallest safe change, run relevant tests, and update the tracker only through approved tools. Never print secrets.
```

Adjust `hooks.after_create` for the target repo. If the target repo uses `mise`, `pnpm`, `uv`, or another toolchain, bootstrap dependencies in `after_create` before relying on them in later hooks.

## Validate and run

Inside pi from the target repository:

```text
/symphony
/symphony --port 8080
```

`/symphony` opens the full-screen operator console. Use Config to validate, Queue to run once for a safe selected issue (`x`) or first eligible issue (`X`), and Overview/Running/Logs/Runs to observe work. Start the daemon only after a safe one-issue run succeeds by pressing `d` inside the console. Stop it with `s`. Closing the console does not stop the daemon.

Then open the loopback dashboard with `o` or this URL when the daemon was started with a port:

```text
http://127.0.0.1:8080/
```

## Smoke checks for this package checkout

When changing `pi-symphony` itself, run:

```bash
npm install
npm run check
npm test
npm run smoke:pi-extension
npm run smoke:codex-schema
npm run smoke:codex-app-server
npm run smoke:beads-e2e
```

Live tracker checks are opt-in and should use isolated test projects:

```bash
PI_SYMPHONY_LIVE_LINEAR=1 LINEAR_API_KEY=... LINEAR_PROJECT_SLUG=... npm run smoke:linear-live
PI_SYMPHONY_LIVE_JIRA=1 JIRA_EMAIL=... JIRA_API_TOKEN=... JIRA_ENDPOINT=https://your-org.atlassian.net JIRA_PROJECT_KEY=ABC npm run smoke:jira-live
```

## Copy/paste prompt for an LLM agent

```text
Set up pi-symphony in this repository for developer use.

Package source: npm:@jkbjhs/symphony-pi

Requirements:
1. Review the package docs before installing. Pi packages execute local code.
2. Install it into project pi settings with `pi install -l`, or update `.pi/settings.json` equivalently.
3. Create `WORKFLOW.md` for our tracker. Use Linear unless I specify Jira or Beads.
4. Use environment variables for credentials; do not commit tokens or `.env`.
5. Add `.symphony/runs/`, `.symphony/workspaces/`, `.symphony/logs/`, and `.env` to `.gitignore` if missing.
6. Configure `hooks.after_create` so each issue workspace contains a fresh checkout/setup of this repo.
7. Run `/symphony` in pi, inspect Config validation, then run once for `<safe-test-issue>` from Queue only if I provide a safe issue id.
8. Report exactly what files changed and what manual secrets/env vars I must set.
```

## Troubleshooting

- `codex app-server` missing: install/authenticate Codex CLI and verify `codex app-server generate-json-schema --out /tmp/codex-schema` works.
- `/symphony` command missing: restart pi from the target repo and check `pi list` includes the package.
- Linear validates but finds no work: verify the issue is assigned to the configured Linear project `project_slug` (not just the team), its state name is included in `active_states`, and the token has access.
- Jira validates but finds no work: verify `JIRA_ENDPOINT`, `project_key` or `jql`, and status names.
- Workspaces are empty: fix `hooks.after_create`; pi-symphony only creates the directory unless the hook clones/bootstrap the repo.
