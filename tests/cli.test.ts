import test from "node:test";
import assert from "node:assert/strict";

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main, parseArgs } from "../src/cli.js";

test("CLI parser supports workflow path, once, and port", () => {
	assert.deepEqual(parseArgs(["--port", "0", "--once", "ABC-1", "./WORKFLOW.md"]), {
		help: false,
		port: 0,
		once: "ABC-1",
		workflowPath: "./WORKFLOW.md",
	});
});

test("CLI parser supports daemon workflow-only mode", () => {
	assert.deepEqual(parseArgs(["./WORKFLOW.md"]), { help: false, workflowPath: "./WORKFLOW.md" });
});

test("CLI main returns success for help and nonzero for missing workflow startup", async () => {
	assert.equal(await main(["--help"]), 0);

	const oldCwd = process.cwd();
	const cwd = await mkdtemp(join(tmpdir(), "pi-symphony-cli-"));
	process.chdir(cwd);
	try {
		assert.equal(await main(["--once"]), 1);
	} finally {
		process.chdir(oldCwd);
	}
});
