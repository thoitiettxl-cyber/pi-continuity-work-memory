import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import extension from "../src/extension.js";
import { temporaryDirectory } from "./helpers.js";

interface ToolDefinitionLike {
	name: string;
	execute(id: string, params: Record<string, unknown>, signal: AbortSignal, update: undefined, ctx: ExtensionContext): Promise<{ content: Array<{ type: string; text?: string }>; details?: unknown }>;
}

interface Runtime {
	api: ExtensionAPI;
	ctx: ExtensionContext;
	handlers: Map<string, Array<(event: any, ctx: ExtensionContext) => Promise<any> | any>>;
	tools: Map<string, ToolDefinitionLike>;
	entries: Array<Record<string, any>>;
}

function runtime(root: string): Runtime {
	const handlers = new Map<string, Array<(event: any, ctx: ExtensionContext) => Promise<any> | any>>();
	const tools = new Map<string, ToolDefinitionLike>();
	const entries: Array<Record<string, any>> = [{ id: "root", parentId: null, type: "custom", customType: "root", data: {} }];
	let leaf = "root";
	const sessionManager = {
		getSessionId: () => "managed-workflow-session",
		getSessionFile: () => join(root, "session.jsonl"),
		getBranch: () => entries,
		getEntries: () => entries,
		getLeafId: () => leaf,
	};
	const ctx = {
		ui: new Proxy({}, { get() { throw new Error("TUI API must not be used in RPC workflow proof"); } }),
		mode: "rpc",
		hasUI: true,
		cwd: root,
		sessionManager,
		modelRegistry: {},
		model: undefined,
		scopedModels: [],
		isIdle: () => true,
		isProjectTrusted: () => true,
		signal: undefined,
		abort() {},
		hasPendingMessages: () => false,
		shutdown() {},
		getContextUsage: () => undefined,
		compact() {},
		getSystemPrompt: () => "",
	} as unknown as ExtensionContext;
	const api = {
		on(name: string, handler: (event: any, context: ExtensionContext) => Promise<any> | any) {
			const list = handlers.get(name) ?? [];
			list.push(handler);
			handlers.set(name, list);
		},
		registerTool(tool: ToolDefinitionLike) { tools.set(tool.name, tool); },
		registerCommand() {},
		appendEntry(customType: string, data: unknown) {
			const id = `entry-${entries.length}`;
			entries.push({ id, parentId: leaf, type: "custom", customType, data });
			leaf = id;
		},
		async exec(command: string, args: string[]) {
			if (command !== "git") return { stdout: "validation passed", stderr: "", code: 0, killed: false };
			const joined = args.join(" ");
			if (joined === "rev-parse --show-toplevel") return { stdout: `${root}\n`, stderr: "", code: 0, killed: false };
			if (joined === "rev-parse --verify HEAD") return { stdout: "head-managed\n", stderr: "", code: 0, killed: false };
			if (joined === "symbolic-ref --quiet --short HEAD") return { stdout: "main\n", stderr: "", code: 0, killed: false };
			if (joined === "status --porcelain=v2 -z --untracked-files=all") return { stdout: "", stderr: "", code: 0, killed: false };
			if (joined === "diff --no-ext-diff --binary --cached --" || joined === "diff --no-ext-diff --binary --") {
				return { stdout: "", stderr: "", code: 0, killed: false };
			}
			if (joined === "ls-files --others --exclude-standard -z") return { stdout: "", stderr: "", code: 0, killed: false };
			return { stdout: "", stderr: `unexpected git ${joined}`, code: 1, killed: false };
		},
	} as unknown as ExtensionAPI;
	return { api, ctx, handlers, tools, entries };
}

async function emit(runtime: Runtime, name: string, event: any): Promise<any[]> {
	const values = [];
	for (const handler of runtime.handlers.get(name) ?? []) values.push(await handler(event, runtime.ctx));
	return values;
}

