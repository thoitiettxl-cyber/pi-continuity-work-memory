import { randomUUID } from "node:crypto";

import { boundedStrings, canonicalJson, redactSecrets, sha256 } from "../domain/canonical.js";
import {
	buildCheckpointHashes,
	parseCheckpointPayload,
	verifyCheckpointChain,
	type CheckpointPayload,
	type CheckpointPayloadV2,
} from "../domain/checkpoint-chain.js";
import {
	CONTINUITY_SCHEMA_VERSION,
	cloneWorkState,
	emptyWorkState,
	type CheckpointRecord,
	type ContinuityStatus,
	type EmbeddedState,
	type PlanStep,
	type ReconciliationOutcome,
	type SessionIdentity,
	type SessionLineage,
	type TrackedOperation,
	type ValidationEvidence,
	type WorkState,
} from "../domain/types.js";
import { buildValidationEvidence, verifyValidationEvidence } from "../domain/validation-receipt.js";
import { ContinuityStore } from "../infrastructure/continuity-store.js";
import {
	GitFingerprintService,
	type CommandResult,
	type CommandRunner,
} from "../infrastructure/git-fingerprint.js";
import {
	classifyMutationConsequence,
	classifyTool,
	isExecutableValidationCommand,
	splitSimpleCommand,
	splitValidationCommand,
} from "./tool-classifier.js";

export interface BranchContext {
	nodeIds: string[];
	currentNodeId: string;
	embeddedStates: EmbeddedState[];
}

export interface WorkStatePatch {
	goal?: string;
	workItemId?: string;
	plan?: PlanStep[];
	currentStepId?: string | null;
	nextActions?: string[];
	completedWork?: string[];
	decisions?: string[];
	blockers?: string[];
	constraints?: string[];
}

export interface ToolCallObservation {
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
	branch: BranchContext;
	actor?: "agent-tool" | "user-bash";
	signal?: AbortSignal | undefined;
}

export interface ToolCallDecision {
	block: true;
	reason: string;
}

export interface ToolResultObservation {
	toolCallId: string;
	isError: boolean;
	contentText: string;
	branch: BranchContext;
	signal?: AbortSignal | undefined;
}

function normalizePlan(plan: readonly PlanStep[] | undefined): PlanStep[] {
	if (!plan) return [];
	const ids = new Set<string>();
	const output: PlanStep[] = [];
	for (const step of plan.slice(0, 200)) {
		const id = step.id.trim().slice(0, 200);
		const text = step.text.trim().slice(0, 4_000);
		if (!id || !text || ids.has(id)) continue;
		ids.add(id);
		output.push({ id, text, status: step.status });
	}
	return output;
}

function latestEmbedded(branch: BranchContext): EmbeddedState | undefined {
	for (let index = branch.embeddedStates.length - 1; index >= 0; index -= 1) {
		const embedded = branch.embeddedStates[index];
		if (embedded?.schemaVersion === CONTINUITY_SCHEMA_VERSION) return embedded;
	}
	return undefined;
}

function payloadState(record: CheckpointRecord): WorkState {
	const payload = parseCheckpointPayload(record);
	const state = cloneWorkState(payload.state);
	state.checkpointId = record.id;
	state.checkpointAncestry = [record.id, ...state.checkpointAncestry.filter((item) => item !== record.id)].slice(0, 200);
	return state;
}

function safeCommandSummary(program: string, args: readonly string[]): string {
	const safeTokens = new Set([
		"run", "test", "validate", "validate:premerge", "validate:release", "check", "lint", "typecheck", "build",
		"--test", "-m", "pytest", "diff", "--check", "cargo", "go", "dotnet", "mvn", "mvnw", "gradle", "gradlew",
		"push", "publish", "deploy", "release", "config", "status", "branch",
	]);
	let retained = 0;
	while (retained < args.length && retained < 2 && safeTokens.has(args[retained]!)) retained += 1;
	const prefix = args.slice(0, retained);
	const hidden = args.slice(retained).map((argument) => `[arg:${sha256(argument).slice(0, 12)}]`);
	return [program, ...prefix, ...hidden].join(" ").slice(0, 4_000);
}

