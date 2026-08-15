import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/pi-version.mjs");
const range = ">=0.84.1 <0.85.0";

function check(version: string) {
	return spawnSync(process.execPath, [script, version], { encoding: "utf8" });
}

test("Pi version validation accepts the lower bound and current 0.84.x releases while reporting the actual version", () => {
	for (const [input, expected] of [["0.84.1", "0.84.1"], ["0.84.2", "0.84.2"], ["v0.84.99", "0.84.99"]] as const) {
		const result = check(input);
		assert.equal(result.status, 0, result.stderr);
		const report = JSON.parse(result.stdout) as Record<string, unknown>;
		assert.equal(report.status, "PASS");
		assert.equal(report.pi, expected);
		assert.equal(report.piRange, range);
	}
});

test("Pi version validation rejects versions outside the package peer range with an actionable diagnostic", () => {
	for (const version of ["0.84.0", "0.85.0", "1.0.0", "0.84.2-beta.1", "not-a-version"]) {
		const result = check(version);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Unsupported Pi version/);
		assert.ok(result.stderr.includes(version));
		assert.ok(result.stderr.includes(range));
	}
});

test("deferred provider proof still reports the actual Pi version and supported range", () => {
	const environment = { ...process.env };
	delete environment.PI_PROVIDER_PROOF_MODEL;
	delete environment.PI_PROVIDER_PROOF_AGENT_DIR;
	delete environment.PI_PROVIDER_PROOF_PI;
	delete environment.PI_CODING_AGENT_DIR;
	const result = spawnSync(process.execPath, [resolve("scripts/validate-provider.mjs")], { encoding: "utf8", env: environment });
	assert.equal(result.status, 0, result.stderr);
	const report = JSON.parse(result.stdout) as Record<string, unknown>;
	assert.equal(report.status, "DEFERRED");
	assert.equal(report.pi, "0.84.1");
	assert.equal(report.piRange, range);
});

test("provider proof isolates the explicit candidate extension from configured discovery", () => {
	const source = readFileSync(resolve("scripts/validate-provider.mjs"), "utf8");
	for (const flag of ["--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files"]) {
		assert.ok(source.includes(`\"${flag}\"`), `missing provider-proof isolation flag ${flag}`);
	}
	assert.match(source, /"--extension", resolve\(root, "dist", "extension\.js"\)/);
	assert.ok(source.indexOf('"--no-extensions"') < source.indexOf('"--extension"'));
	assert.match(source, /diagnostic:\s*safeDiagnostic/);
	assert.match(source, /pipelineReason:\s*safeDiagnostic/);
	const managedLifecycle = source.slice(source.indexOf("const proofRoot ="));
	assert.doesNotMatch(managedLifecycle, /process\.exit\(/);
	assert.match(managedLifecycle, /finally\s*{\s*rmSync\(proofRoot,\s*{ recursive: true, force: true }\);\s*}/);
});
