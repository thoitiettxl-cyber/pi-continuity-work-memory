import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";

import extension from "../src/extension.js";
import { CONTEXT_PRESSURE_CUSTOM_TYPE, CONTEXT_PRESSURE_STATUS_KEY } from "../src/application/context-pressure-governor.js";
import { temporaryDirectory } from "./helpers.js";

type Mode = "tui" | "rpc" | "json" | "print";
type Handler = (event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown;
type TestMessage = Record<string, unknown>;

interface ContextResult {
	messages?: TestMessage[];
}

interface TestCommand {
	handler(args: string, ctx: ExtensionCommandContext): Promise<void> | void;
}

interface Runtime {
	api: ExtensionAPI;
	ctx: ExtensionCommandContext;
	handlers: Map<string, Handler[]>;
	commands: Map<string, TestCommand>;
	entries: Array<Record<string, unknown>>;
	statuses: Array<{ key: string; value: string | undefined }>;
	notifications: string[];
	usage: { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
	usageFailure: Error | undefined;
	calls: {
		abort: number;
		compact: number;
		sendMessage: number;
		sendUserMessage: number;
		appendEntry: number;
	};
}

function createRuntime(mode: Mode, root: string): Runtime {
	const handlers = new Map<string, Handler[]>();
	const commands = new Map<string, TestCommand>();
	const entries: Array<Record<string, unknown>> = [{ id: "root", parentId: null, type: "custom", customType: "root", data: {} }];
	const statuses: Array<{ key: string; value: string | undefined }> = [];
	const notifications: string[] = [];
	const calls = { abort: 0, compact: 0, sendMessage: 0, sendUserMessage: 0, appendEntry: 0 };
	let leaf = "root";
	const forbiddenUi = new Proxy({}, {
		get() {
			throw new Error(`UI API accessed in ${mode} mode`);
		},
	});
	const tui = {
		setStatus(key: string, value: string | undefined) { statuses.push({ key, value }); },
		notify(message: string) { notifications.push(message); },
	};
	const sessionManager = {
		getSessionId: () => `context-pressure-${mode}`,
		getSessionFile: () => join(root, `${mode}.jsonl`),
		getBranch: () => entries,
		getEntries: () => entries,
		getLeafId: () => leaf,
	};
	const runtime = {} as Runtime;
	const ctx = {
		ui: mode === "tui" ? tui : forbiddenUi,
		mode,
		hasUI: mode === "tui" || mode === "rpc",
		cwd: root,
		sessionManager,
		modelRegistry: {},
		model: undefined,
		scopedModels: [],
		isIdle: () => true,
		isProjectTrusted: () => false,
		signal: undefined,
		abort() { calls.abort += 1; },
		hasPendingMessages: () => false,
		shutdown() {},
		getContextUsage: () => {
			if (runtime.usageFailure) throw runtime.usageFailure;
			return runtime.usage;
		},
		compact() { calls.compact += 1; },
		getSystemPrompt: () => "",
		getSystemPromptOptions: () => ({ cwd: root, contextFiles: [] }),
	} as unknown as ExtensionCommandContext;
	const api = {
		on(name: string, handler: Handler) {
			const list = handlers.get(name) ?? [];
			list.push(handler);
			handlers.set(name, list);
		},
		registerTool() {},
		registerCommand(name: string, command: TestCommand) {
			commands.set(name, command);
		},
		appendEntry(customType: string, data: unknown) {
			calls.appendEntry += 1;
			const id = `entry-${entries.length}`;
			entries.push({ id, parentId: leaf, type: "custom", customType, data });
			leaf = id;
		},
		sendMessage() { calls.sendMessage += 1; },
		sendUserMessage() { calls.sendUserMessage += 1; },
		async exec() {
			throw new Error("Git or validation command must not run in an untrusted context-pressure test");
		},
	} as unknown as ExtensionAPI;
	Object.assign(runtime, {
		api,
		ctx,
		handlers,
		commands,
		entries,
		statuses,
		notifications,
		usage: undefined,
		usageFailure: undefined,
		calls,
	});
	return runtime;
}

async function emit(runtime: Runtime, name: string, event: unknown): Promise<unknown[]> {
	const results = [];
	for (const handler of runtime.handlers.get(name) ?? []) results.push(await handler(event, runtime.ctx));
	return results;
}

async function context(runtime: Runtime, messages: TestMessage[]): Promise<ContextResult | undefined> {
	const results = await emit(runtime, "context", { type: "context", messages });
	return results[0] as ContextResult | undefined;
}

async function withRuntime(mode: Mode, body: (runtime: Runtime) => Promise<void>): Promise<void> {
	const root = temporaryDirectory(`context-pressure-${mode}`);
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, "continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, "memory");
	const runtime = createRuntime(mode, root);
	extension(runtime.api);
	try {
		await emit(runtime, "session_start", { type: "session_start", reason: "startup" });
		await body(runtime);
	} finally {
		await emit(runtime, "session_shutdown", { type: "session_shutdown", reason: "quit" });
		if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
		else process.env.PI_CONTINUITY_HOME = oldContinuity;
		if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
		else process.env.PI_WORK_MEMORY_HOME = oldMemory;
	}
}

const baseMessage: TestMessage = { role: "user", content: "work", timestamp: 1 };

function governorMessages(messages: TestMessage[]): TestMessage[] {
	return messages.filter((message) => message.role === "custom" && message.customType === CONTEXT_PRESSURE_CUSTOM_TYPE);
}

function messageText(message: TestMessage | undefined): string {
	return typeof message?.content === "string" ? message.content : "";
}

test("normal TUI usage leaves provider context unchanged", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 50_000, contextWindow: 131_072, percent: 38 };
		const messages = [baseMessage];
		assert.equal(await context(runtime, messages), undefined);
		assert.deepEqual(messages, [baseMessage]);
	});
});

