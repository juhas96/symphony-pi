import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";

export interface SymphonyHttpServerOptions {
	port: number;
	host?: string;
	snapshot(): unknown;
	issueSnapshot(identifier: string): unknown | null;
	refresh(): Promise<void>;
}

export class SymphonyHttpServer {
	private server: Server | null = null;
	private boundPort: number | null = null;

	constructor(private readonly options: SymphonyHttpServerOptions) {}

	async start(): Promise<{ host: string; port: number }> {
		if (this.server) return { host: this.options.host ?? "127.0.0.1", port: this.boundPort ?? this.options.port };
		const host = this.options.host ?? "127.0.0.1";
		this.server = createServer((request, response) => void this.handle(request, response));
		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error) => {
				this.server?.off("listening", onListening);
				reject(error);
			};
			const onListening = () => {
				this.server?.off("error", onError);
				const address = this.server?.address();
				this.boundPort = typeof address === "object" && address ? address.port : this.options.port;
				resolve();
			};
			this.server!.once("error", onError);
			this.server!.once("listening", onListening);
			this.server!.listen(this.options.port, host);
		});
		return { host, port: this.boundPort ?? this.options.port };
	}

	async stop(): Promise<void> {
		const server = this.server;
		this.server = null;
		this.boundPort = null;
		if (!server) return;
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}

	private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
		try {
			const method = request.method ?? "GET";
			const url = new URL(request.url ?? "/", "http://127.0.0.1");
			if (url.pathname === "/") {
				if (method !== "GET") return methodNotAllowed(response, ["GET"]);
				return html(response, renderDashboard(this.options.snapshot()));
			}
			if (url.pathname === "/api/v1/state") {
				if (method !== "GET") return methodNotAllowed(response, ["GET"]);
				return json(response, 200, this.options.snapshot());
			}
			if (url.pathname === "/api/v1/refresh") {
				if (method !== "POST") return methodNotAllowed(response, ["POST"]);
				await drainRequest(request);
				void this.options.refresh();
				return json(response, 202, {
					queued: true,
					coalesced: false,
					requested_at: new Date().toISOString(),
					operations: ["poll", "reconcile"],
				});
			}
			const issueMatch = url.pathname.match(/^\/api\/v1\/([^/]+)$/);
			if (issueMatch) {
				if (method !== "GET") return methodNotAllowed(response, ["GET"]);
				const issue = this.options.issueSnapshot(decodeURIComponent(issueMatch[1]!));
				if (!issue) return jsonError(response, 404, "issue_not_found", `Issue not found in current runtime state: ${issueMatch[1]}`);
				return json(response, 200, issue);
			}
			return jsonError(response, 404, "not_found", `Route not found: ${url.pathname}`);
		} catch (error) {
			return jsonError(response, 500, "internal_error", error instanceof Error ? error.message : String(error));
		}
	}
}

function json(response: ServerResponse, status: number, body: unknown): void {
	const payload = JSON.stringify(body, null, 2);
	response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
	response.end(payload);
}

function html(response: ServerResponse, body: string): void {
	response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
	response.end(body);
}

function jsonError(response: ServerResponse, status: number, code: string, message: string): void {
	json(response, status, { error: { code, message } });
}

function methodNotAllowed(response: ServerResponse, allow: string[]): void {
	response.writeHead(405, { allow: allow.join(", "), "content-type": "application/json; charset=utf-8" });
	response.end(JSON.stringify({ error: { code: "method_not_allowed", message: `Method not allowed. Use ${allow.join(" or ")}.` } }));
}

async function drainRequest(request: IncomingMessage): Promise<void> {
	for await (const _chunk of request) {
		// Drain request body so clients can reuse connections.
	}
}

function renderDashboard(snapshot: unknown): string {
	const safe = escapeHtml(JSON.stringify(snapshot, null, 2));
	const observability = renderObservability(snapshot);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>pi-symphony</title>
<style>
:root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { margin: 0; background: #0b1020; color: #e5e7eb; }
main { max-width: 1100px; margin: 0 auto; padding: 32px; }
h1 { margin: 0 0 8px; font-size: 28px; }
p { color: #9ca3af; }
pre { overflow: auto; background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 20px; line-height: 1.45; }
a { color: #93c5fd; }
</style>
</head>
<body>
<main>
<h1>pi-symphony</h1>
<p>Runtime snapshot. JSON API: <a href="/api/v1/state">/api/v1/state</a></p>
${observability}
<pre>${safe}</pre>
</main>
</body>
</html>`;
}

function renderObservability(snapshot: unknown): string {
	if (!snapshot || typeof snapshot !== "object") return "";
	const running = Array.isArray((snapshot as any).running) ? (snapshot as any).running : [];
	const retrying = Array.isArray((snapshot as any).retrying) ? (snapshot as any).retrying : [];
	const rows = [...running, ...retrying]
		.map((row) => {
			const identifier = escapeHtml(String(row.issue_identifier ?? row.issue_id ?? "unknown"));
			const event = escapeHtml(String(row.last_event ?? row.error ?? "—"));
			const artifact = escapeHtml(String(row.artifact_path ?? row.artifacts?.dir ?? "—"));
			return `<li><strong>${identifier}</strong> last=${event}<br><small>artifact: ${artifact}</small></li>`;
		})
		.join("\n");
	if (!rows) return "";
	return `<section aria-label="Recent run observability"><h2>Recent events and artifacts</h2><ul>${rows}</ul></section>`;
}

function escapeHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
