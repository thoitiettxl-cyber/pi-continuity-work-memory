import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type {
	MemoryConsolidationInput,
	MemoryExtractionInput,
	MemoryProvider,
	ProviderResult,
} from "../src/application/memory-ports.js";
import { MemoryService } from "../src/application/memory-service.js";
import { MemoryScheduler } from "../src/application/memory-scheduler.js";
import { emptyWorkState, type PipelineUsage } from "../src/domain/types.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { identity, temporaryDirectory } from "./helpers.js";

const usage: PipelineUsage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 1, cacheWriteTokens: 0, cost: 0.01 };

class FakeProvider implements MemoryProvider {
	extractCalls = 0;
	consolidateCalls = 0;
	afterExtract?: () => void;

	async extract(input: MemoryExtractionInput): Promise<ProviderResult<Array<{ scope: "repository"; kind: "fact"; content: string; citation: string }>>> {
		this.extractCalls += 1;
		this.afterExtract?.();
		return { value: input.allowedScopes.includes("repository") ? [{ scope: "repository", kind: "fact", content: "repository A durable marker", citation: "session evidence" }] : [], usage };
	}

	async consolidate(input: MemoryConsolidationInput) {
		this.consolidateCalls += 1;
		return {
			value: input.allowedScopes.map((scope) => ({ scope, content: `published ${scope} baseline` })),
			usage,
		};
	}
}

test("memory is isolated by repository/work item/session while global-user crosses repositories", () => {
	const root = temporaryDirectory("memory-scope");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const stateA = emptyWorkState();
	stateA.workItemId = "work-a";
	const stateB = emptyWorkState();
	stateB.workItemId = "work-b";
	const memoryA = new MemoryService(identity(), () => stateA, store);
	const memoryB = new MemoryService(identity({ sessionId: "session-b", sessionFileKey: "file-b", sessionKey: "session-b:file-b", repositoryId: "repo:b" }), () => stateB, store);

	const repository = memoryA.add("repository A marker", "repository", "agent-tool");
	const workItem = memoryA.add("work A marker", "work-item", "agent-tool");
	const session = memoryA.add("session A marker", "session", "agent-tool");
	const global = memoryA.add("global user marker", "global-user", "user-command");

	const visibleA = new Set(memoryA.list().map((record) => record.id));
	assert.ok(visibleA.has(repository.id) && visibleA.has(workItem.id) && visibleA.has(session.id) && visibleA.has(global.id));
	const visibleB = new Set(memoryB.list().map((record) => record.id));
	assert.ok(visibleB.has(global.id));
	assert.ok(!visibleB.has(repository.id));
	assert.ok(!visibleB.has(workItem.id));
	assert.ok(!visibleB.has(session.id));
	assert.equal(memoryB.recordCitations(`[memory:${repository.id}]`), 0, "hidden repository memory cannot receive cross-scope citation usage");
	assert.equal(memoryA.read(repository.id)?.usageCount, 0);
	store.close();
});

test("untrusted memory never injects repository scope or promotes beyond session", () => {
	const root = temporaryDirectory("memory-untrusted");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity({ trusted: false }), () => emptyWorkState(), store);
	assert.deepEqual(service.allowedExtractionScopes(), ["session"]);
	assert.deepEqual(service.selectors().map((selector) => selector.scope), ["global-user", "session"]);
	assert.throws(() => service.add("repo poison", "repository", "agent-tool"), /Untrusted/);
	assert.throws(() => service.add("global poison", "global-user", "user-command"), /Untrusted/);
	assert.doesNotThrow(() => service.add("local session fact", "session", "agent-tool"));
	store.close();
});

test("Stage 1 and Stage 2 publish atomically with usage and citations", async () => {
	const root = temporaryDirectory("memory-pipeline");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const provider = new FakeProvider();
	const source = { text: "completed a durable repository workflow", hash: "source-v1", citation: "session:source-v1" };
	const result = await service.runPipeline(source, "generation-1", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => source.hash,
	}, new AbortController().signal);
	assert.equal(result.status, "published");
	assert.equal(provider.extractCalls, 1);
	assert.equal(provider.consolidateCalls, 1);
	assert.equal(result.usage.inputTokens, 20);
	assert.ok(store.publishedBaselines(service.selectors()).length > 0);
	const record = service.search("durable marker")[0];
	assert.ok(record);
	assert.equal(service.recordCitations(`Used [memory:${record.id}]`), 1);
	assert.equal(service.read(record.id)?.usageCount, 1);
	store.close();
});