const durableParams = {
	requestedMutation: true,
	authority: "resolved",
	spansSessions: true,
	coordinatesContributors: false,
	hasMeaningfulDependencies: true,
	recoverySensitive: true,
	externalSideEffects: false,
	cannotResumeSafelyFromDiff: true,
	resumeHint: "Read the bound plan before resuming.",
	document: {
		title: "Managed extension proof",
		slug: "managed-extension-proof",
		outcome: "Create exactly one repository execution plan.",
		authorityAndContext: ["AGENTS.md", "User request"],
		inScope: ["Workflow runtime"],
		outOfScope: ["Product policy"],
		constraints: ["No overwrite"],
		steps: ["Create plan", "Verify runtime"],
		risksAndRecovery: ["Remove only the task-owned plan during test cleanup."],
		validation: ["npm test"],
	},
};

test("trusted runtime loads package workflow, blocks unprepared mutation, and materializes one durable plan through public Pi APIs", async () => {
	const root = temporaryDirectory("managed-extension-runtime");
	await writeFile(join(root, "AGENTS.md"), "# Repository instructions\n", "utf8");
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, ".proof-continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, ".proof-memory");
	try {
		const proof = runtime(root);
		extension(proof.api);
		await emit(proof, "session_start", { type: "session_start", reason: "startup" });
		const staleEligibility = (await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "write-before-workflow-context",
			toolName: "write",
			input: { path: "src/stale.ts", content: "x" },
		}))[0];
		assert.equal(staleEligibility?.block, true);
		assert.match(staleEligibility?.reason ?? "", /eligibility was not established/);

		const before = await emit(proof, "before_agent_start", {
			type: "before_agent_start",
			prompt: "Implement durable work",
			systemPrompt: "base",
			systemPromptOptions: { contextFiles: [{ path: join(root, "AGENTS.md"), content: "# Repository instructions" }] },
		});
		assert.match(before[0]?.systemPrompt ?? "", /managed-repository-workflow/);
		assert.match(before[0]?.systemPrompt ?? "", /continuity_prepare_work/);

		const blocked = (await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "premature-write",
			toolName: "write",
			input: { path: "src/new.ts", content: "x" },
		}))[0];
		assert.equal(blocked?.block, true);
		assert.match(blocked?.reason ?? "", /continuity_prepare_work/);

		const prepare = proof.tools.get("continuity_prepare_work");
		assert.ok(prepare);
		const preflight = (await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "prepare-durable",
			toolName: "continuity_prepare_work",
			input: durableParams,
		}))[0];
		assert.equal(preflight, undefined);
		const result = await prepare.execute("prepare-durable", durableParams, new AbortController().signal, undefined, proof.ctx);
		await emit(proof, "tool_result", {
			type: "tool_result",
			toolCallId: "prepare-durable",
			toolName: "continuity_prepare_work",
			input: durableParams,
			isError: false,
			content: result.content,
		});
		assert.match(result.content[0]?.text ?? "", /created docs\/plans\/active\/managed-extension-proof\.md/);
		const plan = await readFile(join(root, "docs", "plans", "active", "managed-extension-proof.md"), "utf8");
		assert.match(plan, /pi-continuity-work-document/);
		assert.match(plan, /Managed extension proof/);
		assert.match(plan, /Pending implementation and executable proof/);

		const allowed = (await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "prepared-write",
			toolName: "write",
			input: { path: "src/new.ts", content: "x" },
		}))[0];
		assert.equal(allowed, undefined);
		await emit(proof, "tool_result", {
			type: "tool_result",
			toolCallId: "prepared-write",
			toolName: "write",
			input: {},
			isError: false,
			content: [{ type: "text", text: "written" }],
		});
		const finalize = proof.tools.get("continuity_finalize_work")!;
		assert.equal((await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "finalize-without-current-proof",
			toolName: "continuity_finalize_work",
			input: {},
		}))[0], undefined);
		const notFinalized = await finalize.execute("finalize-without-current-proof", {}, new AbortController().signal, undefined, proof.ctx);
		await emit(proof, "tool_result", {
			type: "tool_result",
			toolCallId: "finalize-without-current-proof",
			toolName: "continuity_finalize_work",
			input: {},
			isError: false,
			content: notFinalized.content,
		});
		assert.match(notFinalized.content[0]?.text ?? "", /No receipt-bound executable validation/);
		assert.match(await readFile(join(root, "docs", "plans", "active", "managed-extension-proof.md"), "utf8"), /Pending implementation/);
		await assert.rejects(access(join(root, "docs", "plans", "completed", "managed-extension-proof.md")));

		await assert.rejects(access(join(root, "docs", "plans", "active", "managed-extension-proof-2.md")));
		await assert.rejects(access(join(root, "docs", "plans", "active", "managed-extension-proof-2.md")));
		await emit(proof, "session_shutdown", { type: "session_shutdown", reason: "quit" });
	} finally {
		if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
		else process.env.PI_CONTINUITY_HOME = oldContinuity;
		if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
		else process.env.PI_WORK_MEMORY_HOME = oldMemory;
	}
});

