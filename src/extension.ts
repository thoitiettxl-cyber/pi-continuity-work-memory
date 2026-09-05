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
import type { WorkflowMode } from "./domain/managed-workflow.js";
import type { ContinuityStatus, MemoryScope, SessionIdentity, WorkState } from "./domain/types.js";
import { ContinuityService, type WorkStatePatch } from "./application/continuity-service.js";
import {
	ContextPressureGovernor,
	CONTEXT_PRESSURE_CUSTOM_TYPE,
	CONTEXT_PRESSURE_STATUS_KEY,
	renderContextPressureAdvisory,
	renderContextPressureStatus,
	type ActiveContextPressureLevel,
} from "./application/context-pressure-governor.js";
import {
	ManagedWorkflowService,
	type PrepareManagedWorkInput,
	type WorkflowAssetName,
} from "./application/managed-workflow-service.js";
import { MemoryScheduler } from "./application/memory-scheduler.js";
import { MemoryService } from "./application/memory-service.js";
import { classifyTool, isManagedWorkflowMutationTool } from "./application/tool-classifier.js";
import {
	assessWorkflowEligibility,
	managedWorkflowPrompt,
	type WorkflowEligibility,
} from "./application/workflow-context.js";
import { ContinuityStore } from "./infrastructure/continuity-store.js";
import {
	ExecutionPlanConflictError,
	ExecutionPlanDigestMismatchError,
	ExecutionPlanFileService,
	ExecutionPlanNotReadyError,
	ExecutionPlanPathError,
} from "./infrastructure/execution-plan-files.js";
import {
	GitFingerprintService,
	repositoryIdForRoot,
	workspaceId,
	type CommandRunner,
} from "./infrastructure/git-fingerprint.js";
import { MemoryStore } from "./infrastructure/memory-store.js";
import { resolveStorePaths } from "./infrastructure/paths.js";
import { PiMemoryProvider } from "./infrastructure/pi-memory-provider.js";
import { loadWorkflowAssets } from "./infrastructure/workflow-assets.js";
import {
	CONTINUITY_ENTRY_TYPE,
	branchContext,
	memorySource,
	sessionFileKey,
	sessionKey,
} from "./interface/session-adapter.js";
import { showPlanBrowser } from "./interface/plan-browser.js";

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

const WorkflowDocumentSchema = Type.Object({
	title: Type.String({ maxLength: 500 }),
	slug: Type.String({ maxLength: 80 }),
	outcome: Type.String({ maxLength: 16_000 }),
	authorityAndContext: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 100 }),
	inScope: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 100 }),
	outOfScope: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 100 }),
	constraints: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 100 }),
	steps: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 200 }),
	risksAndRecovery: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 100 }),
	validation: Type.Array(Type.String({ maxLength: 4_000 }), { maxItems: 100 }),
});

