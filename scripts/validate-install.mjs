import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SUPPORTED_PI_RANGE, assertSupportedPiVersion, resolvePiExecutable } from "./pi-version.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const packageManifest = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const argumentIndex = process.argv.indexOf("--package");
const suppliedPackage = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : undefined;
const proofRoot = mkdtempSync(join(tmpdir(), "pi-global-install-proof-"));
const agentDir = join(proofRoot, "agent");
const sessionDir = join(proofRoot, "sessions");
const continuityRoot = join(proofRoot, "continuity-store");
const memoryRoot = join(proofRoot, "memory-store");
const packageRoot = suppliedPackage ? resolve(suppliedPackage) : join(proofRoot, "extracted-package", "pi-continuity-work-memory");
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

function fail(message) {
	throw new Error(message);
}

function run(args, cwd, environment) {
	const result = spawnSync(pi, args, { cwd, env: environment, encoding: "utf8", timeout: 60_000 });
	if (result.status !== 0) fail(`pi ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
	return result.stdout;
}

function initializeGit(path) {
	mkdirSync(path, { recursive: true });
	writeFileSync(join(path, "README.md"), `${basename(path)}\n`, "utf8");
	writeFileSync(join(path, "AGENTS.md"), "# Isolated install proof instructions\n", "utf8");
	for (const args of [["init", "-q"], ["config", "user.email", "proof@example.invalid"], ["config", "user.name", "Proof"], ["add", "README.md", "AGENTS.md"], ["commit", "-qm", "initial"]]) {
		const result = spawnSync("git", args, { cwd: path, encoding: "utf8" });
		if (result.status !== 0) fail(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
}

function copyInstallPayload() {
	if (suppliedPackage) return;
	if (!Array.isArray(packageManifest.files) || packageManifest.files.some((entry) => typeof entry !== "string" || !entry.trim()
		|| entry.startsWith("/") || entry.replaceAll("\\", "/").split("/").includes(".."))) {
		fail("package.json files must contain safe non-empty relative paths");
	}
	for (const relative of ["package.json", ...new Set(packageManifest.files)]) {
		const source = resolve(projectRoot, relative);
		if (!existsSync(source)) fail(`Install payload source missing: ${relative}`);
		const target = resolve(packageRoot, relative);
		mkdirSync(dirname(target), { recursive: true });
		cpSync(source, target, { recursive: true });
	}
}

function workflowFiles(path) {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const full = join(path, entry.name);
		return entry.isDirectory() ? workflowFiles(full) : [full];
	});
}

function verifyWorkflowPayload() {
	const workflowRoot = join(packageRoot, "workflow");
	const manifestPath = join(workflowRoot, "manifest.json");
	if (!existsSync(manifestPath)) fail("Installed package workflow manifest is missing");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (manifest.schemaVersion !== 1 || manifest.algorithm !== "sha256" || !Array.isArray(manifest.assets)) {
		fail("Installed package workflow manifest is invalid");
	}
	const actual = workflowFiles(workflowRoot)
		.map((path) => path.slice(workflowRoot.length + 1).replaceAll("\\", "/"))
		.filter((path) => path !== "manifest.json")
		.sort();
	const declared = manifest.assets.map((entry) => entry.path);
	const requiredWorkflowAssets = ["WORKFLOW.md", "templates/application-runbook.md", "templates/decision-record.md", "templates/execution-plan.md"];
	if (JSON.stringify(declared) !== JSON.stringify(requiredWorkflowAssets)) fail("Installed package workflow set is incomplete");
	if (new Set(declared).size !== declared.length || JSON.stringify([...declared].sort()) !== JSON.stringify(declared)) {
		fail("Installed package workflow paths must be unique and sorted");
	}
	if (JSON.stringify(actual) !== JSON.stringify(declared)) fail("Installed package workflow inventory does not match its manifest");
	for (const entry of manifest.assets) {
		if (typeof entry.path !== "string" || !entry.path || entry.path.includes("\\") || entry.path.includes("\0") || isAbsolute(entry.path)
			|| entry.path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
			fail("Installed package workflow manifest contains an unsafe path");
		}
		const path = resolve(workflowRoot, entry.path);
		const fromRoot = relative(workflowRoot, path);
		if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) fail(`Installed workflow asset escapes its root: ${entry.path}`);
		const digest = existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : "missing";
		if (digest !== entry.sha256) fail(`Installed package workflow checksum mismatch: ${entry.path}`);
	}
}

function verifySkillsPayload() {
	const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
	if (JSON.stringify(manifest.pi?.skills) !== JSON.stringify(expectedSkillEntries)) fail("Installed package does not load exactly the eleven package skill directories");
	const skillsRoot = join(packageRoot, "skills");
	if (!existsSync(skillsRoot)) fail("Installed package skill root is missing");
	const actual = readdirSync(skillsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, "SKILL.md")))
		.map((entry) => entry.name)
		.sort();
	if (JSON.stringify(actual) !== JSON.stringify(expectedSkills)) fail("Installed package skill inventory is incomplete or unexpected");
	for (const name of expectedSkills) {
		const text = readFileSync(join(skillsRoot, name, "SKILL.md"), "utf8");
		if (!text.startsWith("---\n") || !text.includes(`\nname: ${name}\n`) || !/\ndescription:\s*"[^\n]+"\n/.test(text)) {
			fail(`Installed Pi skill frontmatter is invalid: ${name}`);
		}
		const sourceCommits = sourceCommitsFor(name);
		if (sourceCommits.length === 0 || sourceCommits.some((commit) => !text.includes(commit))) {
			fail(`Installed Pi skill provenance is invalid: ${name}`);
		}
	}
	if (workflowFiles(skillsRoot).some((path) => !/\.(?:md|txt)$/.test(path))) fail("Installed package skills must remain prompt/reference-only resources");
	if (!readFileSync(join(skillsRoot, "UPSTREAM_LICENSE.txt"), "utf8").includes("Copyright (c) 2026 Matt Pocock")) {
		fail("Installed Matt Pocock skill license notice is missing");
	}
	if (!readFileSync(join(skillsRoot, "REPOSITORY_HARNESS_LICENSE.txt"), "utf8").includes("Copyright (c) 2025 Hoang Nguyen")) {
		fail("Installed Repository Harness skill license notice is missing");
	}
	if (!readFileSync(join(skillsRoot, "ECC_LICENSE.txt"), "utf8").includes("Copyright (c) 2026 Affaan Mustafa")) {
		fail("Installed ECC skill license notice is missing");
	}
}

function rpc(workspace, environment, messages) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(pi, ["--mode", "rpc", "--approve", "--offline", "--session-dir", sessionDir], {
			cwd: workspace,
			env: environment,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		const responses = [];
		let timer;
		let stopping = false;
		let pendingError;
		const stop = (error) => {
			if (stopping) return;
			stopping = true;
			pendingError = error;
			if (!child.killed) child.kill("SIGTERM");
		};
		child.stderr.on("data", (chunk) => { stderr += String(chunk); });
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
			for (;;) {
				const newline = stdout.indexOf("\n");
				if (newline < 0) break;
				const line = stdout.slice(0, newline);
				stdout = stdout.slice(newline + 1);
				if (!line.trim()) continue;
				try {
					const value = JSON.parse(line);
					if (value.type === "response") responses.push(value);
				} catch {
					stop(new Error(`Non-JSON RPC output: ${line}`));
					return;
				}
			}
			if (responses.filter((response) => response.id).length >= messages.length) stop();
		});
		child.on("error", stop);
		child.on("exit", (code) => {
			if (timer) clearTimeout(timer);
			if (responses.filter((response) => response.id).length < messages.length) {
				pendingError ||= new Error(`RPC exited ${code} before all responses: ${stderr}`);
			}
			if (pendingError) reject(pendingError);
			else resolvePromise(responses);
		});
		timer = setTimeout(() => stop(new Error(`RPC timeout: ${stderr}`)), 30_000);
		for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
	});
}

try {
	const versionResult = spawnSync(pi, ["--version"], { encoding: "utf8", timeout: 30_000 });
	if (versionResult.status !== 0) fail(`Pi version check failed: ${versionResult.stderr || versionResult.stdout}`);
	const piVersion = assertSupportedPiVersion(versionResult.stdout);

	copyInstallPayload();
	verifyWorkflowPayload();
	verifySkillsPayload();
	const workspaceA = join(proofRoot, "workspace-a");
	const proofHome = join(proofRoot, "home");
	const workspaceB = join(proofRoot, "workspace-b");
	initializeGit(workspaceA);
	initializeGit(workspaceB);
	mkdirSync(agentDir, { recursive: true });
	mkdirSync(proofHome, { recursive: true });
	mkdirSync(sessionDir, { recursive: true });
	const environment = {
		...process.env,
		HOME: proofHome,
		PI_CODING_AGENT_DIR: agentDir,
		PI_CONTINUITY_HOME: continuityRoot,
		PI_WORK_MEMORY_HOME: memoryRoot,
		PI_OFFLINE: "1",
	};

	run(["install", packageRoot], workspaceA, environment);
	for (const workspace of [workspaceA, workspaceB]) {
		const listing = run(["list"], workspace, environment);
		if (!listing.includes(packageRoot)) fail(`Global package absent in ${workspace}`);
	}
	const commandsA = await rpc(workspaceA, environment, [
		{ id: "commands-a", type: "get_commands" },
		{ id: "workflow-a", type: "prompt", message: "/continuity workflow" },
		{ id: "repo-a", type: "prompt", message: "/memory remember repository repo-A-e2e-marker" },
		{ id: "global-a", type: "prompt", message: "/memory remember global-user global-e2e-marker" },
	]);
	const workflowResponse = commandsA.find((response) => response.id === "workflow-a");
	if (!workflowResponse?.success || workflowResponse.command !== "prompt") fail("Installed workflow status command was not accepted by Pi RPC");
	const commandsB = await rpc(workspaceB, environment, [
		{ id: "commands-b", type: "get_commands" },
		{ id: "repo-b", type: "prompt", message: "/memory remember repository repo-B-e2e-marker" },
	]);
	for (const [label, responses] of [["A", commandsA], ["B", commandsB]]) {
		const commandResponse = responses.find((response) => response.command === "get_commands");
		const names = new Set(commandResponse?.data?.commands?.map((command) => command.name));
		if (!names.has("continuity") || !names.has("memory")) fail(`Extension namespaces not loaded in workspace ${label}`);
		for (const skill of expectedSkills) {
			const command = commandResponse?.data?.commands?.find((candidate) => candidate.name === `skill:${skill}`);
			if (!command) fail(`Packaged skill ${skill} not loaded in workspace ${label}`);
			const expectedPath = resolve(packageRoot, "skills", skill, "SKILL.md");
			if (command.source !== "skill" || resolve(String(command.sourceInfo?.path || "")) !== expectedPath) {
				fail(`Packaged skill ${skill} was shadowed or loaded from the wrong source in workspace ${label}`);
			}
		}
	}
	const memoryDb = new DatabaseSync(join(memoryRoot, "memory.sqlite"), { readOnly: true });
	memoryDb.exec("PRAGMA busy_timeout = 5000");
	const rows = memoryDb.prepare("SELECT scope, scope_key, content FROM memory_records WHERE status = 'published' ORDER BY content").all();
	memoryDb.close();
	const repoA = rows.find((row) => row.content === "repo-A-e2e-marker");
	const repoB = rows.find((row) => row.content === "repo-B-e2e-marker");
	const global = rows.find((row) => row.content === "global-e2e-marker");
	if (!repoA || !repoB || repoA.scope !== "repository" || repoB.scope !== "repository" || repoA.scope_key === repoB.scope_key) {
		fail("Repository memory scopes were mixed across workspaces");
	}
	if (!global || global.scope !== "global-user" || global.scope_key !== "global") fail("Global-user memory was not shared correctly");
	const continuityDb = new DatabaseSync(join(continuityRoot, "state.sqlite"), { readOnly: true });
	continuityDb.exec("PRAGMA busy_timeout = 5000");
	const repositories = continuityDb.prepare("SELECT DISTINCT repository_id FROM sessions").all();
	continuityDb.close();
	if (repositories.length < 2) fail("Continuity sessions did not retain separate repository identities");
	run(["remove", packageRoot], workspaceA, environment);
	if (!existsSync(join(continuityRoot, "state.sqlite")) || !existsSync(join(memoryRoot, "memory.sqlite"))) {
		fail("Removing the extension deleted a persistent store");
	}
	process.stdout.write(`${JSON.stringify({
		status: "PASS",
		pi: piVersion,
		piRange: SUPPORTED_PI_RANGE,
		globalInstall: true,
		workspaces: 2,
		withoutExtensionFlag: true,
		withoutLocalInstallFlag: true,
		repositoryScopeKeysDistinct: true,
		globalMemoryShared: true,
		storesSurviveRemove: true,
		workflowAssetsVerified: true,
		skillsLoaded: expectedSkills.length,
		isolatedHome: true,
		skillSourcesVerified: true,
		workflowCommandAccepted: true,
	})}\n`);
} finally {
	rmSync(proofRoot, { recursive: true, force: true });
}
