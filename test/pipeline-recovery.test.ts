import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { MemoryConsolidationInput, MemoryExtractionInput, MemoryProvider, ProviderResult } from "../src/application/memory-ports.js";
import { MemoryService } from "../src/application/memory-service.js";
import { sha256 } from "../src/domain/canonical.js";
import { emptyWorkState, type PipelineUsage } from "../src/domain/types.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { identity, temporaryDirectory } from "./helpers.js";

const usage: PipelineUsage = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 };

function pending(id: string, content: string) {
	return { id, scope: "session" as const, scopeKey: "session:a:file-a", kind: "fact" as const, content, citation: "test" };
}

function baseline(id: string, content: string) {
	return { id, scope: "session" as const, scopeKey: "session:a:file-a", content };
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("expired reclaim clears old artifacts and stale finish cannot delete the new owner's pending work", () => {
	const root = temporaryDirectory("pipeline-reclaim");
	const path = join(root, "memory.sqlite");
	const first = new MemoryStore(path);
	const second = new MemoryStore(path);
	const oldLease = first.claimPipeline("session:a:file-a", "source", "generation-old", "owner-old", 1_000, 50);
	assert.ok(oldLease);
	assert.equal(first.stage1(oldLease, [pending("old-record", "old pending")], usage, 1_010), true);
	first.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, run_id, status, created_at
) VALUES (?, 'session', ?, ?, ?, ?, 'building', ?)`)
		.run("old-baseline", "session:a:file-a", "old building", "generation-old", oldLease.runId, 1_010);

	assert.equal(second.claimPipeline("session:a:file-a", "source", "generation-new", "owner-new", 1_040, 50), undefined);
	const newLease = second.claimPipeline("session:a:file-a", "source", "generation-new", "owner-new", 1_060, 50);
	assert.ok(newLease);
	assert.equal(newLease.runId, oldLease.runId);
	assert.equal(Number(second.db.prepare("SELECT COUNT(*) AS count FROM memory_records WHERE run_id = ? AND status = 'pending'").get(newLease.runId)?.count), 0);
	assert.equal(Number(second.db.prepare("SELECT COUNT(*) AS count FROM memory_baselines WHERE run_id = ? AND status = 'building'").get(newLease.runId)?.count), 0);

	assert.equal(second.stage1(newLease, [pending("new-record", "new pending")], usage, 1_070), true);
	assert.equal(first.finish(oldLease, "failed", "stale owner", 1_071), false);
	assert.equal(Number(second.db.prepare("SELECT COUNT(*) AS count FROM memory_records WHERE id = 'new-record' AND status = 'pending'").get()?.count), 1);
	assert.equal(second.publish(newLease, [baseline("new-baseline", "new baseline")], usage, 1_080), true);
	const published = second.db.prepare("SELECT id, content FROM memory_records WHERE status = 'published' ORDER BY id").all() as Array<Record<string, unknown>>;
	assert.deepEqual(published.map((row) => String(row.id)), ["new-record"]);
	assert.equal(second.latestRun("session:a:file-a")?.status, "published");
	first.close();
	second.close();
});

test("opening a store recovers expired runs and removes pending/building orphans before retry", () => {
	const root = temporaryDirectory("pipeline-open-recovery");
	const path = join(root, "memory.sqlite");
	const oldNow = Date.now() - 10_000;
	const first = new MemoryStore(path);
	const lease = first.claimPipeline("session:a:file-a", "source", "generation-old", "owner-old", oldNow, 100);
	assert.ok(lease);
	assert.equal(first.stage1(lease, [pending("crash-record", "crash pending")], usage, oldNow + 10), true);
	first.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, status, created_at
) VALUES ('prior-published', 'session', 'session:a:file-a', 'prior safe head', 'prior', 'published', ?)`)
		.run(oldNow - 100);
	first.db.prepare(`INSERT INTO baseline_heads(scope, scope_key, baseline_id, updated_at)
VALUES ('session', 'session:a:file-a', 'prior-published', ?)`)
		.run(oldNow - 100);
	first.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, run_id, status, created_at
) VALUES (?, 'session', ?, ?, ?, ?, 'building', ?)`)
		.run("crash-baseline", "session:a:file-a", "crash building", "generation-old", lease.runId, oldNow + 10);
	first.db.prepare(`INSERT INTO memory_records(
  id, scope, scope_key, content, citation, source_session_key, source_hash, run_id, status, created_at, updated_at
) VALUES ('detached-record', 'session', 'session:a:file-a', 'detached', 'test', 'session:a:file-a', 'detached', NULL, 'pending', ?, ?)`)
		.run(oldNow, oldNow);
	first.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, run_id, status, created_at
) VALUES ('detached-baseline', 'session', 'session:a:file-a', 'detached', 'detached', NULL, 'building', ?)`)
		.run(oldNow);
	first.close();

	const recovered = new MemoryStore(path);
	const run = recovered.db.prepare("SELECT status, owner, lease_until, reason, stage1_records FROM pipeline_runs WHERE id = ?").get(lease.runId) as Record<string, unknown>;
	assert.equal(run.status, "failed");
	assert.equal(run.owner, null);
	assert.equal(run.lease_until, null);
	assert.equal(run.reason, "expired lease recovered");
	assert.equal(Number(run.stage1_records), 0);
	assert.equal(Number(recovered.db.prepare("SELECT COUNT(*) AS count FROM memory_records WHERE status = 'pending'").get()?.count), 0);
	assert.equal(Number(recovered.db.prepare("SELECT COUNT(*) AS count FROM memory_baselines WHERE status = 'building'").get()?.count), 0);
	assert.equal(recovered.db.prepare("SELECT baseline_id FROM baseline_heads WHERE scope = 'session' AND scope_key = 'session:a:file-a'").get()?.baseline_id, "prior-published");
	assert.equal(recovered.db.prepare("SELECT content FROM memory_baselines WHERE id = 'prior-published' AND status = 'published'").get()?.content, "prior safe head");

	const retry = recovered.claimPipeline("session:a:file-a", "source", "generation-retry", "owner-retry", Date.now(), 1_000);
	assert.ok(retry);
	assert.equal(retry.runId, lease.runId);
	recovered.close();
});

