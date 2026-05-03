import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

export type Style = ReturnType<typeof createConsoleStyle>;

export function createConsoleStyle(theme: Theme) {
	return {
		border: (s: string) => theme.fg("border", s),
		title: (s: string) => theme.fg("accent", theme.bold(s)),
		accent: (s: string) => theme.fg("accent", s),
		selected: (s: string) => theme.bg("selectedBg", theme.fg("accent", s)),
		muted: (s: string) => theme.fg("muted", s),
		dim: (s: string) => theme.fg("dim", s),
		success: (s: string) => theme.fg("success", s),
		warning: (s: string) => theme.fg("warning", s),
		error: (s: string) => theme.fg("error", s),
		bold: (s: string) => theme.bold(s),
	};
}

export function fit(value: string, width: number): string {
	return truncateToWidth(value, Math.max(0, width), "…", true);
}

export function padRight(value: string, width: number): string {
	const clipped = fit(value, width);
	return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

export function wrap(value: string, width: number): string[] {
	return wrapTextWithAnsi(value, Math.max(10, width));
}

export function formatInt(value: unknown): string {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString("en-US") : "0";
}

export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(Math.floor(totalSeconds), 0);
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

export function formatAge(isoOrMs: string | number | undefined): string {
	if (isoOrMs === undefined || isoOrMs === "") return "-";
	const timestamp = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
	const ms = Date.now() - timestamp;
	return Number.isFinite(ms) ? formatDuration(ms / 1000) : "-";
}

export function stringValue(value: unknown): string {
	return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function objectValue(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function lineBox(lines: string[], width: number, style: Style, title: string): string[] {
	const inner = Math.max(width - 2, 10);
	const titleText = ` ${title} `;
	const remain = Math.max(0, inner - visibleWidth(titleText));
	const left = Math.floor(remain / 2);
	const right = remain - left;
	const out = [style.border(`╭${"─".repeat(left)}`) + style.title(titleText) + style.border(`${"─".repeat(right)}╮`)];
	for (const line of lines) out.push(style.border("│") + fit(line, inner).padEnd(Math.max(0, inner - Math.max(0, visibleWidth(fit(line, inner))) + fit(line, inner).length)) + style.border("│"));
	out.push(style.border(`╰${"─".repeat(inner)}╯`));
	return out.map((line) => fit(line, width));
}
