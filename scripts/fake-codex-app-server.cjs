#!/usr/bin/env node
const readline = require("node:readline");

const scenario = process.argv[2] || "success";
const rl = readline.createInterface({ input: process.stdin });

function send(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

if (scenario === "exit") process.exit(7);

rl.on("line", (line) => {
	const msg = JSON.parse(line);
	if (scenario === "read-timeout" && msg.method === "initialize") return;
	if (msg.method === "initialize") send({ id: msg.id, result: { userAgent: "fake-codex-app-server" } });
	else if (msg.method === "initialized") {}
	else if (msg.method === "thread/start") send({ id: msg.id, result: { thread: { id: "thr_smoke" } } });
	else if (msg.method === "turn/start") {
		send({ id: msg.id, result: { turn: { id: "turn_smoke", status: "inProgress", items: [], error: null } } });
		if (scenario === "turn-timeout") return;
		setTimeout(() => {
			send({ method: "turn/started", params: { turn: { id: "turn_smoke", status: "inProgress" } } });
			send({ method: "thread/tokenUsage/updated", params: { total_token_usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
			send({ method: "turn/completed", params: { turn: { id: "turn_smoke", status: scenario === "failed" ? "failed" : "completed", error: scenario === "failed" ? { message: "fake failure" } : null } } });
		}, 5);
	}
});
