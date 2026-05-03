---
tracker:
  kind: jira
  endpoint: https://your-org.atlassian.net
  email: $JIRA_EMAIL
  api_token: $JIRA_API_TOKEN
  project_key: ABC
  active_states: ["To Do", "In Progress"]
  terminal_states: [Done, Canceled]
  # Optional custom candidate query:
  # jql: 'project = ABC AND status in ("To Do", "In Progress") ORDER BY priority ASC, created ASC'

workspace:
  root: .symphony/workspaces

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
You are working on Jira issue {{ issue.identifier }}: {{ issue.title }}.

Description:
{{ issue.description }}

Before finishing, summarize what changed and what a human should review.
