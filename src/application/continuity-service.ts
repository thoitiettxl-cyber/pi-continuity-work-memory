import { randomUUID } from "node:crypto";

import { boundedStrings, canonicalJson, redactSecrets, sha256 } from "../domain/canonical.js";
import { buildCheckpointHashes, verifyCheckpointChain, type CheckpointPayload } from "../domain/checkpoint-chain.js";
import {
	CONTINUITY_SCHEMA_VERSION,
	cloneWorkState,
	emptyWorkState,
	type CheckpointRecord,
	type ContinuityStatus,
	type EmbeddedState,
	type PlanStep,
	type SessionIdentity,
	type SessionLineage,
	type ValidationEvidence,
	type WorkState,
} from "../domain/types.js";
import { ContinuityStore } from "../infrastructure/continuity-store.js";
import {
	GitFingerprintService,
	type CommandResult,
	type CommandRunner,
} from "../infrastructure/git-fingerprint.js";
import { classifyTool, isExecutableValidationCommand, splitValidationCommand } from "./tool-classifier.js";

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
	signal?: AbortSignal | undefined;
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
	const payload = JSON.parse(record.payloadJson) as CheckpointPayload;
	const state = cloneWorkState(payload.state);
	state.checkpointId = record.id;
	state.checkpointAncestry = [record.id, ...state.checkpointAncestry.filter((item) => item !== record.id)].slice(0, 200);
	return state;
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
		if (uncertainSequences.length > 0) {
			this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
				state.mutationSequence = Math.max(state.mutationSequence, ...uncertainSequences);
				state.mutationStatus = "uncertain";
				state.mutationUncertain = true;
			});
		}
		this.started = true;
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

	async observeToolCall(observation: ToolCallObservation): Promise<void> {
		this.requireStarted();
		const classification = classifyTool(observation.toolName, observation.input);
		if (classification !== "mutation" && classification !== "validation") return;
		let preFingerprint: string | null = null;
		if (classification === "validation" && this.identity.trusted) {
			preFingerprint = (await this.fingerprints.captureStable(this.cwd, true, observation.signal)).combined;
		}
		const command = observation.toolName === "bash" && typeof observation.input.command === "string"
			? observation.input.command
			: null;
		this.state = this.store.beginTrackedCall({
			toolCallId: observation.toolCallId,
			sessionKey: this.identity.sessionKey,
			nodeId: observation.branch.currentNodeId,
			toolName: observation.toolName,
			kind: classification,
			inputDigest: sha256(canonicalJson(observation.input)),
			command,
			preFingerprint,
			state: this.state,
		});
	}

	async observeToolResult(observation: ToolResultObservation): Promise<ValidationEvidence | undefined> {
		this.requireStarted();
		const trackedBefore = this.store.getTrackedCall(observation.toolCallId);
		if (!trackedBefore) return undefined;
		const tracked = this.store.resolveTrackedCall(
			observation.toolCallId,
			observation.isError,
			sha256(redactSecrets(observation.contentText)),
		);
		if (!tracked) return undefined;
		if (tracked.kind === "mutation") {
			const pending = this.store.pendingForBranch(this.identity.sessionKey, observation.branch.nodeIds);
			this.state = this.store.mutateState(this.identity.sessionKey, observation.branch.currentNodeId, this.state, (state) => {
				state.mutationSequence = Math.max(state.mutationSequence, tracked.sequence);
				state.mutationStatus = pending.length === 0 ? "determined" : "pending";
				state.mutationUncertain = false;
			});
			return undefined;
		}
		if (observation.isError || !this.identity.trusted || !tracked.command || !tracked.preFingerprint) return undefined;
		const post = await this.fingerprints.captureStable(this.cwd, true, observation.signal);
		if (post.combined !== tracked.preFingerprint) return undefined;
		const evidence: ValidationEvidence = {
			id: randomUUID(),
			command: tracked.command,
			exitCode: 0,
			startedAt: tracked.createdAt,
			finishedAt: Date.now(),
			mutationSequence: this.state.mutationSequence,
			repositoryFingerprint: post.combined,
			outputDigest: sha256(redactSecrets(observation.contentText)),
			provider: "observed-tool",
		};
		this.recordEvidence(evidence, observation.branch);
		return evidence;
	}

	async validate(command: string, branch: BranchContext, signal?: AbortSignal): Promise<{ evidence?: ValidationEvidence; result: CommandResult }> {
		this.requireStarted();
		if (!this.identity.trusted) throw new Error("Project is untrusted; validation cannot collect Git authority");
		if (!isExecutableValidationCommand(command)) throw new Error("Validation command is not on the executable allow-list or contains shell operators");
		const { program, args } = splitValidationCommand(command);
		const pre = await this.fingerprints.captureStable(this.cwd, true, signal);
		const startedAt = Date.now();
		const result = await this.commandRunner.run(program, args, { cwd: this.cwd, signal, timeout: 30 * 60_000 });
		const finishedAt = Date.now();
		const post = await this.fingerprints.captureStable(this.cwd, true, signal);
		if (result.code !== 0 || result.killed || pre.combined !== post.combined) return { result };
		const evidence: ValidationEvidence = {
			id: randomUUID(),
			command,
			exitCode: result.code,
			startedAt,
			finishedAt,
			mutationSequence: this.state.mutationSequence,
			repositoryFingerprint: post.combined,
			outputDigest: sha256(redactSecrets(`${result.stdout}\n${result.stderr}`)),
			provider: "continuity-validate",
		};
		this.recordEvidence(evidence, branch);
		return { evidence, result };
	}

	private recordEvidence(evidence: ValidationEvidence, branch: BranchContext): void {
		this.store.recordValidation(this.identity.sessionKey, branch.currentNodeId, evidence);
		this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
			state.validationEvidence = [...state.validationEvidence.filter((item) => item.id !== evidence.id), evidence].slice(-100);
		});
	}

	async createCheckpoint(branch: BranchContext, signal?: AbortSignal): Promise<CheckpointRecord> {
		this.requireStarted();
		if (!this.identity.trusted) throw new Error("Project is untrusted; safe checkpoints require a complete Git fingerprint");
		if (this.state.mutationUncertain || this.state.mutationStatus === "uncertain") {
			throw new Error("The latest mutation outcome is uncertain; run or inspect the mutation, then validate again");
		}
		if (this.store.pendingForBranch(this.identity.sessionKey, branch.nodeIds).length > 0 || this.state.mutationStatus === "pending") {
			throw new Error("A mutation is still pending; no checkpoint can be verified");
		}
		const evidence = this.store.latestValidation(this.identity.sessionKey, branch.nodeIds, this.state.mutationSequence);
		if (!evidence) throw new Error("No successful executable validation exists after the latest mutation");
		const fingerprint = await this.fingerprints.captureStable(this.cwd, true, signal);
		if (fingerprint.combined !== evidence.repositoryFingerprint) {
			throw new Error("Repository drifted after validation; validate the current state again");
		}
		let parentId = this.state.checkpointId;
		let parentHash = "GENESIS";
		let startsFreshSessionChain = false;
		if (parentId) {
			const parent = this.store.getCheckpoint(parentId);
			if (!parent) {
				throw new Error("Checkpoint ancestry parent is missing; embedded recovery context cannot grant safe authority");
			} else if (parent.sessionId !== this.identity.sessionId || parent.sessionFileKey !== this.identity.sessionFileKey) {
				// A fork/copy may recover the old state but cannot extend the old
				// session's authority. Fresh validation starts a new local chain.
				parentId = null;
				parentHash = "GENESIS";
				startsFreshSessionChain = true;
			} else {
				const verification = verifyCheckpointChain(parent.id, this.store);
				if (!verification.valid) {
					this.store.quarantineCheckpoint(parent.id, verification.reason);
					throw new Error(`Checkpoint ancestry is corrupt and was quarantined: ${verification.reason}`);
				}
				parentHash = parent.chainHash;
			}
		}
		const createdAt = Date.now();
		const id = randomUUID();
		const stateForPayload = cloneWorkState(this.state);
		if (startsFreshSessionChain) {
			stateForPayload.checkpointId = null;
			stateForPayload.checkpointAncestry = [];
		}
		const payload: CheckpointPayload = {
			version: 1,
			sessionId: this.identity.sessionId,
			sessionFileKey: this.identity.sessionFileKey,
			repositoryId: this.identity.repositoryId,
			state: stateForPayload,
			validationEvidenceId: evidence.id,
			mutationSequence: this.state.mutationSequence,
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
			...hashes,
			repositoryFingerprint: fingerprint.combined,
			validationEvidenceId: evidence.id,
			mutationSequence: this.state.mutationSequence,
			status: "verified",
			createdAt,
		};
		this.store.insertCheckpoint(record);
		this.state = this.store.mutateState(this.identity.sessionKey, branch.currentNodeId, this.state, (state) => {
			state.checkpointId = id;
			state.checkpointAncestry = startsFreshSessionChain
				? [id]
				: [id, ...state.checkpointAncestry.filter((item) => item !== id)].slice(0, 200);
		});
		return record;
	}

	async status(branch: BranchContext, signal?: AbortSignal): Promise<ContinuityStatus> {
		this.requireStarted();
		const result = (
			health: ContinuityStatus["health"],
			checkpointId: string | null,
			authority: ContinuityStatus["authority"],
			reason: string,
		): ContinuityStatus => ({ health, checkpointId, authority, reason, lineage: this.lineage(), state: this.currentState() });
		if (!this.identity.trusted) {
			return result("degraded", this.state.checkpointId, "embedded", "project untrusted; Git authority disabled");
		}
		if (this.state.mutationUncertain || this.state.mutationStatus === "uncertain") {
			return result("degraded", this.state.checkpointId, "none", "latest mutation outcome is uncertain");
		}
		const checkpointId = this.state.checkpointId;
		if (!checkpointId) return result("degraded", null, "none", "no checkpoint");
		const checkpoint = this.store.getCheckpoint(checkpointId);
		if (!checkpoint) {
			return result("degraded", checkpointId, "embedded", "checkpoint exists only as embedded recovery context");
		}
		if (checkpoint.sessionId !== this.identity.sessionId || checkpoint.sessionFileKey !== this.identity.sessionFileKey) {
			return result("degraded", checkpointId, "embedded", "copied/forked checkpoint has no safe authority in this session");
		}
		const embeddedOnBranch = branch.embeddedStates.some((item) => item.checkpointId === checkpointId);
		if (!embeddedOnBranch) {
			return result("degraded", checkpointId, "none", "checkpoint is not on the active session branch");
		}
		const chain = verifyCheckpointChain(checkpointId, this.store);
		if (!chain.valid) {
			this.store.quarantineCheckpoint(checkpointId, chain.reason);
			return result("degraded", checkpointId, "quarantined", chain.reason);
		}
		const evidence = this.store.getValidation(checkpoint.validationEvidenceId);
		if (!evidence || evidence.repositoryFingerprint !== checkpoint.repositoryFingerprint || evidence.mutationSequence !== checkpoint.mutationSequence) {
			this.store.quarantineCheckpoint(checkpointId, "validation evidence mismatch");
			return result("degraded", checkpointId, "quarantined", "validation evidence mismatch");
		}
		const fingerprint = await this.fingerprints.captureStable(this.cwd, true, signal);
		if (fingerprint.combined !== checkpoint.repositoryFingerprint) {
			return result("drifted", checkpointId, "verified", "repository changed after checkpoint");
		}
		return result("safe", checkpointId, "verified", "validation, Git fingerprint, and hash chain verified");
	}

	recover(branch: BranchContext, requestedCheckpointId?: string): WorkState {
		this.requireStarted();
		// Deliberately store-only: no Git, filesystem mutation, shell command, patch,
		// checkout, reset, stash, commit, publish, deploy, or side-effect replay.
		let recovered: WorkState | undefined;
		if (requestedCheckpointId) {
			const checkpoint = this.store.getCheckpoint(requestedCheckpointId);
			if (checkpoint && checkpoint.repositoryId === this.identity.repositoryId) recovered = payloadState(checkpoint);
		}
		if (!recovered) recovered = latestEmbedded(branch)?.state;
		if (!recovered) recovered = this.store.findNearestState(this.identity.sessionKey, branch.nodeIds);
		if (!recovered) throw new Error("No continuity state is available for recovery");
		this.state = this.store.saveState(this.identity.sessionKey, branch.currentNodeId, cloneWorkState(recovered));
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
			"Only executable validation plus the extension's Git fingerprint and checkpoint hash-chain can mark a checkpoint safe.",
			"</continuity-work-state>",
		].join("\n");
	}

	private requireStarted(): void {
		if (!this.started) throw new Error("Continuity service has not started");
	}
}
