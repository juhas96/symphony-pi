import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { loadResolvedConfig, probeConfig, resolveWorkflowPath, validateDispatchConfig } from "./config.js";
import { createFileLogger } from "./logger.js";
import { SymphonyOrchestrator } from "./orchestrator.js";

type SymphonyUiContext = {
	ui: {
		notify(message: string, type?: "info" | "warning" | "error" | "success"): void;
		setStatus(id: string, value: string | undefined): void;
		setWidget(id: string, value: string[] | undefined, options?: { placement?: "aboveEditor" | "belowEditor" }): void;
	};
};

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
			const logPath = symphonyLogPath(ctx.cwd, workflowPath);
			const orchestrator = new SymphonyOrchestrator(ctx.cwd, workflowPath, createFileLogger(logPath));
			onceRun = { selector, workflowPath, startedAt: new Date().toISOString() };
			try {
				setSymphonyStatus(ctx, `once${selector ? ` ${selector}` : ""}`);
				ctx.ui.setWidget("symphony", [`Symphony once${selector ? `: ${selector}` : ""}`, `Log: ${logPath}`, "Artifacts: .symphony/runs/", "Dashboard is not started for /once."], { placement: "belowEditor" });
				ctx.ui.notify(`Symphony once starting${selector ? ` for ${selector}` : ""}. Log: ${logPath}`, "info");
				const result = await orchestrator.runOnce(selector);
				ctx.ui.notify(formatOnceResult("completed", result.artifactPath), "info");
			} catch (error) {
				ctx.ui.notify(`Symphony once failed: ${error instanceof Error ? error.message : String(error)}`, "error");
			} finally {
				onceRun = null;
				setSymphonyStatus(ctx, undefined);
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
			const logPath = symphonyLogPath(ctx.cwd, parsed.workflowPath);
			daemon = new SymphonyOrchestrator(ctx.cwd, parsed.workflowPath, createFileLogger(logPath), { portOverride: parsed.port });
			try {
				await daemon.start();
				const { config } = await loadResolvedConfig(ctx.cwd, parsed.workflowPath);
				setSymphonyStatus(ctx, "daemon running");
				ctx.ui.setWidget("symphony", daemonWidgetLines(daemon, config.tracker.kind, config.tracker.activeStates, logPath), { placement: "belowEditor" });
				ctx.ui.notify(formatDaemonStarted(daemon, config.tracker.kind, config.tracker.activeStates, logPath), "info");
			} catch (error) {
				daemon = null;
				setSymphonyStatus(ctx, undefined);
				ctx.ui.setWidget("symphony", undefined);
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
			setSymphonyStatus(ctx, undefined);
			ctx.ui.setWidget("symphony", undefined);
			ctx.ui.notify("Symphony daemon stopped", "info");
		},
	});

	pi.registerCommand("symphony:status", {
		description: "Show Symphony daemon status and recent local runs",
		handler: async (args, ctx) => {
			const workflowPath = args.trim() || undefined;
			if (daemon) {
				const { config } = await loadResolvedConfig(ctx.cwd, workflowPath);
				const logPath = symphonyLogPath(ctx.cwd, workflowPath);
				ctx.ui.setWidget("symphony", daemonWidgetLines(daemon, config.tracker.kind, config.tracker.activeStates, logPath), { placement: "belowEditor" });
				ctx.ui.notify(`Symphony daemon is running. Dashboard/logs are in the Symphony widget. Log: ${logPath}`, "info");
				return;
			}
			ctx.ui.setWidget("symphony", await formatNoDaemonStatusLines(ctx.cwd, workflowPath), { placement: "belowEditor" });
			ctx.ui.notify("Symphony daemon is not running. See Symphony widget for recent runs and start command.", "info");
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

function symphonyLogPath(cwd: string, workflowPath?: string): string {
	return join(dirname(resolveWorkflowPath(cwd, workflowPath)), ".symphony", "logs", "symphony.log");
}

function setSymphonyStatus(ctx: SymphonyUiContext, value: string | undefined): void {
	ctx.ui.setStatus("symphony", value ? `♪ ${value}` : undefined);
}

function formatDaemonStarted(orchestrator: SymphonyOrchestrator, trackerKind: string, activeStates: string[], logPath: string): string {
	const http = orchestrator.getHttpAddress();
	const dashboard = http.enabled && http.port !== null ? ` Dashboard: http://127.0.0.1:${http.port}/` : " Dashboard disabled; pass --port 8080 or set server.port.";
	return `Symphony daemon started for tracker=${trackerKind}, active_states=[${activeStates.join(", ")}].${dashboard} Log: ${logPath}`;
}

function daemonWidgetLines(orchestrator: SymphonyOrchestrator, trackerKind: string, activeStates: string[], logPath: string): string[] {
	const snapshot = orchestrator.snapshot() as { counts?: { running?: number; retrying?: number }; http?: { enabled?: boolean; port?: number | null }; rate_limits?: unknown };
	const http = snapshot.http?.enabled && snapshot.http.port !== null && snapshot.http.port !== undefined ? `http://127.0.0.1:${snapshot.http.port}/` : "disabled";
	const running = snapshot.counts?.running ?? 0;
	const retrying = snapshot.counts?.retrying ?? 0;
	return [
		"Symphony daemon: running",
		`Dashboard: ${http}`,
		`Tracker: ${trackerKind}; active_states=[${activeStates.join(", ")}]`,
		`Runs: ${running} running, ${retrying} retrying`,
		`Log: ${logPath}`,
	];
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

async function formatNoDaemonStatusLines(cwd: string, workflowPath?: string): Promise<string[]> {
	const pieces = ["Symphony daemon: not running"];
	if (onceRun) pieces.push(`A /symphony:once command started at ${onceRun.startedAt}${onceRun.selector ? ` for ${onceRun.selector}` : ""}; /once does not start the HTTP dashboard.`);
	try {
		const { config } = await loadResolvedConfig(cwd, workflowPath);
		const port = config.server.port ?? 8080;
		pieces.push(`Start dashboard/scheduler: /symphony:daemon --port ${port}`);
		pieces.push(`Workflow: ${config.workflowPath}`);
		pieces.push(`Tracker: ${config.tracker.kind}; active_states=[${config.tracker.activeStates.join(", ")}]`);
		pieces.push(`Log: ${symphonyLogPath(cwd, workflowPath)}`);
		const recent = await recentRuns(dirname(config.workflowPath));
		if (recent.length > 0) pieces.push("Recent runs:", ...recent.map((run) => `- ${run}`));
		else pieces.push("No recent .symphony/runs artifacts found.");
	} catch (error) {
		pieces.push(`Workflow not loaded: ${error instanceof Error ? error.message : String(error)}`);
	}
	return pieces;
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
