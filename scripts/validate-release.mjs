import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, resolve, relative, sep } from "node:path";

import { SUPPORTED_PI_RANGE, assertSupportedPiVersion, resolvePiExecutable } from "./pi-version.mjs";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const failures = [];
const pi = resolvePiExecutable();
const expectedSkills = ["audit-onboarding-proposal", "code-review", "codebase-design", "contract-first", "diagnosing-bugs", "domain-modeling", "encode-invariant", "grill-with-docs", "improve-harness", "onboard-repository", "tdd"];
const expectedSkillEntries = expectedSkills.map((name) => `./skills/${name}`);
const mattPocockSkills = new Set(["code-review", "codebase-design", "diagnosing-bugs", "domain-modeling", "grill-with-docs", "tdd"]);
const repositoryHarnessSkills = new Set(["audit-onboarding-proposal", "encode-invariant", "improve-harness", "onboard-repository"]);
const eccSkills = new Set(["contract-first", "tdd"]);
const mattPocockCommit = "5b15a47f2d7150f545fbcacbfe381787fc0230dc";
const repositoryHarnessCommit = "e765792b635b4d5e3e5fc0578f82f9ca5dea2681";
const eccCommit = "d8409a4b0813771235555e32e3d8046a73988bfa";

function sourceCommitsFor(name) {
	const commits = [];
	if (mattPocockSkills.has(name)) commits.push(mattPocockCommit);
	if (repositoryHarnessSkills.has(name)) commits.push(repositoryHarnessCommit);
	if (eccSkills.has(name)) commits.push(eccCommit);
	return commits;
}
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
const expectedBuildDependencies = { typescript: "5.9.3" };
if (JSON.stringify(manifest.dependencies) !== JSON.stringify(expectedBuildDependencies)) {
	failures.push("Git install build dependencies must remain exact and build-only");
}
if (manifest.scripts?.prepare !== "npm run build:git-install") failures.push("Git installs must emit the extension during npm prepare");
const requiredPayload = [
	"dist",
	"skills",
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
const piEntries = [...(manifest.pi?.extensions ?? []), ...(manifest.pi?.skills ?? [])];
if (piEntries.some((entry) => typeof entry === "string" && entry.includes("repository-harness"))) failures.push("Repository Harness appears as a Pi runtime resource");
if (JSON.stringify(manifest.pi?.skills) !== JSON.stringify(expectedSkillEntries)) failures.push("Pi manifest must load exactly the eleven package skill directories");
const skillsRoot = resolve(root, "skills");
let skillCount = 0;
if (!existsSync(skillsRoot)) failures.push("Package skill root is missing");
else {
	const actualSkills = readdirSync(skillsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(resolve(skillsRoot, entry.name, "SKILL.md")))
		.map((entry) => entry.name)
		.sort();
	skillCount = actualSkills.length;
	if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) failures.push("Package skill inventory is incomplete or unexpected");
	for (const name of expectedSkills) {
		const text = readFileSync(resolve(skillsRoot, name, "SKILL.md"), "utf8");
		if (!text.startsWith("---\n") || !text.includes(`\nname: ${name}\n`) || !/\ndescription:\s*"[^\n]+"\n/.test(text)) {
			failures.push(`Pi skill frontmatter is invalid: ${name}`);
		}
		const sourceCommits = sourceCommitsFor(name);
		if (sourceCommits.length === 0 || sourceCommits.some((commit) => !text.includes(commit))) {
			failures.push(`Pinned source provenance is missing: ${name}`);
		}
	}
	const skillText = walk(skillsRoot).filter((path) => /\.(?:md|txt)$/.test(path)).map((path) => readFileSync(path, "utf8")).join("\n");
	if (walk(skillsRoot).some((path) => !/\.(?:md|txt)$/.test(path))) failures.push("Package skills must remain prompt/reference-only resources");
	for (const forbidden of ["Call the Skill tool", "/clear", "xdg-open", "Commit your work to the current branch", "spawn both sub-agents in parallel"]) {
		if (skillText.includes(forbidden)) failures.push(`Cross-harness or unsafe skill assumption remains: ${forbidden}`);
	}
	if (!skillText.includes("Copyright (c) 2026 Matt Pocock")) failures.push("Matt Pocock skill license notice is missing");
	if (!skillText.includes("Copyright (c) 2025 Hoang Nguyen")) failures.push("Repository Harness skill license notice is missing");
	if (!skillText.includes("Copyright (c) 2026 Affaan Mustafa")) failures.push("ECC skill license notice is missing");
}
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
process.stdout.write(`${JSON.stringify({ status: "PASS", node: process.version, pi: piVersion, piRange: SUPPORTED_PI_RANGE, sqlite: "node:sqlite", repositoryHarnessRuntimeDependency: false, repositoryHarnessInPiManifest: false, workflowAssets: workflowAssetCount, skills: skillCount })}\n`);
