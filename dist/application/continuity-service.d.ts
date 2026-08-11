import { type CheckpointRecord, type ContinuityStatus, type EmbeddedState, type PlanStep, type SessionIdentity, type SessionLineage, type ValidationEvidence, type WorkState } from "../domain/types.js";
import { ContinuityStore } from "../infrastructure/continuity-store.js";
import { GitFingerprintService, type CommandResult, type CommandRunner } from "../infrastructure/git-fingerprint.js";
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
export declare class ContinuityService {
    readonly identity: SessionIdentity;
    readonly cwd: string;
    private readonly store;
    private readonly fingerprints;
    private readonly commandRunner;
    private state;
    private started;
    constructor(identity: SessionIdentity, cwd: string, store: ContinuityStore, fingerprints: GitFingerprintService, commandRunner: CommandRunner);
    initialize(branch: BranchContext): WorkState;
    reconstructBranch(branch: BranchContext): WorkState;
    currentState(): WorkState;
    lineage(): SessionLineage;
    update(patch: WorkStatePatch, branch: BranchContext): WorkState;
    observeToolCall(observation: ToolCallObservation): Promise<void>;
    observeToolResult(observation: ToolResultObservation): Promise<ValidationEvidence | undefined>;
    validate(command: string, branch: BranchContext, signal?: AbortSignal): Promise<{
        evidence?: ValidationEvidence;
        result: CommandResult;
    }>;
    private recordEvidence;
    createCheckpoint(branch: BranchContext, signal?: AbortSignal): Promise<CheckpointRecord>;
    status(branch: BranchContext, signal?: AbortSignal): Promise<ContinuityStatus>;
    recover(branch: BranchContext, requestedCheckpointId?: string): WorkState;
    embeddedState(checkpoint?: CheckpointRecord): EmbeddedState;
    contextSummary(): string;
    private requireStarted;
}
//# sourceMappingURL=continuity-service.d.ts.map