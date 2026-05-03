import test from "node:test";
import assert from "node:assert/strict";

import { registerSymphonyCommands } from "../src/commands.js";

test("registerSymphonyCommands registers v1 slash commands", () => {
	const commands: string[] = [];
	const pi = {
		registerCommand(name: string): void {
			commands.push(name);
		},
		on(): void {},
	};

	registerSymphonyCommands(pi as never);

	assert.deepEqual(commands, [
		"symphony:validate",
		"symphony:once",
		"symphony:daemon",
		"symphony:panel",
		"symphony:stop",
		"symphony:status",
	]);
});
