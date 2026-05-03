import { spawn } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

import type { Logger, SymphonyConfig } from "./types.js";

export interface WorkspaceInfo {
	path: string;
	workspace_key: string;
	created_now: boolean;
}

export interface WorkspaceHookContext {
	issue_id?: string;
	issue_identifier?: string;
}

export class WorkspaceManager {
	constructor(
		private readonly getConfig: () => SymphonyConfig,
		private readonly logger: Logger,
	) {}

	sanitizeIdentifier(identifier: string): string {
		return identifier.replace(/[^A-Za-z0-9._-]/g, "_");
	}

	workspacePathForIdentifier(identifier: string): string {
		const config = this.getConfig();
		const root = resolve(config.workspace.root);
		const key = this.sanitizeIdentifier(identifier);
		const workspacePath = resolve(root, key);
		assertInsideRoot(root, workspacePath);
		return workspacePath;
	}

	async createForIssue(identifier: string, signal?: AbortSignal, context: WorkspaceHookContext = {}): Promise<WorkspaceInfo> {
		const config = this.getConfig();
		const root = resolve(config.workspace.root);
		const workspace_key = this.sanitizeIdentifier(identifier);
		const path = resolve(root, workspace_key);
		assertInsideRoot(root, path);
		await mkdir(root, { recursive: true });
		let created_now = false;
		try {
			const existing = await stat(path);
			if (!existing.isDirectory()) throw new Error(`Workspace path exists but is not a directory: ${path}`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			await mkdir(path, { recursive: true });
			created_now = true;
		}
		if (created_now && config.hooks.afterCreate) {
			await this.runHook("after_create", config.hooks.afterCreate, path, true, signal, context);
		}
		return { path, workspace_key, created_now };
	}

	async runBeforeRun(workspacePath: string, signal?: AbortSignal, context: WorkspaceHookContext = {}): Promise<void> {
		const script = this.getConfig().hooks.beforeRun;
		if (script) await this.runHook("before_run", script, workspacePath, true, signal, context);
	}

	async runAfterRun(workspacePath: string, signal?: AbortSignal, context: WorkspaceHookContext = {}): Promise<void> {
		const script = this.getConfig().hooks.afterRun;
		if (!script) return;
		try {
			await this.runHook("after_run", script, workspacePath, false, signal, context);
		} catch {
			// runHook only throws for fatal=true, keep this defensive.
		}
	}

	async removeForIssue(identifier: string, signal?: AbortSignal, context: WorkspaceHookContext = {}): Promise<void> {
		const path = this.workspacePathForIdentifier(identifier);
		const script = this.getConfig().hooks.beforeRemove;
		let exists = false;
		let isDirectory = false;
		try {
			const existing = await stat(path);
			exists = true;
			isDirectory = existing.isDirectory();
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		if (script && exists && isDirectory) await this.runHook("before_remove", script, path, false, signal, context);
		if (script && exists && !isDirectory) this.logger.warn("before_remove skipped for non-directory workspace path", { cwd: path, ...context });
		await rm(path, { recursive: true, force: true });
	}

	private async runHook(name: string, script: string, cwd: string, fatal: boolean, signal?: AbortSignal, context: WorkspaceHookContext = {}): Promise<void> {
		const timeoutMs = this.getConfig().hooks.timeoutMs;
		this.logger.info("hook started", { hook: name, cwd, ...context });
		try {
			const result = await execShell(script, cwd, timeoutMs, signal);
			if (result.code !== 0) throw new Error(`hook ${name} exited ${result.code}: ${sanitizeHookOutput(result.stderr || result.stdout)}`);
			this.logger.info("hook completed", { hook: name, cwd, ...context });
		} catch (error) {
			this.logger.warn("hook failed", { hook: name, cwd, error: errorMessage(error), ...context });
			if (fatal) throw error;
		}
	}
}

export function assertInsideRoot(rootPath: string, childPath: string): void {
	const root = resolve(rootPath);
	const child = resolve(childPath);
	const rel = relative(root, child);
	if (rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && !rel.match(/^[A-Za-z]:/))) return;
	throw new Error(`Workspace path escapes workspace root: root=${root} path=${child}`);
}

export async function execShell(command: string, cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<{ code: number | null; stdout: string; stderr: string }> {
	return new Promise((resolvePromise, reject) => {
		const child = spawn("sh", ["-lc", command], { cwd, stdio: ["ignore", "pipe", "pipe"], signal });
		let stdout = "";
		let stderr = "";
		const timeout = setTimeout(() => {
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
			reject(new Error(`hook timeout after ${timeoutMs}ms`));
		}, timeoutMs);
		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			resolvePromise({ code, stdout, stderr });
		});
	});
}

function sanitizeHookOutput(text: string, max = 2_000): string {
	const redacted = text
		.replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|API_KEY|PASSWORD)[A-Z0-9_]*)=([^\s]+)/gi, "$1=[redacted]")
		.replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted]");
	return redacted.length <= max ? redacted : `${redacted.slice(0, max)}…`;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