test("an expired lease cannot be revived or used to stage and publish", () => {
	const root = temporaryDirectory("pipeline-expired-fence");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const lease = store.claimPipeline("session:a:file-a", "source", "generation", "owner", 1_000, 10);
	assert.ok(lease);
	assert.equal(store.heartbeat(lease, 1_011, 10), false);
	assert.equal(store.stage1(lease, [pending("late-record", "late")], usage, 1_011), false);
	assert.equal(store.publish(lease, [baseline("late-baseline", "late")], usage, 1_011), false);
	assert.equal(Number(store.db.prepare("SELECT COUNT(*) AS count FROM memory_records").get()?.count), 0);
	assert.equal(Number(store.db.prepare("SELECT COUNT(*) AS count FROM memory_baselines").get()?.count), 0);
	store.close();
});

test("MemoryService heartbeats across both provider stages and publishes after the original lease window", async () => {
	const root = temporaryDirectory("pipeline-heartbeat");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const originalHeartbeat = store.heartbeat.bind(store);
	let heartbeatCalls = 0;
	store.heartbeat = (lease, now, leaseMs) => {
		heartbeatCalls += 1;
		return originalHeartbeat(lease, now, leaseMs);
	};
	const service = new MemoryService(identity(), () => emptyWorkState(), store, { leaseMs: 50, heartbeatMs: 5 });
	const provider: MemoryProvider = {
		async extract(_input: MemoryExtractionInput): Promise<ProviderResult<Array<{ scope: "session"; kind: "fact"; content: string; citation: string }>>> {
			await delay(40);
			return { value: [{ scope: "session", kind: "fact", content: "heartbeat record", citation: "test" }], usage };
		},
		async consolidate(_input: MemoryConsolidationInput): Promise<ProviderResult<Array<{ scope: "session"; content: string }>>> {
			await delay(40);
			return { value: [{ scope: "session", content: "heartbeat baseline" }], usage };
		},
	};
	const source = { text: "heartbeat source", hash: sha256("heartbeat source"), citation: "test" };
	const result = await service.runPipeline(source, "generation", provider, {
		isCurrentGeneration: () => true,
		currentSourceHash: () => source.hash,
	}, new AbortController().signal);
	assert.equal(result.status, "published");
	assert.ok(heartbeatCalls >= 2);
	assert.equal(store.latestRun(identity().sessionKey)?.status, "published");
	store.close();
});

