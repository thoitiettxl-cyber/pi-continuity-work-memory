import assert from "node:assert/strict";
import test from "node:test";

import { escapeXmlText, redactSecrets, sanitizeProviderBoundText } from "../src/domain/canonical.js";

test("escapeXmlText encodes ampersand, less-than, and greater-than independently and in combination", () => {
	assert.equal(escapeXmlText("&"), "&amp;");
	assert.equal(escapeXmlText("<"), "&lt;");
	assert.equal(escapeXmlText(">"), "&gt;");
	assert.equal(escapeXmlText("a&b<c>d"), "a&amp;b&lt;c&gt;d");
});

test("escapeXmlText encodes ampersand first so existing entity text is not mistaken for markup", () => {
	assert.equal(escapeXmlText("&lt;"), "&amp;lt;");
	assert.equal(escapeXmlText(""), "");
	assert.equal(escapeXmlText(`"'`), `"'`);
});

test("memory-bound text redacts common API, OAuth, cookie, private-key, and session-token forms", () => {
	const secrets = [
		["sk", "-", "abcdefghijklmnopqrstuv"].join(""),
		["AK", "IA", "ABCDEFGHIJKLMNOP"].join(""),
		["AI", "za", "abcdefghijklmnopqrstuvwxyz1234567890"].join(""),
		"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcml2YXRlIn0.signature123456",
		"cookie-value-should-not-survive",
		"oauth-value-should-not-survive",
		"session-value-should-not-survive",
		"bearer-value-should-not-survive",
		"password-value-should-not-survive",
	];
	const source = [
		`api_key=${secrets[0]}`,
		secrets[1],
		secrets[2],
		`id_token=${secrets[3]}`,
		`Cookie: ${secrets[4]}`,
		`oauth_token=${secrets[5]}`,
		`session_token=${secrets[6]}`,
		`password=${secrets[8]}`,
		`authorization=Bearer ${secrets[7]}`,
		"-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----",
	].join("\n");
	const redacted = redactSecrets(source);
	for (const secret of secrets) assert.ok(!redacted.includes(secret));
	assert.ok(!redacted.includes("private-material"));
	assert.match(redacted, /REDACTED/);
});

test("provider-bound text strips opaque payloads and personal Pi session paths while retaining surrounding evidence", () => {
	const opaque = "A".repeat(1_024);
	const sessionPath = "/root/.pi/agent/sessions/--root-code--/session.jsonl";
	const sanitized = sanitizeProviderBoundText(`before data:image/png;base64,${opaque} ${sessionPath} after`);
	assert.ok(sanitized.includes("before"));
	assert.ok(sanitized.includes("after"));
	assert.ok(sanitized.includes("[OMITTED_BASE64_DATA]"));
	assert.ok(sanitized.includes("[REDACTED_SESSION_PATH]"));
	assert.ok(!sanitized.includes(opaque));
	assert.ok(!sanitized.includes(sessionPath));
});

test("provider-bound sanitizer handles encoded or short-line wrapped base64, Windows session paths, and generic token forms", () => {
	const wrappedBase64 = Array.from({ length: 8 }, () => "A".repeat(63)).join("\n");
	const encodedWrappedBase64 = wrappedBase64.replaceAll("\n", "%0A");
	const windowsSessionPath = "C:\\Users\\Alice\\.pi\\agent\\sessions\\private\\session.jsonl";
	const genericToken = "t".repeat(40);
	const tokens = [
		`gho_${"a".repeat(30)}`,
		`ghu_${"b".repeat(30)}`,
		`gsk_${"c".repeat(30)}`,
		`npm_${"d".repeat(30)}`,
		`ya29.${"e".repeat(30)}`,
		`token=${genericToken}`,
	];
	const sanitized = sanitizeProviderBoundText([
		`before data:image/png;charset=utf-8;base64,${encodedWrappedBase64} after`,
		wrappedBase64,
		windowsSessionPath,
		...tokens,
	].join("\n"));
	assert.ok(sanitized.includes("before"));
	assert.ok(sanitized.includes("after"));
	assert.ok(sanitized.includes("[OMITTED_BASE64_DATA]"));
	assert.ok(sanitized.includes("[OMITTED_OPAQUE_DATA]"));
	assert.ok(sanitized.includes("[REDACTED_SESSION_PATH]"));
	for (const forbidden of [wrappedBase64, encodedWrappedBase64, windowsSessionPath, genericToken, ...tokens]) assert.ok(!sanitized.includes(forbidden));
});

test("redaction preserves JSON syntax for quoted secret fields", () => {
	const source = JSON.stringify({ token: `prefix-${"x".repeat(20)}-\"quoted\"`, keep: "durable" });
	const sanitized = sanitizeProviderBoundText(source);
	assert.deepEqual(JSON.parse(sanitized), { token: "[REDACTED_SECRET]", keep: "durable" });
});
