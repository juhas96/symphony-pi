---
tracker:
  kind: beads
  command: bd
  ready_command: bd ready --json
  active_states: [open, in_progress]
  terminal_states: [closed]

workspace:
  root: .symphony/workspaces

agent:
  max_concurrent_agents: 1
  max_turns: 3

codex:
  command: codex app-server
  approval_policy: never
  turn_sandbox_policy:
    type: workspaceWrite
    writableRoots: []
    networkAccess: true
---
You are working on Beads task {{ issue.identifier }}: {{ issue.title }}.

Task details:
{{ issue.description }}

Use `bd show {{ issue.identifier }}` if more local tracker detail is needed.
