import type { MemoryScope, PipelineUsage } from "../domain/types.js";

export interface ExtractedMemory {
	scope: MemoryScope;
	content: string;
	citation: string;
}

export interface ConsolidatedBaseline {
	scope: MemoryScope;
	content: string;
}

export interface MemoryExtractionInput {
	sourceText: string;
	allowedScopes: MemoryScope[];
	workItemId: string;
	repositoryId: string;
	sessionKey: string;
}

export interface MemoryConsolidationInput {
	records: ExtractedMemory[];
	previousBaselines: Array<{ scope: MemoryScope; content: string }>;
	allowedScopes: MemoryScope[];
}

export interface ProviderResult<T> {
	value: T;
	usage: PipelineUsage;
}

export interface MemoryProvider {
	extract(input: MemoryExtractionInput, signal: AbortSignal): Promise<ProviderResult<ExtractedMemory[]>>;
	consolidate(input: MemoryConsolidationInput, signal: AbortSignal): Promise<ProviderResult<ConsolidatedBaseline[]>>;
}

export class MemoryProviderDeferredError extends Error {}
