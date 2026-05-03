import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { createConsoleLogger } from "../src/logger.js";
import { SymphonyOrchestrator } from "../src/orchestrator.js";

test("orchestrator can be constructed before workflow is loaded", async () => {
	const cwd = await mkdtemp(join(tmpdir(), "pi-symphony-"));
	await writeFile(join(cwd, "WORKFLOW.md"), "---\ntracker:\n  kind: beads\n---\nTask");
	const orchestrator = new SymphonyOrchestrator(cwd, undefined, createConsoleLogger("test"));

	assert.equal(typeof orchestrator.snapshot(), "object");
	await orchestrator.stop();
});
