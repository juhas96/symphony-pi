import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBeadIssue, normalizeJiraIssue, normalizeLinearIssue } from "../src/tracker.js";

test("normalizes Jira Cloud issue", () => {
	const issue = normalizeJiraIssue({
		key: "ABC-1",
		self: "https://example.atlassian.net/rest/api/3/issue/ABC-1",
		fields: {
			summary: "Fix bug",
			status: { name: "To Do" },
			priority: { name: "High" },
			labels: ["Backend", "Bug"],
			created: "2026-01-01T00:00:00.000+0000",
			updated: "2026-01-02T00:00:00.000+0000",
			description: { content: [{ content: [{ text: "Details" }] }] },
		},
	});

	assert.equal(issue?.id, "ABC-1");
	assert.equal(issue?.priority, 2);
	assert.deepEqual(issue?.labels, ["backend", "bug"]);
	assert.equal(issue?.description, "Details");
});

test("normalizes Beads issue with flexible fields", () => {
	const issue = normalizeBeadIssue({ id: "pi-symphony-1", title: "Work", status: "open", tags: ["Agent"] });

	assert.equal(issue?.identifier, "pi-symphony-1");
	assert.equal(issue?.state, "open");
	assert.deepEqual(issue?.labels, ["agent"]);
});

test("normalizes Linear labels and blockers", () => {
	const issue = normalizeLinearIssue({
		id: "uuid",
		identifier: "LIN-1",
		title: "Work",
		state: { name: "Todo" },
		labels: { nodes: [{ name: "Bug" }] },
		inverseRelations: { nodes: [{ type: "blocks", issue: { id: "b", identifier: "LIN-0", state: { name: "Done" } } }] },
	});

	assert.deepEqual(issue?.labels, ["bug"]);
	assert.deepEqual(issue?.blocked_by, [{ id: "b", identifier: "LIN-0", state: "Done" }]);
});
