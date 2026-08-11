import type { MemoryRecord, MemoryScope, PipelineRunResult, PipelineUsage, PublishedBaseline } from "../domain/types.js";
import { DurableSqlite } from "./sqlite.js";
export interface ScopeSelector {
    scope: MemoryScope;
    scopeKey: string;
}
export interface PipelineLease {
    runId: string;
    owner: string;
    sessionKey: string;
    sourceHash: string;
    generation: string;
    leaseUntil: number;
}
export interface PendingMemoryInput {
    id: string;
    scope: MemoryScope;
    scopeKey: string;
    content: string;
    citation: string;
}
export interface BaselineInput {
    id: string;
    scope: MemoryScope;
    scopeKey: string;
    content: string;
}
export declare class MemoryStore {
    readonly db: DurableSqlite;
    constructor(path: string);
    private migrate;
    claimPipeline(sessionKey: string, sourceHash: string, generation: string, owner: string, now?: number, leaseMs?: number): PipelineLease | undefined;
    heartbeat(lease: PipelineLease, now?: number, leaseMs?: number): boolean;
    stage1(lease: PipelineLease, inputs: readonly PendingMemoryInput[], usage: PipelineUsage, now?: number): boolean;
    publish(lease: PipelineLease, baselines: readonly BaselineInput[], usage: PipelineUsage, now?: number): boolean;
    finish(lease: PipelineLease, status: "deferred" | "superseded" | "failed", reason: string, now?: number): void;
    addPublished(input: Omit<MemoryRecord, "usageCount" | "createdAt" | "updatedAt">, now?: number): MemoryRecord;
    list(selectors: readonly ScopeSelector[], limit?: number): MemoryRecord[];
    read(id: string, selectors: readonly ScopeSelector[]): MemoryRecord | undefined;
    search(query: string, selectors: readonly ScopeSelector[], limit?: number): MemoryRecord[];
    publishedBaselines(selectors: readonly ScopeSelector[]): PublishedBaseline[];
    recordCitations(memoryIds: readonly string[], sessionKey: string, now?: number): number;
    latestRun(sessionKey: string): PipelineRunResult | undefined;
    reset(): void;
    close(): void;
}
//# sourceMappingURL=memory-store.d.ts.map