export class ContinuityService {
	private state: WorkState = emptyWorkState();
	private started = false;

	constructor(
		readonly identity: SessionIdentity,
		readonly cwd: string,
		private readonly store: ContinuityStore,
		private readonly fingerprints: GitFingerprintService,
		private readonly commandRunner: CommandRunner,
	) {}

	initialize(branch: BranchContext): WorkState {
		this.store.registerSession(this.identity);
		const external = this.store.findNearestState(this.identity.sessionKey, branch.nodeIds);
		const embedded = latestEmbedded(branch);
		this.state = external
			? cloneWorkState(external)
			: embedded
				? cloneWorkState(embedded.state)
				: emptyWorkState();
		const uncertainSequences = this.store.markPendingUncertain(this.identity.sessionKey, branch.nodeIds);
		if (uncertainSequences.length > 0) this.state.mutationSequence = Math.max(this.state.mutationSequence, ...uncertainSequences);
		this.started = true;
		this.refreshMutationProjection(branch);
		return this.currentState();
	}

	reconstructBranch(branch: BranchContext): WorkState {
		this.requireStarted();
		const external = this.store.findNearestState(this.identity.sessionKey, branch.nodeIds);
		const embedded = latestEmbedded(branch);
		this.state = external
			? cloneWorkState(external)
			: embedded
				? cloneWorkState(embedded.state)
				: emptyWorkState();
		this.refreshMutationProjection(branch);
		return this.currentState();
	}

	currentState(): WorkState {
		return cloneWorkState(this.state);
	}

	lineage(): SessionLineage {
		return {
			sessionId: this.identity.sessionId,
			sessionFileKey: this.identity.sessionFileKey,
			sessionKey: this.identity.sessionKey,
			parentSessionKey: this.identity.parentSessionKey,
			repositoryId: this.identity.repositoryId,
		};
	}

