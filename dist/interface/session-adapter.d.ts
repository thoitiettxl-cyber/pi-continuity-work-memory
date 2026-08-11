import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { BranchContext } from "../application/continuity-service.js";
import type { SessionMemorySource } from "../application/memory-service.js";
export declare const CONTINUITY_ENTRY_TYPE = "pi-continuity-state-v1";
export declare function branchContext(ctx: ExtensionContext): BranchContext;
export declare function memorySource(ctx: ExtensionContext): SessionMemorySource;
export declare function sessionFileKey(ctx: ExtensionContext): string;
export declare function sessionKey(ctx: ExtensionContext): string;
//# sourceMappingURL=session-adapter.d.ts.map