test("pressured calls append exactly one ephemeral advisory without mutating input", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 1 };
		const original = { ...baseMessage };
		const stale = {
			role: "custom",
			customType: CONTEXT_PRESSURE_CUSTOM_TYPE,
			content: "stale",
			display: false,
			timestamp: 2,
		};
		const other = {
			role: "custom",
			customType: "other-extension",
			content: "preserve",
			display: false,
			timestamp: 3,
		};
		const messages = [original, other, stale];
		const beforeEntries = runtime.entries.length;
		const beforeCalls = { ...runtime.calls };
		const first = await context(runtime, messages);
		assert.ok(first?.messages);
		assert.equal(first.messages.at(-1)?.role, "custom");
		assert.equal(first.messages.at(-1)?.customType, CONTEXT_PRESSURE_CUSTOM_TYPE);
		assert.equal(first.messages.at(-1)?.display, false);
		assert.equal(typeof first.messages.at(-1)?.timestamp, "number");
		assert.match(messageText(first.messages.at(-1)), /level="pressure"/);
		assert.equal(governorMessages(first.messages).length, 1);
		assert.equal(first.messages[1], other);
		assert.deepEqual(messages, [original, other, stale]);
		assert.deepEqual(original, baseMessage);

		const second = await context(runtime, [original]);
		assert.equal(governorMessages(second?.messages ?? []).length, 1);
		assert.equal(runtime.entries.length, beforeEntries);
		assert.equal(runtime.calls.appendEntry, beforeCalls.appendEntry);
		assert.equal(runtime.calls.abort, beforeCalls.abort);
		assert.equal(runtime.calls.compact, beforeCalls.compact);
		assert.equal(runtime.calls.sendMessage, beforeCalls.sendMessage);
		assert.equal(runtime.calls.sendUserMessage, beforeCalls.sendUserMessage);
		assert.equal(runtime.statuses.filter((status) => status.value === "context: pressure").length, 1);
	});
});

test("critical and over-limit calls render their active severity", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 115_000, contextWindow: 131_072, percent: 10 };
		const critical = await context(runtime, [baseMessage]);
		assert.match(messageText(critical?.messages?.at(-1)), /level="critical"/);
		runtime.usage = { tokens: 140_000, contextWindow: 131_072, percent: 10 };
		const overLimit = await context(runtime, [baseMessage]);
		assert.match(messageText(overLimit?.messages?.at(-1)), /level="over-limit"/);
		assert.equal(runtime.statuses.at(-1)?.value, "context: over configured window");
	});
});

