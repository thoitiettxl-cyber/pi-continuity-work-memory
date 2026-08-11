export type ScheduledWorker = (signal: AbortSignal, generation: number, settledSerial: number) => Promise<void>;
export declare class MemoryScheduler {
    private readonly debounceMs;
    private generation;
    private settledSerial;
    private readonly timers;
    private readonly controllers;
    private shutdownState;
    constructor(debounceMs?: number);
    onAgentEnd(): void;
    onAgentSettled(worker: ScheduledWorker): number;
    invalidate(): void;
    shutdown(): void;
    currentGeneration(): number;
    pendingTimers(): number;
}
//# sourceMappingURL=memory-scheduler.d.ts.map