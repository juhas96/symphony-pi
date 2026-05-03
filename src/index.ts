import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { registerSymphonyCommands } from "./commands.js";

export default function symphonyExtension(pi: ExtensionAPI): void {
	registerSymphonyCommands(pi);
}
