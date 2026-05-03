import { Liquid } from "liquidjs";

import { DEFAULT_PROMPT } from "./config.js";
import { SymphonyTemplateError, type Issue } from "./types.js";

const engine = new Liquid({
	strictVariables: true,
	strictFilters: true,
	greedy: false,
});

export async function renderPromptTemplate(template: string, issue: Issue, attempt: number | null): Promise<string> {
	const source = template.trim() || DEFAULT_PROMPT;
	try {
		const parsed = engine.parse(source);
		try {
			return await engine.render(parsed, { issue, attempt });
		} catch (error) {
			throw new SymphonyTemplateError("template_render_error", errorMessage(error));
		}
	} catch (error) {
		if (error instanceof SymphonyTemplateError) throw error;
		throw new SymphonyTemplateError("template_parse_error", errorMessage(error));
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
