import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import extension from "../src/extension.js";
import { ContinuityStore } from "../src/infrastructure/continuity-store.js";
import { temporaryDirectory } from "./helpers.js";

interface FakeRuntime {
	api: ExtensionAPI;
	handlers: Map<string, Array<(event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown>>;
	toolNames: string[];
	commandNames: string[];
	statuses: string[];
	entries: Array<Record<string, unknown>>;
	gitCalls: number;
	ctx: ExtensionContext;
}

function fakeRuntime(mode: "tui" | "rpc" | "json" | "print", root: string): FakeRuntime {
	const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown>>();
	const toolNames: string[] = [];
	const commandNames: string[] = [];
	const entries: Array<Record<string, unknown>> = [{ id: "root", parentId: null, type: "custom", customType: "root", data: {} }];
	let leaf = "root";
	let gitCalls = 0;
	const statuses: string[] = [];
	const forbiddenUi = new Proxy({}, {
		get() {
			throw new Error(`TUI API accessed in ${mode} mode`);
		},
	});
	const tui = {
		setStatus(_key: string, value: string) { statuses.push(value); },
		notify() {},
	};
	const sessionManager = {
		getSessionId: () => `session-${mode}`,
		getSessionFile: () => join(root, `${mode}.jsonl`),
		getBranch: () => entries,
		getEntries: () => entries,
		getLeafId: () => leaf,
	};
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
		abort() {},
		hasPendingMessages: () => false,
		shutdown() {},
		getContextUsage: () => undefined,
		compact() {},
		getSystemPrompt: () => "",
	} as unknown as ExtensionContext;
	const api = {
		on(name: string, handler: (event: unknown, context: ExtensionContext) => Promise<unknown> | unknown) {
			const list = handlers.get(name) ?? [];
			list.push(handler);
			handlers.set(name, list);
		},
		registerTool(tool: { name: string }) { toolNames.push(tool.name); },
		registerCommand(name: string) { commandNames.push(name); },
		appendEntry(customType: string, data: unknown) {
			const id = `entry-${entries.length}`;
			entries.push({ id, parentId: leaf, type: "custom", customType, data });
			leaf = id;
		},
		async exec(command: string) {
			if (command === "git") gitCalls += 1;
			throw new Error("exec must not run in untrusted mode");
		},
	} as unknown as ExtensionAPI;
	const runtime: FakeRuntime = { api, handlers, toolNames, commandNames, statuses, entries, get gitCalls() { return gitCalls; }, ctx };
	return runtime;
}

test("direct !/!! bash mutation is durably resolved and embedded", async () => {
	const root = temporaryDirectory("direct-user-bash");
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, "continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, "memory");
	try {
		const runtime = fakeRuntime("rpc", root);
		extension(runtime.api);
		await emit(runtime, "session_start", { type: "session_start", reason: "startup" });
		const handler = runtime.handlers.get("user_bash")?.[0];
		assert.ok(handler);
		const command = "printf direct-bash-marker > direct-bash.txt";
		const override = await handler({ type: "user_bash", command, excludeFromContext: false }, runtime.ctx) as {
			operations?: { exec(command: string, cwd: string, options: { onData(data: Buffer): void; signal?: AbortSignal; timeout?: number; env?: NodeJS.ProcessEnv }): Promise<{ exitCode: number }> };
		};
		assert.ok(override.operations);
		const result = await override.operations.exec(command, root, { onData() {} });
		assert.equal(result.exitCode, 0);
		assert.equal(readFileSync(join(root, "direct-bash.txt"), "utf8"), "direct-bash-marker");
		await emit(runtime, "session_shutdown", { type: "session_shutdown", reason: "quit" });

		const store = new ContinuityStore(join(root, "continuity", "state.sqlite"));
		const tracked = store.db.prepare("SELECT kind, status, is_error FROM pending_mutations").get() as Record<string, unknown>;
		assert.equal(tracked.kind, "mutation");
		assert.equal(tracked.status, "determined");
		assert.equal(Number(tracked.is_error), 0);
		store.close();
	} finally {
		if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
		else process.env.PI_CONTINUITY_HOME = oldContinuity;
		if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
		else process.env.PI_WORK_MEMORY_HOME = oldMemory;
	}
});

