import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { loadResolvedConfig, probeConfig, validateDispatchConfig } from "./config.js";
import { createConsoleLogger } from "./logger.js";
import { SymphonyOrchestrator } from "./orchestrator.js";

let daemon: SymphonyOrchestrator | null = null;
let onceRun: { selector?: string; workflowPath?: string; startedAt: string } | null = null;

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
				const dashboard = config.server.port !== undefined ? ` Dashboard starts with /symphony:daemon and will be http://127.0.0.1:${config.server.port}/.` : " No dashboard port configured; use /symphony:daemon --port 8080 to enable one.";
				ctx.ui.notify(
					`Symphony workflow valid: tracker=${config.tracker.kind} workflow=${config.workflowPath}. Secrets resolved from process env or workflow .env.${dashboard}`,
					"info",
				);
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
			onceRun = { selector, workflowPath, startedAt: new Date().toISOString() };
			try {
				ctx.ui.notify(`Symphony once starting${selector ? ` for ${selector}` : ""}. Dashboard is not started for /once; run artifacts are written under .symphony/runs/.`, "info");
				const result = await orchestrator.runOnce(selector);
				ctx.ui.notify(formatOnceResult("completed", result.artifactPath), "info");
			} catch (error) {
				ctx.ui.notify(`Symphony once failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			} finally {
				onceRun = null;
				await orchestrator.stop();
			}
		},
	});

	pi.registerCommand("symphony:daemon", {
		description: "Start the Symphony daemon scheduler. Pass optional path-to-WORKFLOW.md",
		handler: async (args, ctx) => {
			if (daemon) {
				ctx.ui.notify(formatDaemonAlreadyRunning(daemon), "warning");
				return;
			}
			const parsed = parseDaemonArgs(args);
			daemon = new SymphonyOrchestrator(ctx.cwd, parsed.workflowPath, createConsoleLogger(), { portOverride: parsed.port });
			try {
				await daemon.start();
				const { config } = await loadResolvedConfig(ctx.cwd, parsed.workflowPath);
				ctx.ui.notify(formatDaemonStarted(daemon, config.tracker.kind, config.tracker.activeStates), "info");
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
				ctx.ui.notify("Symphony daemon is not running. If /symphony:once is active, wait for it to finish or stop the pi session.", "warning");
				return;
			}
			await daemon.stop();
			daemon = null;
			ctx.ui.notify("Symphony daemon stopped", "info");
		},
	});

	pi.registerCommand("symphony:status", {
		description: "Show Symphony daemon status and recent local runs",
		handler: async (args, ctx) => {
			const workflowPath = args.trim() || undefined;
			if (daemon) {
				ctx.ui.notify(JSON.stringify(daemon.snapshot(), null, 2), "info");
				return;
			}
			ctx.ui.notify(await formatNoDaemonStatus(ctx.cwd, workflowPath), "info");
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

function formatDaemonStarted(orchestrator: SymphonyOrchestrator, trackerKind: string, activeStates: string[]): string {
	const http = orchestrator.getHttpAddress();
	const dashboard = http.enabled && http.port !== null ? ` Dashboard: http://127.0.0.1:${http.port}/` : " Dashboard disabled; pass --port 8080 or set server.port.";
	return `Symphony daemon started for tracker=${trackerKind}, active_states=[${activeStates.join(", ")}].${dashboard} Use /symphony:status for live state and /symphony:stop to stop.`;
}

function formatDaemonAlreadyRunning(orchestrator: SymphonyOrchestrator): string {
	const http = orchestrator.getHttpAddress();
	const dashboard = http.enabled && http.port !== null ? ` Dashboard: http://127.0.0.1:${http.port}/` : "";
	return `Symphony daemon is already running.${dashboard}`;
}

function formatOnceResult(status: string, artifactPath: string | null): string {
	if (!artifactPath) return `Symphony once ${status}. No artifact path was reported.`;
	return `Symphony once ${status}. Artifacts: ${artifactPath}. Result: ${join(artifactPath, "result.json")}`;
}

async function formatNoDaemonStatus(cwd: string, workflowPath?: string): Promise<string> {
	const pieces = ["Symphony daemon is not running."];
	if (onceRun) pieces.push(`A /symphony:once command started at ${onceRun.startedAt}${onceRun.selector ? ` for ${onceRun.selector}` : ""}; /once does not start the HTTP dashboard.`);
	try {
		const { config } = await loadResolvedConfig(cwd, workflowPath);
		const port = config.server.port ?? 8080;
		pieces.push(`Start dashboard/scheduler with: /symphony:daemon --port ${port}`);
		pieces.push(`Workflow: ${config.workflowPath}`);
		pieces.push(`Tracker: ${config.tracker.kind}; active_states=[${config.tracker.activeStates.join(", ")}]`);
		const recent = await recentRuns(dirname(config.workflowPath));
		if (recent.length > 0) pieces.push(`Recent runs:\n${recent.map((run) => `- ${run}`).join("\n")}`);
		else pieces.push("No recent .symphony/runs artifacts found.");
	} catch (error) {
		pieces.push(`Workflow not loaded: ${error instanceof Error ? error.message : String(error)}`);
	}
	return pieces.join("\n");
}

async function recentRuns(workflowDir: string): Promise<string[]> {
	const runsDir = join(workflowDir, ".symphony", "runs");
	try {
		const entries = await readdir(runsDir);
		const dirs = await Promise.all(
			entries.map(async (entry) => {
				const full = join(runsDir, entry);
				try {
					const stats = await stat(full);
					if (!stats.isDirectory()) return null;
					return { entry, full, mtimeMs: stats.mtimeMs };
				} catch {
					return null;
				}
			}),
		);
		return Promise.all(
			dirs
				.filter((dir): dir is { entry: string; full: string; mtimeMs: number } => Boolean(dir))
				.sort((a, b) => b.mtimeMs - a.mtimeMs)
				.slice(0, 5)
				.map(async ({ full }) => `${full}${(await hasResult(full)) ? " (finished)" : " (in progress/no result.json)"}`),
		);
	} catch {
		return [];
	}
}

async function hasResult(runDir: string): Promise<boolean> {
	try {
		await readFile(join(runDir, "result.json"), "utf8");
		return true;
	} catch {
		return false;
	}
}
