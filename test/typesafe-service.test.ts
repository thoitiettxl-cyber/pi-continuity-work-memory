import assert from "node:assert/strict";
import test from "node:test";

import { TypeSafeService } from "../src/application/typesafe-service.js";

test("TypeSafeService falls back gracefully when disabled or unauthenticated", async () => {
	const service = new TypeSafeService({ enabled: false });
	assert.equal(service.isEnabled(), false);

	const noul = await service.evaluateNoul("Is this a safe commit?", {}, false);
	assert.equal(noul.result, false);
	assert.equal(noul.fallbackUsed, true);

	const choice = await service.evaluateChoice("Select action", ["retry", "abort"] as const, {}, "abort");
	assert.equal(choice.selected, "abort");
	assert.equal(choice.fallbackUsed, true);

	const score = await service.evaluateScore("Rate architecture", {}, 2.0);
	assert.equal(score.score, 2.0);
	assert.equal(score.level, "acceptable-solid");
	assert.equal(score.fallbackUsed, true);
});

test("TypeSafeService evaluates noul with mocked API response", async () => {
	const mockFetch: typeof fetch = async (_url, init) => {
		const body = JSON.parse(init?.body as string);
		assert.equal(body.kind, "noul");
		assert.equal(body.model, "jev-1.13.0");
		return new Response(JSON.stringify({ probability: 0.88 }), { status: 200 });
	};

	const service = new TypeSafeService({
		apiKey: "test-typesafe-key",
		enabled: true,
		fetchFn: mockFetch,
	});
	assert.equal(service.isEnabled(), true);

	const result = await service.evaluateNoul("Is proposed work item ready?", { item: "fix-1" }, false);
	assert.equal(result.result, true);
	assert.equal(result.fallbackUsed, false);
	assert.ok(result.rawProbability >= 0.88);
});

test("TypeSafeService evaluates choice and selects among given options", async () => {
	const mockFetch: typeof fetch = async () => {
		return new Response(JSON.stringify({ selected: "rollback", confidence: 0.95 }), { status: 200 });
	};

	const service = new TypeSafeService({
		apiKey: "test-typesafe-key",
		enabled: true,
		fetchFn: mockFetch,
	});

	const choice = await service.evaluateChoice(
		"Select recovery strategy",
		["retry", "rollback", "escalate"] as const,
		{ error: "drift detected" },
		"retry",
	);

	assert.equal(choice.selected, "rollback");
	assert.equal(choice.fallbackUsed, false);
	assert.equal(choice.confidence, 0.95);
});

test("TypeSafeService evaluates score and calculates quality level", async () => {
	const mockFetch: typeof fetch = async () => {
		return new Response(JSON.stringify({ score: 2.85, confidence: 0.92 }), { status: 200 });
	};

	const service = new TypeSafeService({
		apiKey: "test-typesafe-key",
		enabled: true,
		fetchFn: mockFetch,
	});

	const score = await service.evaluateScore("Rate test maturity", {}, 1.5);
	assert.equal(score.score, 2.85);
	assert.equal(score.level, "high-quality");
	assert.equal(score.fallbackUsed, false);
});

test("TypeSafeService redacts secrets from prompt and context", async () => {
	let capturedBody: Record<string, unknown> | undefined;
	const mockFetch: typeof fetch = async (_url, init) => {
		capturedBody = JSON.parse(init?.body as string);
		return new Response(JSON.stringify({ probability: 0.7 }), { status: 200 });
	};

	const service = new TypeSafeService({
		apiKey: "test-key",
		enabled: true,
		fetchFn: mockFetch,
	});

	await service.evaluateNoul(
		"Check Authorization: Bearer secret-token-1234567890123456",
		{ key: "AIzaSyD1234567890abcdef1234567890abcdef" },
		false,
	);

	assert.ok(capturedBody);
	assert.doesNotMatch(capturedBody.prompt as string, /secret-token-1234567890123456/);
	assert.match(capturedBody.prompt as string, /\[REDACTED_SECRET\]|\[REDACTED_BEARER_TOKEN\]/);
});

test("TypeSafeService falls back smoothly upon network failure or timeout", async () => {
	const failingFetch: typeof fetch = async () => {
		throw new Error("Connection refused to api.typesafe.ai");
	};

	const service = new TypeSafeService({
		apiKey: "test-key",
		enabled: true,
		fetchFn: failingFetch,
	});

	const noul = await service.evaluateNoul("Will this succeed?", {}, true);
	assert.equal(noul.result, true);
	assert.equal(noul.fallbackUsed, true);

	const choice = await service.evaluateChoice("Pick action", ["a", "b"] as const, {}, "a");
	assert.equal(choice.selected, "a");
	assert.equal(choice.fallbackUsed, true);
});

test("isAmbiguousToolCall and selectRecoveryAction prioritize deterministic facts", async () => {
	const service = new TypeSafeService({ enabled: false });

	// Deterministic missing args
	const invalidCall = await service.isAmbiguousToolCall("", {});
	assert.equal(invalidCall.ambiguous, true);

	// Deterministic recovery for EADDRINUSE
	const recovery = await service.selectRecoveryAction(
		"Error: listen EADDRINUSE: address already in use 0.0.0.0:3000",
		["kill-existing-process", "retry", "abort"] as const,
	);
	assert.equal(recovery, "kill-existing-process");
});
