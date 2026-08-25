export const CONTEXT_PRESSURE_CUSTOM_TYPE = "continuity-context-pressure";
export const CONTEXT_PRESSURE_STATUS_KEY = "context-governor";

const SOFT_HEADROOM_RATIO = 0.20;
const MIN_SOFT_HEADROOM = 32_768;
const MAX_SOFT_HEADROOM = 98_304;
const SMALL_WINDOW_HEADROOM_RATIO = 0.50;
const MAX_ADVISORY_CHARACTERS = 1_200;
const MAX_STATUS_CHARACTERS = 1_200;

export type ContextPressureLevel =
	| "unknown"
	| "normal"
	| "pressure"
	| "critical"
	| "over-limit";

export type ActiveContextPressureLevel = Exclude<ContextPressureLevel, "unknown">;

export interface ContextUsageInput {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
}

export interface ContextPressureSnapshot {
	known: boolean;
	observedLevel: ContextPressureLevel;
	activeLevel: ActiveContextPressureLevel;
	tokens: number | null;
	contextWindow: number | null;
	percent: number | null;
	remainingTokens: number | null;
	softHeadroom: number | null;
	criticalHeadroom: number | null;
	transitioned: boolean;
	epoch: number;
}

export interface ContextPressureState {
	epoch: number;
	activeLevel: ActiveContextPressureLevel;
	peakPercent: number | null;
}

export interface ContextPressureStatusInput {
	mode: "tui" | "rpc" | "json" | "print";
	sessionEnabled: boolean;
	effective: boolean;
	state: ContextPressureState;
	snapshot: ContextPressureSnapshot;
}

const severityRank: Record<ActiveContextPressureLevel, number> = {
	normal: 0,
	pressure: 1,
	critical: 2,
	"over-limit": 3,
};

function validContextWindow(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}

function thresholds(contextWindow: number): { softHeadroom: number; criticalHeadroom: number } {
	const desiredSoft = Math.max(MIN_SOFT_HEADROOM, Math.ceil(contextWindow * SOFT_HEADROOM_RATIO));
	const softHeadroom = Math.max(
		1,
		Math.min(
			desiredSoft,
			MAX_SOFT_HEADROOM,
			Math.floor(contextWindow * SMALL_WINDOW_HEADROOM_RATIO),
		),
	);
	return {
		softHeadroom,
		criticalHeadroom: Math.max(1, Math.floor(softHeadroom / 2)),
	};
}

function classify(remainingTokens: number, softHeadroom: number, criticalHeadroom: number): ActiveContextPressureLevel {
	if (remainingTokens <= 0) return "over-limit";
	if (remainingTokens <= criticalHeadroom) return "critical";
	if (remainingTokens <= softHeadroom) return "pressure";
	return "normal";
}

function unknownSnapshot(
	state: ContextPressureState,
	input?: ContextUsageInput,
): ContextPressureSnapshot {
	const contextWindow = input && validContextWindow(input.contextWindow) ? input.contextWindow : null;
	const headroom = contextWindow === null ? null : thresholds(contextWindow);
	return {
		known: false,
		observedLevel: "unknown",
		activeLevel: state.activeLevel,
		tokens: null,
		contextWindow,
		percent: null,
		remainingTokens: null,
		softHeadroom: headroom?.softHeadroom ?? null,
		criticalHeadroom: headroom?.criticalHeadroom ?? null,
		transitioned: false,
		epoch: state.epoch,
	};
}

