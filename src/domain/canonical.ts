import { createHash } from "node:crypto";

function normalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, item]) => item !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, item]) => [key, normalize(item)]),
		);
	}
	return value;
}

export function canonicalJson(value: unknown): string {
	return JSON.stringify(normalize(value));
}

export function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

export function chainedHash(parentHash: string, payloadHash: string): string {
	return sha256(`pi-continuity-checkpoint-v1\n${parentHash}\n${payloadHash}`);
}

export function escapeXmlText(input: string): string {
	return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function boundedStrings(values: readonly string[] | undefined, maximum = 200): string[] {
	if (!values) return [];
	const unique = new Set<string>();
	for (const candidate of values) {
		const value = candidate.trim();
		if (!value) continue;
		unique.add(value.slice(0, 4_000));
		if (unique.size >= maximum) break;
	}
	return [...unique];
}

export const PROVIDER_SOURCE_MAX_CHARS = 120_000;

function redactKnownPrivatePaths(value: string, privatePaths: readonly string[]): string {
	let output = value;
	for (const path of privatePaths) {
		if (!path || path.length < 4) continue;
		const candidates = new Set([path, path.replaceAll("\\", "/"), path.replaceAll("/", "\\")]);
		for (const candidate of candidates) {
			const escaped = JSON.stringify(candidate).slice(1, -1);
			output = output.replaceAll(candidate, "[REDACTED_SESSION_PATH]").replaceAll(escaped, "[REDACTED_SESSION_PATH]");
		}
	}
	return output;
}

function omitDataUriPayloads(value: string): string {
	const prefix = /data:[^,\s]{1,512};base64,/gi;
	let output = "";
	let cursor = 0;
	for (;;) {
		prefix.lastIndex = cursor;
		const match = prefix.exec(value);
		if (!match || match.index === undefined) break;
		output += `${value.slice(cursor, match.index)}[OMITTED_BASE64_DATA]`;
		let end = prefix.lastIndex;
		while (end < value.length) {
			const character = value[end]!;
			if (/[A-Za-z0-9+/_=-]/.test(character) || character === "\n" || character === "\r" || character === "\t") {
				end += 1;
				continue;
			}
			const pair = value.slice(end, end + 2).toLowerCase();
			if (pair === "\\n" || pair === "\\r" || pair === "\\t") {
				end += 2;
				continue;
			}
			if (/^%0[ad9]$/i.test(value.slice(end, end + 3))) {
				end += 3;
				continue;
			}
			break;
		}
		cursor = end;
	}
	return `${output}${value.slice(cursor)}`;
}

function omitWrappedOpaqueData(value: string): string {
	return value.replace(/(?:[A-Za-z0-9+/_-]{24,}={0,2}(?:(?:\r?\n)|(?:\\[nrt])|(?:%0[ad9]))){2,}[A-Za-z0-9+/_-]{16,}={0,2}/gi, (match) => {
		const payloadLength = match.replace(/(?:\r?\n|\\[nrt]|%0[ad9]|=)/gi, "").length;
		return payloadLength >= 128 ? "[OMITTED_OPAQUE_DATA]" : match;
	});
}

export function sanitizeProviderBoundText(value: string, maximum = 16_000, privatePaths: readonly string[] = []): string {
	const limit = Math.max(256, Math.floor(maximum));
	const sanitized = omitWrappedOpaqueData(omitDataUriPayloads(redactSecrets(redactKnownPrivatePaths(value, privatePaths))))
		.replace(/[A-Za-z0-9+/_-]{256,}={0,2}/g, "[OMITTED_OPAQUE_DATA]")
		.replace(/(?:[A-Za-z]:[\\/](?:Users[\\/][^\\/\s]+[\\/])?|\/(?:root|home\/[^/\s]+)\/|~[\\/])?\.pi[\\/]agent[\\/]sessions[\\/][^\s"'<>]+/gi, "[REDACTED_SESSION_PATH]")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "�");
	if (sanitized.length <= limit) return sanitized;
	const marker = `\n[TRUNCATED ${sanitized.length - limit} CHARS]\n`;
	const available = Math.max(0, limit - marker.length);
	const head = Math.ceil(available / 2);
	const tail = Math.floor(available / 2);
	return `${sanitized.slice(0, head)}${marker}${tail > 0 ? sanitized.slice(-tail) : ""}`;
}

export function redactSecrets(value: string): string {
	return value
		.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
		.replace(/\b(?:sk|rk|pk)-[-A-Za-z0-9_]{12,}\b/g, "[REDACTED_SECRET]")
		.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_SECRET]")
		.replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_SECRET]")
		.replace(/\b(?:glpat|xox[baprs])-[-A-Za-z0-9_]{12,}\b/g, "[REDACTED_SECRET]")
		.replace(/\bgsk_[A-Za-z0-9]{20,}\b/g, "[REDACTED_SECRET]")
		.replace(/\bnpm_[A-Za-z0-9]{20,}\b/g, "[REDACTED_SECRET]")
		.replace(/\bya29\.[A-Za-z0-9._-]{20,}\b/g, "[REDACTED_SECRET]")
		.replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]")
		.replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[REDACTED_GOOGLE_KEY]")
		.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
		.replace(/\b(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|id[_-]?token|session[_-]?token|auth[_-]?token|token|client[_-]?secret|secret|credential(?:s)?|password|passwd|set-cookie|cookie)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|Bearer\s+[A-Za-z0-9._~+\/-]{12,}|[^\s,;}]+)/gi, (match) => {
			const separator = match.search(/[:=]/);
			if (separator < 0) return "[REDACTED_SECRET]";
			const suffix = match.slice(separator + 1);
			const quote = /^\s*(["'])/.exec(suffix)?.[1];
			return `${match.slice(0, separator)}${match[separator]}${quote ? `${quote}[REDACTED_SECRET]${quote}` : "[REDACTED_SECRET]"}`;
		})
		.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, "Bearer [REDACTED_SECRET]");
}
