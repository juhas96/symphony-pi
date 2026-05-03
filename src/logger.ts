import type { Logger } from "./types.js";

function redact(value: unknown): unknown {
	if (typeof value === "string") {
		if (/sk-[A-Za-z0-9_-]{12,}/.test(value)) return "[redacted]";
		if (value.length > 8 && /(api[_-]?key|token|secret)/i.test(value)) return "[redacted]";
	}
	if (Array.isArray(value)) return value.map(redact);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value)) {
			out[key] = /(api[_-]?key|token|secret|authorization)/i.test(key) ? "[redacted]" : redact(child);
		}
		return out;
	}
	return value;
}

function formatFields(fields: Record<string, unknown> = {}): string {
	return Object.entries(redact(fields) as Record<string, unknown>)
		.map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
		.join(" ");
}

export function createConsoleLogger(prefix = "symphony"): Logger {
	const log = (level: string, message: string, fields?: Record<string, unknown>) => {
		const line = `[${prefix}] level=${level} message=${JSON.stringify(message)}${fields ? ` ${formatFields(fields)}` : ""}`;
		if (level === "error") console.error(line);
		else if (level === "warn") console.warn(line);
		else console.log(line);
	};
	return {
		info: (message, fields) => log("info", message, fields),
		warn: (message, fields) => log("warn", message, fields),
		error: (message, fields) => log("error", message, fields),
		debug: (message, fields) => {
			if (process.env.SYMPHONY_DEBUG) log("debug", message, fields);
		},
	};
}
