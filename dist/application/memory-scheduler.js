export class MemoryScheduler {
    debounceMs;
    generation = 0;
    settledSerial = 0;
    timers = new Map();
    controllers = new Set();
    shutdownState = false;
    constructor(debounceMs = 2_000) {
        this.debounceMs = debounceMs;
    }
    onAgentEnd() {
        // Intentionally empty. agent_end is not a stable boundary because Pi may
        // still retry, auto-compact, or consume queued follow-ups.
    }
    onAgentSettled(worker) {
        if (this.shutdownState)
            return -1;
        const serial = ++this.settledSerial;
        const generation = this.generation;
        const timer = setTimeout(() => {
            this.timers.delete(serial);
            if (this.shutdownState || generation !== this.generation)
                return;
            const controller = new AbortController();
            this.controllers.add(controller);
            void worker(controller.signal, generation, serial)
                .catch(() => undefined)
                .finally(() => this.controllers.delete(controller));
        }, this.debounceMs);
        this.timers.set(serial, timer);
        return serial;
    }
    invalidate() {
        this.generation += 1;
        for (const timer of this.timers.values())
            clearTimeout(timer);
        this.timers.clear();
        for (const controller of this.controllers)
            controller.abort(new Error("memory lifecycle generation changed"));
        this.controllers.clear();
    }
    shutdown() {
        if (this.shutdownState)
            return;
        this.shutdownState = true;
        this.invalidate();
    }
    currentGeneration() {
        return this.generation;
    }
    pendingTimers() {
        return this.timers.size;
    }
}
//# sourceMappingURL=memory-scheduler.js.map