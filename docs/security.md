# pi-symphony security posture

## Trust boundary

pi-symphony is intended for trusted operator environments unless the operator adds external isolation. It reads tracker issues, creates local workspaces, and launches Codex app-server processes that can execute code according to the configured Codex approval and sandbox policy.

Tracker content, repository files, and prompt inputs can be adversarial. Do not run pi-symphony against untrusted projects without additional OS/container/VM sandboxing, scoped credentials, and network controls.

## Workspace isolation

Baseline invariants enforced by the extension:

- Workspace names are derived from sanitized issue identifiers.
- Workspace paths must remain under `workspace.root`.
- Codex app-server is launched with the per-issue workspace as `cwd`.
- Terminal issue cleanup removes only the sanitized per-issue workspace path.

These controls prevent accidental path traversal but are not a replacement for a sandbox.

## Codex approval and sandbox policy

pi-symphony passes `codex.approval_policy`, `codex.thread_sandbox`, and `codex.turn_sandbox_policy` through to the installed Codex app-server version. Supported values are defined by that Codex version.

For Codex app-server approval callbacks, pi-symphony uses a high-trust autonomous policy: `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` receive `{ decision: "accept" }`; `item/permissions/requestApproval` grants the requested permission profile for the current turn. These callbacks emit runtime events such as `approval_auto_approved`. This prevents unattended runs from stalling but means the configured Codex sandbox and the surrounding OS/container boundary carry the security burden.

Recommended starting point for trusted local testing:

```yaml
codex:
  approval_policy: never
  turn_sandbox_policy:
    type: workspaceWrite
    writableRoots: []
    networkAccess: true
```

For stricter environments, use a more restrictive approval policy, disable network access where possible, and run the whole service under a dedicated OS user or external sandbox.

## Hook trust

`hooks.after_create`, `hooks.before_run`, `hooks.after_run`, and `hooks.before_remove` are arbitrary shell scripts from `WORKFLOW.md`. They are trusted configuration and run in the workspace directory.

Hook safety behavior:

- `after_create` and `before_run` failures abort the current operation.
- `after_run` and `before_remove` failures are logged and ignored.
- `hooks.timeout_ms` applies to all hooks.
- `before_remove` runs only for existing workspace directories; missing paths skip the hook and non-directory paths skip it with a warning before removal.
- Hook output in failure logs is truncated and obvious token/secret assignments are redacted.

## Secret handling

Secrets should be referenced with `$VAR` indirection:

```yaml
tracker:
  api_key: $LINEAR_API_KEY
```

pi-symphony validates presence after resolution without logging raw secret values. Avoid placing literal secrets in `WORKFLOW.md` because that file is expected to be repository-owned.

## User-input policy

Autonomous runs must not stall waiting for a human. Codex `tool/requestUserInput`, `item/tool/requestUserInput`, and MCP elicitation requests receive a structured error response and the run fails with `turn_input_required` / terminal reason `user_input_required`.

## Optional client-side tools

The optional `linear_graphql` dynamic tool is advertised on Codex `thread/start` for Linear sessions with valid configured auth and handled for `item/tool/call` requests. It reuses the configured Linear endpoint/token without writing the token into the prompt or tool arguments, rejects empty/multi-operation queries and invalid variables, and returns `success=false` for GraphQL or validation failures. Because this exposes raw Linear GraphQL capability to the agent, use a least-privilege Linear token and isolated project scope. Unsupported app-server tool/server requests receive structured errors or unsuccessful dynamic-tool responses and do not stall the run.
