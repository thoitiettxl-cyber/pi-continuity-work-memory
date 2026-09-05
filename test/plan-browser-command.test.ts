import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, RegisteredCommand } from "@earendil-works/pi-coding-agent";

import extension from "../src/extension.js";
import { ExecutionPlanFileService } from "../src/infrastructure/execution-plan-files.js";
import { FakeCommandRunner, temporaryDirectory } from "./helpers.js";

async function browserRuntime(mode: "tui" | "rpc" | "json" | "print" = "tui", trusted = true) {
	const root = temporaryDirectory("plan-browser-command");
	const repository = join(root, "repository");
	await mkdir(repository);
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, "continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, "memory");
	const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();
	const commands = new Map<string, RegisteredCommand>();
	const entries: Array<Record<string, unknown>> = [{ id: "root", parentId: null, type: "custom", customType: "root", data: {} }];
	const runner = new FakeCommandRunner(repository);
	const notices: string[] = [];
	let editor = "existing draft";
	let calls = 0;
	let choose: () => Promise<unknown> = async () => undefined;
	let idle = true;
	let currentTrust = trusted;
	const ui = {
		setStatus() {},
		notify(message: string) { notices.push(message); },
		getEditorText() { return editor; },
		setEditorText(value: string) { editor = value; },
		async custom() { calls++; return choose(); },
	};
	const ctx = {
		cwd: repository, mode, hasUI: mode === "tui" || mode === "rpc",
		ui: mode === "tui" ? ui : new Proxy({}, { get() { assert.fail("non-TUI UI access"); } }),
		isProjectTrusted: () => currentTrust,
		isIdle: () => idle,
		getSystemPromptOptions: () => ({ contextFiles: [] }),
		sessionManager: {
			getSessionId: () => "browser-session", getSessionFile: () => join(root, "session.jsonl"),
			getBranch: () => entries, getEntries: () => entries, getLeafId: () => String(entries.at(-1)!.id),
		},
	} as unknown as ExtensionCommandContext;
	const api = {
		on(name: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		registerCommand(name: string, command: RegisteredCommand) { commands.set(name, command); },
		registerTool() {},
		appendEntry(customType: string, data: unknown) {
			entries.push({ id: `entry-${entries.length}`, parentId: entries.at(-1)!.id, type: "custom", customType, data });
		},
		exec: (command: string, args: string[]) => runner.run(command, args),
		sendMessage() { assert.fail("browser must not send messages"); },
		sendUserMessage() { assert.fail("browser must not submit prompts"); },
	} as unknown as ExtensionAPI;
	const emit = async (name: string) => {
		for (const handler of handlers.get(name) ?? []) await handler({ type: name, reason: name === "session_start" ? "startup" : "quit" }, ctx);
	};
	extension(api);
	await emit("session_start");
	return {
		root: repository, ctx, entries, notices, runner, emit,
		command: (args = "plans") => commands.get("continuity")!.handler(args, ctx),
		get editor() { return editor; }, get calls() { return calls; },
		setChoose(value: () => Promise<unknown>) { choose = value; },
		setIdle(value: boolean) { idle = value; },
		setTrust(value: boolean) { currentTrust = value; },
		async close() {
			await emit("session_shutdown");
			if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
			else process.env.PI_CONTINUITY_HOME = oldContinuity;
			if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
			else process.env.PI_WORK_MEMORY_HOME = oldMemory;
		},
	};
}

async function fixture(runtime: Awaited<ReturnType<typeof browserRuntime>>, status = "active") {
	const path = `docs/plans/${status}/example.md`;
	await mkdir(join(runtime.root, "docs/plans", status), { recursive: true });
	const content = "# Example\n\n## Status\n\nIn progress\n\n## Result\n\nPending\n";
	await writeFile(join(runtime.root, path), content);
	const files = await ExecutionPlanFileService.open(runtime.root);
	return { plan: await files.readExecutionPlan(path), content };
}

test("plans Work prepares an editor draft without submitting, binding or modifying task state", async () => {
	const runtime = await browserRuntime();
	try {
		const { plan, content } = await fixture(runtime);
		const before = JSON.stringify(runtime.entries);
		runtime.setChoose(async () => ({ plan, action: "work", query: "example", scope: "all" }));
		await runtime.command("plans example");
		assert.equal(runtime.calls, 1);
		assert.ok(runtime.editor.startsWith("existing draft\n\n"));
		assert.match(runtime.editor, /docs\/plans\/active\/example\.md/);
		assert.match(runtime.editor, /Read|read/);
		assert.equal(JSON.stringify(runtime.entries), before);
		assert.equal(await readFile(join(runtime.root, plan.relativePath), "utf8"), content);
	} finally { await runtime.close(); }
});

for (const mode of ["rpc", "json", "print"] as const) {
	test(`${mode} plans is inert even when the repository is trusted`, async () => {
		const runtime = await browserRuntime(mode);
		try {
			await runtime.command();
			assert.equal(runtime.calls, 0);
			assert.deepEqual(await readdir(runtime.root), []);
		} finally { await runtime.close(); }
	});
}

test("untrusted, non-repository and busy TUI requests do not open the browser", async () => {
	const untrusted = await browserRuntime("tui", false);
	try {
		await untrusted.command();
		assert.equal(untrusted.calls, 0);
		assert.equal(untrusted.runner.commands.length, 0);
		assert.deepEqual(await readdir(untrusted.root), []);
	} finally { await untrusted.close(); }
	const busy = await browserRuntime();
	try {
		busy.setIdle(false);
		await busy.command();
		assert.equal(busy.calls, 0);
		assert.match(busy.notices.join(" "), /idle/);
	} finally { await busy.close(); }
});

test("empty catalog and cancel create no plan directory or editor changes", async () => {
	const runtime = await browserRuntime();
	try {
		await runtime.command();
		assert.equal(runtime.calls, 1);
		assert.equal(runtime.editor, "existing draft");
		assert.deepEqual(await readdir(runtime.root), []);
	} finally { await runtime.close(); }
});

test("completed plan supports read-only Refine but never Work", async () => {
	const runtime = await browserRuntime();
	try {
		const { plan } = await fixture(runtime, "completed");
		runtime.setChoose(async () => ({ plan, action: "work", query: "", scope: "all" }));
		await runtime.command();
		assert.equal(runtime.editor, "existing draft");
		runtime.setChoose(async () => ({ plan, action: "refine", query: "", scope: "all" }));
		await runtime.command();
		assert.match(runtime.editor, /Review this plan read-only/);
		assert.match(runtime.editor, /Do not edit files/);
	} finally { await runtime.close(); }
});

for (const replacement of ["changed-file", "session_tree", "session_shutdown", "trust-revoked", "busy", "input"] as const) {
	test(`pending selection is discarded after ${replacement}`, async () => {
		const runtime = await browserRuntime();
		try {
			const { plan } = await fixture(runtime);
			runtime.setChoose(async () => {
				if (replacement === "changed-file") await writeFile(join(runtime.root, plan.relativePath), "# Changed\n");
				else if (replacement === "trust-revoked") runtime.setTrust(false);
				else if (replacement === "busy") runtime.setIdle(false);
				else await runtime.emit(replacement);
				return { plan, action: "work", query: "", scope: "all" };
			});
			await runtime.command();
			assert.equal(runtime.editor, "existing draft");
		} finally { await runtime.close(); }
	});
}

test("a plan changed while Markdown detail is open cannot become a stale draft", async () => {
	const runtime = await browserRuntime();
	try {
		const { plan } = await fixture(runtime);
		runtime.setChoose(async () => {
			if (runtime.calls === 1) return { plan, action: "view", query: "", scope: "all" };
			await writeFile(join(runtime.root, plan.relativePath), "# Edited in another process\n");
			return "work";
		});
		await runtime.command();
		assert.equal(runtime.calls, 2);
		assert.equal(runtime.editor, "existing draft");
		assert.match(runtime.notices.join(" "), /changed/);
	} finally { await runtime.close(); }
});