test("TUI status is exact and a tracking fault fails closed to unavailable", async () => {
	const root = temporaryDirectory("tui-fail-closed");
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, "continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, "memory");
	try {
		const runtime = fakeRuntime("tui", root);
		extension(runtime.api);
		await emit(runtime, "session_start", { type: "session_start", reason: "startup" });
		assert.equal(runtime.statuses.at(-1), "continuity: degraded");
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		await emit(runtime, "tool_call", { type: "tool_call", toolCallId: "broken-track", toolName: "write", input: circular });
		assert.equal(runtime.statuses.at(-1), "continuity: unavailable");
		await emit(runtime, "turn_end", { type: "turn_end" });
		assert.equal(runtime.statuses.at(-1), "continuity: unavailable");
		await emit(runtime, "session_shutdown", { type: "session_shutdown", reason: "quit" });
	} finally {
		if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
		else process.env.PI_CONTINUITY_HOME = oldContinuity;
		if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
		else process.env.PI_WORK_MEMORY_HOME = oldMemory;
	}
});

for (const reason of ["manual", "threshold"] as const) {
	test(`${reason} compaction embeds the latest mutation state before and after compaction`, async () => {
		const root = temporaryDirectory(`compact-${reason}`);
		const oldContinuity = process.env.PI_CONTINUITY_HOME;
		const oldMemory = process.env.PI_WORK_MEMORY_HOME;
		process.env.PI_CONTINUITY_HOME = join(root, "continuity");
		process.env.PI_WORK_MEMORY_HOME = join(root, "memory");
		try {
			const runtime = fakeRuntime("rpc", root);
			extension(runtime.api);
			await emit(runtime, "session_start", { type: "session_start", reason: "startup" });
			await emit(runtime, "tool_call", { type: "tool_call", toolCallId: `mutation-${reason}`, toolName: "write", input: { path: "file.txt", content: reason } });
			await emit(runtime, "tool_result", { type: "tool_result", toolCallId: `mutation-${reason}`, toolName: "write", input: {}, isError: false, content: [{ type: "text", text: "written" }] });
			await emit(runtime, "session_before_compact", { type: "session_before_compact", reason, willRetry: false });
			const before = runtime.entries.at(-1)?.data as { state?: { mutationSequence?: number } };
			assert.equal(before.state?.mutationSequence, 1);
			await emit(runtime, "session_compact", { type: "session_compact", reason, willRetry: false });
			const after = runtime.entries.at(-1)?.data as { authority?: string; state?: { mutationSequence?: number; mutationStatus?: string } };
			assert.equal(after.authority, "embedded");
			assert.equal(after.state?.mutationSequence, 1);
			assert.equal(after.state?.mutationStatus, "determined");
			await emit(runtime, "session_shutdown", { type: "session_shutdown", reason: "quit" });
		} finally {
			if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
			else process.env.PI_CONTINUITY_HOME = oldContinuity;
			if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
			else process.env.PI_WORK_MEMORY_HOME = oldMemory;
		}
	});
}

async function emit(runtime: FakeRuntime, name: string, event: unknown): Promise<void> {
	for (const handler of runtime.handlers.get(name) ?? []) await handler(event, runtime.ctx);
}

for (const mode of ["rpc", "json", "print"] as const) {
	test(`${mode} mode loads safely without TUI calls or Git in an untrusted project`, async () => {
		const root = temporaryDirectory(`mode-${mode}`);
		const oldContinuity = process.env.PI_CONTINUITY_HOME;
		const oldMemory = process.env.PI_WORK_MEMORY_HOME;
		process.env.PI_CONTINUITY_HOME = join(root, "continuity");
		process.env.PI_WORK_MEMORY_HOME = join(root, "memory");
		try {
			const runtime = fakeRuntime(mode, root);
			extension(runtime.api);
			await emit(runtime, "session_start", { type: "session_start", reason: "startup" });
			assert.ok(runtime.toolNames.includes("continuity_status"));
			assert.ok(runtime.toolNames.includes("memory_search"));
			assert.deepEqual(runtime.commandNames.sort(), ["continuity", "memory"]);
			assert.equal(runtime.gitCalls, 0);
			await emit(runtime, "session_shutdown", { type: "session_shutdown", reason: "quit" });
		} finally {
			if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
			else process.env.PI_CONTINUITY_HOME = oldContinuity;
			if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
			else process.env.PI_WORK_MEMORY_HOME = oldMemory;
		}
	});
}