const PrepareWorkSchema = Type.Object({
	requestedMutation: Type.Boolean(),
	authority: StringEnum(["resolved", "ambiguous", "missing"] as const),
	spansSessions: Type.Boolean(),
	coordinatesContributors: Type.Boolean(),
	hasMeaningfulDependencies: Type.Boolean(),
	recoverySensitive: Type.Boolean(),
	externalSideEffects: Type.Boolean(),
	cannotResumeSafelyFromDiff: Type.Boolean(),
	resumeHint: Type.Optional(Type.String({ maxLength: 4_000 })),
	document: Type.Optional(WorkflowDocumentSchema),
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
		workflow: state.workflow,
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
	let managedWorkflow: ManagedWorkflowService | undefined;
	let repositoryRoot: string | undefined;
	let workflowUnavailableReason: string | undefined;
	let workflowEligibility: WorkflowEligibility = { eligible: false, repositoryAgentsPaths: [], reason: "Workflow context has not been assessed." };
	let workflowEligibilityAssessedForRun = false;
	let scheduler = new MemoryScheduler();
	let provider = new PiMemoryProvider(() => context);
	let unavailableReason: string | undefined;
	let authorityCompromisedReason: string | undefined;
	let generationToken = "0";
	let planBrowserRequest = 0;
	const manualPipelineControllers = new Set<AbortController>();
	const manualPipelineRuns = new Set<Promise<void>>();
	let contextPressureGovernor = new ContextPressureGovernor();
	let sessionGovernorEnabled = false;
	let contextGovernorStatusValue: string | undefined;

	const isContextGovernorEnabled = (ctx: ExtensionContext): boolean => (
		ctx.mode === "tui" && ctx.hasUI && sessionGovernorEnabled
	);

	const setContextGovernorStatus = (ctx: ExtensionContext, value: string | undefined): void => {
		if (ctx.mode !== "tui" || !ctx.hasUI || contextGovernorStatusValue === value) return;
		try {
			ctx.ui.setStatus(CONTEXT_PRESSURE_STATUS_KEY, value);
			contextGovernorStatusValue = value;
		} catch {
			contextGovernorStatusValue = undefined;
		}
	};

	const clearContextGovernorStatus = (ctx: ExtensionContext): void => {
		setContextGovernorStatus(ctx, undefined);
	};

	const contextGovernorStatusLabel = (level: ActiveContextPressureLevel): string | undefined => {
		if (level === "normal") return undefined;
		if (level === "over-limit") return "context: over configured window";
		return `context: ${level}`;
	};

	const showContextGovernorLevel = (ctx: ExtensionContext, level: ActiveContextPressureLevel): void => {
		if (!isContextGovernorEnabled(ctx)) return;
		setContextGovernorStatus(ctx, contextGovernorStatusLabel(level));
	};

	const resetContextGovernor = (ctx: ExtensionContext): void => {
		contextPressureGovernor.reset();
		clearContextGovernorStatus(ctx);
	};

	const contextGovernorStatus = (ctx: ExtensionContext): string => renderContextPressureStatus({
		mode: ctx.mode,
		sessionEnabled: sessionGovernorEnabled,
		effective: isContextGovernorEnabled(ctx),
		state: contextPressureGovernor.currentState(),
		snapshot: contextPressureGovernor.currentSnapshot(),
	});

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

	const requireManagedWorkflow = (): ManagedWorkflowService => {
		if (!managedWorkflow) throw new Error(workflowUnavailableReason || "Managed workflow is unavailable");
		return managedWorkflow;
	};

	const refreshWorkflowEligibility = (ctx: ExtensionContext, contextFiles: readonly { path: string }[] | undefined): WorkflowEligibility => {
		workflowEligibility = managedWorkflow
			? assessWorkflowEligibility(repositoryRoot, ctx.isProjectTrusted(), contextFiles)
			: { eligible: false, repositoryAgentsPaths: [], reason: workflowUnavailableReason || "Managed workflow is unavailable." };
		return workflowEligibility;
	};

	const workflowStatus = async () => {
		if (!continuity) throw new Error(unavailableReason || "Continuity is unavailable");
		const state = continuity.currentState();
		let alignment;
		try {
			alignment = managedWorkflow
				? await managedWorkflow.alignment(state.workflow.binding)
				: { state: "invalid" as const, binding: null, reason: workflowUnavailableReason || "Managed workflow is unavailable." };
		} catch (error) {
			alignment = { state: "invalid" as const, binding: null, reason: redactSecrets(error instanceof Error ? error.message : String(error)) };
		}
		return {
			mode: state.workflow.mode,
			shape: state.workflow.shape,
			phase: state.workflow.phase,
			intent: state.workflow.intent,
			eligibility: workflowEligibility,
			binding: state.workflow.binding,
			alignment,
			completionAuthority: "repository-only" as const,
			safeCheckpointMeaning: "repository-and-operation-safety-only" as const,
		};
	};

	const cancelManualPipelines = (reason: string): void => {
		for (const controller of manualPipelineControllers) controller.abort(new Error(reason));
		manualPipelineControllers.clear();
	};

	const waitForManualPipelines = async (): Promise<void> => {
		await Promise.allSettled([...manualPipelineRuns]);
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
		const activeMemory = memory;
		const afterEntryId = activeMemory.cursor()?.lastEntryId;
		const source = memorySource(ctx, afterEntryId);
		const expectedGeneration = generationToken;
		const result = await activeMemory.runPipeline(source, expectedGeneration, provider, {
			isCurrentGeneration: () => scheduler.currentGeneration() === schedulerGeneration && generationToken === expectedGeneration,
			currentSourceHash: () => context ? memorySource(context, afterEntryId).hash : "replaced",
		}, signal);
		if (result.status === "failed") safeNotify(ctx, `Memory pipeline failed: ${result.reason}`, "warning");
	};

	async function startSession(event: SessionStartEvent, ctx: ExtensionContext): Promise<void> {
		planBrowserRequest++;
		context = ctx;
		resetContextGovernor(ctx);
		sessionGovernorEnabled = ctx.mode === "tui" && ctx.hasUI;
		unavailableReason = undefined;
		authorityCompromisedReason = undefined;
		repositoryRoot = undefined;
		managedWorkflow = undefined;
		workflowUnavailableReason = undefined;
		workflowEligibility = { eligible: false, repositoryAgentsPaths: [], reason: "Workflow context has not been assessed." };
		workflowEligibilityAssessedForRun = false;
		cancelManualPipelines("session replaced");
		await scheduler.shutdown();
		await waitForManualPipelines();
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
					repositoryRoot = await fingerprints.repositoryRoot(ctx.cwd, true, ctx.signal);
					repositoryId = repositoryIdForRoot(repositoryRoot);
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
			try {
				const assets = await loadWorkflowAssets();
				const files = repositoryRoot ? await ExecutionPlanFileService.open(repositoryRoot) : undefined;
				managedWorkflow = new ManagedWorkflowService(assets, files);
				if (!repositoryRoot) workflowUnavailableReason = "Managed repository writes require a trusted canonical Git repository root.";
			} catch (error) {
				workflowUnavailableReason = redactSecrets(error instanceof Error ? error.message : String(error));
				managedWorkflow = undefined;
			}
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
		resetContextGovernor(ctx);
		if (continuity) continuity.reconstructBranch(branchContext(ctx));
		appendState();
	});

	pi.on("session_tree", async (_event, ctx) => {
		planBrowserRequest++;
		context = ctx;
		resetContextGovernor(ctx);
		scheduler.invalidate();
		cancelManualPipelines("session tree replaced");
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}:${ctx.sessionManager.getLeafId() || "root"}`;
		workflowEligibilityAssessedForRun = false;
		if (continuity) continuity.reconstructBranch(branchContext(ctx));
		await refreshTuiStatus(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		context = ctx;
		resetContextGovernor(ctx);
	});

	pi.on("input", async (event, ctx) => {
		context = ctx;
		scheduler.invalidate();
		cancelManualPipelines("new input invalidated memory generation");
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}:input`;
		if (event.streamingBehavior !== "steer" && event.streamingBehavior !== "followUp") workflowEligibilityAssessedForRun = false;
	});

	pi.on("agent_start", async (_event, ctx) => {
		context = ctx;
		scheduler.onAgentStart();
		scheduler.invalidate();
		cancelManualPipelines("agent restart invalidated memory generation");
		generationToken = `${Date.now()}:${ctx.sessionManager.getSessionId()}:agent`;
	});

	pi.on("agent_end", async () => scheduler.onAgentEnd());

	pi.on("agent_settled", async (_event, ctx) => {
		context = ctx;
		if (
			isContextGovernorEnabled(ctx)
			&& contextPressureGovernor.currentSnapshot().known
			&& contextPressureGovernor.currentState().activeLevel !== "normal"
		) {
			setContextGovernorStatus(ctx, "context: /compact recommended");
		}
		scheduler.onAgentSettled((signal, currentGeneration) => runMemoryPipeline(ctx, signal, currentGeneration));
		workflowEligibilityAssessedForRun = false;
		if (continuity) {
			const workflow = continuity.currentState().workflow;
			if (workflow.mode === "managed" && workflow.shape !== "durable" && workflow.shape !== "unclassified") {
				continuity.resetWorkflowPreparation(branchContext(ctx));
				appendState();
			}
		}
	});

	pi.on("context", async (event, ctx) => {
		context = ctx;
		if (!isContextGovernorEnabled(ctx)) return;
		try {
			const snapshot = contextPressureGovernor.observe(ctx.getContextUsage());
			if (!snapshot.known || snapshot.activeLevel === "normal") return;
			const messages = event.messages.filter((message) => !(
				message.role === "custom" && message.customType === CONTEXT_PRESSURE_CUSTOM_TYPE
			));
			const advisory = {
				role: "custom" as const,
				customType: CONTEXT_PRESSURE_CUSTOM_TYPE,
				content: renderContextPressureAdvisory(snapshot),
				display: false,
				timestamp: Date.now(),
			};
			if (snapshot.transitioned) showContextGovernorLevel(ctx, snapshot.activeLevel);
			return { messages: [...messages, advisory] };
		} catch {
			clearContextGovernorStatus(ctx);
			return;
		}
	});

	pi.on("tool_call", async (event, ctx) => {
		context = ctx;
		if (!continuity) return;
		const classification = classifyTool(event.toolName, event.input);
		if (ctx.isProjectTrusted() && continuity.currentState().workflow.mode === "managed" && !workflowEligibilityAssessedForRun && classification === "mutation") {
			return { block: true, reason: "Managed workflow eligibility was not established for the current agent run; restart the turn so applicable AGENTS.md context can be assessed before mutation" };
		}
		try {
			return await continuity.observeToolCall({
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				input: event.input,
				branch: branchContext(ctx),
				actor: "agent-tool",
				enforceWorkflow: workflowEligibility.eligible,
				signal: ctx.signal,
			});
		} catch (error) {
			compromiseAuthority(ctx, error);
			if (isManagedWorkflowMutationTool(event.toolName)) {
				return { block: true, reason: `Managed workflow mutation could not be durably tracked: ${redactSecrets(error instanceof Error ? error.message : String(error))}` };
			}
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
		const eligibility = refreshWorkflowEligibility(ctx, event.systemPromptOptions.contextFiles);
		workflowEligibilityAssessedForRun = true;
		const currentWorkflow = continuity.currentState().workflow;
		if (managedWorkflow && eligibility.eligible && currentWorkflow.binding && (currentWorkflow.phase === "bound" || currentWorkflow.phase === "finalized")) {
			const alignment = await managedWorkflow.alignment(currentWorkflow.binding);
			if (alignment.state !== "aligned") {
				continuity.recordWorkflowAlignment("drifted", alignment.state === "changed" ? alignment.binding : null, branchContext(ctx));
				appendState();
			}
		}
		const workflowAsset = managedWorkflow?.readAsset("workflow");
		const workflowPrompt = workflowAsset
			? managedWorkflowPrompt(
				continuity.currentState().workflow.mode,
				eligibility,
				continuity.currentState().workflow,
				`Package workflow ${workflowAsset.path} is checksum-verified at sha256:${workflowAsset.digest.slice(0, 12)}. Use continuity_workflow_read when the full workflow or a template is needed.`,
			)
			: "";
		const memoryPrompt = memory.contextPrompt(event.prompt);
		return { systemPrompt: `${event.systemPrompt}\n\n${continuity.contextSummary()}${workflowPrompt ? `\n\n${workflowPrompt}` : ""}${memoryPrompt ? `\n\n${memoryPrompt}` : ""}` };
	});

	pi.on("message_end", async (event, ctx) => {
		context = ctx;
		const message = event.message as unknown as { role?: string; stopReason?: string };
		if (message.role === "assistant") scheduler.onAssistantMessageEnd(message.stopReason);
		if (!memory) return;
		const text = messageText(event);
		if (text) memory.recordCitations(text);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		planBrowserRequest++;
		clearContextGovernorStatus(ctx);
		sessionGovernorEnabled = false;
		contextPressureGovernor = new ContextPressureGovernor();
		contextGovernorStatusValue = undefined;
		cancelManualPipelines("session shutdown");
		await scheduler.shutdown();
		await waitForManualPipelines();
		context = undefined;
		continuity = undefined;
		memory = undefined;
		managedWorkflow = undefined;
		repositoryRoot = undefined;
		workflowUnavailableReason = undefined;
		workflowEligibility = { eligible: false, repositoryAgentsPaths: [], reason: "Session shut down." };
		workflowEligibilityAssessedForRun = false;
		continuityStore?.close();
		memoryStore?.close();
		continuityStore = undefined;
		memoryStore = undefined;
	});

	pi.registerTool({
		name: "continuity_workflow_status",
		label: "Workflow Status",
		description: "Inspect package-owned workflow availability, repository AGENTS eligibility, work shape, document binding, drift, and the separate completion/safe-checkpoint authority axes.",
		promptSnippet: "Inspect managed repository workflow state and document alignment",
		parameters: Type.Object({}),
		async execute() {
			const status = await workflowStatus();
			return textResult(JSON.stringify(status, null, 2), status);
		},
	});

	pi.registerTool({
		name: "continuity_workflow_read",
		label: "Read Workflow",
		description: "Read one checksum-verified package-owned workflow or template asset. Templates are process scaffolding, never repository product authority or completion evidence.",
		promptSnippet: "Read managed workflow guidance or a document template",
		parameters: Type.Object({
			document: StringEnum(["workflow", "execution-plan", "decision-record", "application-runbook"] as const),
		}),
		async execute(_id, params) {
			const asset = requireManagedWorkflow().readAsset(params.document as WorkflowAssetName);
			return textResult(`${asset.content}\n\nAsset: ${asset.path}\nSHA-256: ${asset.digest}`, asset);
		},
	});

	pi.registerTool({
		name: "continuity_prepare_work",
		label: "Prepare Work",
		description: "Classify the current work from structured authority/durability signals. Read-only and bounded work create no documents; managed durable work persists exact intent then exclusively creates one execution plan, while ambiguity creates nothing.",
		promptSnippet: "Classify mutative work before the first repository mutation and create a durable plan only when required",
		promptGuidelines: [
			"Call continuity_prepare_work before the first repository mutation when managed workflow eligibility is active.",
			"Set authority to ambiguous or missing when a material product, security, compatibility, recovery, or external-state choice remains unresolved; continuity_prepare_work then creates no document and mutation stays blocked.",
		],
		parameters: PrepareWorkSchema,
		executionMode: "sequential",
		async execute(_id, params, _signal, _update, ctx) {
			const services = requireServices();
			const mode = services.continuity.currentState().workflow.mode;
			const existingBinding = services.continuity.currentState().workflow.binding;
			if (existingBinding?.status === "active") {
				return textResult(`Current durable work is already bound to ${existingBinding.relativePath}. Update or explicitly rebind that repository document instead of creating a parallel plan.`, { status: "already-bound", binding: existingBinding });
			}
			if (mode === "off") throw new Error("Managed workflow is disabled; use /continuity workflow-mode advisory|managed");
			if (mode === "managed" && !workflowEligibility.eligible) throw new Error(workflowEligibility.reason);
			try {
				const planned = requireManagedWorkflow().plan(params as PrepareManagedWorkInput);
				let binding = null;
				if (planned.preparation.shape === "durable" && planned.intent && mode === "managed" && workflowEligibility.eligible) {
					services.continuity.recordWorkflowIntent(planned.preparation, planned.intent, planned.resumeHint, branchContext(ctx));
					appendState();
					binding = await requireManagedWorkflow().materialize(planned);
				}
				const state = services.continuity.recordWorkPreparation(planned.preparation, binding, planned.resumeHint, branchContext(ctx));
				appendState();
				const text = binding
					? `Prepared durable work and created ${binding.relativePath}. Repository document owns durable plan truth.`
					: planned.preparation.shape === "durable"
						? `Classified durable work; advisory mode would create ${planned.intent!.relativePath}. Enable managed mode or bind an existing plan before relying on enforcement.`
						: `Prepared ${planned.preparation.shape} work. ${planned.preparation.reason}`;
				return textResult(`${text}\n${stateSummary(state)}`, { planned: { ...planned, content: planned.content === null ? null : `[sha256:${planned.intent!.expectedDigest}]` }, binding, state });
			} catch (error) {
				if (error instanceof ExecutionPlanConflictError || error instanceof ExecutionPlanPathError || error instanceof ExecutionPlanDigestMismatchError) {
					const state = services.continuity.recordWorkflowAlignment("conflict", null, branchContext(ctx));
					appendState();
					return textResult(`Workflow document was not created: ${error.message}`, { status: "conflict", state });
				}
				throw error;
			}
		},
	});

	pi.registerTool({
		name: "continuity_bind_work_document",
		label: "Bind Work Document",
		description: "Bind one explicit existing execution plan as repository-owned durable work truth after checking its root-confined path, regular-file identity, metadata, and optional digest. Never edits the document.",
		promptSnippet: "Bind an existing repository execution plan without modifying it",
		parameters: Type.Object({
			path: Type.String({ maxLength: 1_000 }),
			expectedDigest: Type.Optional(Type.String({ minLength: 64, maxLength: 64 })),
			resumeHint: Type.Optional(Type.String({ maxLength: 4_000 })),
		}),
		async execute(_id, params, _signal, _update, ctx) {
			if (!workflowEligibility.eligible) throw new Error(workflowEligibility.reason);
			const binding = await requireManagedWorkflow().bind(params.path, params.expectedDigest);
			const state = requireServices().continuity.bindWorkflowDocument(binding, branchContext(ctx), params.resumeHint);
			appendState();
			return textResult(`Bound repository work document ${binding.relativePath}; repository content owns durable task truth.\n${stateSummary(state)}`, { binding, state });
		},
	});

	pi.registerTool({
		name: "continuity_finalize_work",
		label: "Finalize Work Document",
		description: "Move the currently bound active execution plan to docs/plans/completed only when a receipt-bound immediately preceding validation still matches the pre-operation ledger and stable Git fingerprint. The move is a new mutation and always requires fresh post-move validation; it never proves task completion by itself.",
		promptSnippet: "Move an evidence-prepared active plan to completed and require fresh validation",
		parameters: Type.Object({}),
		executionMode: "sequential",
		async execute(id, _params, signal, _update, ctx) {
			if (!workflowEligibility.eligible) throw new Error(workflowEligibility.reason);
			const services = requireServices();
			const status = await authoritativeStatus(ctx, signal);
			const unresolved = status.unresolvedOperations.filter((operation) => operation.toolCallId !== id);
			if (unresolved.length > 0) {
				return textResult(`Work document was not finalized: unresolved operation ${unresolved[0]!.toolCallId} is ${unresolved[0]!.status}.`, { status: "blocked", unresolved });
			}
			const binding = services.continuity.currentState().workflow.binding;
			if (!binding) return textResult("Work document was not finalized: no execution plan is bound.", { status: "blocked" });
			let evidence;
			try {
				evidence = await services.continuity.workflowFinalizationEvidence(id, branchContext(ctx), signal);
			} catch (error) {
				return textResult(`Work document was not finalized: ${redactSecrets(error instanceof Error ? error.message : String(error))}.`, { status: "blocked" });
			}
			services.continuity.recordWorkflowFinalizationIntent(binding, branchContext(ctx));
			appendState();
			try {
				const result = await requireManagedWorkflow().finalize(binding);
				const state = services.continuity.recordWorkflowAlignment("finalized", result.binding, branchContext(ctx));
				appendState();
				return textResult(`${result.finalized.notice}\nMoved to ${result.binding.relativePath}.`, { ...result, preFinalizationEvidence: evidence, state });
			} catch (error) {
				if (error instanceof ExecutionPlanDigestMismatchError) {
					const state = services.continuity.recordWorkflowAlignment("drifted", null, branchContext(ctx));
					appendState();
					return textResult(`Work document was not finalized: ${error.message}. Re-read and explicitly rebind repository content.`, { status: "drifted", state });
				}
				if (error instanceof ExecutionPlanNotReadyError) {
					const state = services.continuity.recordWorkflowAlignment("bound", binding, branchContext(ctx));
					appendState();
					return textResult(`Work document was not finalized: ${error.message}`, { status: "not-ready", state });
				}
				if (error instanceof ExecutionPlanConflictError || error instanceof ExecutionPlanPathError) {
					const state = services.continuity.recordWorkflowAlignment("conflict", null, branchContext(ctx));
					appendState();
					return textResult(`Work document was not finalized: ${error.message}`, { status: "conflict", state });
				}
				throw error;
			}
		},
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
		description: "Persist operational work state on the active session branch. When managed durable work is bound, the repository document owns plan, durable decisions, validation, and completion, so duplicate Continuity fields are rejected.",
		promptSnippet: "Persist branch-correct work state",
		promptGuidelines: ["Use continuity_update for operational recovery state only. When a managed repository work document is bound, update that document instead of copying its plan, decisions, or completion into Continuity; continuity_update never grants safe or completion authority."],
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
		description: "Create a verified repository/operation safety checkpoint only when mutation outcome, executable validation, stable full Git fingerprint, and checkpoint hash-chain all pass. A checkpoint never marks repository work complete.",
		promptSnippet: "Create an evidence-backed safe checkpoint",
		parameters: Type.Object({}),
		executionMode: "sequential",
		async execute(_id, _params, signal, _update, ctx) {
			const services = requireServices();
			requireSafeAuthority();
			const checkpoint = await services.continuity.createCheckpoint(branchContext(ctx), signal);
			appendState(checkpoint);
			return textResult(`Verified safety checkpoint ${checkpoint.id}. This proves repository/operation safety only and does not mark any repository work document or task complete.`, checkpoint);
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
		description: "Continuity status, plan browser, context governor, managed workflow, checkpoint, operations, reconciliation, or state-only recovery",
		async handler(args, ctx) {
			context = ctx;
			try {
				const [subcommand = "status", value] = args.trim().split(/\s+/, 2);
				if (subcommand === "plans") {
					// Do not discover files or access UI outside a trusted idle TUI repository.
					if (ctx.mode !== "tui" || !ctx.hasUI) return;
					if (!ctx.isProjectTrusted() || !repositoryRoot) {
						safeNotify(ctx, "Plan browser requires a trusted Git repository.", "warning");
						return;
					}
					if (!ctx.isIdle()) {
						safeNotify(ctx, "Wait for the agent to become idle before browsing plans.", "warning");
						return;
					}
					const root = repositoryRoot;
					const generation = generationToken;
					const request = ++planBrowserRequest;
					const isCurrent = () => context === ctx && repositoryRoot === root && generationToken === generation
						&& request === planBrowserRequest && ctx.mode === "tui" && ctx.hasUI && ctx.isProjectTrusted() && ctx.isIdle();
					const files = await ExecutionPlanFileService.open(root);
					await showPlanBrowser(ctx, files, isCurrent, args.trim().slice("plans".length).trim());
					return;
				}
				if (subcommand === "context-governor") {
					const action = value || "status";
					if (ctx.mode !== "tui" || !ctx.hasUI) {
						if (action === "on") sessionGovernorEnabled = false;
						return;
					}
					if (action === "off") {
						sessionGovernorEnabled = false;
						clearContextGovernorStatus(ctx);
						safeNotify(ctx, contextGovernorStatus(ctx));
						return;
					}
					if (action === "on") {
						sessionGovernorEnabled = true;
						showContextGovernorLevel(ctx, contextPressureGovernor.currentState().activeLevel);
						safeNotify(ctx, contextGovernorStatus(ctx));
						return;
					}
					if (action === "status") {
						safeNotify(ctx, contextGovernorStatus(ctx));
						return;
					}
					safeNotify(ctx, "Usage: /continuity context-governor status|on|off", "warning");
					return;
				}
				const services = requireServices();
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
				if (subcommand === "workflow") {
					refreshWorkflowEligibility(ctx, ctx.getSystemPromptOptions().contextFiles);
					safeNotify(ctx, JSON.stringify(await workflowStatus(), null, 2));
					return;
				}
				if (subcommand === "workflow-mode") {
					if (!value || !["off", "advisory", "managed"].includes(value)) {
						safeNotify(ctx, "Usage: /continuity workflow-mode <off|advisory|managed>", "warning");
						return;
					}
					const state = services.continuity.configureWorkflow(value as WorkflowMode, branchContext(ctx));
					appendState();
					safeNotify(ctx, `Managed workflow mode: ${state.workflow.mode}`);
					return;
				}
				if (subcommand === "workflow-bind") {
					if (!value) {
						safeNotify(ctx, "Usage: /continuity workflow-bind <docs/plans/active/file.md>", "warning");
						return;
					}
					refreshWorkflowEligibility(ctx, ctx.getSystemPromptOptions().contextFiles);
					if (!workflowEligibility.eligible) throw new Error(workflowEligibility.reason);
					const binding = await requireManagedWorkflow().bind(value);
					services.continuity.bindWorkflowDocument(binding, branchContext(ctx));
					appendState();
					safeNotify(ctx, `Bound repository work document ${binding.relativePath}.`);
					return;
				}
				if (subcommand === "workflow-reset") {
					services.continuity.resetWorkflowPreparation(branchContext(ctx));
					appendState();
					safeNotify(ctx, "Cleared operational workflow preparation; repository files were not changed.");
					return;
				}
				if (subcommand === "checkpoint") {
					requireSafeAuthority();
					const checkpoint = await services.continuity.createCheckpoint(branchContext(ctx), ctx.signal);
					appendState(checkpoint);
					safeNotify(ctx, `continuity: safe ${checkpoint.id.slice(0, 8)} — repository/operation safety only; task completion remains repository-owned`);
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
				safeNotify(ctx, "Usage: /continuity status|show|plans [query]|context-governor status|on|off|workflow|workflow-mode <mode>|workflow-bind <path>|workflow-reset|checkpoint|recover [checkpoint-id]|operations|reconcile ...", "warning");
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
					const afterEntryId = services.memory.cursor()?.lastEntryId;
					const source = memorySource(ctx, afterEntryId);
					const token = generationToken;
					const run = (async () => {
						const result = await services.memory.runPipeline(source, token, provider, {
							isCurrentGeneration: () => generationToken === token,
							currentSourceHash: () => context ? memorySource(context, afterEntryId).hash : "replaced",
						}, controller.signal, { force: true });
						safeNotify(ctx, `Memory pipeline: ${result.status} — ${result.reason}`, result.status === "failed" ? "error" : "info");
					})();
					manualPipelineRuns.add(run);
					try {
						await run;
					} finally {
						manualPipelineRuns.delete(run);
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
