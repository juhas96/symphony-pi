import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("operator docs and examples cover trackers, security, runbook, and real integration", async () => {
	const linear = await readFile("examples/WORKFLOW.linear.md", "utf8");
	const jira = await readFile("examples/WORKFLOW.jira.md", "utf8");
	const beads = await readFile("examples/WORKFLOW.beads.md", "utf8");
	const security = await readFile("docs/security.md", "utf8");
	const runbook = await readFile("docs/runbook.md", "utf8");
	const trackerExtensions = await readFile("docs/tracker-extensions.md", "utf8");
	const llmSetup = await readFile("docs/llm-developer-setup.md", "utf8");

	assert.match(linear, /kind: linear/);
	assert.match(jira, /kind: jira/);
	assert.match(beads, /kind: beads/);
	assert.match(security, /Trust boundary/);
	assert.match(security, /User-input policy/);
	assert.match(security, /Hook trust/);
	assert.match(runbook, /\/symphony/);
	assert.doesNotMatch(runbook, /\/symphony:validate/);
	assert.doesNotMatch(runbook, /\/symphony:once/);
	assert.doesNotMatch(runbook, /\/symphony:daemon/);
	assert.match(runbook, /\/api\/v1\/state/);
	assert.match(runbook, /Real integration profile/);
	assert.match(runbook, /\.symphony\/runs/);
	assert.match(runbook, /result\.json/);
	assert.match(runbook, /npm run smoke:pi-extension/);
	assert.match(runbook, /npm run smoke:codex-schema/);
	assert.match(runbook, /npm run smoke:codex-app-server/);
	assert.match(runbook, /npm run smoke:beads-e2e/);
	assert.match(runbook, /npm run smoke:linear-live/);
	assert.match(runbook, /npm run smoke:jira-live/);
	assert.match(trackerExtensions, /implementation-defined tracker extensions/i);
	assert.match(llmSetup, /LLM developer setup guide/);
	assert.match(llmSetup, /pi install -l npm:@jkbjhs\/symphony-pi/);
	assert.match(llmSetup, /https:\/\/github\.com\/juhas96\/symphony-pi/);
	assert.match(llmSetup, /\/symphony/);
	assert.doesNotMatch(llmSetup, /\/symphony:\*/);
	assert.match(llmSetup, /WORKFLOW\.md/);
});

test("validation docs describe linear_graphql advertisement and dynamic handler", async () => {
	const matrix = await readFile("docs/validation-matrix.md", "utf8");
	const readme = await readFile("README.md", "utf8");

	assert.match(matrix, /linear_graphql/);
	assert.match(matrix, /advertised and handled/i);
	assert.match(matrix, /dynamic_tools/);
	assert.match(matrix, /unsupported_tool_call/);
	assert.match(readme, /docs\/llm-developer-setup\.md/);
	assert.doesNotMatch(readme, /linear_graphql.*omitted/i);
	assert.match(readme, /linear_graphql/);
	assert.match(readme, /advertised on `thread\/start`/i);
	assert.match(readme, /smoke:pi-extension/);
	assert.match(readme, /smoke:codex-schema/);
	assert.match(readme, /smoke:codex-app-server/);
	assert.match(readme, /smoke:beads-e2e/);
	assert.match(readme, /smoke:linear-live/);
	assert.match(readme, /smoke:jira-live/);
});
