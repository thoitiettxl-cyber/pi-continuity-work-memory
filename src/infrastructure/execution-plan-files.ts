import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, realpath, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";

import { sha256 } from "../domain/canonical.js";
import type { WorkflowDocumentBinding, WorkflowDocumentStatus } from "../domain/managed-workflow.js";

export class ExecutionPlanPathError extends Error {}
export class ExecutionPlanConflictError extends Error {}
export class ExecutionPlanDigestMismatchError extends Error {}
export class ExecutionPlanFinalizeError extends Error {}
export class ExecutionPlanNotReadyError extends Error {}

export interface ExecutionPlanFileBinding extends WorkflowDocumentBinding {
	kind: "execution-plan";
	absolutePath: string;
	size: number;
}

export interface FinalizedExecutionPlan {
	previous: ExecutionPlanFileBinding;
	current: ExecutionPlanFileBinding;
	validationRequired: true;
	notice: string;
}

function errorCode(error: unknown): string | undefined {
	return error instanceof Error && "code" in error ? String(error.code) : undefined;
}

function validateRelativePlanPath(candidate: string, status: WorkflowDocumentStatus): string {
	if (!candidate || candidate.includes("\0") || candidate.includes("\\") || isAbsolute(candidate)) {
		throw new ExecutionPlanPathError("Execution plan path must be a safe repository-relative path");
	}
	const segments = candidate.split("/");
	if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
		throw new ExecutionPlanPathError("Execution plan path must not contain empty, dot, or traversal segments");
	}
	if (
		segments.length !== 4 ||
		segments[0] !== "docs" ||
		segments[1] !== "plans" ||
		segments[2] !== status ||
		!segments[3]!.endsWith(".md") ||
		segments[3] === ".md"
	) {
		throw new ExecutionPlanPathError(`Execution plan must be an explicit Markdown file under docs/plans/${status}/`);
	}
	return segments.join("/");
}

function assertConfined(root: string, candidate: string): void {
	const fromRoot = relative(root, candidate);
	if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
		throw new ExecutionPlanPathError("Execution plan path escapes the repository root");
	}
}

