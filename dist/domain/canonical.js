import { createHash } from "node:crypto";
function normalize(value) {
    if (Array.isArray(value))
        return value.map(normalize);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, normalize(item)]));
    }
    return value;
}
export function canonicalJson(value) {
    return JSON.stringify(normalize(value));
}
export function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
export function chainedHash(parentHash, payloadHash) {
    return sha256(`pi-continuity-checkpoint-v1\n${parentHash}\n${payloadHash}`);
}
export function boundedStrings(values, maximum = 200) {
    if (!values)
        return [];
    const unique = new Set();
    for (const candidate of values) {
        const value = candidate.trim();
        if (!value)
            continue;
        unique.add(value.slice(0, 4_000));
        if (unique.size >= maximum)
            break;
    }
    return [...unique];
}
export function redactSecrets(value) {
    return value
        .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
        .replace(/\b(?:sk|rk|pk|ghp|github_pat|glpat|xox[baprs])-[-A-Za-z0-9_]{12,}\b/g, "[REDACTED_SECRET]")
        .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]")
        .replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[REDACTED_GOOGLE_KEY]")
        .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
        .replace(/\b(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|id[_-]?token|session[_-]?token|client[_-]?secret|password|passwd|set-cookie|cookie)["']?\s*[:=]\s*["']?[^\s,;}]+/gi, (match) => {
        const separator = match.search(/[:=]/);
        return separator < 0 ? "[REDACTED_SECRET]" : `${match.slice(0, separator)}=[REDACTED_SECRET]`;
    })
        .replace(/Bearer\s+[A-Za-z0-9._~+\/-]{12,}/gi, "Bearer [REDACTED_SECRET]");
}
//# sourceMappingURL=canonical.js.map