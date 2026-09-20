import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..", "..");

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(resolve(root, path), "utf8")) as Record<string, unknown>;
}

test("package declares the clean Git-install build and validation contract", () => {
	const manifest = readJson("package.json") as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		scripts?: Record<string, string>;
	};
	const installConfig = readJson("tsconfig.git-install.json") as {
		compilerOptions?: Record<string, unknown>;
	};
	const readme = readFileSync(resolve(root, "README.md"), "utf8");

	assert.equal(manifest.scripts?.prepare, "npm run build:git-install");
	assert.equal(manifest.scripts?.["build:git-install"], "tsc -p tsconfig.git-install.json");
	assert.equal(manifest.scripts?.["validate:git-install"], "node scripts/validate-git-install.mjs");
	assert.match(manifest.scripts?.validate ?? "", /node scripts\/validate-git-install\.mjs/);
	assert.deepEqual(manifest.dependencies, { typescript: "5.9.3" });
	assert.equal(manifest.devDependencies?.["@types/node"], "24.12.4");
	assert.equal(manifest.devDependencies?.typescript, undefined);
	assert.equal(installConfig.compilerOptions?.noCheck, true);
	assert.deepEqual(installConfig.compilerOptions?.types, []);
	assert.equal(installConfig.compilerOptions?.outDir, "dist");
	assert.match(readme, /pi install git:github\.com\/thoitiettxl-cyber\/pi-continuity-work-memory/);
});

test("package engines, peer range, and proof identity stay aligned for RC6 install validation", () => {
	const manifest = readJson("package.json") as {
		version?: string;
		engines?: { node?: string };
		peerDependencies?: Record<string, string>;
		pi?: { extensions?: string[]; skills?: string[] };
		files?: string[];
	};
	const results = readJson("proof/RESULTS.json") as {
		packageVersion?: string;
		status?: string;
		developmentValidation?: { observations?: { tests?: string } };
	};
	const acceptance = readFileSync(resolve(root, "proof/ACCEPTANCE.md"), "utf8");

	assert.equal(manifest.version, "1.0.0-rc.6");
	assert.equal(manifest.engines?.node, ">=22.19.0");
	assert.equal((manifest as { packageManager?: string }).packageManager, "bun@1.4.2");
	assert.equal(manifest.peerDependencies?.["@earendil-works/pi-coding-agent"], ">=0.86.0 <0.87.0");
	assert.equal(manifest.peerDependencies?.["@earendil-works/pi-ai"], ">=0.86.0 <0.87.0");
	assert.deepEqual(manifest.pi?.extensions, ["./dist/extension.js"]);
	assert.equal(manifest.pi?.skills?.length, 11);
	for (const required of [
		"scripts/validate-install.mjs",
		"scripts/validate-provider.mjs",
		"scripts/manage-user-install.mjs",
		"proof/ACCEPTANCE.md",
		"proof/RESULTS.json",
	]) {
		assert.ok(manifest.files?.includes(required), `missing release payload entry ${required}`);
	}
	assert.equal(results.packageVersion, manifest.version, "RESULTS.json packageVersion must match package.json");
	assert.match(results.status ?? "", /RC6/);
	assert.match(acceptance, /1\.0\.0-rc\.6/);
	assert.match(acceptance, /harden\/tests-rc6|source-local harden/i);
});

test("GitHub Actions CI runs bun typecheck and test on Node 22.19 PRs", () => {
	const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
	assert.match(workflow, /node-version:\s*\["22\.19\.0"\]/);
	assert.match(workflow, /oven-sh\/setup-bun/);
	assert.match(workflow, /bun-version:\s*\["1\.4\.2"\]/);
	assert.match(workflow, /bun install --frozen-lockfile/);
	assert.match(workflow, /bun run typecheck/);
	assert.match(workflow, /bun run test/);
	assert.match(workflow, /pull_request:/);
	assert.match(workflow, /branches:\s*\[[^\]]*\bdev-next\b/);
	assert.doesNotMatch(workflow, /^\s*run:\s*(?:npm|bun) run validate:release\s*$/m);
	assert.doesNotMatch(workflow, /npm ci/);
});
