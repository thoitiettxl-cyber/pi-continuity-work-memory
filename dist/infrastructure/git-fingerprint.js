import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readlink, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonicalJson, sha256 } from "../domain/canonical.js";
export class FingerprintRaceError extends Error {
}
export class RepositoryUnavailableError extends Error {
}
async function requireSuccess(runner, cwd, args, signal) {
    const result = await runner.run("git", args, { cwd, signal, timeout: 30_000 });
    if (result.code !== 0 || result.killed) {
        throw new RepositoryUnavailableError(`git ${args.join(" ")} failed: ${result.stderr.trim() || `exit ${result.code}`}`);
    }
    return result.stdout;
}
function safeRepositoryPath(root, candidate) {
    if (!candidate || isAbsolute(candidate) || candidate.includes("\0"))
        throw new Error(`Unsafe Git path: ${candidate}`);
    const absolute = resolve(root, candidate);
    const fromRoot = relative(root, absolute);
    if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
        throw new Error(`Git path escapes repository: ${candidate}`);
    }
    return absolute;
}
async function hashFile(path) {
    const digest = createHash("sha256");
    await new Promise((resolvePromise, reject) => {
        const stream = createReadStream(path);
        stream.on("data", (chunk) => digest.update(chunk));
        stream.on("end", resolvePromise);
        stream.on("error", reject);
    });
    return digest.digest("hex");
}
async function hashUntracked(root, list) {
    const digest = createHash("sha256");
    const paths = list.split("\0").filter(Boolean).sort();
    for (const path of paths) {
        const absolute = safeRepositoryPath(root, path);
        const metadata = await lstat(absolute);
        digest.update(path);
        digest.update("\0");
        digest.update(String(metadata.mode));
        digest.update("\0");
        if (metadata.isSymbolicLink()) {
            digest.update("symlink\0");
            digest.update(await readlink(absolute));
        }
        else if (metadata.isFile()) {
            digest.update("file\0");
            digest.update(await hashFile(absolute));
        }
        else {
            digest.update(`other:${metadata.size}`);
        }
        digest.update("\0");
    }
    return digest.digest("hex");
}
export class GitFingerprintService {
    runner;
    constructor(runner) {
        this.runner = runner;
    }
    async repositoryRoot(cwd, trusted, signal) {
        if (!trusted)
            throw new RepositoryUnavailableError("Project is untrusted; Git access is disabled");
        const output = await requireSuccess(this.runner, cwd, ["rev-parse", "--show-toplevel"], signal);
        return realpath(output.trim());
    }
    async capture(cwd, trusted, signal) {
        if (!trusted)
            throw new RepositoryUnavailableError("Project is untrusted; Git access is disabled");
        const repositoryRoot = await this.repositoryRoot(cwd, trusted, signal);
        const [headOutput, branchOutput, status, indexDiff, worktreeDiff, untracked] = await Promise.all([
            requireSuccess(this.runner, repositoryRoot, ["rev-parse", "--verify", "HEAD"], signal).catch(() => "UNBORN\n"),
            requireSuccess(this.runner, repositoryRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], signal).catch(() => "DETACHED\n"),
            requireSuccess(this.runner, repositoryRoot, ["status", "--porcelain=v2", "-z", "--untracked-files=all"], signal),
            requireSuccess(this.runner, repositoryRoot, ["diff", "--no-ext-diff", "--binary", "--cached", "--"], signal),
            requireSuccess(this.runner, repositoryRoot, ["diff", "--no-ext-diff", "--binary", "--"], signal),
            requireSuccess(this.runner, repositoryRoot, ["ls-files", "--others", "--exclude-standard", "-z"], signal),
        ]);
        const fingerprint = {
            version: 1,
            repositoryRoot,
            head: headOutput.trim(),
            branch: branchOutput.trim(),
            statusDigest: sha256(status),
            indexDigest: sha256(indexDiff),
            worktreeDigest: sha256(worktreeDiff),
            untrackedDigest: await hashUntracked(repositoryRoot, untracked),
            capturedAt: Date.now(),
        };
        const combined = sha256(canonicalJson({ ...fingerprint, capturedAt: 0 }));
        return { ...fingerprint, combined };
    }
    async captureStable(cwd, trusted, signal) {
        const first = await this.capture(cwd, trusted, signal);
        const second = await this.capture(cwd, trusted, signal);
        if (first.combined !== second.combined) {
            throw new FingerprintRaceError("Repository changed while collecting the Git fingerprint");
        }
        return second;
    }
}
export function repositoryIdForRoot(root) {
    return `repo:${sha256(root)}`;
}
export function workspaceId(cwd) {
    return `workspace:${sha256(resolve(cwd))}`;
}
//# sourceMappingURL=git-fingerprint.js.map