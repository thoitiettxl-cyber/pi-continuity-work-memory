import { emptyWorkflowProjection, type WorkflowProjection } from "./managed-workflow.js";

export const CONTINUITY_STATE_SCHEMA_VERSION = 2;
export const CONTINUITY_DATABASE_SCHEMA_VERSION = 2;
export const MEMORY_DATABASE_SCHEMA_VERSION = 3;
export const CONTINUITY_SCHEMA_VERSION = CONTINUITY_STATE_SCHEMA_VERSION;
export const MEMORY_SCHEMA_VERSION = 1;

export type CheckpointAuthority = "none" | "verified" | "embedded" | "legacy" | "quarantined";
export type ContinuityHealth = "safe" | "drifted" | "degraded" | "unavailable";
export type MutationStatus = "none" | "pending" | "determined" | "uncertain";
export type MemoryScope = "global-user" | "repository" | "work-item" | "session";
export type MemoryKind = "preference" | "constraint" | "lesson" | "fact";
export const MEMORY_KINDS = ["preference", "constraint", "lesson", "fact"] as const;

export function isMemoryKind(value: unknown): value is MemoryKind {
	return typeof value === "string" && (MEMORY_KINDS as readonly string[]).includes(value);
}
export type MutationConsequence = "none" | "local" | "external";
export type ReconciliationOutcome = "applied" | "not_applied" | "partially_applied";

export interface PlanStep {
	id: string;
	text: string;
	status: "pending" | "in_progress" | "completed";
}

export interface ValidationEvidence {
	id: string;
	receiptVersion: 1 | null;
	sessionKey: string;
	nodeId: string;
	command: string;
	commandDigest: string;
	exitCode: number;
	startedAt: number;
	finishedAt: number;
	mutationSequence: number;
	preRepositoryFingerprint: string | null;
	postRepositoryFingerprint: string | null;
	repositoryFingerprint: string;
	operationLedgerDigest: string | null;
	outputDigest: string;
	provider: "observed-tool" | "continuity-validate";
	receiptDigest: string | null;
}

export interface OperationReconciliation {
	id: string;
	toolCallId: string;
	revision: number;
	outcome: ReconciliationOutcome;
	note: string;
	noteDigest: string;
	recordDigest: string;
	actor: "human-command";
	sessionKey: string;
	nodeId: string;
	createdAt: number;
	integrityValid: boolean;
}

export interface TrackedOperation {
	toolCallId: string;
	operationKey: string | null;
	nodeId: string;
	sequence: number;
	toolName: string;
	kind: "mutation" | "validation";
	consequence: MutationConsequence;
	inputDigest: string;
	preFingerprint: string | null;
	preOperationLedgerDigest: string | null;
	command: string | null;
	commandDigest: string | null;
	status: "pending" | "determined" | "uncertain";
	isError: boolean | null;
	resultDigest: string | null;
	createdAt: number;
	resolvedAt: number | null;
	reconciliation: OperationReconciliation | null;
}

export interface UnresolvedOperation {
	toolCallId: string;
	operationKey: string | null;
	toolName: string;
	consequence: MutationConsequence;
	command: string | null;
	status: "pending" | "uncertain";
	createdAt: number;
}

export interface WorkState {
	schemaVersion: number;
	goal: string;
	workItemId: string;
	plan: PlanStep[];
	currentStepId: string | null;
	nextActions: string[];
	completedWork: string[];
	decisions: string[];
	blockers: string[];
	constraints: string[];
	workflow: WorkflowProjection;
	validationEvidence: ValidationEvidence[];
	checkpointId: string | null;
	checkpointAncestry: string[];
	mutationSequence: number;
	mutationStatus: MutationStatus;
	mutationUncertain: boolean;
	updatedAt: number;
}

export interface SessionIdentity {
	sessionId: string;
	sessionFileKey: string;
	sessionKey: string;
	parentSessionKey: string | null;
	repositoryId: string;
	trusted: boolean;
}

