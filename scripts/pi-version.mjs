import { existsSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SUPPORTED_PI_RANGE = ">=0.84.1 <0.86.0";
const MIN_SUPPORTED = { major: 0, minor: 84, patch: 1 };
const MAX_EXCLUSIVE = { major: 0, minor: 86, patch: 0 };

export function parsePiVersion(value) {
	const text = String(value ?? "").trim();
	const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text);
	if (!match) return undefined;
	return {
		version: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`,
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

function comparePiVersion(left, right) {
	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	return left.patch - right.patch;
}

export function isSupportedPiVersion(value) {
	const parsed = parsePiVersion(value);
	return Boolean(parsed && comparePiVersion(parsed, MIN_SUPPORTED) >= 0 && comparePiVersion(parsed, MAX_EXCLUSIVE) < 0);
}

function isNodeModulesBin(dir) {
	return dir.replaceAll("\\", "/").replace(/\/+$/, "").endsWith("/node_modules/.bin");
}

export function resolvePiExecutable(env = process.env) {
	for (const key of ["PI_VALIDATION_PI", "PI_MANAGED_INSTALL_PI", "PI_PROVIDER_PROOF_PI"]) {
		const value = env[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	const pathVar = env.PATH || env.Path || "";
	const name = process.platform === "win32" ? "pi.cmd" : "pi";
	for (const dir of pathVar.split(delimiter)) {
		if (!dir || isNodeModulesBin(dir)) continue;
		const candidate = resolve(dir, name);
		if (existsSync(candidate)) return candidate;
	}
	return "pi";
}

export function assertSupportedPiVersion(value) {
	const parsed = parsePiVersion(value);
	if (!parsed || !isSupportedPiVersion(parsed.version)) {
		throw new Error(`Unsupported Pi version ${String(value ?? "").trim() || "<missing>"}; expected ${SUPPORTED_PI_RANGE}`);
	}
	return parsed.version;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
	try {
		if (process.argv[2] === "--resolve") {
			process.stdout.write(`${resolvePiExecutable()}\n`);
		} else {
			const pi = assertSupportedPiVersion(process.argv[2]);
			process.stdout.write(`${JSON.stringify({ status: "PASS", pi, piRange: SUPPORTED_PI_RANGE })}\n`);
		}
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
