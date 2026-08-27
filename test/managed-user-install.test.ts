import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	symlinkSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { relative, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { temporaryDirectory } from "./helpers.js";

const projectRoot = resolve(import.meta.dirname, "..", "..");
const managerScript = resolve(projectRoot, "scripts", "manage-user-install.mjs");
const pi = resolve(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "pi.cmd" : "pi");
const expectedSkills = ["audit-onboarding-proposal", "code-review", "codebase-design", "contract-first", "diagnosing-bugs", "domain-modeling", "encode-invariant", "grill-with-docs", "improve-harness", "onboard-repository", "tdd"];
const expectedSkillEntries = expectedSkills.map((name) => `./skills/${name}`);

function writeJson(path: string, value: unknown): void {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function walk(path: string): string[] {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const full = resolve(path, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

function createInstallPackage(root: string, version: string): void {
	mkdirSync(resolve(root, "dist"), { recursive: true });
	mkdirSync(resolve(root, "scripts"), { recursive: true });
	for (const skill of expectedSkills) mkdirSync(resolve(root, "skills", skill), { recursive: true });
	writeJson(resolve(root, "package.json"), {
		name: "pi-continuity-work-memory",
		version,
		type: "module",
		pi: { extensions: ["./dist/extension.js"], skills: expectedSkillEntries },
	});
	writeFileSync(resolve(root, "dist", "extension.js"), "export default function () {}\n", "utf8");
	for (const skill of expectedSkills) {
		writeFileSync(resolve(root, "skills", skill, "SKILL.md"), `---\nname: ${skill}\ndescription: Test skill.\n---\n\n# Test\n`, "utf8");
	}
	writeFileSync(
		resolve(root, "scripts", "validate-install.mjs"),
		'process.stdout.write(JSON.stringify({ status: "PASS" }) + "\\n");\n',
		"utf8",
	);
	const files = walk(root)
		.map((path) => ({
			path: relative(root, path).replaceAll("\\", "/"),
			size: statSync(path).size,
			sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
		}))
		.sort((left, right) => left.path.localeCompare(right.path));
	writeJson(resolve(root, "PACKAGE_INVENTORY.json"), {
		format: 1,
		package: "pi-continuity-work-memory",
		version,
		inventoryFile: "PACKAGE_INVENTORY.json",
		inventoryFileExcludedFromEntries: true,
		files,
	});
}

function runManager(args: string[], environment: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
	return spawnSync(process.execPath, [managerScript, ...args], {
		cwd: projectRoot,
		env: { ...process.env, ...environment },
		encoding: "utf8",
		timeout: 60_000,
	});
}

function readSettings(agentDir: string): { packages?: Array<string | Record<string, unknown>> } {
	return JSON.parse(readFileSync(resolve(agentDir, "settings.json"), "utf8"));
}

test("managed deploy migrates a source-tree registration into the stable agent package path", () => {
	const root = temporaryDirectory("managed-deploy");
	try {
		const home = resolve(root, "home");
		const agentDir = resolve(home, ".pi", "agent");
		const sourcePackage = resolve(root, "source", "pi-continuity-work-memory");
		const releasePackage = resolve(root, "release-package");
		const continuityStore = resolve(home, ".pi", "continuity", "state.sqlite");
		const memoryStore = resolve(home, ".pi", "work-memory", "memory.sqlite");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(sourcePackage, { recursive: true });
		mkdirSync(resolve(continuityStore, ".."), { recursive: true });
		mkdirSync(resolve(memoryStore, ".."), { recursive: true });
		writeJson(resolve(sourcePackage, "package.json"), { name: "pi-continuity-work-memory", version: "source" });
		writeFileSync(continuityStore, "continuity-marker", "utf8");
		writeFileSync(memoryStore, "memory-marker", "utf8");
		createInstallPackage(releasePackage, "1.0.0-test.1");
		writeJson(resolve(agentDir, "settings.json"), {
			packages: ["npm:pi-claude-code-tui", relative(agentDir, sourcePackage)],
		});

		const result = runManager([
			"deploy",
			"--package", releasePackage,
			"--agent-dir", agentDir,
			"--pi", pi,
		], { HOME: home });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const output = JSON.parse(result.stdout) as {
			status: string;
			registeredSource: string;
			storesChanged: boolean;
			backupRoot: string;
		};
		assert.equal(output.status, "PASS");
		assert.equal(output.registeredSource, "packages/pi-continuity-work-memory");
		assert.equal(output.storesChanged, false);
		assert.ok(existsSync(resolve(output.backupRoot, "settings.json")));

		assert.deepEqual(readSettings(agentDir).packages, ["npm:pi-claude-code-tui", "packages/pi-continuity-work-memory"]);
		const installedManifest = JSON.parse(readFileSync(resolve(agentDir, "packages", "pi-continuity-work-memory", "package.json"), "utf8"));
		assert.equal(installedManifest.version, "1.0.0-test.1");
		assert.equal(readFileSync(continuityStore, "utf8"), "continuity-marker");
		assert.equal(readFileSync(memoryStore, "utf8"), "memory-marker");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed deploy restores settings and the previous runtime when activation fails", async () => {
	const root = temporaryDirectory("managed-rollback");
	try {
		const agentDir = resolve(root, "agent");
		const target = resolve(agentDir, "packages", "pi-continuity-work-memory");
		const candidate = resolve(root, "candidate");
		mkdirSync(target, { recursive: true });
		writeJson(resolve(target, "package.json"), { name: "pi-continuity-work-memory", version: "old-runtime" });
		createInstallPackage(candidate, "new-runtime");
		const originalSettings = {
			packages: ["npm:pi-claude-code-tui", "packages/pi-continuity-work-memory"],
		};
		writeJson(resolve(agentDir, "settings.json"), originalSettings);
		const manager = await import(pathToFileURL(managerScript).href) as {
			deployManaged: (options: Record<string, unknown>, hooks: { afterActivate: () => void }) => unknown;
		};
		assert.throws(() => manager.deployManaged({ package: candidate, agentDir, pi }, {
			afterActivate() {
				throw new Error("intentional activation failure");
			},
		}), /intentional activation failure/);
		assert.deepEqual(readSettings(agentDir), originalSettings);
		const restoredManifest = JSON.parse(readFileSync(resolve(target, "package.json"), "utf8"));
		assert.equal(restoredManifest.version, "old-runtime");
		const packageEntries = readdirSync(resolve(agentDir, "packages"));
		assert.deepEqual(packageEntries.filter((entry) => entry.includes("staging") || entry.includes("install.lock")), []);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed deploy rejects a symlink package root", () => {
	const root = temporaryDirectory("managed-symlink");
	try {
		const packageRoot = resolve(root, "real-package");
		const packageLink = resolve(root, "linked-package");
		const agentDir = resolve(root, "agent");
		createInstallPackage(packageRoot, "symlink-test");
		symlinkSync(packageRoot, packageLink, "dir");
		const result = runManager([
			"deploy",
			"--package", packageLink,
			"--agent-dir", agentDir,
			"--pi", pi,
		]);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Package source must be a real directory/);
		assert.ok(!existsSync(resolve(agentDir, "packages", "pi-continuity-work-memory")));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed dry-run leaves a missing agent directory absent", () => {
	const root = temporaryDirectory("managed-dry-run");
	try {
		const packageRoot = resolve(root, "package");
		const agentDir = resolve(root, "missing-agent");
		createInstallPackage(packageRoot, "dry-run-test");
		const result = runManager([
			"deploy",
			"--package", packageRoot,
			"--agent-dir", agentDir,
			"--pi", pi,
			"--dry-run",
		]);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.ok(!existsSync(agentDir));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed deploy deduplicates registrations while preserving the first object filters", () => {
	const root = temporaryDirectory("managed-filters");
	try {
		const agentDir = resolve(root, "agent");
		const sourcePackage = resolve(root, "source", "pi-continuity-work-memory");
		const packageRoot = resolve(root, "package");
		mkdirSync(sourcePackage, { recursive: true });
		writeJson(resolve(sourcePackage, "package.json"), { name: "pi-continuity-work-memory", version: "source" });
		createInstallPackage(packageRoot, "filter-test");
		mkdirSync(agentDir, { recursive: true });
		const source = relative(agentDir, sourcePackage);
		writeJson(resolve(agentDir, "settings.json"), {
			packages: [
				"npm:pi-claude-code-tui",
				{ source, extensions: [], autoload: false },
				source,
			],
		});
		const result = runManager([
			"deploy",
			"--package", packageRoot,
			"--agent-dir", agentDir,
			"--pi", pi,
		]);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.deepEqual(readSettings(agentDir).packages, [
			"npm:pi-claude-code-tui",
			{ source: "packages/pi-continuity-work-memory", extensions: [], autoload: false },
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed deploy reclaims an empty stale settings lock compatible with Pi proper-lockfile", () => {
	const root = temporaryDirectory("managed-stale-lock");
	try {
		const agentDir = resolve(root, "agent");
		const packageRoot = resolve(root, "package");
		const settingsPath = resolve(agentDir, "settings.json");
		const settingsLock = `${settingsPath}.lock`;
		mkdirSync(agentDir, { recursive: true });
		createInstallPackage(packageRoot, "stale-lock-test");
		writeJson(settingsPath, { packages: [] });
		mkdirSync(settingsLock);
		const stale = new Date(Date.now() - 20_000);
		utimesSync(settingsLock, stale, stale);
		const result = runManager([
			"deploy",
			"--package", packageRoot,
			"--agent-dir", agentDir,
			"--pi", pi,
		]);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.ok(!existsSync(settingsLock));
		assert.deepEqual(readSettings(agentDir).packages, ["packages/pi-continuity-work-memory"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed remove unregisters the package while retaining runtime files and persistent stores", () => {
	const root = temporaryDirectory("managed-remove");
	try {
		const home = resolve(root, "home");
		const agentDir = resolve(home, ".pi", "agent");
		const target = resolve(agentDir, "packages", "pi-continuity-work-memory");
		const continuityStore = resolve(home, ".pi", "continuity", "state.sqlite");
		const memoryStore = resolve(home, ".pi", "work-memory", "memory.sqlite");
		mkdirSync(target, { recursive: true });
		mkdirSync(resolve(continuityStore, ".."), { recursive: true });
		mkdirSync(resolve(memoryStore, ".."), { recursive: true });
		writeJson(resolve(target, "package.json"), { name: "pi-continuity-work-memory", version: "installed" });
		writeFileSync(resolve(target, "runtime-marker"), "keep-runtime", "utf8");
		writeFileSync(continuityStore, "keep-continuity", "utf8");
		writeFileSync(memoryStore, "keep-memory", "utf8");
		writeJson(resolve(agentDir, "settings.json"), { packages: ["packages/pi-continuity-work-memory"] });

		const result = runManager([
			"remove",
			"--agent-dir", agentDir,
			"--pi", pi,
		], { HOME: home });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const output = JSON.parse(result.stdout) as { storesChanged: boolean; runtimeArchived: boolean };
		assert.equal(output.storesChanged, false);
		assert.equal(output.runtimeArchived, false);
		assert.deepEqual(readSettings(agentDir).packages, []);
		assert.equal(readFileSync(resolve(target, "runtime-marker"), "utf8"), "keep-runtime");
		assert.equal(readFileSync(continuityStore, "utf8"), "keep-continuity");
		assert.equal(readFileSync(memoryStore, "utf8"), "keep-memory");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
