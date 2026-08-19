export type ScheduledWorker = (signal: AbortSignal, generation: number, settledSerial: number) => Promise<void>;

export class MemoryScheduler {
	private generation = 0;
	private settledSerial = 0;
	private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
	private readonly controllers = new Set<AbortController>();
	private readonly workers = new Set<Promise<void>>();
	private shutdownState = false;
	private lastAgentRunAborted = false;

	constructor(private readonly debounceMs = 2_000) {}

	onAgentStart(): void {
		this.lastAgentRunAborted = false;
	}

	onAgentEnd(): void {
		// Intentionally empty. agent_end is not a stable boundary because Pi may
		// still retry, auto-compact, or consume queued follow-ups.
	}

	onAssistantMessageEnd(stopReason?: string): void {
		this.lastAgentRunAborted = stopReason === "aborted";
	}

	onAgentSettled(worker: ScheduledWorker): number {
		if (this.shutdownState || this.lastAgentRunAborted) {
			this.lastAgentRunAborted = false;
			return -1;
		}
		const serial = ++this.settledSerial;
		const generation = this.generation;
		const timer = setTimeout(() => {
			this.timers.delete(serial);
			if (this.shutdownState || generation !== this.generation) return;
			const controller = new AbortController();
			this.controllers.add(controller);
			const run = worker(controller.signal, generation, serial)
				.catch(() => undefined)
				.finally(() => this.controllers.delete(controller));
			this.workers.add(run);
			void run.then(() => this.workers.delete(run));
		}, this.debounceMs);
		this.timers.set(serial, timer);
		return serial;
	}

	invalidate(): void {
		this.generation += 1;
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
		for (const controller of this.controllers) controller.abort(new Error("memory lifecycle generation changed"));
		this.controllers.clear();
	}

	async shutdown(): Promise<void> {
		if (!this.shutdownState) {
			this.shutdownState = true;
			this.invalidate();
		}
		await Promise.allSettled([...this.workers]);
	}

	currentGeneration(): number {
		return this.generation;
	}

	pendingTimers(): number {
		return this.timers.size;
	}
}