test("concurrent runs from one MemoryService do not share an owner token", async () => {
	const root = temporaryDirectory("pipeline-attempt-owner");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const service = new MemoryService(identity(), () => emptyWorkState(), store, { leaseMs: 1_000, heartbeatMs: 100 });
	let releaseExtraction: (() => void) | undefined;
	let extractionStarted: (() => void) | undefined;
	const started = new Promise<void>((resolve) => { extractionStarted = resolve; });
	const released = new Promise<void>((resolve) => { releaseExtraction = resolve; });
	let extractCalls = 0;
	const provider: MemoryProvider = {
		async extract(): Promise<ProviderResult<Array<{ scope: "session"; kind: "fact"; content: string; citation: string }>>> {
			extractCalls += 1;
			extractionStarted?.();
			await released;
			return { value: [{ scope: "session", kind: "fact", content: "single owner", citation: "test" }], usage };
		},
		async consolidate(): Promise<ProviderResult<Array<{ scope: "session"; content: string }>>> {
			return { value: [{ scope: "session", content: "single baseline" }], usage };
		},
	};
	const source = { text: "same source", hash: sha256("same source"), citation: "test" };
	const guards = { isCurrentGeneration: () => true, currentSourceHash: () => source.hash };
	const first = service.runPipeline(source, "generation", provider, guards, new AbortController().signal);
	await started;
	const second = await service.runPipeline(source, "generation", provider, guards, new AbortController().signal);
	assert.equal(second.status, "superseded");
	assert.equal(extractCalls, 1);
	releaseExtraction?.();
	assert.equal((await first).status, "published");
	store.close();
});

test("a superseded source can be retried under a new generation and published", () => {
	const root = temporaryDirectory("pipeline-superseded-retry");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const first = store.claimPipeline("session:a:file-a", "same-source", "generation-old", "owner-old", 1_000, 100);
	assert.ok(first);
	assert.equal(store.finish(first, "superseded", "lifecycle changed", 1_010), true);
	const retry = store.claimPipeline("session:a:file-a", "same-source", "generation-new", "owner-new", 1_020, 100);
	assert.ok(retry);
	assert.equal(retry.runId, first.runId);
	assert.equal(store.stage1(retry, [pending("retry-record", "retry")], usage, 1_030), true);
	assert.equal(store.publish(retry, [baseline("retry-baseline", "retry baseline")], usage, 1_040), true);
	assert.equal(store.latestRun("session:a:file-a")?.status, "published");
	assert.equal(store.claimPipeline("session:a:file-a", "same-source", "generation-after-publish", "owner-late", 1_050, 100), undefined);
	store.close();
});

test("lease checks use a clock sampled inside the acquired SQLite transaction", () => {
	const root = temporaryDirectory("pipeline-lock-clock");
	const store = new MemoryStore(join(root, "memory.sqlite"));
	const lease = store.claimPipeline("session:a:file-a", "source", "generation", "owner", undefined, 20);
	assert.ok(lease);
	const originalTransaction = store.db.transaction.bind(store.db);
	const sleeper = new Int32Array(new SharedArrayBuffer(4));
	store.db.transaction = ((operation: () => unknown) => originalTransaction(() => {
		Atomics.wait(sleeper, 0, 0, 35);
		return operation();
	})) as typeof store.db.transaction;
	assert.equal(store.stage1(lease, [pending("late-after-lock", "late")], usage), false);
	store.db.transaction = originalTransaction;
	assert.equal(Number(store.db.prepare("SELECT COUNT(*) AS count FROM memory_records").get()?.count), 0);
	store.close();
});