export interface SessionLineage {
	sessionId: string;
	sessionFileKey: string;
	sessionKey: string;
	parentSessionKey: string | null;
	repositoryId: string;
}

export interface EmbeddedState {
	schemaVersion: number;
	sessionId: string;
	repositoryId: string;
	state: WorkState;
	checkpointId: string | null;
	checkpointHash: string | null;
	authority: "embedded";
	createdAt: number;
}

export interface RepositoryFingerprint {
	version: 1;
	repositoryRoot: string;
	head: string;
	branch: string;
	statusDigest: string;
	indexDigest: string;
	worktreeDigest: string;
	untrackedDigest: string;
	combined: string;
	capturedAt: number;
}

export interface CheckpointRecord {
	id: string;
	sessionKey: string;
	sessionId: string;
	sessionFileKey: string;
	repositoryId: string;
	parentId: string | null;
	parentHash: string;
	payloadVersion: 1 | 2;
	payloadJson: string;
	payloadHash: string;
	chainHash: string;
	repositoryFingerprint: string;
	validationEvidenceId: string;
	validationReceiptDigest: string | null;
	operationLedgerDigest: string | null;
	mutationSequence: number;
	status: "provisional" | "verified" | "quarantined";
	createdAt: number;
}

export interface ContinuityStatus {
	health: ContinuityHealth;
	checkpointId: string | null;
	authority: CheckpointAuthority;
	reason: string;
	lineage: SessionLineage;
	state: WorkState;
	unresolvedOperations: UnresolvedOperation[];
}

export interface MemoryRecord {
	id: string;
	scope: MemoryScope;
	scopeKey: string;
	kind: MemoryKind;
	content: string;
	citation: string;
	sourceSessionKey: string;
	sourceHash: string;
	usageCount: number;
	createdAt: number;
	updatedAt: number;
}

export interface PublishedBaseline {
	id: string;
	scope: MemoryScope;
	scopeKey: string;
	content: string;
	sourceGeneration: string;
	createdAt: number;
}

export interface PipelineUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	cost: number;
}

export interface PipelineRunResult {
	runId: string;
	status: "published" | "deferred" | "superseded" | "failed" | "skipped";
	stage1Records: number;
	stage2Baselines: number;
	usage: PipelineUsage;
	reason: string;
}

export function emptyWorkState(now = Date.now()): WorkState {
	return {
		schemaVersion: CONTINUITY_SCHEMA_VERSION,
		goal: "",
		workItemId: "default",
		plan: [],
		currentStepId: null,
		nextActions: [],
		completedWork: [],
		decisions: [],
		blockers: [],
		constraints: [],
		workflow: emptyWorkflowProjection(now),
		validationEvidence: [],
		checkpointId: null,
		checkpointAncestry: [],
		mutationSequence: 0,
		mutationStatus: "none",
		mutationUncertain: false,
		updatedAt: now,
	};
}

export function migrateWorkState(value: unknown, now = Date.now()): WorkState {
	if (!value || typeof value !== "object") return emptyWorkState(now);
	const candidate = value as Partial<WorkState> & { schemaVersion?: number };
	if (candidate.schemaVersion !== 1 && candidate.schemaVersion !== CONTINUITY_STATE_SCHEMA_VERSION) {
		throw new Error(`Unsupported Continuity WorkState schema version: ${String(candidate.schemaVersion)}`);
	}
	const base = emptyWorkState(typeof candidate.updatedAt === "number" ? candidate.updatedAt : now);
	return {
		...base,
		...structuredClone(candidate),
		schemaVersion: CONTINUITY_STATE_SCHEMA_VERSION,
		workflow: candidate.schemaVersion === CONTINUITY_STATE_SCHEMA_VERSION && candidate.workflow
			? { ...emptyWorkflowProjection(base.updatedAt), ...structuredClone(candidate.workflow) }
			: emptyWorkflowProjection(base.updatedAt, "advisory"),
	} as WorkState;
}

export function cloneWorkState(state: WorkState): WorkState {
	return structuredClone(state);
}
