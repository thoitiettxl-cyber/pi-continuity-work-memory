import { redactSecrets } from "../domain/canonical.js";

export interface NoulJudgment {
	result: boolean;
	confidence: number;
	rawProbability: number;
	fallbackUsed: boolean;
}

export interface ChoiceJudgment<T extends string> {
	selected: T;
	confidence: number;
	fallbackUsed: boolean;
}

export interface ScoreJudgment {
	score: number;
	confidence: number;
	level: string;
	fallbackUsed: boolean;
}

export interface TypeSafeConfig {
	apiKey?: string;
	baseUrl?: string;
	enabled?: boolean;
	timeoutMs?: number;
	fetchFn?: typeof fetch;
}

export class TypeSafeService {
	private readonly apiKey: string | undefined;
	private readonly baseUrl: string;
	private readonly enabled: boolean;
	private readonly timeoutMs: number;
	private readonly fetchFn: typeof fetch;

	constructor(config: TypeSafeConfig = {}) {
		this.apiKey = config.apiKey ?? process.env.TYPESAFE_API_KEY ?? process.env.JEV_API_KEY;
		this.baseUrl = config.baseUrl ?? process.env.TYPESAFE_BASE_URL ?? "https://api.typesafe.ai/v1";
		this.enabled = config.enabled ?? (process.env.TYPESAFE_ENABLED !== "false" && process.env.JEV_OPTIMIZATION_ENABLED !== "false");
		this.timeoutMs = config.timeoutMs ?? 2_500;
		this.fetchFn = config.fetchFn ?? globalThis.fetch;
	}

	isEnabled(): boolean {
		return Boolean(this.enabled && this.apiKey);
	}

	async evaluateNoul(
		prompt: string,
		context: Record<string, unknown> = {},
		fallback = false,
		timeoutMs?: number,
	): Promise<NoulJudgment> {
		if (!this.isEnabled()) {
			return { result: fallback, confidence: 1.0, rawProbability: fallback ? 1.0 : 0.0, fallbackUsed: true };
		}

		try {
			const sanitizedPrompt = redactSecrets(prompt);
			const sanitizedContext = JSON.parse(redactSecrets(JSON.stringify(context)));
			const payload = {
				model: "jev-latest",
				state: Object.keys(sanitizedContext).length > 0 ? sanitizedContext : sanitizedPrompt,
				questions: {
					noul_eval: {
						type: "noul",
						instructions: sanitizedPrompt,
					},
				},
			};

			const response = await this.postRequest("/systemone", payload, timeoutMs);
			const answer = (response?.answers as Record<string, any>)?.noul_eval;
			const noulVal = typeof answer?.noul === "number" ? answer.noul : (response?.probability as number);

			if (typeof noulVal === "number") {
				const prob = Math.min(1.0, Math.max(0.0, noulVal));
				return {
					result: prob >= 0.5,
					confidence: Math.abs(prob - 0.5) * 2,
					rawProbability: prob,
					fallbackUsed: false,
				};
			}
		} catch {
			// Fallback smoothly to deterministic default
		}

		return { result: fallback, confidence: 1.0, rawProbability: fallback ? 1.0 : 0.0, fallbackUsed: true };
	}

	async evaluateChoice<T extends string>(
		prompt: string,
		choices: readonly T[],
		context: Record<string, unknown> = {},
		fallback: T,
		timeoutMs?: number,
	): Promise<ChoiceJudgment<T>> {
		if (!choices.includes(fallback)) {
			throw new Error(`Fallback choice "${fallback}" must be present in choices array`);
		}

		if (!this.isEnabled() || choices.length === 0) {
			return { selected: fallback, confidence: 1.0, fallbackUsed: true };
		}

		try {
			const sanitizedPrompt = redactSecrets(prompt);
			const sanitizedContext = JSON.parse(redactSecrets(JSON.stringify(context)));
			const criteriaMap: Record<string, string> = {};
			for (const choice of choices) {
				criteriaMap[choice] = choice;
			}

			const payload = {
				model: "jev-latest",
				state: Object.keys(sanitizedContext).length > 0 ? sanitizedContext : sanitizedPrompt,
				questions: {
					choice_eval: {
						type: "choice",
						instructions: sanitizedPrompt,
						criteria: criteriaMap,
					},
				},
			};

			const response = await this.postRequest("/systemone", payload, timeoutMs);
			const answer = (response?.answers as Record<string, any>)?.choice_eval;
			const selectedOption = answer?.choice ?? response?.selected;
			const confidence = typeof answer?.confidence === "number" ? answer.confidence : (typeof response?.confidence === "number" ? response.confidence : 0.9);

			if (typeof selectedOption === "string" && choices.includes(selectedOption as T)) {
				return {
					selected: selectedOption as T,
					confidence,
					fallbackUsed: false,
				};
			}
		} catch {
			// Fallback
		}

		return { selected: fallback, confidence: 1.0, fallbackUsed: true };
	}

