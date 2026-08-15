import { createHash, randomUUID } from "node:crypto";

import { StringEnum } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	MessageEndEvent,
	SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { redactSecrets } from "./domain/canonical.js";
import type { ContinuityStatus, MemoryScope, SessionIdentity, WorkState } from "./domain/types.js";
import { ContinuityService, type WorkStatePatch } from "./application/continuity-service.js";
import { MemoryScheduler } from "./application/memory-scheduler.js";
import { MemoryService } from "./application/memory-service.js";
import { ContinuityStore } from "./infrastructure/continuity-store.js";
import {
	GitFingerprintService,
	repositoryIdForRoot,
	workspaceId,
	type CommandRunner,
} from "./infrastructure/git-fingerprint.js";
import { MemoryStore } from "./infrastructure/memory-store.js";
import { resolveStorePaths } from "./infrastructure/paths.js";
import { PiMemoryProvider } from "./infrastructure/pi-memory-provider.js";
import {
	CONTINUITY_ENTRY_TYPE,
	branchContext,
	memorySource,
	sessionFileKey,
	sessionKey,
} from "./interface/session-adapter.js";

const PlanStepSchema = Type.Object({
	id: Type.String({ maxLength: 200 }),
	text: Type.String({ maxLength: 4_000 }),
	status: StringEnum(["pending", "in_progress", "completed"] as const),
});

const WorkPatchSchema = Type.Object({
	goal: Type.Optional(Type.String({ maxLength: 16_000 })),
	workItemId: Type.Optional(Type.String({ maxLength: 500 })),
	plan: Type.Optional(Type.Array(PlanStepSchema, { maxItems: 200 })),
	currentStepId: Type.Optional(Type.Union([Type.String({ maxLength: 200 }), Type.Null()])),
	nextActions: Type.Optional(Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 200 })),
	completedWork: Type.Optional(Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 200 })),
	decisions: Type.Optional(Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 200 })),
	blockers: Type.Optional(Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 200 })),
	constraints: Type.Optional(Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 200 })),
});

function textResult(text: string, details?: unknown) {
	return { content: [{ type: "text" as const, text }], details };
}

function messageText(event: MessageEndEvent): string {
	const message = event.message as unknown as { role?: string; content?: unknown };
	if (message.role !== "assistant" || !Array.isArray(message.content)) return "";
	return message.content
		.filter((item): item is { type: string; text: string } => Boolean(item && typeof item === "object" && (item as { type?: unknown }).type === "text" && typeof (item as { text?: unknown }).text === "string"))
		.map((item) => item.text)
		.join("\n");
}

function stateSummary(state: WorkState): string {
	return JSON.stringify({
		goal: state.goal,
		workItemId: state.workItemId,
		plan: state.plan,
		currentStepId: state.currentStepId,
		nextActions: state.nextActions,
		completedWork: state.completedWork,
		decisions: state.decisions,
		blockers: state.blockers,
		constraints: state.constraints,
		validationEvidence: state.validationEvidence,
		checkpointId: state.checkpointId,
		checkpointAncestry: state.checkpointAncestry,
		mutationUncertain: state.mutationUncertain,
	}, null, 2);
}

function safeNotify(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error" = "info"): void {
	if (ctx.mode === "tui" && ctx.hasUI) ctx.ui.notify(message, level);
}

function statusLabel(status: ContinuityStatus): string {
	const id = (status.health === "safe" || status.health === "drifted") && status.checkpointId
		? ` ${status.checkpointId.slice(0, 8)}`
		: "";
	return `continuity: ${status.health}${id}`;
}

function setTuiStatus(ctx: ExtensionContext, status: ContinuityStatus | "unavailable"): void {
	if (ctx.mode !== "tui" || !ctx.hasUI) return;
	ctx.ui.setStatus("continuity", status === "unavailable" ? "continuity: unavailable" : statusLabel(status));
}

function scopeFrom(value: string): MemoryScope {
	if (["global-user", "repository", "work-item", "session"].includes(value)) return value as MemoryScope;
	throw new Error(`Unknown memory scope: ${value}`);
}

