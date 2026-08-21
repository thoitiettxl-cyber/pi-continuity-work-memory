import { existsSync } from "node:fs";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { sha256 } from "../domain/canonical.js";

export interface WorkflowAssetManifestEntry {
	path: string;
	sha256: string;
}

export interface WorkflowAssetManifest {
	schemaVersion: 1;
	algorithm: "sha256";
	assets: WorkflowAssetManifestEntry[];
}

export interface WorkflowAssetBundle {
	root: string;
	manifest: WorkflowAssetManifest;
	assets: Readonly<Record<string, string>>;
}

export class WorkflowAssetIntegrityError extends Error {}

function defaultWorkflowRoot(): string {
	const adjacent = resolve(import.meta.dirname, "..", "..", "workflow");
	if (existsSync(adjacent)) return adjacent;
	const compiledTest = resolve(import.meta.dirname, "..", "..", "..", "workflow");
	if (existsSync(compiledTest)) return compiledTest;
	return adjacent;
}

function requireAssetPath(candidate: unknown): string {
	if (typeof candidate !== "string" || !candidate || candidate.includes("\0") || isAbsolute(candidate)) {
		throw new WorkflowAssetIntegrityError("Workflow manifest contains an unsafe asset path");
	}
	const segments = candidate.split("/");
	if (candidate.includes("\\") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
		throw new WorkflowAssetIntegrityError(`Workflow manifest contains an unsafe asset path: ${candidate}`);
	}
	return candidate;
}

function compareAssetPath(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function parseManifest(value: unknown): WorkflowAssetManifest {
	if (!value || typeof value !== "object") throw new WorkflowAssetIntegrityError("Workflow manifest must be an object");
	const candidate = value as Record<string, unknown>;
	if (candidate.schemaVersion !== 1 || candidate.algorithm !== "sha256" || !Array.isArray(candidate.assets)) {
		throw new WorkflowAssetIntegrityError("Workflow manifest schema or algorithm is unsupported");
	}
	const assets = candidate.assets.map((entry): WorkflowAssetManifestEntry => {
		if (!entry || typeof entry !== "object") throw new WorkflowAssetIntegrityError("Workflow manifest entry must be an object");
		const item = entry as Record<string, unknown>;
		const path = requireAssetPath(item.path);
		if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)) {
			throw new WorkflowAssetIntegrityError(`Workflow manifest checksum is invalid for ${path}`);
		}
		return { path, sha256: item.sha256 };
	});
	const paths = assets.map((entry) => entry.path);
	if (new Set(paths).size !== paths.length) throw new WorkflowAssetIntegrityError("Workflow manifest contains duplicate asset paths");
	if (paths.some((path, index) => index > 0 && compareAssetPath(paths[index - 1]!, path) >= 0)) {
		throw new WorkflowAssetIntegrityError("Workflow manifest assets must be sorted by path");
	}
	return { schemaVersion: 1, algorithm: "sha256", assets };
}

function assertConfined(root: string, candidate: string): void {
	const fromRoot = relative(root, candidate);
	if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
		throw new WorkflowAssetIntegrityError("Workflow asset escapes its package root");
	}
}

async function collectAssetPaths(root: string, directory = root): Promise<string[]> {
	const paths: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new WorkflowAssetIntegrityError(`Workflow assets must not contain symlinks: ${entry.name}`);
		if (entry.isDirectory()) {
			paths.push(...await collectAssetPaths(root, absolute));
			continue;
		}
		if (!entry.isFile()) throw new WorkflowAssetIntegrityError(`Workflow asset is not a regular file: ${entry.name}`);
		const path = relative(root, absolute).split(sep).join("/");
		if (path !== "manifest.json") paths.push(path);
	}
	return paths.sort(compareAssetPath);
}

export async function loadWorkflowAssets(workflowRoot = defaultWorkflowRoot()): Promise<WorkflowAssetBundle> {
	const rootMetadata = await lstat(workflowRoot);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
		throw new WorkflowAssetIntegrityError("Workflow asset root must be a real directory");
	}
	const root = await realpath(workflowRoot);
	const manifestPath = join(root, "manifest.json");
	assertConfined(root, manifestPath);
	const manifestMetadata = await lstat(manifestPath);
	if (manifestMetadata.isSymbolicLink() || !manifestMetadata.isFile()) {
		throw new WorkflowAssetIntegrityError("Workflow manifest must be a regular file");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(manifestPath, "utf8"));
	} catch (error) {
		throw new WorkflowAssetIntegrityError("Workflow manifest is not valid JSON", { cause: error });
	}
	const manifest = parseManifest(parsed);
	const inventory = await collectAssetPaths(root);
	const declared = manifest.assets.map((entry) => entry.path);
	if (inventory.length !== declared.length || inventory.some((path, index) => path !== declared[index])) {
		throw new WorkflowAssetIntegrityError("Workflow asset inventory does not match the checksum manifest");
	}
	const assets: Record<string, string> = Object.create(null) as Record<string, string>;
	for (const entry of manifest.assets) {
		const absolute = resolve(root, entry.path);
		assertConfined(root, absolute);
		const metadata = await lstat(absolute);
		if (metadata.isSymbolicLink() || !metadata.isFile()) {
			throw new WorkflowAssetIntegrityError(`Workflow asset must be a regular file: ${entry.path}`);
		}
		const canonical = await realpath(absolute);
		assertConfined(root, canonical);
		const content = await readFile(canonical);
		if (sha256(content) !== entry.sha256) {
			throw new WorkflowAssetIntegrityError(`Workflow asset checksum mismatch: ${entry.path}`);
		}
		assets[entry.path] = content.toString("utf8");
	}
	return { root, manifest, assets: Object.freeze(assets) };
}
