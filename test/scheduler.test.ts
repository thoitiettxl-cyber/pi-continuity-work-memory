import assert from "node:assert/strict";
import test from "node:test";

import { MemoryScheduler } from "../src/application/memory-scheduler.js";

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("agent_end cannot start a worker; one settled event creates one eligible run", async () => {
	const scheduler = new MemoryScheduler(5);
	let runs = 0;
	scheduler.onAgentEnd();
	await wait(15);
	assert.equal(runs, 0);
	scheduler.onAgentSettled(async () => { runs += 1; });
	await wait(20);
	assert.equal(runs, 1);
	await scheduler.shutdown();
});

test("an aborted settled run does not schedule memory extraction", async () => {
	const scheduler = new MemoryScheduler(1);
	let runs = 0;
	scheduler.onAgentStart();
	scheduler.onAssistantMessageEnd("aborted");
	assert.equal(scheduler.onAgentSettled(async () => { runs += 1; }), -1);
	await wait(10);
	assert.equal(runs, 0);
	await scheduler.shutdown();
});

test("tree/session replacement invalidates old timers", async () => {
	const scheduler = new MemoryScheduler(30);
	let runs = 0;
	scheduler.onAgentSettled(async () => { runs += 1; });
	assert.equal(scheduler.pendingTimers(), 1);
	scheduler.invalidate();
	await wait(50);
	assert.equal(runs, 0);
	assert.equal(scheduler.pendingTimers(), 0);
	await scheduler.shutdown();
});

test("shutdown aborts active Stage 1/consolidator controller", async () => {
	const scheduler = new MemoryScheduler(1);
	let aborted = false;
	scheduler.onAgentSettled(async (signal) => {
		await new Promise<void>((resolve) => {
			if (signal.aborted) {
				aborted = true;
				resolve();
				return;
			}
			signal.addEventListener("abort", () => {
				aborted = true;
				resolve();
			}, { once: true });
		});
	});
	await wait(10);
	await scheduler.shutdown();
	await wait(10);
	assert.equal(aborted, true);
});

test("shutdown waits for an active worker before resolving", async () => {
	const scheduler = new MemoryScheduler(1);
	let resolveStarted!: () => void;
	let resolveWorker!: () => void;
	const started = new Promise<void>((resolve) => { resolveStarted = resolve; });
	const workerDone = new Promise<void>((resolve) => { resolveWorker = resolve; });
	scheduler.onAgentSettled(async () => {
		resolveStarted();
		await workerDone;
	});
	await started;
	let shutdownFinished = false;
	const shutdown = scheduler.shutdown().then(() => { shutdownFinished = true; });
	await wait(5);
	assert.equal(shutdownFinished, false);
	resolveWorker();
	await shutdown;
	assert.equal(shutdownFinished, true);
});
