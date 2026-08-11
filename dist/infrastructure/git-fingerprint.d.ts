import type { RepositoryFingerprint } from "../domain/types.js";
export interface CommandResult {
    stdout: string;
    stderr: string;
    code: number;
    killed?: boolean;
}
export interface CommandRunner {
    run(command: string, args: string[], options: {
        cwd: string;
        signal?: AbortSignal | undefined;
        timeout?: number;
    }): Promise<CommandResult>;
}
export declare class FingerprintRaceError extends Error {
}
export declare class RepositoryUnavailableError extends Error {
}
export declare class GitFingerprintService {
    private readonly runner;
    constructor(runner: CommandRunner);
    repositoryRoot(cwd: string, trusted: boolean, signal?: AbortSignal): Promise<string>;
    capture(cwd: string, trusted: boolean, signal?: AbortSignal): Promise<RepositoryFingerprint>;
    captureStable(cwd: string, trusted: boolean, signal?: AbortSignal): Promise<RepositoryFingerprint>;
}
export declare function repositoryIdForRoot(root: string): string;
export declare function workspaceId(cwd: string): string;
//# sourceMappingURL=git-fingerprint.d.ts.map