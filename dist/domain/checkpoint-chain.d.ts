import type { CheckpointRecord, WorkState } from "./types.js";
export interface CheckpointPayload {
    version: 1;
    sessionId: string;
    sessionFileKey: string;
    repositoryId: string;
    state: WorkState;
    validationEvidenceId: string;
    mutationSequence: number;
    repositoryFingerprint: string;
    createdAt: number;
}
export declare function buildCheckpointHashes(payload: CheckpointPayload, parentHash: string): {
    payloadJson: string;
    payloadHash: string;
    chainHash: string;
};
export interface ChainLookup {
    getCheckpoint(id: string): CheckpointRecord | undefined;
}
export interface ChainVerification {
    valid: boolean;
    reason: string;
    ancestry: string[];
}
export declare function verifyCheckpointChain(id: string, lookup: ChainLookup): ChainVerification;
//# sourceMappingURL=checkpoint-chain.d.ts.map