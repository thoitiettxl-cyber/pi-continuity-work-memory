import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
	fauxAssistantMessage,
	fauxProvider,
	fauxToolCall,
	type ToolResultMessage,
} from "@earendil-works/pi-ai";
import {
	createAgentSession,
	DefaultResourceLoader,
	type AgentSession,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

import { ContinuityService, type ToolCallDecision } from "../src/application/continuity-service.js";
import { ContinuityStore } from "../src/infrastructure/continuity-store.js";
import { GitFingerprintService } from "../src/infrastructure/git-fingerprint.js";
import { branch, FakeCommandRunner, identity, temporaryDirectory } from "./helpers.js";

function toolResultText(message: ToolResultMessage): string {
	return message.content
		.filter((item) => item.type === "text")
		.map((item) => item.text)
		.join("\n");
}

test("an uncertain recovered operation is blocked without ending the Pi agent run", async () => {
	const root = temporaryDirectory("recoverable-agent-block");
	try {
		const storePath = join(root, "continuity.sqlite");
		const active = branch(["root", "work"]);
		const runner = new FakeCommandRunner(root);
		const command = `python3 ${join(root, "eta_locale_check.py")}`;
		const input = { command };

		const originalStore = new ContinuityStore(storePath);
		try {
			const original = new ContinuityService(identity(), root, originalStore, new GitFingerprintService(runner), runner);
			original.initialize(active);
			await original.observeToolCall({
				toolCallId: "python-check-original",
				toolName: "bash",
				input,
				branch: active,
			});
		} finally {
			originalStore.close();
		}

		const store = new ContinuityStore(storePath);
		let session: AgentSession | undefined;
		try {
			const service = new ContinuityService(identity(), root, store, new GitFingerprintService(runner), runner);
			service.initialize(active);
			const commandsBeforeRecovery = runner.commands.length;
			const recovered = service.recover(active);
			assert.equal(recovered.mutationUncertain, true);
			assert.equal(runner.commands.length, commandsBeforeRecovery, "recovery must not execute or inspect the old operation");

			const faux = fauxProvider({ provider: "continuity-agent-loop-test" });
			faux.setResponses([
				fauxAssistantMessage(
					fauxToolCall("bash", input, { id: "python-check-retry" }),
					{ stopReason: "toolUse" },
				),
				fauxAssistantMessage("Handled the Continuity block and continued."),
			]);

			const modelRuntime = await ModelRuntime.create({
				authPath: join(root, "auth.json"),
				modelsPath: null,
				refreshOnCreate: false,
			});
			modelRuntime.registerNativeProvider(faux.provider);
			const settingsManager = SettingsManager.inMemory({
				compaction: { enabled: false },
				retry: { enabled: false },
			}, { projectTrusted: true });
			let observedDecision: ToolCallDecision | undefined;
			const resourceLoader = new DefaultResourceLoader({
				cwd: root,
				agentDir: root,
				settingsManager,
				extensionFactories: [{
					name: "recoverable-continuity-block",
					factory(pi) {
						pi.on("tool_call", async (event) => {
							if (event.toolName !== "bash") return undefined;
							observedDecision = await service.observeToolCall({
								toolCallId: event.toolCallId,
								toolName: event.toolName,
								input: event.input,
								branch: active,
							});
							return observedDecision;
						});
					},
				}],
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
				noContextFiles: true,
				systemPrompt: "Test Continuity tool-call lifecycle behavior.",
			});
			await resourceLoader.reload();

			({ session } = await createAgentSession({
				cwd: root,
				agentDir: root,
				modelRuntime,
				model: faux.getModel(),
				thinkingLevel: "off",
				tools: ["bash"],
				resourceLoader,
				sessionManager: SessionManager.inMemory(root),
				settingsManager,
			}));

			await session.prompt("Retry the locale check and handle any guard error.");

			assert.equal(observedDecision?.block, true);
			assert.equal(Object.hasOwn(observedDecision ?? {}, "terminate"), false);
			assert.equal(faux.state.callCount, 2, "the blocked tool result must be followed by another provider turn");

			const blockedResult = session.messages.find((message): message is ToolResultMessage => (
				message.role === "toolResult" && message.toolCallId === "python-check-retry"
			));
			assert.ok(blockedResult, "Pi must persist an error result for the blocked tool call");
			assert.equal(blockedResult.isError, true);
			assert.match(toolResultText(blockedResult), /uncertain; reconcile it before retrying/);

			const finalMessage = session.messages.at(-1);
			assert.equal(finalMessage?.role, "assistant");
			if (finalMessage?.role === "assistant") {
				const finalText = finalMessage.content
					.filter((item) => item.type === "text")
					.map((item) => item.text)
					.join("\n");
				assert.match(finalText, /Handled the Continuity block and continued/);
			}
		} finally {
			session?.dispose();
			store.close();
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