function formatInteger(value: number): string {
	const rounded = Math.round(value);
	const sign = rounded < 0 ? "-" : "";
	const digits = String(Math.abs(rounded));
	return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function roundedHeadroom(value: number): number {
	return Math.round(value / 1_024) * 1_024;
}

function bounded(text: string, maximum: number, label: string): string {
	if (text.length > maximum) throw new Error(`${label} exceeds ${maximum} characters`);
	return text;
}

export class ContextPressureGovernor {
	private state: ContextPressureState = {
		epoch: 0,
		activeLevel: "normal",
		peakPercent: null,
	};
	private snapshot: ContextPressureSnapshot = unknownSnapshot(this.state);

	observe(input: ContextUsageInput | undefined): ContextPressureSnapshot {
		if (
			!input
			|| input.tokens === null
			|| !Number.isFinite(input.tokens)
			|| input.tokens < 0
			|| !validContextWindow(input.contextWindow)
		) {
			this.snapshot = unknownSnapshot(this.state, input);
			return { ...this.snapshot };
		}

		const { softHeadroom, criticalHeadroom } = thresholds(input.contextWindow);
		const remainingTokens = input.contextWindow - input.tokens;
		const percent = (input.tokens / input.contextWindow) * 100;
		if (!Number.isFinite(remainingTokens) || !Number.isFinite(percent)) {
			this.snapshot = unknownSnapshot(this.state, input);
			return { ...this.snapshot };
		}
		const observedLevel = classify(remainingTokens, softHeadroom, criticalHeadroom);
		const activeLevel = severityRank[observedLevel] > severityRank[this.state.activeLevel]
			? observedLevel
			: this.state.activeLevel;
		const transitioned = activeLevel !== this.state.activeLevel;
		this.state = {
			...this.state,
			activeLevel,
			peakPercent: this.state.peakPercent === null ? percent : Math.max(this.state.peakPercent, percent),
		};
		this.snapshot = {
			known: true,
			observedLevel,
			activeLevel,
			tokens: input.tokens,
			contextWindow: input.contextWindow,
			percent,
			remainingTokens,
			softHeadroom,
			criticalHeadroom,
			transitioned,
			epoch: this.state.epoch,
		};
		return { ...this.snapshot };
	}

	reset(): void {
		this.state = {
			epoch: this.state.epoch + 1,
			activeLevel: "normal",
			peakPercent: null,
		};
		this.snapshot = unknownSnapshot(this.state);
	}

	currentState(): ContextPressureState {
		return { ...this.state };
	}

	currentSnapshot(): ContextPressureSnapshot {
		return { ...this.snapshot };
	}
}

export function renderContextPressureAdvisory(snapshot: ContextPressureSnapshot): string {
	if (!snapshot.known || snapshot.percent === null || snapshot.remainingTokens === null) {
		throw new Error("Cannot render a context-pressure advisory from unknown usage");
	}
	if (snapshot.activeLevel === "normal") {
		throw new Error("Normal context usage does not require an advisory");
	}

	const percent = formatInteger(snapshot.percent);
	let text: string;
	if (snapshot.activeLevel === "pressure") {
		const remainingTokens = formatInteger(Math.max(0, roundedHeadroom(snapshot.remainingTokens)));
		text = `<context-pressure
  source="pi-continuity-work-memory"
  authority="runtime-safety-advisory"
  level="pressure">
Estimated context use is ${percent}% of Pi's configured window, with approximately
${remainingTokens} tokens of headroom. Do not begin another multi-step subtask.
Finish only the current coherent step, keep already-authorized repository and
Continuity state recoverable, then end this agent run so Pi can evaluate its
configured compaction policy at idle. Do not claim completion merely to yield.
This advisory grants no mutation, external-action, reconciliation, validation,
checkpoint, or completion authority.
</context-pressure>`;
	} else if (snapshot.activeLevel === "critical") {
		text = `<context-pressure
  source="pi-continuity-work-memory"
  authority="runtime-safety-advisory"
  level="critical">
Context pressure is critical at approximately ${percent}% of Pi's configured
window. Do not start another tool batch or subtask. Finish only an already-started
atomic step if required for a recoverable state; otherwise return a concise
progress handoff and end this agent run now. Never retry or reconcile an uncertain
operation automatically. This advisory grants no mutation, external-action,
validation, checkpoint, or completion authority.
</context-pressure>`;
	} else {
		text = `<context-pressure
  source="pi-continuity-work-memory"
  authority="runtime-safety-advisory"
  level="over-limit">
Estimated context use has exceeded Pi's configured window. Issue no new tool
calls. Return a concise recoverable status and end this agent run now. Preserve
any blocker or uncertain operation as unresolved; do not retry, reconcile, or
claim completion. This advisory grants no additional authority.
</context-pressure>`;
	}
	return bounded(text, MAX_ADVISORY_CHARACTERS, "Context-pressure advisory");
}

export function renderContextPressureStatus(input: ContextPressureStatusInput): string {
	const snapshot = input.snapshot;
	const state = input.state;
	const enabled = input.sessionEnabled ? "on" : "off";
	const effective = input.effective ? "active" : "inactive";
	const peak = state.peakPercent === null ? "unknown" : `${formatInteger(state.peakPercent)}%`;
	const usage = snapshot.known && snapshot.tokens !== null && snapshot.contextWindow !== null && snapshot.percent !== null
		? `${formatInteger(snapshot.tokens)}/${formatInteger(snapshot.contextWindow)} tokens (${formatInteger(snapshot.percent)}%)`
		: `unknown${snapshot.contextWindow === null ? "" : `/${formatInteger(snapshot.contextWindow)} tokens`}`;
	const remaining = snapshot.remainingTokens === null ? "unknown" : formatInteger(snapshot.remainingTokens);
	const soft = snapshot.softHeadroom === null ? "unknown" : formatInteger(snapshot.softHeadroom);
	const critical = snapshot.criticalHeadroom === null ? "unknown" : formatInteger(snapshot.criticalHeadroom);
	return bounded(
		`Context governor: ${enabled}; ${effective}; mode=${input.mode}\n`
		+ `Observed=${snapshot.observedLevel}; active=${state.activeLevel}; epoch=${state.epoch}; peak=${peak}\n`
		+ `Usage=${usage}; remaining=${remaining}; soft-headroom=${soft}; critical-headroom=${critical}`,
		MAX_STATUS_CHARACTERS,
		"Context-pressure status",
	);
}
