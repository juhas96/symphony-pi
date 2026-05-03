import test from "node:test";
import assert from "node:assert/strict";

import { SymphonyHttpServer } from "../src/http.js";

test("HTTP server exposes state, issue lookup, refresh, and dashboard", async () => {
	let refreshed = false;
	const runtimeSnapshot = {
		counts: { running: 1, retrying: 0 },
		running: [{ issue_identifier: "ABC-1", last_event: "turn_completed", artifact_path: "/tmp/.symphony/runs/ABC-1" }],
		retrying: [],
	};
	const issueSnapshot = {
		issue_identifier: "ABC-1",
		recent_events: [{ at: "2026-01-01T00:00:00.000Z", event: "turn_completed", message: "done" }],
		artifacts: { events: "/tmp/.symphony/runs/ABC-1/events.jsonl" },
		logs: { codex_session_logs: [{ label: "Codex events", path: "/tmp/.symphony/runs/ABC-1/events.jsonl", url: "file:///tmp/.symphony/runs/ABC-1/events.jsonl" }] },
	};
	const server = new SymphonyHttpServer({
		port: 0,
		snapshot: () => runtimeSnapshot,
		issueSnapshot: (identifier) => (identifier === "ABC-1" ? issueSnapshot : null),
		refresh: async () => {
			refreshed = true;
		},
	});
	const { port } = await server.start();
	try {
		const state = await fetchJson(`http://127.0.0.1:${port}/api/v1/state`);
		assert.deepEqual(state, runtimeSnapshot);

		const issue = await fetchJson(`http://127.0.0.1:${port}/api/v1/ABC-1`);
		assert.deepEqual(issue, issueSnapshot);

		const missing = await fetch(`http://127.0.0.1:${port}/api/v1/MISSING`);
		assert.equal(missing.status, 404);
		assert.deepEqual(await missing.json(), { error: { code: "issue_not_found", message: "Issue not found in current runtime state: MISSING" } });

		const wrongMethod = await fetch(`http://127.0.0.1:${port}/api/v1/state`, { method: "POST" });
		assert.equal(wrongMethod.status, 405);
		assert.equal(wrongMethod.headers.get("allow"), "GET");

		const refresh = await fetch(`http://127.0.0.1:${port}/api/v1/refresh`, { method: "POST" });
		assert.equal(refresh.status, 202);
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(refreshed, true);

		const dashboard = await fetch(`http://127.0.0.1:${port}/`);
		assert.equal(dashboard.headers.get("content-type")?.startsWith("text/html"), true);
		const html = await dashboard.text();
		assert.match(html, /Recent events and artifacts/);
		assert.match(html, /turn_completed/);
		assert.match(html, /\/tmp\/.symphony\/runs\/ABC-1/);
	} finally {
		await server.stop();
	}
});

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url);
	assert.equal(response.status, 200);
	return response.json();
}