export default function extension(pi: ExtensionAPI): void {
	let context: ExtensionContext | undefined;
	let continuityStore: ContinuityStore | undefined;
	let memoryStore: MemoryStore | undefined;
	let continuity: ContinuityService | undefined;
	let memory: MemoryService | undefined;
	let scheduler = new MemoryScheduler();
	let provider = new PiMemoryProvider(() => context);
	let unavailableReason: string | undefined;
	let authorityCompromisedReason: string | undefined;
	let generationToken = "0";
	const manualPipelineControllers = new Set<AbortController>();

	const commandRunner: CommandRunner = {
		async run(command, args, options) {
			return pi.exec(command, args, {
				cwd: options.cwd,
				...(options.signal ? { signal: options.signal } : {}),
				...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
			});
		},
	};
	const fingerprints = new GitFingerprintService(commandRunner);

	const appendState = (checkpoint?: Parameters<ContinuityService["embeddedState"]>[0]) => {
		if (!continuity) return;
		pi.appendEntry(CONTINUITY_ENTRY_TYPE, continuity.embeddedState(checkpoint));
	};

	const requireServices = (): { continuity: ContinuityService; memory: MemoryService; ctx: ExtensionContext } => {
		if (!continuity || !memory || !context) throw new Error(unavailableReason || "Continuity is unavailable");
		return { continuity, memory, ctx: context };
	};

	const cancelManualPipelines = (reason: string): void => {
		for (const controller of manualPipelineControllers) controller.abort(new Error(reason));
		manualPipelineControllers.clear();
	};

	const compromiseAuthority = (ctx: ExtensionContext, error: unknown): void => {
		authorityCompromisedReason = redactSecrets(error instanceof Error ? error.message : String(error));
		setTuiStatus(ctx, "unavailable");
	};

	const authoritativeStatus = async (ctx: ExtensionContext, signal?: AbortSignal): Promise<ContinuityStatus> => {
		if (!continuity) throw new Error(unavailableReason || "Continuity is unavailable");
		if (authorityCompromisedReason) {
			return {
				health: "unavailable",
				checkpointId: continuity.currentState().checkpointId,
				authority: "none",
				reason: `mutation tracking failed closed: ${authorityCompromisedReason}`,
				lineage: continuity.lineage(),
				state: continuity.currentState(),
				unresolvedOperations: [],
			};
		}
		return continuity.status(branchContext(ctx), signal);
	};

	const requireSafeAuthority = (): void => {
		if (authorityCompromisedReason) throw new Error(`Safe authority is unavailable: ${authorityCompromisedReason}`);
	};

	const refreshTuiStatus = async (ctx: ExtensionContext): Promise<void> => {
		if (!continuity) {
			setTuiStatus(ctx, "unavailable");
			return;
		}
		try {
			setTuiStatus(ctx, await authoritativeStatus(ctx, ctx.signal));
		} catch (error) {
			unavailableReason = error instanceof Error ? error.message : String(error);
			setTuiStatus(ctx, "unavailable");
		}
	};

	const runMemoryPipeline = async (ctx: ExtensionContext, signal: AbortSignal, schedulerGeneration: number) => {
		if (!memory) return;
		const source = memorySource(ctx);
		const expectedGeneration = generationToken;
		const result = await memory.runPipeline(source, expectedGeneration, provider, {
			isCurrentGeneration: () => scheduler.currentGeneration() === schedulerGeneration && generationToken === expectedGeneration,
			currentSourceHash: () => context ? memorySource(context).hash : "replaced",
		}, signal);
		if (result.status === "failed") safeNotify(ctx, `Memory pipeline failed: ${result.reason}`, "warning");
	};

	async function startSession(event: SessionStartEvent, ctx: ExtensionContext): Promise<void> {
		context = ctx;
		unavailableReason = undefined;
		authorityCompromisedReason = undefined;
		scheduler.shutdown();
		cancelManualPipelines("session replaced");
		scheduler = new MemoryScheduler();
		provider = new PiMemoryProvider(() => context);
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}`;
		try {
			const paths = resolveStorePaths();
			continuityStore = new ContinuityStore(paths.continuityDatabase);
			memoryStore = new MemoryStore(paths.memoryDatabase);
			const childSessionKey = sessionKey(ctx);
			let parentSessionKey: string | null = null;
			if (event.reason === "fork" && event.previousSessionFile) {
				parentSessionKey = continuityStore.consumeForkIntent(event.previousSessionFile, childSessionKey)?.sourceSessionKey ?? null;
			}
			const trusted = ctx.isProjectTrusted();
			let repositoryId = workspaceId(ctx.cwd);
			if (trusted) {
				try {
					repositoryId = repositoryIdForRoot(await fingerprints.repositoryRoot(ctx.cwd, true, ctx.signal));
				} catch {
					// Non-Git trusted workspaces retain isolated continuity but cannot be safe.
				}
			}
			const identity: SessionIdentity = {
				sessionId: ctx.sessionManager.getSessionId(),
				sessionFileKey: sessionFileKey(ctx),
				sessionKey: childSessionKey,
				parentSessionKey,
				repositoryId,
				trusted,
			};
			continuity = new ContinuityService(identity, ctx.cwd, continuityStore, fingerprints, commandRunner);
			continuity.initialize(branchContext(ctx));
			memory = new MemoryService(identity, () => continuity!.currentState(), memoryStore);
			appendState();
			await refreshTuiStatus(ctx);
		} catch (error) {
			unavailableReason = redactSecrets(error instanceof Error ? error.message : String(error));
			continuity = undefined;
			memory = undefined;
			setTuiStatus(ctx, "unavailable");
			safeNotify(ctx, `Continuity unavailable: ${unavailableReason}`, "warning");
		}
	}

	pi.on("session_start", startSession);

	pi.on("session_before_fork", async (event, ctx) => {
		if (!continuityStore || !continuity) return;
		const file = ctx.sessionManager.getSessionFile();
		if (!file) return;
		continuityStore.recordForkIntent(continuity.identity.sessionKey, file, event.entryId, event.position);
	});

	pi.on("session_before_compact", async (_event, ctx) => {
		context = ctx;
		appendState();
	});

	pi.on("session_compact", async (_event, ctx) => {
		context = ctx;
		if (continuity) continuity.reconstructBranch(branchContext(ctx));
		appendState();
	});

	pi.on("session_tree", async (_event, ctx) => {
		context = ctx;
		scheduler.invalidate();
		cancelManualPipelines("session tree replaced");
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}:${ctx.sessionManager.getLeafId() || "root"}`;
		if (continuity) continuity.reconstructBranch(branchContext(ctx));
		await refreshTuiStatus(ctx);
	});

	pi.on("input", async (_event, ctx) => {
		context = ctx;
		scheduler.invalidate();
		cancelManualPipelines("new input invalidated memory generation");
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}:input`;
	});

	pi.on("agent_start", async (_event, ctx) => {
		context = ctx;
		scheduler.invalidate();
		cancelManualPipelines("agent restart invalidated memory generation");
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}:agent`;
	});

	pi.on("agent_end", async () => scheduler.onAgentEnd());

	pi.on("agent_settled", async (_event, ctx) => {
		context = ctx;
		scheduler.onAgentSettled((signal, currentGeneration) => runMemoryPipeline(ctx, signal, currentGeneration));
	});

	pi.on("tool_call", async (event, ctx) => {
		context = ctx;
		if (!continuity) return;
		try {
			return await continuity.observeToolCall({
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				input: event.input,
				branch: branchContext(ctx),
				actor: "agent-tool",
				signal: ctx.signal,
			});
		} catch (error) {
			// Tracking must fail closed without crashing or blocking the user's tool.
			compromiseAuthority(ctx, error);
		}
	});

	pi.on("tool_result", async (event, ctx) => {
		context = ctx;
		if (!continuity) return;
		try {
			await continuity.observeToolResult({
				toolCallId: event.toolCallId,
				isError: event.isError,
				contentText: event.content.map((item) => item.type === "text" ? item.text : "[image]").join("\n"),
				branch: branchContext(ctx),
				signal: ctx.signal,
			});
		} catch (error) {
			compromiseAuthority(ctx, error);
		}
	});

	pi.on("user_bash", async (event, ctx) => {
		context = ctx;
		if (!continuity) return;
		const toolCallId = `user-bash:${randomUUID()}`;
		const activeBranch = branchContext(ctx);
		try {
			await continuity.observeToolCall({
				toolCallId,
				toolName: "bash",
				input: { command: event.command },
				branch: activeBranch,
				actor: "user-bash",
				signal: ctx.signal,
			});
		} catch (error) {
			compromiseAuthority(ctx, error);
			return;
		}
		if (!continuityStore?.getTrackedCall(toolCallId, continuity.identity.sessionKey, activeBranch.nodeIds)) return;
		const local = createLocalBashOperations();
		return {
			operations: {
				async exec(command, cwd, options) {
					const digest = createHash("sha256");
					const onData = (data: Buffer) => {
						digest.update(data);
						options.onData(data);
					};
					let result;
					try {
						result = await local.exec(command, cwd, {
							onData,
							...(options.signal ? { signal: options.signal } : {}),
							...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
							...(options.env ? { env: options.env } : {}),
						});
					} catch (error) {
						try {
							await continuity?.observeToolResult({
								toolCallId,
								isError: true,
								contentText: redactSecrets(error instanceof Error ? error.message : String(error)),
								branch: branchContext(ctx),
								signal: options.signal,
							});
							appendState();
							await refreshTuiStatus(ctx);
						} catch (trackingError) {
							compromiseAuthority(ctx, trackingError);
						}
						throw error;
					}
					try {
						await continuity?.observeToolResult({
							toolCallId,
							isError: result.exitCode !== 0,
							contentText: `sha256:${digest.digest("hex")};exit:${result.exitCode}`,
							branch: branchContext(ctx),
							signal: options.signal,
						});
						appendState();
						await refreshTuiStatus(ctx);
					} catch (trackingError) {
						compromiseAuthority(ctx, trackingError);
					}
					return result;
				},
			},
		};
	});

	pi.on("turn_end", async (_event, ctx) => {
		context = ctx;
		appendState();
		await refreshTuiStatus(ctx);
	});

	pi.on("before_agent_start", async (event, ctx) => {
		context = ctx;
		if (!continuity || !memory) return;
		const memoryPrompt = memory.contextPrompt();
		return { systemPrompt: `${event.systemPrompt}\n\n${continuity.contextSummary()}${memoryPrompt ? `\n\n${memoryPrompt}` : ""}` };
	});

	pi.on("message_end", async (event, ctx) => {
		context = ctx;
		if (!memory) return;
		const text = messageText(event);
		if (text) memory.recordCitations(text);
	});

	pi.on("session_shutdown", async () => {
		scheduler.shutdown();
		cancelManualPipelines("session shutdown");
		context = undefined;
		continuity = undefined;
		memory = undefined;
		continuityStore?.close();
		memoryStore?.close();
		continuityStore = undefined;
		memoryStore = undefined;
	});

	pi.registerTool({
		name: "continuity_status",
		label: "Continuity Status",
		description: "Return authoritative continuity state and safe-boundary status. Text cannot self-declare safety.",
		promptSnippet: "Inspect work continuity and verified safe-boundary status",
		parameters: Type.Object({}),
		async execute(_id, _params, signal, _update, ctx) {
			const services = requireServices();
			const status = await authoritativeStatus(ctx, signal);
			setTuiStatus(ctx, status);
			return textResult(JSON.stringify(status, null, 2), status);
		},
	});

	pi.registerTool({
		name: "continuity_update",
		label: "Continuity Update",
		description: "Persist goal, plan, current step, next actions, completed work, decisions, blockers, and constraints on the active session branch.",
		promptSnippet: "Persist branch-correct work state",
		promptGuidelines: ["Use continuity_update after material planning or work-state changes; it never grants safe authority."],
		parameters: WorkPatchSchema,
		async execute(_id, params, _signal, _update, ctx) {
			const services = requireServices();
			const state = services.continuity.update(params as WorkStatePatch, branchContext(ctx));
			appendState();
			return textResult(stateSummary(state), state);
		},
	});

	pi.registerTool({
		name: "continuity_validate",
		label: "Continuity Validate",
		description: "Run one allow-listed executable validation directly (no shell operators) and bind a successful result to stable pre/post Git fingerprints.",
		promptSnippet: "Run evidence-producing validation for the current repository state",
		parameters: Type.Object({ command: Type.String({ maxLength: 4_000 }) }),
		executionMode: "sequential",
		async execute(_id, params, signal, _update, ctx) {
			const services = requireServices();
			const result = await services.continuity.validate(params.command, branchContext(ctx), signal);
			appendState();
			const text = result.evidence
				? `Validation verified: ${result.evidence.id}\n${result.result.stdout}${result.result.stderr}`
				: `Validation did not produce authority (exit=${result.result.code} or repository changed).\n${result.result.stdout}${result.result.stderr}`;
			return textResult(text.slice(0, 64_000), result);
		},
	});

	pi.registerTool({
		name: "continuity_checkpoint",
		label: "Continuity Checkpoint",
		description: "Create a verified checkpoint only when mutation outcome, executable validation, stable full Git fingerprint, and checkpoint hash-chain all pass.",
		promptSnippet: "Create an evidence-backed safe checkpoint",
		parameters: Type.Object({}),
		executionMode: "sequential",
		async execute(_id, _params, signal, _update, ctx) {
			const services = requireServices();
			requireSafeAuthority();
			const checkpoint = await services.continuity.createCheckpoint(branchContext(ctx), signal);
			appendState(checkpoint);
			return textResult(`Verified checkpoint ${checkpoint.id}`, checkpoint);
		},
	});

	pi.registerTool({
		name: "continuity_recover",
		label: "Continuity Recover",
		description: "Recover only work state from external or embedded continuity. Never changes repository files or Git and never replays side effects.",
		promptSnippet: "Recover work context without touching the repository",
		parameters: Type.Object({ checkpointId: Type.Optional(Type.String({ maxLength: 100 })) }),
		executionMode: "sequential",
		async execute(_id, params, _signal, _update, ctx) {
			const services = requireServices();
			const state = services.continuity.recover(branchContext(ctx), params.checkpointId);
			appendState();
			return textResult(`Recovered work state only.\n${stateSummary(state)}`, state);
		},
	});

	pi.registerTool({
		name: "memory_list",
		label: "Memory List",
		description: "List published memory visible in the current global/repository/work-item/session scopes.",
		parameters: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })) }),
		async execute(_id, params) {
			const records = requireServices().memory.list(params.limit ?? 100);
			return textResult(JSON.stringify(records, null, 2), records);
		},
	});

	pi.registerTool({
		name: "memory_read",
		label: "Memory Read",
		description: "Read one published memory only if its scope is visible in the current session.",
		parameters: Type.Object({ id: Type.String({ maxLength: 100 }) }),
		async execute(_id, params) {
			const record = requireServices().memory.read(params.id);
			if (!record) throw new Error("Memory not found or not visible in this scope");
			requireServices().memory.recordCitations(`[memory:${record.id}]`);
			return textResult(`[memory:${record.id}] ${record.content}\nSource: ${record.citation}`, record);
		},
	});

	pi.registerTool({
		name: "memory_search",
		label: "Memory Search",
		description: "Search published memory within the current isolated scopes.",
		parameters: Type.Object({ query: Type.String({ maxLength: 500 }), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }),
		async execute(_id, params) {
			const records = requireServices().memory.search(params.query, params.limit ?? 50);
			return textResult(JSON.stringify(records, null, 2), records);
		},
	});

	pi.registerTool({
		name: "memory_add",
		label: "Memory Add",
		description: "Add learning memory. Agent calls cannot create global-user memory; untrusted projects may write only session memory.",
		parameters: Type.Object({
			scope: StringEnum(["repository", "work-item", "session"] as const),
			content: Type.String({ maxLength: 16_000 }),
			citation: Type.Optional(Type.String({ maxLength: 4_000 })),
		}),
		async execute(_id, params) {
			const record = requireServices().memory.add(params.content, params.scope, "agent-tool", params.citation);
			return textResult(`Stored [memory:${record.id}] in ${record.scope}`, record);
		},
	});

	pi.registerCommand("continuity", {
		description: "Continuity status, checkpoint, operations, reconciliation, or state-only recovery",
		async handler(args, ctx) {
			context = ctx;
			try {
				const services = requireServices();
				const [subcommand = "status", value] = args.trim().split(/\s+/, 2);
				if (subcommand === "status") {
					const status = await authoritativeStatus(ctx, ctx.signal);
					setTuiStatus(ctx, status);
					safeNotify(ctx, `${statusLabel(status)} — ${status.reason}`);
					return;
				}
				if (subcommand === "show") {
					safeNotify(ctx, stateSummary(services.continuity.currentState()));
					return;
				}
				if (subcommand === "checkpoint") {
					requireSafeAuthority();
					const checkpoint = await services.continuity.createCheckpoint(branchContext(ctx), ctx.signal);
					appendState(checkpoint);
					safeNotify(ctx, `continuity: safe ${checkpoint.id.slice(0, 8)}`);
					return;
				}
				if (subcommand === "recover") {
					services.continuity.recover(branchContext(ctx), value);
					appendState();
					safeNotify(ctx, "Continuity work state recovered; repository untouched.");
					return;
				}
				if (subcommand === "operations") {
					safeNotify(ctx, JSON.stringify(services.continuity.listOperations(branchContext(ctx)), null, 2));
					return;
				}
				if (subcommand === "reconcile") {
					const match = args.trim().match(/^reconcile\s+(\S+)\s+(applied|not_applied|partially_applied)\s+(.+)$/s);
					if (!match) {
						safeNotify(ctx, "Usage: /continuity reconcile <operation-id> <applied|not_applied|partially_applied> <evidence-note>", "warning");
						return;
					}
					services.continuity.reconcileOperation(branchContext(ctx), match[1]!, match[2]! as "applied" | "not_applied" | "partially_applied", match[3]!);
					appendState();
					await refreshTuiStatus(ctx);
					safeNotify(ctx, `Reconciled operation ${match[1]}; fresh validation is required.`);
					return;
				}
				safeNotify(ctx, "Usage: /continuity status|show|checkpoint|recover [checkpoint-id]|operations|reconcile ...", "warning");
			} catch (error) {
				safeNotify(ctx, redactSecrets(error instanceof Error ? error.message : String(error)), "error");
			}
		},
	});

	pi.registerCommand("memory", {
		description: "Memory status, run, reset, or explicit remember",
		async handler(args, ctx) {
			context = ctx;
			try {
				const services = requireServices();
				const trimmed = args.trim();
				const [subcommand = "status", ...rest] = trimmed.split(/\s+/);
				if (subcommand === "status") {
					safeNotify(ctx, JSON.stringify({ latestRun: services.memory.latestRun(), visibleRecords: services.memory.list(500).length }, null, 2));
					return;
				}
				if (subcommand === "run") {
					const controller = new AbortController();
					manualPipelineControllers.add(controller);
					const source = memorySource(ctx);
					const token = generationToken;
					try {
						const result = await services.memory.runPipeline(source, token, provider, {
							isCurrentGeneration: () => generationToken === token,
							currentSourceHash: () => context ? memorySource(context).hash : "replaced",
						}, controller.signal);
						safeNotify(ctx, `Memory pipeline: ${result.status} — ${result.reason}`, result.status === "failed" ? "error" : "info");
					} finally {
						manualPipelineControllers.delete(controller);
					}
					return;
				}
				if (subcommand === "reset") {
					services.memory.reset();
					safeNotify(ctx, "Memory store reset. Continuity state was not changed.");
					return;
				}
				if (subcommand === "remember") {
					const scope = scopeFrom(rest.shift() || "session");
					const content = rest.join(" ");
					const record = services.memory.add(content, scope, "user-command", "explicit /memory remember");
					safeNotify(ctx, `Stored [memory:${record.id}] in ${record.scope}.`);
					return;
				}
				safeNotify(ctx, "Usage: /memory status|run|reset|remember <scope> <text>", "warning");
			} catch (error) {
				safeNotify(ctx, redactSecrets(error instanceof Error ? error.message : String(error)), "error");
			}
		},
	});
}