test("successful compaction resets pressure and unknown post-compaction usage stays quiet", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		await emit(runtime, "session_compact", { type: "session_compact", reason: "manual", willRetry: false });
		assert.equal(runtime.statuses.at(-1)?.key, CONTEXT_PRESSURE_STATUS_KEY);
		assert.equal(runtime.statuses.at(-1)?.value, undefined);
		runtime.usage = { tokens: null, contextWindow: 131_072, percent: null };
		assert.equal(await context(runtime, [baseMessage]), undefined);
	});
});

test("a new session lifecycle resets pressure and restores default TUI enablement", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		await runtime.commands.get("continuity")?.handler("context-governor off", runtime.ctx);
		await emit(runtime, "session_shutdown", { type: "session_shutdown", reason: "new" });
		await emit(runtime, "session_start", { type: "session_start", reason: "new" });

		runtime.usage = { tokens: 10_000, contextWindow: 131_072, percent: 8 };
		assert.equal(await context(runtime, [baseMessage]), undefined);
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
	});
});

test("model and tree replacement each begin a fresh pressure epoch", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		await emit(runtime, "model_select", { type: "model_select", model: {}, previousModel: undefined, source: "set" });
		runtime.usage = { tokens: 10_000, contextWindow: 131_072, percent: 8 };
		assert.equal(await context(runtime, [baseMessage]), undefined);

		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		await emit(runtime, "session_tree", { type: "session_tree", newLeafId: "root", oldLeafId: "other" });
		runtime.usage = { tokens: 10_000, contextWindow: 131_072, percent: 8 };
		assert.equal(await context(runtime, [baseMessage]), undefined);
	});
});

for (const mode of ["rpc", "json", "print"] as const) {
	test(`${mode} mode does not touch UI or transform context`, async () => {
		await withRuntime(mode, async (runtime) => {
			runtime.usage = { tokens: 140_000, contextWindow: 131_072, percent: 107 };
			const messages = [baseMessage];
			assert.equal(await context(runtime, messages), undefined);
			assert.deepEqual(messages, [baseMessage]);
			await runtime.commands.get("continuity")?.handler("context-governor on", runtime.ctx);
			assert.equal(await context(runtime, messages), undefined);
		});
	});
}

test("TUI controls report bounded metadata and disable or enable the next transformation", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 1 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		const command = runtime.commands.get("continuity");
		assert.ok(command);
		await command.handler("context-governor status", runtime.ctx);
		const report = runtime.notifications.at(-1) ?? "";
		assert.match(report, /Context governor: on; active; mode=tui/);
		assert.match(report, /Observed=pressure; active=pressure/);
		assert.match(report, /Usage=100,000\/131,072 tokens \(76%\)/);
		assert.ok(report.length <= 1_200);
		assert.ok(!report.includes(runtime.ctx.cwd));

		await command.handler("context-governor off", runtime.ctx);
		assert.equal(runtime.statuses.at(-1)?.value, undefined);
		assert.equal(await context(runtime, [baseMessage]), undefined);

		await command.handler("context-governor on", runtime.ctx);
		assert.ok((await context(runtime, [baseMessage]))?.messages);
	});
});

test("agent settlement recommends explicit compaction only while pressure remains", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		await emit(runtime, "agent_settled", { type: "agent_settled" });
		assert.equal(runtime.statuses.at(-1)?.value, "context: /compact recommended");

		await emit(runtime, "session_compact", { type: "session_compact", reason: "threshold", willRetry: false });
		await emit(runtime, "agent_settled", { type: "agent_settled" });
		assert.notEqual(runtime.statuses.at(-1)?.value, "context: /compact recommended");
	});
});

test("usage failures fail open locally without compromising ordinary execution", async () => {
	await withRuntime("tui", async (runtime) => {
		runtime.usage = { tokens: 100_000, contextWindow: 131_072, percent: 76 };
		assert.ok((await context(runtime, [baseMessage]))?.messages);
		runtime.usageFailure = new Error("usage unavailable");
		assert.equal(await context(runtime, [baseMessage]), undefined);
		assert.equal(runtime.statuses.at(-1)?.key, CONTEXT_PRESSURE_STATUS_KEY);
		assert.equal(runtime.statuses.at(-1)?.value, undefined);
	});
});