	async evaluateScore(
		prompt: string,
		context: Record<string, unknown> = {},
		fallback = 2.0,
		timeoutMs?: number,
	): Promise<ScoreJudgment> {
		if (!this.isEnabled()) {
			return { score: fallback, confidence: 1.0, level: this.scoreToLevel(fallback), fallbackUsed: true };
		}

		try {
			const sanitizedPrompt = redactSecrets(prompt);
			const sanitizedContext = JSON.parse(redactSecrets(JSON.stringify(context)));
			const payload = {
				model: "jev-latest",
				state: Object.keys(sanitizedContext).length > 0 ? sanitizedContext : sanitizedPrompt,
				questions: {
					score_eval: {
						type: "score",
						instructions: sanitizedPrompt,
						criteria: ["unacceptable", "marginal-needs-review", "acceptable-solid", "high-quality"],
					},
				},
			};

			const response = await this.postRequest("/systemone", payload, timeoutMs);
			const answer = (response?.answers as Record<string, any>)?.score_eval;
			const scoreVal = typeof answer?.score === "number" ? answer.score : (response?.score as number);
			const confidence = typeof answer?.confidence === "number" ? answer.confidence : (typeof response?.confidence === "number" ? response.confidence : 0.85);

			if (typeof scoreVal === "number") {
				const score = Math.max(0, Math.min(3.0, scoreVal));
				return {
					score,
					confidence,
					level: this.scoreToLevel(score),
					fallbackUsed: false,
				};
			}
		} catch {
			// Fallback
		}

		return { score: fallback, confidence: 1.0, level: this.scoreToLevel(fallback), fallbackUsed: true };
	}

	async isAmbiguousToolCall(
		toolName: string,
		args: Record<string, unknown>,
	): Promise<{ ambiguous: boolean; reason: string }> {
		// Deterministic checks first
		if (!toolName) return { ambiguous: true, reason: "Missing tool name" };
		if (!args || typeof args !== "object") return { ambiguous: true, reason: "Invalid argument shape" };

		// If Jev is enabled, check bounded ambiguity
		if (this.isEnabled()) {
			const judgment = await this.evaluateNoul(
				`Is this tool call ambiguous or missing essential arguments? Tool: ${toolName}`,
				{ toolName, args },
				false,
			);
			if (!judgment.fallbackUsed && judgment.result) {
				return { ambiguous: true, reason: `Jev flagged call as ambiguous (confidence ${judgment.confidence.toFixed(2)})` };
			}
		}

		return { ambiguous: false, reason: "Deterministic check passed" };
	}

	async selectRecoveryAction(
		failureReason: string,
		availableActions: readonly string[],
	): Promise<string> {
		if (availableActions.length === 0) return "escalate-to-user";
		const fallback = availableActions[0] ?? "retry";

		// Deterministic rule shortcuts for known errors
		if (failureReason.includes("EADDRINUSE")) return availableActions.includes("kill-existing-process") ? "kill-existing-process" : fallback;
		if (failureReason.includes("ENOENT")) return availableActions.includes("create-missing-file") ? "create-missing-file" : fallback;
		if (failureReason.includes("lock")) return availableActions.includes("wait-and-retry") ? "wait-and-retry" : fallback;

		if (this.isEnabled()) {
			const choice = await this.evaluateChoice(
				`Select best recovery action for failure: ${failureReason}`,
				availableActions,
				{ failureReason },
				fallback,
			);
			return choice.selected;
		}

		return fallback;
	}

	private scoreToLevel(score: number): string {
		if (score >= 2.5) return "high-quality";
		if (score >= 1.8) return "acceptable-solid";
		if (score >= 1.0) return "marginal-needs-review";
		return "unacceptable";
	}

	private async postRequest(endpoint: string, body: unknown, timeoutMs?: number): Promise<Record<string, unknown>> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs ?? this.timeoutMs);

		try {
			const response = await this.fetchFn(`${this.baseUrl}${endpoint}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`TypeSafe API responded with status ${response.status}`);
			}

			return (await response.json()) as Record<string, unknown>;
		} finally {
			clearTimeout(timeout);
		}
	}
}
