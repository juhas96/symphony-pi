import { normalizeState } from "./config.js";
import type { Issue, OrchestratorState, SymphonyConfig } from "./types.js";

export type EligibilityReasonCode =
	| "ready"
	| "missing_fields"
	| "inactive_state"
	| "terminal_state"
	| "already_running"
	| "already_claimed"
	| "completed_this_session"
	| "retry_backoff_active"
	| "blocked"
	| "no_global_slots"
	| "state_limit_reached";

export interface EligibilityReason {
	code: EligibilityReasonCode;
	message: string;
}

export interface EligibilityResult {
	eligible: boolean;
	reasons: EligibilityReason[];
}

export interface EligibilityRuntimeState {
	running: Iterable<{ issue: Issue }>;
	runningIds: ReadonlySet<string>;
	claimedIds: ReadonlySet<string>;
	completedIds: ReadonlySet<string>;
	retryingIds: ReadonlySet<string>;
}

export function sortIssuesForDispatch(issues: Issue[]): Issue[] {
	return [...issues].sort((a, b) => {
		const pa = a.priority ?? Number.POSITIVE_INFINITY;
		const pb = b.priority ?? Number.POSITIVE_INFINITY;
		if (pa !== pb) return pa - pb;
		const ca = a.created_at ? Date.parse(a.created_at) : Number.POSITIVE_INFINITY;
		const cb = b.created_at ? Date.parse(b.created_at) : Number.POSITIVE_INFINITY;
		if (ca !== cb) return ca - cb;
		return a.identifier.localeCompare(b.identifier);
	});
}

export function evaluateIssueEligibility(issue: Issue, state: EligibilityRuntimeState, config: SymphonyConfig): EligibilityResult {
	const reasons: EligibilityReason[] = [];
	const activeStates = config.tracker.activeStates.map(normalizeState);
	const terminalStates = config.tracker.terminalStates.map(normalizeState);
	const issueState = normalizeState(issue.state);

	if (!issue.id || !issue.identifier || !issue.title || !issue.state) {
		reasons.push({ code: "missing_fields", message: "Issue is missing required id, identifier, title, or state." });
	}
	if (!activeStates.includes(issueState)) {
		reasons.push({ code: "inactive_state", message: `State ${issue.state || "n/a"} is not in active_states.` });
	}
	if (terminalStates.includes(issueState)) {
		reasons.push({ code: "terminal_state", message: `State ${issue.state} is terminal.` });
	}
	if (state.runningIds.has(issue.id)) {
		reasons.push({ code: "already_running", message: "Issue already has a running worker." });
	}
	if (state.claimedIds.has(issue.id)) {
		reasons.push({ code: "already_claimed", message: "Issue is already claimed by this daemon session." });
	}
	if (state.completedIds.has(issue.id)) {
		reasons.push({ code: "completed_this_session", message: "Issue completed in this daemon session and is waiting for continuation/backoff." });
	}
	if (state.retryingIds.has(issue.id)) {
		reasons.push({ code: "retry_backoff_active", message: "Issue is currently in retry/backoff." });
	}
	if (issueState === "todo") {
		const unresolved = issue.blocked_by.filter((blocker) => !blocker.state || !terminalStates.includes(normalizeState(blocker.state)));
		if (unresolved.length > 0) {
			reasons.push({ code: "blocked", message: `Blocked by ${unresolved.map((blocker) => blocker.identifier || blocker.id || "unknown").join(", ")}.` });
		}
	}

	const running = [...state.running];
	const globalAvailable = Math.max(config.agent.maxConcurrentAgents - running.length, 0);
	if (globalAvailable <= 0) {
		reasons.push({ code: "no_global_slots", message: `No global agent slots available (${running.length}/${config.agent.maxConcurrentAgents}).` });
	}
	const perStateLimit = config.agent.maxConcurrentAgentsByState[issueState] ?? config.agent.maxConcurrentAgents;
	const runningInState = running.filter((entry) => normalizeState(entry.issue.state) === issueState).length;
	if (runningInState >= perStateLimit) {
		reasons.push({ code: "state_limit_reached", message: `State concurrency limit reached for ${issue.state} (${runningInState}/${perStateLimit}).` });
	}

	return { eligible: reasons.length === 0, reasons: reasons.length === 0 ? [{ code: "ready", message: "Ready to dispatch." }] : reasons };
}

export function runtimeStateFromOrchestratorState(state: OrchestratorState): EligibilityRuntimeState {
	return {
		running: state.running.values(),
		runningIds: new Set(state.running.keys()),
		claimedIds: state.claimed,
		completedIds: state.completed,
		retryingIds: new Set(state.retry_attempts.keys()),
	};
}
