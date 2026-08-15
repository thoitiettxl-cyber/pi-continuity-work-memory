import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

import type { MemoryConsolidationInput, MemoryExtractionInput, MemoryProvider, ProviderResult } from "../src/application/memory-ports.js";
import { MemoryService } from "../src/application/memory-service.js";
import { PROVIDER_SOURCE_MAX_CHARS, sha256 } from "../src/domain/canonical.js";
import { emptyWorkState, type PipelineUsage } from "../src/domain/types.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { memorySource } from "../src/interface/session-adapter.js";
import { identity, temporaryDirectory } from "./helpers.js";

const usage: PipelineUsage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 };

function contextFor(entries: SessionEntry[], sessionFile?: string): ExtensionContext {
	return {
		sessionManager: {
			getBranch: () => entries,
			getSessionId: () => "sanitization-session",
			getSessionFile: () => sessionFile,
			getLeafId: () => entries.at(-1)?.id ?? null,
		},
	} as unknown as ExtensionContext;
}

test("provider session source keeps bounded text evidence while removing images, opaque payloads, secrets, signatures, and hidden thinking", () => {
	const rawImage = Buffer.from("raw-image-canary".repeat(200)).toString("base64");
	const opaquePayload = "A".repeat(1_024);
	const apiKey = `sk-${"s".repeat(24)}`;
	const bearer = `Bearer ${"b".repeat(24)}`;
	const customSessionFile = "/custom/private/pi-sessions/session.jsonl";
	const now = new Date().toISOString();
	const entries = [
		{
			type: "message",
			id: "user",
			parentId: null,
			timestamp: now,
			message: {
				role: "user",
				content: [
					{ type: "text", text: `durable-user-evidence api_key=${apiKey} ${customSessionFile}`, textSignature: "opaque-text-signature" },
					{ type: "image", mimeType: "image/png", data: rawImage },
				],
				timestamp: Date.now(),
			},
		},
		{
			type: "message",
			id: "assistant",
			parentId: "user",
			timestamp: now,
			message: {
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "private-thinking-canary", thinkingSignature: "opaque-thinking-signature" },
					{ type: "text", text: "durable-assistant-evidence" },
					{
						type: "toolCall",
						id: "tool-call",
						name: "write",
						arguments: { path: "src/example.ts", password: "plain-password-canary", payload: opaquePayload },
						thoughtSignature: "opaque-thought-signature",
					},
				],
				api: "openai-responses",
				provider: "openai",
				model: "proof",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				stopReason: "stop",
				timestamp: Date.now(),
			},
		},
		{
			type: "message",
			id: "tool-result",
			parentId: "assistant",
			timestamp: now,
			message: {
				role: "toolResult",
				toolCallId: "tool-call",
				toolName: "write",
				content: [
					{ type: "text", text: `durable-tool-result ${bearer}` },
					{ type: "image", mimeType: "image/webp", data: rawImage },
				],
				isError: false,
				timestamp: Date.now(),
			},
		},
		{
			type: "message",
			id: "bash",
			parentId: "tool-result",
			timestamp: now,
			message: {
				role: "bashExecution",
				command: "npm test",
				output: `durable-bash-result\n${opaquePayload}\nauthorization=${bearer}`,
				exitCode: 0,
				cancelled: false,
				truncated: false,
				timestamp: Date.now(),
			},
		},
		{
			type: "message",
			id: "excluded-bash",
			parentId: "bash",
			timestamp: now,
			message: {
				role: "bashExecution",
				command: "excluded-command-canary",
				output: "excluded-output-canary",
				exitCode: 0,
				cancelled: false,
				truncated: false,
				excludeFromContext: true,
				timestamp: Date.now(),
			},
		},
	] as SessionEntry[];

	const source = memorySource(contextFor(entries, customSessionFile));
	const parsed = JSON.parse(source.text) as Array<Record<string, unknown>>;
	assert.ok(parsed.length > 0);
	assert.ok(source.text.includes("durable-user-evidence"));
	assert.ok(source.text.includes("durable-assistant-evidence"));
	assert.ok(source.text.includes("durable-tool-result"));
	assert.ok(source.text.includes("durable-bash-result"));
	assert.ok(source.text.includes("npm test"));
	assert.ok(source.text.includes("src/example.ts"));
	assert.ok(source.text.includes("[REDACTED_SECRET]"));
	assert.ok(source.text.includes("[OMITTED_OPAQUE_DATA]"));
	assert.ok(source.text.includes('"omitted":true'));
	for (const forbidden of [rawImage, opaquePayload, apiKey, bearer, "b".repeat(24), customSessionFile, "plain-password-canary", "private-thinking-canary", "opaque-text-signature", "opaque-thinking-signature", "opaque-thought-signature", "excluded-command-canary", "excluded-output-canary"]) {
		assert.ok(!source.text.includes(forbidden), `provider source leaked ${forbidden.slice(0, 40)}`);
	}
	assert.equal(source.hash, sha256(source.text));
	assert.ok(source.text.length <= PROVIDER_SOURCE_MAX_CHARS);
});

