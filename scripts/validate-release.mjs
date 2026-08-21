import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, resolve, relative, sep } from "node:path";

import { SUPPORTED_PI_RANGE, assertSupportedPiVersion } from "./pi-version.mjs";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const failures = [];
const piCandidate = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "pi.cmd" : "pi");
const pi = process.env.PI_VALIDATION_PI || (existsSync(piCandidate) ? piCandidate : "pi");
const piResult = spawnSync(pi, ["--version"], { encoding: "utf8", timeout: 30_000 });
let piVersion = "unavailable";
if (piResult.status !== 0) failures.push(`Pi version check failed: ${piResult.stderr || piResult.stdout}`);
else {
	try {
		piVersion = assertSupportedPiVersion(piResult.stdout);
	} catch (error) {
		failures.push(error instanceof Error ? error.message : String(error));
	}
}

function walk(path) {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const full = resolve(path, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

if (manifest.engines?.node !== ">=22.19.0") failures.push("Node engine must be >=22.19.0");
if (manifest.peerDependencies?.["@earendil-works/pi-coding-agent"] !== SUPPORTED_PI_RANGE) failures.push(`Pi coding-agent peer range must be ${SUPPORTED_PI_RANGE}`);
if (manifest.peerDependencies?.["@earendil-works/pi-ai"] !== SUPPORTED_PI_RANGE) failures.push(`Pi AI peer range must be ${SUPPORTED_PI_RANGE}`);
if (manifest.dependencies && Object.keys(manifest.dependencies).length) failures.push("Runtime dependencies must remain empty");
const requiredPayload = [
	"dist",
	"workflow",
	"scripts/validate-install.mjs",
	"scripts/pi-version.mjs",
	"scripts/validate-provider.mjs",
	"scripts/validate-alpine-arm64.sh",
	"scripts/manage-user-install.mjs",
	"proof/ACCEPTANCE.md",
	"proof/RESULTS.json",
	"README.md",
	"LICENSE",
];
if (!Array.isArray(manifest.files)) failures.push("package.json files must define the release payload");
else for (const path of requiredPayload) if (!manifest.files.includes(path)) failures.push(`Release payload is missing ${path}`);
if (JSON.stringify(manifest.pi).includes("harness")) failures.push("Harness appears in Pi payload");
const workflowRoot = resolve(root, "workflow");
const workflowManifestPath = resolve(workflowRoot, "manifest.json");
let workflowAssetCount = 0;
if (!existsSync(workflowManifestPath)) failures.push("Workflow asset manifest is missing");
else {
	try {
		const workflowManifest = JSON.parse(readFileSync(workflowManifestPath, "utf8"));
		const entries = Array.isArray(workflowManifest.assets) ? workflowManifest.assets : [];
		const actual = walk(workflowRoot)
			.map((path) => relative(workflowRoot, path).replaceAll("\\", "/"))
			.filter((path) => path !== "manifest.json")
			.sort();
		const declared = entries.map((entry) => entry.path);
		const requiredWorkflowAssets = ["WORKFLOW.md", "templates/application-runbook.md", "templates/decision-record.md", "templates/execution-plan.md"];
		workflowAssetCount = entries.length;
		if (workflowManifest.schemaVersion !== 1 || workflowManifest.algorithm !== "sha256") failures.push("Workflow asset manifest schema is unsupported");
		if (JSON.stringify(declared) !== JSON.stringify(requiredWorkflowAssets)) failures.push("Workflow asset manifest is missing the required package-owned workflow set");
		if (new Set(declared).size !== declared.length || JSON.stringify([...declared].sort()) !== JSON.stringify(declared)) failures.push("Workflow asset manifest paths must be unique and sorted");
		if (JSON.stringify(actual) !== JSON.stringify(declared)) failures.push("Workflow asset inventory does not match its manifest");
		for (const entry of entries) {
			if (typeof entry.path !== "string" || !entry.path || entry.path.includes("\\") || entry.path.includes("\0") || isAbsolute(entry.path)
				|| entry.path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
				failures.push("Workflow asset manifest contains an unsafe path");
				continue;
			}
			const path = resolve(workflowRoot, entry.path);
			const fromRoot = relative(workflowRoot, path);
			if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
				failures.push(`Workflow asset escapes its root: ${entry.path}`);
				continue;
			}
			const digest = existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : "missing";
			if (digest !== entry.sha256) failures.push(`Workflow asset checksum mismatch: ${entry.path}`);
		}
	} catch (error) {
		failures.push(`Workflow asset validation failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}
const source = walk(resolve(root, "src")).map((path) => readFileSync(path, "utf8")).join("\n");
if (!source.includes('from "node:sqlite"')) failures.push("Built-in node:sqlite is not used");
if (/better-sqlite3|sqlite3\/|@libsql|native sqlite/i.test(source)) failures.push("Native SQLite addon reference found");
if (!source.includes('pi.on("agent_settled"')) failures.push("agent_settled scheduler boundary missing");
if (!source.includes('pi.on("agent_end", async () => scheduler.onAgentEnd())')) failures.push("agent_end must route only to the no-op lifecycle handler");
if (!source.includes("onAgentEnd(): void") || !source.includes("Intentionally empty. agent_end is not a stable boundary")) failures.push("agent_end no-op invariant missing");
for (const path of walk(resolve(root, "dist"))) {
	const relativePath = relative(root, path);
	if (statSync(path).size === 0) failures.push(`Empty build file: ${relativePath}`);
}
if (failures.length) {
	for (const failure of failures) process.stderr.write(`FAIL: ${failure}\n`);
	process.exit(1);
}
process.stdout.write(`${JSON.stringify({ status: "PASS", node: process.version, pi: piVersion, piRange: SUPPORTED_PI_RANGE, sqlite: "node:sqlite", harnessRuntimeDependency: false, harnessInPiManifest: false, workflowAssets: workflowAssetCount })}\n`);
