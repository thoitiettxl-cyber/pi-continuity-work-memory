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
	assert.match(manifest.scripts?.validate ?? "", /npm run validate:git-install/);
	assert.deepEqual(manifest.dependencies, { typescript: "5.9.3" });
	assert.equal(manifest.devDependencies?.["@types/node"], "24.12.4");
	assert.equal(manifest.devDependencies?.typescript, undefined);
	assert.equal(installConfig.compilerOptions?.noCheck, true);
	assert.deepEqual(installConfig.compilerOptions?.types, []);
	assert.equal(installConfig.compilerOptions?.outDir, "dist");
	assert.match(readme, /pi install git:github\.com\/thoitiettxl-cyber\/pi-continuity-work-memory/);
});
