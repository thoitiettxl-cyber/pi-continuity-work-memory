export declare function canonicalJson(value: unknown): string;
export declare function sha256(value: string | Uint8Array): string;
export declare function chainedHash(parentHash: string, payloadHash: string): string;
export declare function boundedStrings(values: readonly string[] | undefined, maximum?: number): string[];
export declare function redactSecrets(value: string): string;
//# sourceMappingURL=canonical.d.ts.map