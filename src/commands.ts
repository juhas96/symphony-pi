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

type WidgetConfig = {
	trackerKind: string;
	projectSlug: string;
	activeStates: string[];
	maxAgents: number;
	logPath: string;
};

type SymphonySnapshot = {
	generated_at?: string;
	counts?: { running?: number; retrying?: number };
	running?: Array<Record<string, unknown>>;
	retrying?: Array<Record<string, unknown>>;
	codex_totals?: { input_tokens?: number; output_tokens?: number; total_tokens?: number; seconds_running?: number };
	rate_limits?: unknown;
	http?: { enabled?: boolean; port?: number | null };
};

let daemon: SymphonyOrchestrator | null = null;
let daemonStartedAt: number | null = null;
let daemonWidgetTimer: NodeJS.Timeout | null = null;
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
				ctx.ui.setWidget("symphony", onceWidgetLines(selector, logPath), { placement: "belowEditor" });
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
				daemonStartedAt = Date.now();
				const widgetConfig = { trackerKind: config.tracker.kind, projectSlug: config.tracker.projectSlug || config.tracker.jiraProjectKey, activeStates: config.tracker.activeStates, maxAgents: config.agent.maxConcurrentAgents, logPath };
				setSymphonyStatus(ctx, "daemon running");
				startDaemonWidget(ctx, widgetConfig);
				ctx.ui.notify(formatDaemonStarted(daemon, widgetConfig), "info");
			} catch (error) {
				daemon = null;
				daemonStartedAt = null;
				stopDaemonWidget(ctx);
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
			daemonStartedAt = null;
			stopDaemonWidget(ctx);
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
				const widgetConfig = { trackerKind: config.tracker.kind, projectSlug: config.tracker.projectSlug || config.tracker.jiraProjectKey, activeStates: config.tracker.activeStates, maxAgents: config.agent.maxConcurrentAgents, logPath };
				ctx.ui.setWidget("symphony", daemonWidgetLines(daemon, widgetConfig), { placement: "belowEditor" });
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
		daemonStartedAt = null;
		if (daemonWidgetTimer) clearInterval(daemonWidgetTimer);
		daemonWidgetTimer = null;
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

function startDaemonWidget(ctx: SymphonyUiContext, config: WidgetConfig): void {
	if (daemonWidgetTimer) clearInterval(daemonWidgetTimer);
	ctx.ui.setWidget("symphony", daemon ? daemonWidgetLines(daemon, config) : undefined, { placement: "belowEditor" });
	daemonWidgetTimer = setInterval(() => {
		if (!daemon) return;
		ctx.ui.setWidget("symphony", daemonWidgetLines(daemon, config), { placement: "belowEditor" });
	}, 1_000);
}

function stopDaemonWidget(ctx: SymphonyUiContext): void {
	if (daemonWidgetTimer) clearInterval(daemonWidgetTimer);
	daemonWidgetTimer = null;
	setSymphonyStatus(ctx, undefined);
	ctx.ui.setWidget("symphony", undefined);
}

function formatDaemonStarted(orchestrator: SymphonyOrchestrator, config: WidgetConfig): string {
	const http = orchestrator.getHttpAddress();
	const dashboard = http.enabled && http.port !== null ? ` Dashboard: http://127.0.0.1:${http.port}/` : " Dashboard disabled; pass --port 8080 or set server.port.";
	return `Symphony daemon started.${dashboard} Widget refreshes every second. Log: ${config.logPath}`;
}

function onceWidgetLines(selector: string | undefined, logPath: string): string[] {
	return [
		"╭─ SYMPHONY ONCE",
		`│ Issue: ${selector ?? "first eligible"}`,
		"│ Dashboard: not started for /once",
		`│ Log: ${logPath}`,
		"│ Artifacts: .symphony/runs/",
		"╰─ Running single issue",
	];
}

function daemonWidgetLines(orchestrator: SymphonyOrchestrator, config: WidgetConfig): string[] {
	const snapshot = orchestrator.snapshot() as SymphonySnapshot;
	const running = snapshot.counts?.running ?? snapshot.running?.length ?? 0;
	const retrying = snapshot.counts?.retrying ?? snapshot.retrying?.length ?? 0;
	const http = snapshot.http?.enabled && snapshot.http.port !== null && snapshot.http.port !== undefined ? `http://127.0.0.1:${snapshot.http.port}/` : "disabled";
	const runtimeSeconds = daemonStartedAt ? Math.floor((Date.now() - daemonStartedAt) / 1000) : Math.floor(snapshot.codex_totals?.seconds_running ?? 0);
	const totals = snapshot.codex_totals ?? {};
	const lines = [
		"╭─ SYMPHONY STATUS",
		`│ Agents: ${running}/${config.maxAgents} running | ${retrying} backoff`,
		`│ Runtime: ${formatDuration(runtimeSeconds)}`,
		`│ Tokens: in ${formatInt(totals.input_tokens)} | out ${formatInt(totals.output_tokens)} | total ${formatInt(totals.total_tokens)}`,
		`│ Rate limits: ${formatRateLimits(snapshot.rate_limits)}`,
		`│ Project: ${config.projectSlug || "n/a"}`,
		`│ Dashboard: ${http}`,
		`│ Log: ${config.logPath}`,
		"├─ Running",
		"│ ID        STAGE        PID       AGE / TURN   TOKENS       SESSION       EVENT",
		"│ ─────────────────────────────────────────────────────────────────────────────",
	];

	const runningRows = (snapshot.running ?? []).slice(0, 12);
	if (runningRows.length === 0) lines.push("│ No running agents");
	for (const row of runningRows) lines.push(formatRunningRow(row));
	if ((snapshot.running?.length ?? 0) > runningRows.length) lines.push(`│ … ${(snapshot.running?.length ?? 0) - runningRows.length} more running agent(s)`);

	lines.push("├─ Backoff queue");
	const retryRows = (snapshot.retrying ?? []).slice(0, 8);
	if (retryRows.length === 0) lines.push("│ No queued retries");
	for (const retry of retryRows) lines.push(formatRetryRow(retry));
	if ((snapshot.retrying?.length ?? 0) > retryRows.length) lines.push(`│ … ${(snapshot.retrying?.length ?? 0) - retryRows.length} more retry item(s)`);
	lines.push("╰─ Refreshes every 1s");
	return lines;
}

function formatRunningRow(row: Record<string, unknown>): string {
	const tokens = objectValue(row.tokens);
	const age = formatAge(stringValue(row.started_at));
	const session = shorten(stringValue(row.session_id), 12);
	const event = compactEvent(stringValue(row.last_event), stringValue(row.last_message));
	return truncateLine(
		`│ • ${pad(stringValue(row.issue_identifier), 8)} ${pad(stringValue(row.state), 12)} ${pad(stringValue(row.pid) || "-", 9)} ${pad(`${age} / ${numberValue(row.turn_count) ?? 0}`, 12)} ${pad(formatInt(numberValue(tokens?.total_tokens)), 12)} ${pad(session || "-", 13)} ${event}`,
		160,
	);
}

function formatRetryRow(row: Record<string, unknown>): string {
	const dueIn = formatDueIn(stringValue(row.due_at));
	const error = stringValue(row.error) || stringValue(row.terminal_reason) || "retry";
	return truncateLine(`│ • ${pad(stringValue(row.issue_identifier), 8)} attempt ${pad(String(numberValue(row.attempt) ?? "?"), 3)} due ${pad(dueIn, 8)} ${error}`, 160);
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
	const pieces = ["╭─ SYMPHONY STATUS", "│ Daemon: not running"];
	if (onceRun) pieces.push(`│ /once started: ${onceRun.startedAt}${onceRun.selector ? ` for ${onceRun.selector}` : ""}`);
	try {
		const { config } = await loadResolvedConfig(cwd, workflowPath);
		const port = config.server.port ?? 8080;
		pieces.push(`│ Start: /symphony:daemon --port ${port}`);
		pieces.push(`│ Workflow: ${config.workflowPath}`);
		pieces.push(`│ Tracker: ${config.tracker.kind}; active_states=[${config.tracker.activeStates.join(", ")}]`);
		pieces.push(`│ Log: ${symphonyLogPath(cwd, workflowPath)}`);
		const recent = await recentRuns(dirname(config.workflowPath));
		pieces.push("├─ Recent runs");
		if (recent.length > 0) pieces.push(...recent.map((run) => `│ • ${run}`));
		else pieces.push("│ No recent .symphony/runs artifacts found.");
	} catch (error) {
		pieces.push(`│ Workflow not loaded: ${error instanceof Error ? error.message : String(error)}`);
	}
	pieces.push("╰─");
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

function formatRateLimits(value: unknown): string {
	const root = objectValue(value);
	if (!root) return "n/a";
	const id = stringValue(root.limitId) || "codex";
	const primary = objectValue(root.primary);
	const secondary = objectValue(root.secondary);
	const credits = objectValue(root.credits);
	const primaryText = primary ? percentText(numberValue(primary.usedPercent), numberValue(primary.resetsAt)) : "primary n/a";
	const secondaryText = secondary ? percentText(numberValue(secondary.usedPercent), numberValue(secondary.resetsAt)) : "secondary n/a";
	const creditsText = credits ? `credits ${credits.hasCredits === false ? "none" : "ok"}` : "credits n/a";
	return `${id} | ${primaryText} | ${secondaryText} | ${creditsText}`;
}

function percentText(usedPercent: number | null, resetsAt: number | null): string {
	const pct = usedPercent === null ? "n/a" : `${usedPercent}%`;
	const reset = resetsAt ? ` reset ${formatDueIn(new Date(resetsAt * 1000).toISOString())}` : "";
	return `${pct}${reset}`;
}

function compactEvent(event: string, message: string): string {
	const base = event || "-";
	if (!message || message === base) return base;
	return `${base}: ${message}`;
}

function formatAge(iso: string): string {
	if (!iso) return "-";
	const ms = Date.now() - Date.parse(iso);
	return Number.isFinite(ms) ? formatDuration(Math.max(Math.floor(ms / 1000), 0)) : "-";
}

function formatDueIn(iso: string): string {
	if (!iso) return "?";
	const ms = Date.parse(iso) - Date.now();
	return Number.isFinite(ms) ? formatDuration(Math.max(Math.ceil(ms / 1000), 0)) : "?";
}

function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(Math.floor(totalSeconds), 0);
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

function formatInt(value: number | null | undefined): string {
	return Number.isFinite(value) ? Math.round(value as number).toLocaleString("en-US") : "0";
}

function objectValue(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function numberValue(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shorten(value: string, max: number): string {
	if (value.length <= max) return value;
	if (max <= 3) return value.slice(0, max);
	const keep = Math.max(max - 3, 1);
	return `${value.slice(0, Math.ceil(keep / 2))}…${value.slice(-Math.floor(keep / 2))}`;
}

function pad(value: string, width: number): string {
	return value.length >= width ? value.slice(0, width) : value.padEnd(width, " ");
}

function truncateLine(value: string, width: number): string {
	return value.length <= width ? value : `${value.slice(0, Math.max(width - 1, 0))}…`;
}
