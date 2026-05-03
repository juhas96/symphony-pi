# pi-symphony tracker extensions

The OpenAI Symphony draft currently specifies Linear as the required tracker. pi-symphony also ships implementation-defined tracker extensions for Jira Cloud and Beads.

`tracker.kind` is required during dispatch validation. Select `kind: linear` for draft-conformant Linear dispatch, or explicitly select `kind: jira` / `kind: beads` to opt into these extensions. A missing `tracker.kind` is a typed config error rather than an implicit Linear default.

## Adapter contract

All adapters implement:

```ts
interface TrackerAdapter {
  fetchCandidateIssues(): Promise<Issue[]>;
  fetchIssuesByStates(stateNames: string[]): Promise<Issue[]>;
  fetchIssueStatesByIds(issueIds: string[]): Promise<Issue[]>;
}
```

Adapters must normalize tracker payloads into the Symphony `Issue` shape before orchestration sees them.

## Jira Cloud

Config keys under `tracker`:

- `kind: jira`
- `endpoint`: Atlassian site URL, e.g. `https://your-org.atlassian.net`
- `email`: account email or `$JIRA_EMAIL`
- `api_token`: API token or `$JIRA_API_TOKEN`
- `project_key`: Jira project key, unless `jql` fully scopes candidates
- `jql`: optional candidate query override
- `active_states`, `terminal_states`: same scheduler semantics as Linear

Auth uses Jira Cloud Basic auth with `email:api_token`. Tokens are not logged.

## Beads

Config keys under `tracker`:

- `kind: beads`
- `command`: default `bd`
- `ready_command`: default `bd ready --json`
- `active_states`: default `[open, in_progress]`
- `terminal_states`: default `[closed]`

The Beads adapter shells out to the CLI and expects JSON output from `ready`, `list`, and `show` commands. It accepts flexible field names (`id`, `title`, `status`/`state`, `labels`/`tags`) and normalizes them into Symphony issues.

## Boundary

Tracker writes remain outside the orchestrator. Workflow prompts and Codex tools should perform ticket comments, state transitions, or handoff updates. This keeps pi-symphony a scheduler/runner rather than a tracker-specific workflow engine.
