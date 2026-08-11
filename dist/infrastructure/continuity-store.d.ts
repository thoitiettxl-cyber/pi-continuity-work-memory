import type { CheckpointRecord, SessionIdentity, ValidationEvidence, WorkState } from "../domain/types.js";
import { DurableSqlite } from "./sqlite.js";
export interface PendingMutation {
    toolCallId: string;
    nodeId: string;
    sequence: number;
    toolName: string;
    kind: "mutation" | "validation";
    preFingerprint: string | null;
    command: string | null;
    status: "pending" | "determined" | "uncertain";
    createdAt: number;
}
export declare class ContinuityStore {
    readonly db: DurableSqlite;
    constructor(path: string);
    private migrate;
    registerSession(identity: SessionIdentity, now?: number): void;
    mutateState(sessionKey: string, nodeId: string, inherited: WorkState, mutator: (state: WorkState) => void, now?: number): WorkState;
    saveState(sessionKey: string, nodeId: string, state: WorkState, now?: number): WorkState;
    findNearestState(sessionKey: string, branchNodeIds: readonly string[]): WorkState | undefined;
    beginTrackedCall(input: {
        toolCallId: string;
        sessionKey: string;
        nodeId: string;
        toolName: string;
        kind: "mutation" | "validation";
        inputDigest: string;
        command: string | null;
        preFingerprint: string | null;
        state: WorkState;
        now?: number;
    }): WorkState;
    resolveTrackedCall(toolCallId: string, isError: boolean, resultDigest: string, now?: number): PendingMutation | undefined;
    markPendingUncertain(sessionKey: string, branchNodeIds: readonly string[], now?: number): number[];
    pendingForBranch(sessionKey: string, branchNodeIds: readonly string[]): PendingMutation[];
    getTrackedCall(toolCallId: string): PendingMutation | undefined;
    private rowToPending;
    recordValidation(sessionKey: string, nodeId: string, evidence: ValidationEvidence): void;
    getValidation(id: string): ValidationEvidence | undefined;
    latestValidation(sessionKey: string, branchNodeIds: readonly string[], mutationSequence: number): ValidationEvidence | undefined;
    private rowToEvidence;
    insertCheckpoint(record: CheckpointRecord): void;
    getCheckpoint(id: string): CheckpointRecord | undefined;
    quarantineCheckpoint(id: string, reason: string): void;
    recordForkIntent(sourceSessionKey: string, sourceSessionFile: string, targetEntryId: string, position: string): string;
    consumeForkIntent(previousSessionFile: string, childSessionKey: string): {
        sourceSessionKey: string;
        targetEntryId: string;
    } | undefined;
    close(): void;
}
//# sourceMappingURL=continuity-store.d.ts.map