test("provider source remains valid bounded JSON and retains the newest evidence when a session exceeds the total budget", () => {
	const now = new Date().toISOString();
	const entries = Array.from({ length: 40 }, (_, index) => ({
		type: "message",
		id: `entry-${index}`,
		parentId: index === 0 ? null : `entry-${index - 1}`,
		timestamp: now,
		message: {
			role: "user",
			content: [{ type: "text", text: `marker-${index}-${(`chunk-${index} `).repeat(1_500)}` }],
			timestamp: Date.now(),
		},
	})) as SessionEntry[];
	const source = memorySource(contextFor(entries));
	const parsed = JSON.parse(source.text) as Array<Record<string, unknown>>;
	assert.ok(source.text.length <= PROVIDER_SOURCE_MAX_CHARS);
	assert.equal(parsed[0]?.type, "source_truncation");
	assert.ok(Number(parsed[0]?.omittedEntries) > 0);
	assert.ok(source.text.includes("marker-39-"));
	assert.ok(!source.text.includes("marker-0-"));
});

test("MemoryService sanitizes Stage 1 metadata and every Stage 2 field even when callers or legacy rows bypass session serialization", async () => {
	const root = temporaryDirectory("provider-boundary");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const session = identity();
	const state = emptyWorkState();
	const opaquePayload = "Z".repeat(2_048);
	const apiKey = `sk-${"q".repeat(24)}`;
	const sessionPath = "/custom/private/pi-sessions/session.jsonl";
	state.workItemId = `work-${apiKey}-${sessionPath}`;
	store.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, status, created_at
) VALUES ('legacy-baseline', 'session', ?, ?, 'legacy', 'published', ?)`)
		.run(session.sessionKey, `legacy ${opaquePayload} ${sessionPath}`, Date.now());
	store.db.prepare(`INSERT INTO baseline_heads(scope, scope_key, baseline_id, updated_at)
VALUES ('session', ?, 'legacy-baseline', ?)`)
		.run(session.sessionKey, Date.now());
	const service = new MemoryService(session, () => state, store);
	let extractionInput: MemoryExtractionInput | undefined;
	let consolidationInput: MemoryConsolidationInput | undefined;
	const provider: MemoryProvider = {
		async extract(input: MemoryExtractionInput): Promise<ProviderResult<Array<{ scope: "session"; content: string; citation: string }>>> {
			extractionInput = input;
			return {
				value: [{ scope: "session", content: `candidate ${opaquePayload} ${sessionPath}`, citation: `citation ${apiKey}` }],
				usage,
			};
		},
		async consolidate(input: MemoryConsolidationInput): Promise<ProviderResult<Array<{ scope: "session"; content: string }>>> {
			consolidationInput = input;
			return { value: [{ scope: "session", content: "safe baseline" }], usage };
		},
	};
	const raw = `durable-direct-evidence data:image/png;charset=utf-8;base64,${opaquePayload} api_key=${apiKey}`;
	const result = await service.runPipeline({ text: raw, hash: sha256(raw), citation: "test", privatePaths: [sessionPath, "/custom/private/pi-sessions"] }, "generation", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => sha256(raw),
	}, new AbortController().signal);
	assert.equal(result.status, "published");
	assert.ok(extractionInput);
	assert.ok(consolidationInput);
	const stage1 = JSON.stringify(extractionInput);
	const stage2 = JSON.stringify(consolidationInput);
	assert.ok(stage1.includes("durable-direct-evidence"));
	assert.ok(stage1.includes("[OMITTED_BASE64_DATA]"));
	assert.ok(stage1.includes("[REDACTED_SECRET]"));
	assert.ok(stage2.includes("[OMITTED_OPAQUE_DATA]"));
	assert.ok(stage2.includes("[REDACTED_SESSION_PATH]"));
	for (const forbidden of [opaquePayload, apiKey, sessionPath]) {
		assert.ok(!stage1.includes(forbidden));
		assert.ok(!stage2.includes(forbidden));
	}
	assert.ok(extractionInput.sourceText.length <= PROVIDER_SOURCE_MAX_CHARS);
	assert.ok(stage2.length <= PROVIDER_SOURCE_MAX_CHARS);
	store.close();
});