function documentMetadata(content: Buffer, relativePath: string): { workItemId: string; templateVersion: number | null } {
	const text = content.toString("utf8", 0, Math.min(content.byteLength, 2_000));
	const match = /^<!-- pi-continuity-work-document: (\{[^\n]+\}) -->/m.exec(text);
	if (!match) {
		const logicalPath = relativePath.replace(/^docs\/plans\/(?:active|completed)\//, "docs/plans/");
		return { workItemId: `plan:${sha256(logicalPath)}`, templateVersion: null };
	}
	let value: unknown;
	try {
		value = JSON.parse(match[1]!);
	} catch (error) {
		throw new ExecutionPlanPathError(`Execution plan metadata is malformed: ${relativePath}`, { cause: error });
	}
	if (!value || typeof value !== "object") throw new ExecutionPlanPathError(`Execution plan metadata is invalid: ${relativePath}`);
	const metadata = value as Record<string, unknown>;
	if (metadata.schemaVersion !== 1 || metadata.kind !== "execution-plan"
		|| typeof metadata.workItemId !== "string" || !/^[0-9a-f-]{36}$/i.test(metadata.workItemId)
		|| metadata.templateVersion !== 1) {
		throw new ExecutionPlanPathError(`Execution plan metadata is unsupported: ${relativePath}`);
	}
	return { workItemId: metadata.workItemId.toLowerCase(), templateVersion: 1 };
}

function assertReadyForFinalization(content: string, relativePath: string): void {
	const status = /## Status\s+([^\n]+)/i.exec(content)?.[1]?.trim().toLowerCase();
	const result = /## Result\s+([\s\S]*)$/i.exec(content)?.[1]?.trim();
	if (status !== "ready for completion" && status !== "completed") {
		throw new ExecutionPlanNotReadyError(`Execution plan status must be Ready for completion before finalization: ${relativePath}`);
	}
	if (!result || /^pending(?: implementation and executable proof)?\.?$/i.test(result)) {
		throw new ExecutionPlanNotReadyError(`Execution plan Result must record the observed outcome before finalization: ${relativePath}`);
	}
}

async function withMutationQueues<T>(paths: readonly string[], operation: () => Promise<T>, index = 0): Promise<T> {
	if (index >= paths.length) return operation();
	return withFileMutationQueue(paths[index]!, () => withMutationQueues(paths, operation, index + 1));
}

export class ExecutionPlanFileService {
	private constructor(private readonly root: string) {}

	static async open(repositoryRoot: string): Promise<ExecutionPlanFileService> {
		const root = await realpath(repositoryRoot);
		const metadata = await lstat(root);
		if (!metadata.isDirectory()) throw new ExecutionPlanPathError("Repository root must be a directory");
		return new ExecutionPlanFileService(root);
	}

	private absolute(relativePath: string): string {
		const absolute = resolve(this.root, relativePath);
		assertConfined(this.root, absolute);
		return absolute;
	}

	private async prepareDirectory(status: WorkflowDocumentStatus, create: boolean): Promise<string> {
		let current = this.root;
		for (const segment of ["docs", "plans", status]) {
			current = join(current, segment);
			if (create) {
				try {
					await mkdir(current, { mode: 0o755 });
				} catch (error) {
					if (errorCode(error) !== "EEXIST") throw error;
				}
			}
			let metadata;
			try {
				metadata = await lstat(current);
			} catch (error) {
				if (errorCode(error) === "ENOENT") {
					throw new ExecutionPlanPathError(`Execution plan directory does not exist: ${relative(this.root, current)}`);
				}
				throw error;
			}
			if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
				throw new ExecutionPlanPathError(`Execution plan directory is not a real directory: ${relative(this.root, current)}`);
			}
			const canonical = await realpath(current);
			assertConfined(this.root, canonical);
			if (canonical !== current) throw new ExecutionPlanPathError("Execution plan directory resolves through an unsafe alias");
		}
		return current;
	}

	private async existingBinding(relativePath: string, status: WorkflowDocumentStatus): Promise<ExecutionPlanFileBinding> {
		const safePath = validateRelativePlanPath(relativePath, status);
		await this.prepareDirectory(status, false);
		const absolutePath = this.absolute(safePath);
		let metadata;
		try {
			metadata = await lstat(absolutePath);
		} catch (error) {
			if (errorCode(error) === "ENOENT") throw new ExecutionPlanPathError(`Execution plan does not exist: ${safePath}`);
			throw error;
		}
		if (metadata.isSymbolicLink() || !metadata.isFile()) {
			throw new ExecutionPlanPathError(`Execution plan must be a regular file and not a symlink: ${safePath}`);
		}
		const canonical = await realpath(absolutePath);
		assertConfined(this.root, canonical);
		if (canonical !== absolutePath) throw new ExecutionPlanPathError("Execution plan resolves through an unsafe alias");
		const content = await readFile(canonical);
		const document = documentMetadata(content, safePath);
		return {
			kind: "execution-plan",
			status,
			workItemId: document.workItemId,
			relativePath: safePath,
			templateVersion: document.templateVersion,
			absolutePath,
			digest: sha256(content),
			size: content.byteLength,
		};
	}

	async createExecutionPlan(relativePath: string, content: string): Promise<ExecutionPlanFileBinding> {
		const safePath = validateRelativePlanPath(relativePath, "active");
		if (!content.trim()) throw new Error("Execution plan content must not be empty");
		const absolutePath = this.absolute(safePath);
		return withFileMutationQueue(absolutePath, async () => {
			await this.prepareDirectory("active", true);
			try {
				const metadata = await lstat(absolutePath);
				if (metadata.isSymbolicLink()) throw new ExecutionPlanPathError(`Execution plan target is a symlink: ${safePath}`);
				throw new ExecutionPlanConflictError(`Execution plan already exists: ${safePath}`);
			} catch (error) {
				if (errorCode(error) !== "ENOENT") throw error;
			}
			let created = false;
			try {
				const handle = await open(
					absolutePath,
					constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
					0o644,
				);
				created = true;
				try {
					await handle.writeFile(content, "utf8");
					await handle.sync();
				} finally {
					await handle.close();
				}
			} catch (error) {
				if (created) await unlink(absolutePath).catch(() => undefined);
				if (errorCode(error) === "EEXIST") throw new ExecutionPlanConflictError(`Execution plan already exists: ${safePath}`);
				throw error;
			}
			return this.existingBinding(safePath, "active");
		});
	}

	async bindExecutionPlan(relativePath: string, expectedDigest?: string): Promise<ExecutionPlanFileBinding> {
		const status = relativePath.startsWith("docs/plans/completed/") ? "completed" : "active";
		const binding = await this.existingBinding(relativePath, status);
		if (expectedDigest !== undefined && binding.digest !== expectedDigest) {
			throw new ExecutionPlanDigestMismatchError(`Execution plan digest does not match the expected value: ${binding.relativePath}`);
		}
		return binding;
	}

	async finalizeExecutionPlan(relativePath: string, expectedDigest?: string, expectedWorkItemId?: string): Promise<FinalizedExecutionPlan> {
		const safePath = validateRelativePlanPath(relativePath, "active");
		const completedPath = `docs/plans/completed/${safePath.slice("docs/plans/active/".length)}`;
		validateRelativePlanPath(completedPath, "completed");
		const source = this.absolute(safePath);
		const destination = this.absolute(completedPath);
		const queuePaths = [...new Set([source, destination])].sort((left, right) => left.localeCompare(right));
		const assertExpected = (binding: ExecutionPlanFileBinding): void => {
			if (expectedDigest !== undefined && binding.digest !== expectedDigest) {
				throw new ExecutionPlanDigestMismatchError(`Execution plan changed after it was bound: ${binding.relativePath}`);
			}
			if (expectedWorkItemId !== undefined && binding.workItemId !== expectedWorkItemId) {
				throw new ExecutionPlanDigestMismatchError(`Execution plan identity changed after it was bound: ${binding.relativePath}`);
			}
		};
		const result = (previous: ExecutionPlanFileBinding, current: ExecutionPlanFileBinding, recovered: boolean): FinalizedExecutionPlan => ({
			previous,
			current,
			validationRequired: true,
			notice: recovered
				? "Recovered an interrupted same-identity plan move without claiming validation or completion. Fresh executable or observable validation is required."
				: "The plan was moved without claiming validation or completion. Fresh executable or observable validation is required.",
		});
		return withMutationQueues(queuePaths, async () => {
			let sourceExists = true;
			try {
				await lstat(source);
			} catch (error) {
				if (errorCode(error) === "ENOENT") sourceExists = false;
				else throw error;
			}
			if (!sourceExists) {
				const current = await this.existingBinding(completedPath, "completed");
				assertExpected(current);
				assertReadyForFinalization(await readFile(destination, "utf8"), completedPath);
				const previous = { ...current, status: "active" as const, relativePath: safePath, absolutePath: source };
				return result(previous, current, true);
			}

			const previous = await this.existingBinding(safePath, "active");
			assertExpected(previous);
			assertReadyForFinalization(await readFile(source, "utf8"), safePath);
			await this.prepareDirectory("completed", true);
			let completed: ExecutionPlanFileBinding | undefined;
			try {
				completed = await this.existingBinding(completedPath, "completed");
			} catch (error) {
				if (!(error instanceof ExecutionPlanPathError) || !/does not exist/.test(error.message)) throw error;
			}
			if (completed) {
				if (completed.digest !== previous.digest || completed.workItemId !== previous.workItemId) {
					throw new ExecutionPlanConflictError(`Completed execution plan already exists with different content or identity: ${completedPath}`);
				}
				await unlink(source);
				return result(previous, completed, true);
			}
			try {
				await link(source, destination);
			} catch (error) {
				if (errorCode(error) === "EEXIST") throw new ExecutionPlanConflictError(`Completed execution plan already exists: ${completedPath}`);
				throw error;
			}
			try {
				await unlink(source);
			} catch (error) {
				try {
					await unlink(destination);
				} catch (rollbackError) {
					throw new ExecutionPlanFinalizeError("Execution plan finalization is uncertain because rollback failed", {
						cause: new AggregateError([error, rollbackError]),
					});
				}
				throw new ExecutionPlanFinalizeError("Execution plan finalization failed; the active plan was preserved", { cause: error });
			}
			const current = await this.existingBinding(completedPath, "completed");
			return result(previous, current, false);
		});
	}
}
