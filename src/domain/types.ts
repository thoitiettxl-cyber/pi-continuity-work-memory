export const CONTINUITY_SCHEMA_VERSION = 1;
export const MEMORY_SCHEMA_VERSION = 1;

export type CheckpointAuthority = "none" | "verified" | "embedded" | "quarantined";
export type ContinuityHealth = "safe" | "drifted" | "degraded" | "unavailable";
export type MutationStatus = "none" | "pending" | "determined" | "uncertain";
export type MemoryScope = "global-user" | "repository" | "work-item" | "session";

export interface PlanStep {
	id: string;
	text: string;
	status: "pending" | "in_progress" | "completed";
}

export interface ValidationEvidence {
	id: string;
	command: string;
	exitCode: number;
	startedAt: number;
	finishedAt: number;
	mutationSequence: number;
	repositoryFingerprint: string;
	outputDigest: string;
	provider: "observed-tool" | "continuity-validate";
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
	payloadJson: string;
	payloadHash: string;
	chainHash: string;
	repositoryFingerprint: string;
	validationEvidenceId: string;
	mutationSequence: number;
	status: "verified" | "quarantined";
	createdAt: number;
}

export interface ContinuityStatus {
	health: ContinuityHealth;
	checkpointId: string | null;
	authority: CheckpointAuthority;
	reason: string;
	lineage: SessionLineage;
	state: WorkState;
}

export interface MemoryRecord {
	id: string;
	scope: MemoryScope;
	scopeKey: string;
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
	status: "published" | "deferred" | "superseded" | "failed";
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
		validationEvidence: [],
		checkpointId: null,
		checkpointAncestry: [],
		mutationSequence: 0,
		mutationStatus: "none",
		mutationUncertain: false,
		updatedAt: now,
	};
}

export function cloneWorkState(state: WorkState): WorkState {
	return structuredClone(state);
}
