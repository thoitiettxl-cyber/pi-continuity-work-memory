import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const SUPPORTED_PI_RANGE = ">=0.84.1 <0.85.0";

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

export function isSupportedPiVersion(value) {
	const parsed = parsePiVersion(value);
	return Boolean(parsed && parsed.major === 0 && parsed.minor === 84 && parsed.patch >= 1);
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
		const pi = assertSupportedPiVersion(process.argv[2]);
		process.stdout.write(`${JSON.stringify({ status: "PASS", pi, piRange: SUPPORTED_PI_RANGE })}\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
