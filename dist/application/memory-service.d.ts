import type { MemoryRecord, MemoryScope, PipelineRunResult, SessionIdentity, WorkState } from "../domain/types.js";
import { MemoryStore, type ScopeSelector } from "../infrastructure/memory-store.js";
import { type MemoryProvider } from "./memory-ports.js";
export interface SessionMemorySource {
    text: string;
    hash: string;
    citation: string;
}
export interface PipelineGuards {
    isCurrentGeneration(): boolean;
    currentSourceHash(): string;
}
export declare class MemoryService {
    readonly identity: SessionIdentity;
    private readonly state;
    private readonly store;
    private readonly owner;
    constructor(identity: SessionIdentity, state: () => WorkState, store: MemoryStore);
    selectors(): ScopeSelector[];
    private keyForScope;
    allowedExtractionScopes(): MemoryScope[];
    add(content: string, scope: MemoryScope, origin: "user-command" | "agent-tool", citation?: string): MemoryRecord;
    list(limit?: number): MemoryRecord[];
    read(id: string): MemoryRecord | undefined;
    search(query: string, limit?: number): MemoryRecord[];
    recordCitations(text: string): number;
    contextPrompt(): string;
    runPipeline(source: SessionMemorySource, generation: string, provider: MemoryProvider | undefined, guards: PipelineGuards, signal: AbortSignal): Promise<PipelineRunResult>;
    latestRun(): PipelineRunResult | undefined;
    reset(): void;
}
//# sourceMappingURL=memory-service.d.ts.map