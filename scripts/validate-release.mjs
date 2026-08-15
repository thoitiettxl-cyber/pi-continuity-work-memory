import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";

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
process.stdout.write(`${JSON.stringify({ status: "PASS", node: process.version, pi: piVersion, piRange: SUPPORTED_PI_RANGE, sqlite: "node:sqlite", harnessInPayload: false })}\n`);
