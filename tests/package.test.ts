import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import symphonyExtension from "../src/index.js";
import packageJson from "../package.json" with { type: "json" };
import { main } from "../src/cli.js";

test("package metadata exposes pi extension, files, bin, and runtime dependencies", () => {
	assert.deepEqual(packageJson.pi.extensions, ["./src/index.ts"]);
	assert.equal(packageJson.bin["pi-symphony"], "./bin/pi-symphony.mjs");
	assert.equal(packageJson.dependencies.liquidjs.startsWith("^"), true);
	assert.equal(packageJson.dependencies.yaml.startsWith("^"), true);
	assert.equal(packageJson.dependencies.tsx.startsWith("^"), true);
	assert.equal("tsx" in packageJson.devDependencies, false);
	assert.equal(packageJson.files.includes("src/"), true);
	assert.equal(packageJson.files.includes("docs/"), true);
	assert.equal(packageJson.files.includes("examples/"), true);
	assert.equal(packageJson.files.includes("scripts/"), true);
	assert.equal(packageJson.scripts["smoke:pi-extension"], "node scripts/smoke-pi-extension.mjs");
	assert.equal(packageJson.scripts["smoke:codex-schema"], "node scripts/check-codex-schema.mjs");
	assert.equal(packageJson.scripts["smoke:codex-app-server"], "node --import tsx scripts/smoke-codex-app-server.ts");
	assert.equal(packageJson.scripts["smoke:beads-e2e"], "node --import tsx scripts/smoke-beads-e2e.ts");
	assert.equal(packageJson.scripts["smoke:linear-live"], "node --import tsx scripts/smoke-linear-live.ts");
	assert.equal(packageJson.scripts["smoke:jira-live"], "node --import tsx scripts/smoke-jira-live.ts");
});

test("local pi package consumption smoke registers extension commands", () => {
	const commands: string[] = [];
	symphonyExtension({ registerCommand: (name: string) => commands.push(name), on: () => {} } as never);

	assert.deepEqual(commands, ["symphony:validate", "symphony:once", "symphony:daemon", "symphony:panel", "symphony:stop", "symphony:status"]);
});

test("CLI --help works through exported main and temporary workflow smoke reaches validation", async () => {
	assert.equal(await main(["--help"]), 0);
	const cwd = await mkdtemp(join(tmpdir(), "pi-symphony-package-"));
	await writeFile(join(cwd, "WORKFLOW.md"), "---\ntracker:\n  kind: beads\ncodex:\n  command: codex app-server\n---\nTask");
	const oldCwd = process.cwd();
	process.chdir(cwd);
	try {
		// Missing real beads database is an expected startup failure after package/CLI load succeeds.
		assert.equal(await main(["--once"]), 1);
	} finally {
		process.chdir(oldCwd);
	}
});
