import assert from "node:assert/strict";
import test from "node:test";

import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

import { MemoryProviderDeferredError, type MemoryExtractionInput } from "../src/application/memory-ports.js";
import { PiMemoryProvider } from "../src/infrastructure/pi-memory-provider.js";
import { memorySource } from "../src/interface/session-adapter.js";

const usage = {
	input: 1,
	output: 1,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 2,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

test("memory-only xAI Responses calls reuse the active model and session thinking level for both stages", async () => {
	const selectedModel = {
		id: "grok-proof",
		name: "Grok proof",
		api: "openai-responses",
		provider: "xai",
		baseUrl: "https://api.x.ai/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 500_000,
		maxTokens: 500_000,
		thinkingLevelMap: { off: null, low: "low", medium: "medium", high: "high" },
	} as const;
	const requests: Array<{ model: unknown; options: Record<string, unknown> }> = [];
	const ctx = {
		model: selectedModel,
		thinkingLevel: "high",
		modelRegistry: {
			hasConfiguredAuth: () => true,
			async complete(model: Record<string, unknown>, context: { messages: Array<{ content: Array<{ text?: string }> }> }, options: Record<string, unknown>) {
				requests.push({ model, options });
				const prompt = context.messages[0]?.content[0]?.text ?? "";
				return {
					role: "assistant",
					content: [{ type: "text", text: prompt.includes("Stage 1") ? '{"memories":[]}' : '{"baselines":[]}' }],
					api: "openai-responses",
					provider: "xai",
					model: "grok-proof",
					usage,
					stopReason: "stop",
					timestamp: Date.now(),
				};
			},
		},
	} as unknown as ExtensionContext;
	const provider = new PiMemoryProvider(() => ctx);
	await provider.extract({
		sourceText: "durable source",
		allowedScopes: ["session"],
		workItemId: "work",
		repositoryId: "repo",
		sessionKey: "session",
	}, new AbortController().signal);
	await provider.consolidate({ records: [], previousBaselines: [], allowedScopes: ["session"] }, new AbortController().signal);

	assert.equal(requests.length, 2);
	for (const request of requests) {
		assert.equal(request.model, selectedModel);
		assert.equal(request.options.reasoningEffort, "high");
	}
});

test("memory-only xAI Responses calls clamp an unsupported session off level and defer connection failures", async () => {
	const selectedModel = {
		id: "grok-proof",
		name: "Grok proof",
		api: "openai-responses",
		provider: "xai",
		baseUrl: "https://api.x.ai/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 500_000,
		maxTokens: 500_000,
		thinkingLevelMap: { off: null, minimal: null, low: "low", medium: "medium", high: "high" },
	} as const;
	let requestOptions: Record<string, unknown> | undefined;
	const ctx = {
		model: selectedModel,
		thinkingLevel: "off",
		modelRegistry: {
			hasConfiguredAuth: () => true,
			async complete(_model: Record<string, unknown>, _context: unknown, options: Record<string, unknown>) {
				requestOptions = options;
				return {
					role: "assistant",
					content: [],
					api: "openai-responses",
					provider: "xai",
					model: "grok-proof",
					usage,
					stopReason: "error",
					errorMessage: "Connection error.",
					timestamp: Date.now(),
				};
			},
		},
	} as unknown as ExtensionContext;
	const provider = new PiMemoryProvider(() => ctx);
	await assert.rejects(() => provider.extract({
		sourceText: "durable source",
		allowedScopes: ["session"],
		workItemId: "work",
		repositoryId: "repo",
		sessionKey: "session",
	}, new AbortController().signal), MemoryProviderDeferredError);

	assert.equal(requestOptions?.reasoningEffort, "low");
});

test("memory-only OpenAI Responses calls suppress explicit prompt-cache mode without mutating the selected model", async () => {
	const selectedModel = {
		id: "gpt-proof",
		name: "GPT proof",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://example.invalid/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 8_192,
		compat: { supportsExplicitPromptCacheMode: true },
	} as const;
	const requestModels: Array<Record<string, unknown>> = [];
	const ctx = {
		model: selectedModel,
		modelRegistry: {
			hasConfiguredAuth: () => true,
			async complete(model: Record<string, unknown>, context: { messages: Array<{ content: Array<{ text?: string }> }> }) {
				requestModels.push(model);
				const prompt = context.messages[0]?.content[0]?.text ?? "";
				return {
					role: "assistant",
					content: [{ type: "text", text: prompt.includes("Stage 1") ? '{"memories":[]}' : '{"baselines":[]}' }],
					api: "openai-responses",
					provider: "openai",
					model: "gpt-proof",
					usage,
					stopReason: "stop",
					timestamp: Date.now(),
				};
			},
		},
	} as unknown as ExtensionContext;
	const provider = new PiMemoryProvider(() => ctx);
	const extraction: MemoryExtractionInput = {
		sourceText: "durable source",
		allowedScopes: ["session"],
		workItemId: "work",
		repositoryId: "repo",
		sessionKey: "session",
	};
	await provider.extract(extraction, new AbortController().signal);
	await provider.consolidate({ records: [], previousBaselines: [], allowedScopes: ["session"] }, new AbortController().signal);

	assert.equal(requestModels.length, 2);
	for (const requestModel of requestModels) {
		assert.notEqual(requestModel, selectedModel);
		assert.equal((requestModel.compat as { supportsExplicitPromptCacheMode?: boolean }).supportsExplicitPromptCacheMode, false);
	}
	assert.equal(selectedModel.compat.supportsExplicitPromptCacheMode, true);
});

test("included bash executions contribute command and result evidence while excluded executions stay content-free", () => {
	const entries = [
		{
			type: "message",
			id: "included",
			parentId: null,
			timestamp: new Date().toISOString(),
			message: {
				role: "bashExecution",
				command: "npm test",
				output: "32 tests passed",
				exitCode: 0,
				cancelled: false,
				truncated: false,
				timestamp: Date.now(),
			},
		},
		{
			type: "message",
			id: "excluded",
			parentId: "included",
			timestamp: new Date().toISOString(),
			message: {
				role: "bashExecution",
				command: "print-secret",
				output: "must-not-appear",
				exitCode: 0,
				cancelled: false,
				truncated: false,
				excludeFromContext: true,
				timestamp: Date.now(),
			},
		},
	] as SessionEntry[];
	const ctx = {
		sessionManager: {
			getBranch: () => entries,
			getSessionId: () => "session",
			getSessionFile: () => undefined,
			getLeafId: () => "excluded",
		},
	} as unknown as ExtensionContext;
	const sourceText = memorySource(ctx).text;
	const source = JSON.parse(sourceText) as Array<Record<string, unknown>>;
	assert.deepEqual(source[0], {
		id: "included",
		parentId: null,
		type: "message",
		role: "bashExecution",
		command: "npm test",
		output: "32 tests passed",
		exitCode: 0,
		cancelled: false,
		truncated: false,
	});
	assert.deepEqual(source[1], {
		id: "excluded",
		parentId: "included",
		type: "message",
		role: "bashExecution",
		excludedFromContext: true,
	});
	assert.ok(!sourceText.includes("print-secret"));
	assert.ok(!sourceText.includes("must-not-appear"));
});