	update(patch: WorkStatePatch, branch: BranchContext): WorkState {
		this.requireStarted();
		this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
			if (patch.goal !== undefined) state.goal = patch.goal.trim().slice(0, 16_000);
			if (patch.workItemId !== undefined) state.workItemId = patch.workItemId.trim().slice(0, 500) || "default";
			if (patch.plan !== undefined) state.plan = normalizePlan(patch.plan);
			if (patch.currentStepId !== undefined) state.currentStepId = patch.currentStepId?.trim().slice(0, 200) || null;
			if (patch.nextActions !== undefined) state.nextActions = boundedStrings(patch.nextActions);
			if (patch.completedWork !== undefined) state.completedWork = boundedStrings(patch.completedWork);
			if (patch.decisions !== undefined) state.decisions = boundedStrings(patch.decisions);
			if (patch.blockers !== undefined) state.blockers = boundedStrings(patch.blockers);
			if (patch.constraints !== undefined) state.constraints = boundedStrings(patch.constraints);
		});
		return this.currentState();
	}

	private refreshMutationProjection(branch: BranchContext): void {
		const unresolved = this.store.unresolvedForBranch(this.identity.sessionKey, branch.nodeIds);
		const hasUncertain = unresolved.some((operation) => operation.status === "uncertain");
		const hasPending = unresolved.some((operation) => operation.status === "pending");
		const nextStatus = hasUncertain ? "uncertain" : hasPending ? "pending" : this.state.mutationSequence > 0 ? "determined" : "none";
		const nextUncertain = hasUncertain;
		if (this.state.mutationStatus === nextStatus && this.state.mutationUncertain === nextUncertain) return;
		this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
			state.mutationStatus = nextStatus;
			state.mutationUncertain = nextUncertain;
		});
	}

	private operationKey(
		toolName: string,
		inputDigest: string,
		preHead: string | null,
	): string {
		return sha256(canonicalJson({
			version: 1,
			repositoryId: this.identity.repositoryId,
			toolName,
			inputDigest,
			preHead: preHead || "unavailable",
		}));
	}

	async observeToolCall(observation: ToolCallObservation): Promise<ToolCallDecision | undefined> {
		this.requireStarted();
		const classification = classifyTool(observation.toolName, observation.input);
		if (classification !== "mutation" && classification !== "validation") return undefined;
		const rawCommand = observation.toolName === "bash" && typeof observation.input.command === "string"
			? observation.input.command
			: null;
		let parsedCommand: ReturnType<typeof splitSimpleCommand> | null = null;
		if (rawCommand) {
			try {
				parsedCommand = splitSimpleCommand(rawCommand);
			} catch (error) {
				if (observation.actor !== "user-bash") {
					return { block: true, reason: `Compound or expanding shell commands cannot be tracked safely; run one simple command at a time (${String(error)})` };
				}
			}
		}
		const consequence = classifyMutationConsequence(observation.toolName, observation.input);
		const preOperationLedgerDigest = this.store.operationLedgerDigest(this.identity.sessionKey, observation.branch.nodeIds);
		let preFingerprint: string | null = null;
		let preHead: string | null = null;
		if ((classification === "validation" || consequence === "external") && this.identity.trusted) {
			const captured = await this.fingerprints.captureStable(this.cwd, true, observation.signal);
			preFingerprint = captured.combined;
			preHead = captured.head;
		}
		const commandDigest = rawCommand
			? sha256(parsedCommand ? canonicalJson(parsedCommand.tokens) : rawCommand)
			: null;
		const inputDigest = sha256(canonicalJson(observation.input));
		const intentDigest = commandDigest || inputDigest;
		const operationKey = consequence === "external" && observation.actor !== "user-bash"
			? this.operationKey(observation.toolName, intentDigest, preHead)
			: null;
		const command = parsedCommand
			? safeCommandSummary(parsedCommand.program, parsedCommand.args)
			: rawCommand && commandDigest
				? `bash [compound:${commandDigest.slice(0, 12)}]`
				: null;
		const begun = this.store.beginTrackedCall({
			toolCallId: observation.toolCallId,
			sessionKey: this.identity.sessionKey,
			nodeId: observation.branch.currentNodeId,
			toolName: observation.toolName,
			kind: classification,
			consequence,
			operationKey,
			inputDigest,
			command,
			commandDigest,
			preFingerprint,
			preOperationLedgerDigest,
			state: this.state,
		});
		if (!begun.inserted) return { block: true, reason: begun.reason || "Tool call could not be atomically tracked" };
		this.state = begun.state;
		this.refreshMutationProjection(observation.branch);
		return undefined;
	}

	async observeToolResult(observation: ToolResultObservation): Promise<ValidationEvidence | undefined> {
		this.requireStarted();
		const trackedBefore = this.store.getTrackedCall(observation.toolCallId, this.identity.sessionKey, observation.branch.nodeIds);
		if (!trackedBefore) return undefined;
		const tracked = this.store.resolveTrackedCall(
			observation.toolCallId,
			this.identity.sessionKey,
			observation.branch.nodeIds,
			observation.isError,
			sha256(redactSecrets(observation.contentText)),
			trackedBefore.kind === "mutation" && trackedBefore.consequence === "external",
		);
		if (!tracked) return undefined;
		if (tracked.kind === "mutation") {
			this.state.mutationSequence = Math.max(this.state.mutationSequence, tracked.sequence);
			this.refreshMutationProjection(observation.branch);
			return undefined;
		}
		if (observation.isError || !this.identity.trusted || !tracked.command || !tracked.commandDigest || !tracked.preFingerprint || !tracked.preOperationLedgerDigest) return undefined;
		const post = await this.fingerprints.captureStable(this.cwd, true, observation.signal);
		const ledgerDigest = this.store.operationLedgerDigest(this.identity.sessionKey, observation.branch.nodeIds);
		if (this.store.operationIntegrityIssues(this.identity.sessionKey, observation.branch.nodeIds).length > 0) return undefined;
		if (post.combined !== tracked.preFingerprint
			|| ledgerDigest !== tracked.preOperationLedgerDigest
			|| this.state.mutationSequence !== tracked.sequence) return undefined;
		const evidence = buildValidationEvidence({
			id: randomUUID(),
			sessionKey: this.identity.sessionKey,
			nodeId: observation.branch.currentNodeId,
			command: tracked.command,
			commandDigest: tracked.commandDigest,
			exitCode: 0,
			startedAt: tracked.createdAt,
			finishedAt: Date.now(),
			mutationSequence: tracked.sequence,
			preRepositoryFingerprint: tracked.preFingerprint,
			postRepositoryFingerprint: post.combined,
			repositoryFingerprint: post.combined,
			operationLedgerDigest: ledgerDigest,
			outputDigest: sha256(redactSecrets(observation.contentText)),
			provider: "observed-tool",
		});
		this.recordEvidence(evidence, observation.branch);
		return evidence;
	}

	async validate(command: string, branch: BranchContext, signal?: AbortSignal): Promise<{ evidence?: ValidationEvidence; result: CommandResult }> {
		this.requireStarted();
		if (!this.identity.trusted) throw new Error("Project is untrusted; validation cannot collect Git authority");
		if (!isExecutableValidationCommand(command)) throw new Error("Validation command is not on the executable allow-list or contains shell operators");
		const integrityIssues = this.store.operationIntegrityIssues(this.identity.sessionKey, branch.nodeIds);
		if (integrityIssues.length > 0) throw new Error(integrityIssues[0]);
		const { program, args } = splitValidationCommand(command);
		const persistedCommand = safeCommandSummary(program, args);
		const commandDigest = sha256(canonicalJson({ program, args }));
		const mutationSequence = this.state.mutationSequence;
		const ledgerDigest = this.store.operationLedgerDigest(this.identity.sessionKey, branch.nodeIds);
		const pre = await this.fingerprints.captureStable(this.cwd, true, signal);
		const startedAt = Date.now();
		const result = await this.commandRunner.run(program, args, { cwd: this.cwd, signal, timeout: 30 * 60_000 });
		const finishedAt = Date.now();
		const post = await this.fingerprints.captureStable(this.cwd, true, signal);
		const finalLedgerDigest = this.store.operationLedgerDigest(this.identity.sessionKey, branch.nodeIds);
		if (result.code !== 0 || result.killed || pre.combined !== post.combined
			|| mutationSequence !== this.state.mutationSequence || ledgerDigest !== finalLedgerDigest) return { result };
		const evidence = buildValidationEvidence({
			id: randomUUID(),
			sessionKey: this.identity.sessionKey,
			nodeId: branch.currentNodeId,
			command: persistedCommand,
			commandDigest,
			exitCode: result.code,
			startedAt,
			finishedAt,
			mutationSequence,
			preRepositoryFingerprint: pre.combined,
			postRepositoryFingerprint: post.combined,
			repositoryFingerprint: post.combined,
			operationLedgerDigest: ledgerDigest,
			outputDigest: sha256(redactSecrets(`${result.stdout}\n${result.stderr}`)),
			provider: "continuity-validate",
		});
		this.recordEvidence(evidence, branch);
		return { evidence, result };
	}

	private recordEvidence(evidence: ValidationEvidence, branch: BranchContext): void {
		this.store.recordValidation(evidence.sessionKey, evidence.nodeId, evidence);
		this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
			state.validationEvidence = [...state.validationEvidence.filter((item) => item.id !== evidence.id), evidence].slice(-100);
		});
	}

	private checkpointAuthority(checkpointId: string): { valid: boolean; legacy: boolean; reason: string } {
		const chain = verifyCheckpointChain(checkpointId, this.store);
		if (!chain.valid) return { valid: false, legacy: false, reason: chain.reason };
		for (const id of chain.ancestry) {
			const checkpoint = this.store.getCheckpoint(id);
			if (!checkpoint) return { valid: false, legacy: false, reason: `missing checkpoint ${id}` };
			const payload = parseCheckpointPayload(checkpoint);
			if (payload.version === 1) return { valid: false, legacy: true, reason: `checkpoint ${id} predates validation receipt binding` };
			const evidence = this.store.getValidation(checkpoint.validationEvidenceId);
			if (!evidence) return { valid: false, legacy: false, reason: `validation evidence is missing at ${id}` };
			const receipt = verifyValidationEvidence(evidence);
			if (!receipt.valid) return { valid: false, legacy: receipt.legacy, reason: `${receipt.reason} at ${id}` };
			if (evidence.receiptDigest !== checkpoint.validationReceiptDigest
				|| evidence.operationLedgerDigest !== checkpoint.operationLedgerDigest
				|| evidence.mutationSequence !== checkpoint.mutationSequence
				|| evidence.repositoryFingerprint !== checkpoint.repositoryFingerprint) {
				return { valid: false, legacy: false, reason: `validation receipt projection mismatch at ${id}` };
			}
		}
		return { valid: true, legacy: false, reason: "validation receipts, operation ledgers, and checkpoint chain verified" };
	}

	async createCheckpoint(branch: BranchContext, signal?: AbortSignal): Promise<CheckpointRecord> {
		this.requireStarted();
		if (!this.identity.trusted) throw new Error("Project is untrusted; safe checkpoints require a complete Git fingerprint");
		this.refreshMutationProjection(branch);
		const integrityIssues = this.store.operationIntegrityIssues(this.identity.sessionKey, branch.nodeIds);
		if (integrityIssues.length > 0) throw new Error(integrityIssues[0]);
		const unresolved = this.store.unresolvedForBranch(this.identity.sessionKey, branch.nodeIds);
		if (unresolved.length > 0) {
			throw new Error(`Unresolved operation ${unresolved[0]!.toolCallId} is ${unresolved[0]!.status}; reconcile it before checkpointing`);
		}
		if (this.state.mutationUncertain || this.state.mutationStatus === "uncertain") {
			throw new Error("The latest mutation outcome is uncertain; inspect and reconcile it, then validate again");
		}
		if (this.state.mutationStatus === "pending") throw new Error("A mutation is still pending; no checkpoint can be verified");
		const ledgerDigest = this.store.operationLedgerDigest(this.identity.sessionKey, branch.nodeIds);
		const checkpointMutationSequence = this.state.mutationSequence;
		const evidence = this.store.latestValidation(this.identity.sessionKey, branch.nodeIds, checkpointMutationSequence, ledgerDigest);
		if (!evidence) throw new Error("No successful executable validation receipt exists after the latest mutation and operation ledger state");
		const receipt = verifyValidationEvidence(evidence);
		if (!receipt.valid || !evidence.receiptDigest) throw new Error(`Validation receipt is not authoritative: ${receipt.reason}`);
		const fingerprint = await this.fingerprints.captureStable(this.cwd, true, signal);
		if (fingerprint.combined !== evidence.repositoryFingerprint) {
			throw new Error("Repository drifted after validation; validate the current state again");
		}
		if (this.state.mutationSequence !== checkpointMutationSequence
			|| this.store.operationLedgerDigest(this.identity.sessionKey, branch.nodeIds) !== ledgerDigest
			|| this.store.unresolvedForBranch(this.identity.sessionKey, branch.nodeIds).length > 0
			|| this.store.operationIntegrityIssues(this.identity.sessionKey, branch.nodeIds).length > 0) {
			throw new Error("Mutation or operation ledger changed while creating checkpoint");
		}
		let parentId = this.state.checkpointId;
		let parentHash = "GENESIS";
		let startsFreshSessionChain = false;
		if (parentId) {
			const parent = this.store.getCheckpoint(parentId);
			if (!parent) {
				throw new Error("Checkpoint ancestry parent is missing; embedded recovery context cannot grant safe authority");
			} else if (parent.sessionId !== this.identity.sessionId || parent.sessionFileKey !== this.identity.sessionFileKey) {
				parentId = null;
				parentHash = "GENESIS";
				startsFreshSessionChain = true;
			} else {
				const authority = this.checkpointAuthority(parent.id);
				if (authority.legacy) {
					parentId = null;
					parentHash = "GENESIS";
					startsFreshSessionChain = true;
				} else if (!authority.valid) {
					this.store.quarantineCheckpoint(parent.id, authority.reason);
					throw new Error(`Checkpoint ancestry is corrupt and was quarantined: ${authority.reason}`);
				} else {
					parentHash = parent.chainHash;
				}
			}
		}
		const createdAt = Date.now();
		const id = randomUUID();
		const stateForPayload = cloneWorkState(this.state);
		if (startsFreshSessionChain) {
			stateForPayload.checkpointId = null;
			stateForPayload.checkpointAncestry = [];
		}
		const payload: CheckpointPayloadV2 = {
			version: 2,
			sessionId: this.identity.sessionId,
			sessionFileKey: this.identity.sessionFileKey,
			repositoryId: this.identity.repositoryId,
			state: stateForPayload,
			validationEvidenceId: evidence.id,
			validationReceiptDigest: evidence.receiptDigest,
			operationLedgerDigest: ledgerDigest,
			mutationSequence: checkpointMutationSequence,
			repositoryFingerprint: fingerprint.combined,
			createdAt,
		};
		const hashes = buildCheckpointHashes(payload, parentHash);
		const record: CheckpointRecord = {
			id,
			sessionKey: this.identity.sessionKey,
			sessionId: this.identity.sessionId,
			sessionFileKey: this.identity.sessionFileKey,
			repositoryId: this.identity.repositoryId,
			parentId,
			parentHash,
			payloadVersion: 2,
			...hashes,
			repositoryFingerprint: fingerprint.combined,
			validationEvidenceId: evidence.id,
			validationReceiptDigest: evidence.receiptDigest,
			operationLedgerDigest: ledgerDigest,
			mutationSequence: checkpointMutationSequence,
			status: "provisional",
			createdAt,
		};
		const checkpointAncestry = startsFreshSessionChain
			? [id]
			: [id, ...this.state.checkpointAncestry.filter((item) => item !== id)].slice(0, 200);
		this.state = this.store.commitCheckpoint({
			record,
			branchNodeIds: branch.nodeIds,
			nodeId: branch.currentNodeId,
			inheritedState: this.state,
			checkpointAncestry,
		});
		try {
			const finalFingerprint = await this.fingerprints.captureStable(this.cwd, true, signal);
			if (finalFingerprint.combined !== record.repositoryFingerprint) throw new Error("Repository changed before checkpoint promotion");
			this.store.promoteCheckpoint({
				record,
				sessionKey: this.identity.sessionKey,
				nodeId: branch.currentNodeId,
				branchNodeIds: branch.nodeIds,
				mutationSequence: record.mutationSequence,
				operationLedgerDigest: ledgerDigest,
			});
		} catch (error) {
			this.store.quarantineCheckpoint(record.id, String(error));
			throw error;
		}
		return { ...record, status: "verified" };
	}

	async status(branch: BranchContext, signal?: AbortSignal): Promise<ContinuityStatus> {
		this.requireStarted();
		this.refreshMutationProjection(branch);
		const unresolvedOperations = this.store.unresolvedForBranch(this.identity.sessionKey, branch.nodeIds);
		const result = (
			health: ContinuityStatus["health"],
			checkpointId: string | null,
			authority: ContinuityStatus["authority"],
			reason: string,
		): ContinuityStatus => ({ health, checkpointId, authority, reason, lineage: this.lineage(), state: this.currentState(), unresolvedOperations });
		if (!this.identity.trusted) {
			return result("degraded", this.state.checkpointId, "embedded", "project untrusted; Git authority disabled");
		}
		const integrityIssues = this.store.operationIntegrityIssues(this.identity.sessionKey, branch.nodeIds);
		if (integrityIssues.length > 0) {
			if (this.state.checkpointId && this.store.getCheckpoint(this.state.checkpointId)) {
				this.store.quarantineCheckpoint(this.state.checkpointId, integrityIssues[0]!);
				return result("degraded", this.state.checkpointId, "quarantined", integrityIssues[0]!);
			}
			return result("degraded", this.state.checkpointId, "none", integrityIssues[0]!);
		}
		if (unresolvedOperations.length > 0) {
			return result("degraded", this.state.checkpointId, "none", `unresolved operation ${unresolvedOperations[0]!.toolCallId} is ${unresolvedOperations[0]!.status}`);
		}
		const checkpointId = this.state.checkpointId;
		if (!checkpointId) return result("degraded", null, "none", "no checkpoint");
		const checkpoint = this.store.getCheckpoint(checkpointId);
		if (!checkpoint) return result("degraded", checkpointId, "embedded", "checkpoint exists only as embedded recovery context");
		if (checkpoint.sessionId !== this.identity.sessionId || checkpoint.sessionFileKey !== this.identity.sessionFileKey) {
			return result("degraded", checkpointId, "embedded", "copied/forked checkpoint has no safe authority in this session");
		}
		const embeddedOnBranch = branch.embeddedStates.some((item) => item.checkpointId === checkpointId);
		if (!embeddedOnBranch) return result("degraded", checkpointId, "none", "checkpoint is not on the active session branch");
		const chain = verifyCheckpointChain(checkpointId, this.store);
		if (!chain.valid) {
			this.store.quarantineCheckpoint(checkpointId, chain.reason);
			return result("degraded", checkpointId, "quarantined", chain.reason);
		}
		const payload = parseCheckpointPayload(checkpoint);
		if (payload.version === 1) {
			return result("degraded", checkpointId, "legacy", "RC2 checkpoint lacks validation receipt and operation-ledger binding; validate and create a fresh checkpoint");
		}
		const authority = this.checkpointAuthority(checkpointId);
		if (!authority.valid) {
			if (authority.legacy) return result("degraded", checkpointId, "legacy", authority.reason);
			this.store.quarantineCheckpoint(checkpointId, authority.reason);
			return result("degraded", checkpointId, "quarantined", authority.reason);
		}
		if (this.state.mutationSequence !== checkpoint.mutationSequence) {
			return result("degraded", checkpointId, "none", "mutation ledger advanced after checkpoint");
		}
		const ledgerDigest = this.store.operationLedgerDigest(this.identity.sessionKey, branch.nodeIds);
		if (ledgerDigest !== checkpoint.operationLedgerDigest) {
			this.store.quarantineCheckpoint(checkpointId, "operation ledger digest mismatch");
			return result("degraded", checkpointId, "quarantined", "operation ledger digest mismatch");
		}
		const fingerprint = await this.fingerprints.captureStable(this.cwd, true, signal);
		if (fingerprint.combined !== checkpoint.repositoryFingerprint) {
			return result("drifted", checkpointId, "verified", "repository changed after checkpoint");
		}
		return result("safe", checkpointId, "verified", authority.reason);
	}

	listOperations(branch: BranchContext): TrackedOperation[] {
		this.requireStarted();
		return this.store.operationsForBranch(this.identity.sessionKey, branch.nodeIds).filter((operation) => operation.kind === "mutation");
	}

	reconcileOperation(branch: BranchContext, toolCallId: string, outcome: ReconciliationOutcome, note: string): WorkState {
		this.requireStarted();
		const sanitizedNote = redactSecrets(note).trim().slice(0, 4_000);
		if (!sanitizedNote) throw new Error("Reconciliation requires a non-empty evidence note");
		this.store.reconcileOperation({
			sessionKey: this.identity.sessionKey,
			branchNodeIds: branch.nodeIds,
			nodeId: branch.currentNodeId,
			toolCallId,
			outcome,
			note: sanitizedNote,
		});
		this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
			state.mutationSequence += 1;
			state.mutationStatus = "determined";
			state.mutationUncertain = false;
		});
		this.refreshMutationProjection(branch);
		return this.currentState();
	}

	recover(branch: BranchContext, requestedCheckpointId?: string): WorkState {
		this.requireStarted();
		let recovered: WorkState | undefined;
		if (requestedCheckpointId) {
			const checkpoint = this.store.getCheckpoint(requestedCheckpointId);
			if (checkpoint && checkpoint.repositoryId === this.identity.repositoryId) recovered = payloadState(checkpoint);
		}
		if (!recovered) recovered = latestEmbedded(branch)?.state;
		if (!recovered) recovered = this.store.findNearestState(this.identity.sessionKey, branch.nodeIds);
		if (!recovered) throw new Error("No continuity state is available for recovery");
		this.state = this.store.saveState(this.identity.sessionKey, branch.currentNodeId, cloneWorkState(recovered));
		this.refreshMutationProjection(branch);
		return this.currentState();
	}

	embeddedState(checkpoint?: CheckpointRecord): EmbeddedState {
		return {
			schemaVersion: CONTINUITY_SCHEMA_VERSION,
			sessionId: this.identity.sessionId,
			repositoryId: this.identity.repositoryId,
			state: this.currentState(),
			checkpointId: checkpoint?.id ?? this.state.checkpointId,
			checkpointHash: checkpoint?.chainHash ?? (this.state.checkpointId ? this.store.getCheckpoint(this.state.checkpointId)?.chainHash ?? null : null),
			authority: "embedded",
			createdAt: Date.now(),
		};
	}

	contextSummary(): string {
		const state = this.state;
		const currentStep = state.plan.find((step) => step.id === state.currentStepId);
		return [
			"<continuity-work-state authority=\"external-extension-only\">",
			`Goal: ${state.goal || "(unset)"}`,
			`Work item: ${state.workItemId}`,
			`Current step: ${currentStep ? `${currentStep.id}: ${currentStep.text}` : state.currentStepId || "(unset)"}`,
			`Plan: ${state.plan.map((step) => `[${step.status}] ${step.id}: ${step.text}`).join(" | ") || "(empty)"}`,
			`Next actions: ${state.nextActions.join(" | ") || "(none)"}`,
			`Completed: ${state.completedWork.join(" | ") || "(none)"}`,
			`Decisions: ${state.decisions.join(" | ") || "(none)"}`,
			`Blockers: ${state.blockers.join(" | ") || "(none)"}`,
			`Constraints: ${state.constraints.join(" | ") || "(none)"}`,
			`Session lineage: current=${this.identity.sessionKey}; parent=${this.identity.parentSessionKey || "(none)"}`,
			`Latest checkpoint: ${state.checkpointId || "(none)"}; embedded text never grants safe authority.`,
			`Checkpoint ancestry: ${state.checkpointAncestry.join(" -> ") || "(none)"}`,
			`Unresolved operations: ${state.mutationUncertain || state.mutationStatus === "pending" ? "present; inspect continuity_status" : "0"}`,
			"Only receipt-bound executable validation plus the extension's Git fingerprint, operation ledger, and checkpoint hash-chain can mark a checkpoint safe.",
			"</continuity-work-state>",
		].join("\n");
	}

	private requireStarted(): void {
		if (!this.started) throw new Error("Continuity service has not started");
	}
}
