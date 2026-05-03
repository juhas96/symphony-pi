import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { loadResolvedConfig, probeConfig, validateDispatchConfig } from "./config.js";
import { createConsoleLogger } from "./logger.js";
import { SymphonyOrchestrator } from "./orchestrator.js";

let daemon: SymphonyOrchestrator | null = null;

export function registerSymphonyCommands(pi: ExtensionAPI): void {
	pi.registerCommand("symphony:validate", {
		description: "Validate WORKFLOW.md Symphony configuration",
		handler: async (args, ctx) => {
			const workflowPath = args.trim() || undefined;
			const probe = await probeConfig(ctx.cwd, workflowPath);
			if (!probe.workflowExists || !probe.valid) {
				ctx.ui.notify(`Symphony validation failed: ${probe.error?.code ?? "unknown"}: ${probe.error?.message ?? probe.workflowPath}`, "error");
				return;
			}
			const { config } = await loadResolvedConfig(ctx.cwd, workflowPath);
			try {
				validateDispatchConfig(config);
				ctx.ui.notify(`Symphony workflow valid: tracker=${config.tracker.kind} workflow=${config.workflowPath}`, "info");
			} catch (error) {
				ctx.ui.notify(`Symphony dispatch validation failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
			}
		},
	});

	pi.registerCommand("symphony:once", {
		description: "Run one eligible tracker issue through Symphony: /symphony:once [issue-id] [workflow-path]",
		handler: async (args, ctx) => {
			const [selector, workflowPath] = parseOnceArgs(args);
			const orchestrator = new SymphonyOrchestrator(ctx.cwd, workflowPath, createConsoleLogger());
			try {
				ctx.ui.notify(`Symphony once starting${selector ? ` for ${selector}` : ""}`, "info");
				await orchestrator.runOnce(selector);
				ctx.ui.notify("Symphony once completed", "info");
			} catch (error) {
				ctx.ui.notify(`Symphony once failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			} finally {
				await orchestrator.stop();
			}
		},
	});

	pi.registerCommand("symphony:daemon", {
		description: "Start the Symphony daemon scheduler. Pass optional path-to-WORKFLOW.md",
		handler: async (args, ctx) => {
			if (daemon) {
				ctx.ui.notify("Symphony daemon is already running", "warning");
				return;
			}
			const parsed = parseDaemonArgs(args);
			daemon = new SymphonyOrchestrator(ctx.cwd, parsed.workflowPath, createConsoleLogger(), { portOverride: parsed.port });
			try {
				await daemon.start();
				ctx.ui.notify("Symphony daemon started", "info");
			} catch (error) {
				daemon = null;
				ctx.ui.notify(`Symphony daemon failed to start: ${error instanceof Error ? error.message : String(error)}`, "error");
			}
		},
	});

	pi.registerCommand("symphony:stop", {
		description: "Stop the Symphony daemon scheduler",
		handler: async (_args, ctx) => {
			if (!daemon) {
				ctx.ui.notify("Symphony daemon is not running", "warning");
				return;
			}
			await daemon.stop();
			daemon = null;
			ctx.ui.notify("Symphony daemon stopped", "info");
		},
	});

	pi.registerCommand("symphony:status", {
		description: "Show Symphony daemon status",
		handler: async (_args, ctx) => {
			if (!daemon) {
				ctx.ui.notify("Symphony daemon is not running", "info");
				return;
			}
			const snapshot = daemon.snapshot();
			ctx.ui.notify(JSON.stringify(snapshot, null, 2), "info");
		},
	});

	pi.on("session_shutdown", async () => {
		if (daemon) await daemon.stop();
		daemon = null;
	});
}

function parseOnceArgs(args: string): [selector: string | undefined, workflowPath: string | undefined] {
	const parts = args.trim().split(/\s+/).filter(Boolean);
	return [parts[0], parts[1]];
}

function parseDaemonArgs(args: string): { workflowPath?: string; port?: number } {
	const parts = args.trim().split(/\s+/).filter(Boolean);
	let port: number | undefined;
	const positional: string[] = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]!;
		if (part === "--port") {
			const value = parts[++i];
			if (value !== undefined && /^\d+$/.test(value)) port = Number(value);
		} else if (part.startsWith("--port=")) {
			const value = part.slice("--port=".length);
			if (/^\d+$/.test(value)) port = Number(value);
		} else {
			positional.push(part);
		}
	}
	return { workflowPath: positional[0], port };
}