test("consolidation crash leaves building generation invisible and prior head safe", async () => {
	const root = temporaryDirectory("memory-baseline-crash");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const provider = new FakeProvider();
	const source = { text: "source", hash: "source-stable", citation: "session" };
	await service.runPipeline(source, "generation-safe", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => source.hash,
	}, new AbortController().signal);
	const before = store.publishedBaselines(service.selectors());
	assert.ok(before.length > 0);
	store.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, status, created_at
) VALUES ('crash-building', 'repository', 'repo:a', 'unsafe partial baseline', 'generation-crash', 'building', ?)`)
		.run(Date.now());
	const after = store.publishedBaselines(service.selectors());
	assert.deepEqual(after, before);
	assert.ok(!after.some((baseline) => baseline.content.includes("unsafe partial")));
	store.close();
});

test("scheduler shutdown lets an aborted memory worker release its lease", async () => {
	const root = temporaryDirectory("memory-shutdown");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const scheduler = new MemoryScheduler(1);
	let resolveStarted!: () => void;
	const started = new Promise<void>((resolve) => { resolveStarted = resolve; });
	const provider: MemoryProvider = {
		async extract(_input, signal) {
			resolveStarted();
			await new Promise<never>((_resolve, reject) => {
				const abort = () => reject(signal.reason ?? new Error("provider aborted"));
				if (signal.aborted) abort();
				else signal.addEventListener("abort", abort, { once: true });
			});
			return { value: [], usage };
		},
		async consolidate() {
			throw new Error("consolidation must not run");
		},
	};
	const source = { text: "source", hash: "shutdown-source", citation: "session" };
	scheduler.onAgentSettled(async (signal, generation) => {
		await service.runPipeline(source, String(generation), provider, {
			isCurrentGeneration: () => scheduler.currentGeneration() === generation,
			currentSourceHash: () => source.hash,
		}, signal);
	});
	await started;
	await scheduler.shutdown();
	assert.equal(service.latestRun()?.status, "superseded");
	assert.equal(service.latestRun()?.reason, "worker aborted or lifecycle generation changed");
	store.close();
});

test("session source change supersedes stale worker output", async () => {
	const root = temporaryDirectory("memory-supersede");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const provider = new FakeProvider();
	let currentHash = "source-old";
	provider.afterExtract = () => { currentHash = "source-new"; };
	const result = await service.runPipeline({ text: "old", hash: "source-old", citation: "session" }, "generation-old", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => currentHash,
	}, new AbortController().signal);
	assert.equal(result.status, "superseded");
	assert.equal(provider.consolidateCalls, 0);
	assert.equal(service.list().length, 0);
	store.close();
});

test("one memory job has only one lease owner across processes/stores", () => {
	const root = temporaryDirectory("memory-lease");
	const path = join(root, "memory.sqlite");
	const first = new MemoryStore(path);
	const second = new MemoryStore(path);
	const leaseA = first.claimPipeline("session", "source", "generation", "owner-a");
	const leaseB = second.claimPipeline("session", "source", "generation", "owner-b");
	assert.ok(leaseA);
	assert.equal(leaseB, undefined);
	first.close();
	second.close();
});

test("memory reset does not touch the independent Continuity database", async () => {
	const root = temporaryDirectory("memory-reset");
	const memoryPath = join(root, "memory.sqlite");
	const continuityPath = join(root, "state.sqlite");
	const { ContinuityStore } = await import("../src/infrastructure/continuity-store.js");
	const continuity = new ContinuityStore(continuityPath);
	continuity.registerSession(identity());
	continuity.saveState(identity().sessionKey, "root", { ...emptyWorkState(), goal: "must survive reset" });
	const memoryStore = new MemoryStore(memoryPath);
	const service = new MemoryService(identity(), () => emptyWorkState(), memoryStore);
	service.add("temporary memory", "session", "agent-tool");
	service.reset();
	assert.equal(service.list().length, 0);
	assert.equal(continuity.findNearestState(identity().sessionKey, ["root"])?.goal, "must survive reset");
	memoryStore.close();
	continuity.close();
});

test("work-item memory is absent until an explicit work item or repository document binding exists", () => {
	const root = temporaryDirectory("memory-explicit-work-item");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const state = emptyWorkState();
	const service = new MemoryService(identity(), () => state, store);
	assert.deepEqual(service.selectors().map((selector) => selector.scope), ["global-user", "repository", "session"]);
	assert.deepEqual(service.allowedExtractionScopes(), ["repository", "session"]);
	assert.throws(() => service.add("unbound work item", "work-item", "agent-tool"), /explicit work item|bound repository/);

	state.workflow.binding = {
		kind: "execution-plan",
		status: "active",
		workItemId: "5a5933b7-9dd2-45b5-a34e-90ab699ba912",
		relativePath: "docs/plans/active/work.md",
		templateVersion: 1,
		digest: "b".repeat(64),
	};
	assert.deepEqual(service.selectors().map((selector) => selector.scope), ["global-user", "repository", "work-item", "session"]);
	assert.deepEqual(service.allowedExtractionScopes(), ["repository", "work-item", "session"]);
	assert.doesNotThrow(() => service.add("bound work item", "work-item", "agent-tool"));
	store.close();
});

test("memory search ranks token overlap and does not require a contiguous substring", () => {
	const root = temporaryDirectory("memory-token-search");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	service.add("completed a durable repository workflow", "repository", "agent-tool", "session evidence");
	service.add("only one durable token", "repository", "agent-tool", "session evidence");
	const ranked = service.search("workflow durable");
	assert.equal(ranked.length, 2);
	assert.equal(ranked[0]?.content, "completed a durable repository workflow");
	assert.equal(ranked[1]?.content, "only one durable token");
	assert.equal(service.search("unrelated xyz").length, 0);
	store.close();
});

test("context prompt injects query-matched atoms instead of dumping visible records", () => {
	const root = temporaryDirectory("memory-query-prompt");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	service.add("do not refactor the old auth module", "repository", "agent-tool", "session evidence");
	service.add("unrelated formatting preference", "repository", "agent-tool", "session evidence");
	const prompt = service.contextPrompt("can I change the old auth module");
	assert.match(prompt, /authority="learning-only"/);
	assert.match(prompt, /do not refactor the old auth module/);
	assert.doesNotMatch(prompt, /unrelated formatting preference/);
	store.close();
});

test("context prompt without a query injects baselines only and omits the record dump", () => {
	const root = temporaryDirectory("memory-baseline-prompt");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	service.add("manual session note that must not dump", "session", "agent-tool");
	assert.equal(service.contextPrompt(), "");
	assert.equal(service.contextPrompt("   "), "");
	store.close();
});

test("published memory defaults to fact and preserves an explicit learning kind", () => {
	const root = temporaryDirectory("memory-kind");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const implicit = service.add("peer range is 0.84.1", "repository", "agent-tool");
	const explicit = service.add("answer in Vietnamese", "repository", "user-command", "explicit remember", "preference");
	assert.equal(implicit.kind, "fact");
	assert.equal(service.read(implicit.id)?.kind, "fact");
	assert.equal(explicit.kind, "preference");
	assert.equal(service.read(explicit.id)?.kind, "preference");
	store.close();
});

test("pipeline skips below the turn threshold after the first published extract", async () => {
	const root = temporaryDirectory("memory-threshold");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const provider = new FakeProvider();
	const first = await service.runPipeline({
		text: "first durable extract",
		hash: "hash-1",
		citation: "session",
		lastEntryId: "entry-1",
		newTurnCount: 1,
	}, "generation-1", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => "hash-1",
	}, new AbortController().signal);
	assert.equal(first.status, "published");
	assert.equal(provider.extractCalls, 1);
	const skipped = await service.runPipeline({
		text: "second window",
		hash: "hash-2",
		citation: "session",
		lastEntryId: "entry-2",
		newTurnCount: 2,
	}, "generation-2", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => "hash-2",
	}, new AbortController().signal);
	assert.equal(skipped.status, "skipped");
	assert.equal(provider.extractCalls, 1);
	const forced = await service.runPipeline({
		text: "forced window",
		hash: "hash-3",
		citation: "session",
		lastEntryId: "entry-3",
		newTurnCount: 1,
	}, "generation-3", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => "hash-3",
	}, new AbortController().signal, { force: true });
	assert.equal(forced.status, "published");
	assert.equal(provider.extractCalls, 2);
	const third = await service.runPipeline({
		text: "threshold window",
		hash: "hash-4",
		citation: "session",
		lastEntryId: "entry-4",
		newTurnCount: 3,
	}, "generation-4", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => "hash-4",
	}, new AbortController().signal);
	assert.equal(third.status, "published");
	assert.equal(provider.extractCalls, 3);
	store.close();
});

test("pipeline does not publish a second exact-content atom in the same scope", async () => {
	const root = temporaryDirectory("memory-dedup");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	service.add("repository A durable marker", "repository", "agent-tool", "manual");
	const provider = new FakeProvider();
	const source = { text: "completed a durable repository workflow", hash: "dedup-source", citation: "session" };
	const result = await service.runPipeline(source, "generation-dedup", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => source.hash,
	}, new AbortController().signal);
	assert.equal(result.status, "published");
	assert.equal(service.list().filter((record) => record.content === "repository A durable marker").length, 1);
	store.close();
});

test("missing cursor resync extracts when the remaining source hash changed", async () => {
	const root = temporaryDirectory("memory-resync");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store);
	const provider = new FakeProvider();
	await service.runPipeline({
		text: "original window",
		hash: "hash-original",
		citation: "session",
		lastEntryId: "gone",
		newTurnCount: 1,
	}, "generation-1", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => "hash-original",
	}, new AbortController().signal);
	assert.equal(provider.extractCalls, 1);
	const resync = await service.runPipeline({
		text: "compacted remainder",
		hash: "hash-compacted",
		citation: "session",
		lastEntryId: "leaf",
		newTurnCount: 1,
		resync: true,
	}, "generation-2", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => "hash-compacted",
	}, new AbortController().signal);
	assert.equal(resync.status, "published");
	assert.equal(provider.extractCalls, 2);
	store.close();
});
