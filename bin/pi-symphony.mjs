#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "..", "src", "cli.ts");
const result = spawnSync(process.execPath, ["--import", "tsx", cli, ...process.argv.slice(2)], {
	stdio: "inherit",
});

if (result.error) {
	console.error(result.error.message);
	process.exitCode = 1;
} else {
	process.exitCode = result.status ?? 0;
}