test("untrusted runtime exposes guidance but creates no repository document", async () => {
	const root = temporaryDirectory("managed-extension-untrusted");
	const proof = runtime(root);
	(proof.ctx as any).isProjectTrusted = () => false;
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, ".proof-continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, ".proof-memory");
	try {
		extension(proof.api);
		await emit(proof, "session_start", { type: "session_start", reason: "startup" });
		await emit(proof, "before_agent_start", {
			type: "before_agent_start",
			prompt: "Implement durable work",
			systemPrompt: "base",
			systemPromptOptions: { contextFiles: [{ path: join(root, "AGENTS.md"), content: "untrusted" }] },
		});
		const prepare = proof.tools.get("continuity_prepare_work")!;
		await assert.rejects(prepare.execute("untrusted-prepare", durableParams, new AbortController().signal, undefined, proof.ctx), /untrusted/);
		await assert.rejects(access(join(root, "docs")));
		await emit(proof, "session_shutdown", { type: "session_shutdown", reason: "quit" });
	} finally {
		if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
		else process.env.PI_CONTINUITY_HOME = oldContinuity;
		if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
		else process.env.PI_WORK_MEMORY_HOME = oldMemory;
	}
});

test("web search, X search, and MCP discovery stay unblocked before managed workflow preparation", async () => {
	const root = temporaryDirectory("managed-extension-search-discovery");
	await writeFile(join(root, "AGENTS.md"), "# Repository instructions\n", "utf8");
	const oldContinuity = process.env.PI_CONTINUITY_HOME;
	const oldMemory = process.env.PI_WORK_MEMORY_HOME;
	process.env.PI_CONTINUITY_HOME = join(root, ".proof-continuity");
	process.env.PI_WORK_MEMORY_HOME = join(root, ".proof-memory");
	try {
		const proof = runtime(root);
		extension(proof.api);
		await emit(proof, "session_start", { type: "session_start", reason: "startup" });
		for (const [toolCallId, toolName, input] of [
			["discover-web", "web_search", { query: "Continuity managed workflow" }],
			["discover-x", "x_search", { query: "public posts about Continuity search gating" }],
			["discover-mcp-status", "mcp", {}],
			["discover-mcp-tool", "mcp", { tool: "search_openai_docs", args: { query: "responses api" } }],
			["discover-mcp-script", "mcpScript", { code: "emit(1)" }],
		] as const) {
			const decision = (await emit(proof, "tool_call", {
				type: "tool_call",
				toolCallId,
				toolName,
				input,
			}))[0];
			assert.equal(decision, undefined, `${toolName} must not be blocked as repository mutation`);
		}
		const blockedWrite = (await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "write-still-gated",
			toolName: "write",
			input: { path: "src/new.ts", content: "x" },
		}))[0];
		assert.equal(blockedWrite?.block, true);
		const blockedAuth = (await emit(proof, "tool_call", {
			type: "tool_call",
			toolCallId: "mcp-auth-still-gated",
			toolName: "mcp",
			input: { action: "auth-start", server: "openai-docs" },
		}))[0];
		assert.equal(blockedAuth?.block, true);
		await emit(proof, "session_shutdown", { type: "session_shutdown", reason: "quit" });
	} finally {
		if (oldContinuity === undefined) delete process.env.PI_CONTINUITY_HOME;
		else process.env.PI_CONTINUITY_HOME = oldContinuity;
		if (oldMemory === undefined) delete process.env.PI_WORK_MEMORY_HOME;
		else process.env.PI_WORK_MEMORY_HOME = oldMemory;
	}
});
