---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: ABC
  active_states: [Todo, In Progress]
  terminal_states: [Closed, Cancelled, Canceled, Duplicate, Done]

polling:
  interval_ms: 30000

workspace:
  root: .symphony/workspaces

hooks:
  timeout_ms: 60000
  after_create: |
    echo "Prepare repository checkout or bootstrap here"
  before_run: |
    echo "Run preflight checks here"
  after_run: |
    echo "Collect artifacts here"

agent:
  max_concurrent_agents: 2
  max_turns: 5
  max_retry_backoff_ms: 300000

server:
  port: 8080

codex:
  command: codex app-server
  approval_policy: never
  turn_timeout_ms: 3600000
  read_timeout_ms: 5000
  stall_timeout_ms: 300000
  turn_sandbox_policy:
    type: workspaceWrite
    writableRoots: []
    networkAccess: true
---
You are working on Linear issue {{ issue.identifier }}: {{ issue.title }}.

Issue URL: {{ issue.url }}
Priority: {{ issue.priority }}
Labels: {% for label in issue.labels %}{{ label }} {% endfor %}

Description:
{{ issue.description }}

If you need to update the tracker, use workflow-provided tools and never print secrets.
