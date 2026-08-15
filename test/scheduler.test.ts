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
	scheduler.shutdown();
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
	scheduler.shutdown();
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
	scheduler.shutdown();
	await wait(10);
	assert.equal(aborted, true);
});
