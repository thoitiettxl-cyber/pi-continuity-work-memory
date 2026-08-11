import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type ConsolidatedBaseline, type ExtractedMemory, type MemoryConsolidationInput, type MemoryExtractionInput, type MemoryProvider, type ProviderResult } from "../application/memory-ports.js";
export declare class PiMemoryProvider implements MemoryProvider {
    private readonly context;
    constructor(context: () => ExtensionContext | undefined);
    private current;
    extract(input: MemoryExtractionInput, signal: AbortSignal): Promise<ProviderResult<ExtractedMemory[]>>;
    consolidate(input: MemoryConsolidationInput, signal: AbortSignal): Promise<ProviderResult<ConsolidatedBaseline[]>>;
}
//# sourceMappingURL=pi-memory-provider.d.ts.map