import assert from "node:assert/strict";
import test from "node:test";

import {
	classifyMutationConsequence,
	classifyTool,
	isExecutableValidationCommand,
} from "../src/application/tool-classifier.js";

for (const command of [
	"env npm publish",
	"find . -delete",
	"sed -i s/a/b/ tracked.txt",
	"git branch new-release",
]) {
	test(`${command} cannot bypass mutation and external-operation tracking`, () => {
		assert.equal(classifyTool("bash", { command }), "mutation");
		assert.equal(classifyMutationConsequence("bash", { command }), "external");
	});
}

test("narrow read-only Git branch forms remain read-only", () => {
	for (const command of ["git branch", "git branch --show-current", "git branch --list", "git branch -a -vv"]) {
		assert.equal(classifyTool("bash", { command }), "read");
	}
});

test("validation commands reject credential-bearing option arguments", () => {
	for (const command of [
		"npm test -- --api_key=sk-secret-value",
		"npm test -- --token secret-value",
		"npm run validate -- --password=hunter2",
	]) assert.equal(isExecutableValidationCommand(command), false);
	assert.equal(isExecutableValidationCommand("npm test -- --test-name-pattern=continuity"), true);
});

for (const command of [
	"node --test\nnpm publish",
	"pytest\ngit push origin main",
	"go test\ncurl -X POST https://example.invalid",
	"git status $(touch /tmp/pwn)",
	"git status > /tmp/out",
	"ls `touch /tmp/backtick`",
	"grep x <(touch /tmp/process-sub)",
] as const) {
	test(`shell constructs fail closed instead of receiving read or validation authority: ${JSON.stringify(command)}`, () => {
		assert.equal(classifyTool("bash", { command }), "mutation");
		assert.equal(isExecutableValidationCommand(command), false);
	});
}

test("web search, X search, and non-interactive browser discovery remain read-only for repository workflow", () => {
	assert.equal(classifyTool("web_search", { query: "Codex web_search documentation", max_results: 5 }), "read");
	assert.equal(classifyMutationConsequence("web_search", { query: "Codex web_search documentation", max_results: 5 }), "none");
	assert.equal(classifyTool("x_search", { query: "public posts about Continuity search gating" }), "read");
	assert.equal(classifyMutationConsequence("x_search", { query: "public posts about Continuity search gating" }), "none");
	for (const action of [
		"health",
		"navigate",
		"get_readable",
		"get_text",
		"find_elements",
		"observe",
		"hover",
		"scroll",
		"screenshot",
		"get_page_info",
		"go_back",
		"go_forward",
		"reload",
		"wait_for_selector",
		"console",
		"network",
	] as const) {
		assert.equal(classifyTool("eta_browser_use", { action }), "read");
		assert.equal(classifyMutationConsequence("eta_browser_use", { action }), "none");
	}
});

test("interactive or unknown browser actions remain external mutations", () => {
	for (const action of ["click", "type", "select", "press", "request_help", "reset", "unknown"] as const) {
		assert.equal(classifyTool("eta_browser_use", { action }), "mutation");
		assert.equal(classifyMutationConsequence("eta_browser_use", { action }), "external");
	}
	assert.equal(classifyTool("eta_browser_use", {}), "mutation");
	assert.equal(classifyMutationConsequence("eta_browser_use", {}), "external");
});

test("managed workflow document tools retain their authority and mutation boundaries", () => {
	assert.equal(classifyTool("continuity_workflow_status", {}), "ignored");
	assert.equal(classifyTool("continuity_workflow_read", { document: "workflow" }), "ignored");
	assert.equal(classifyTool("continuity_bind_work_document", { path: "docs/plans/active/x.md" }), "ignored");
	assert.equal(classifyTool("continuity_prepare_work", { requestedMutation: true }), "mutation");
	assert.equal(classifyMutationConsequence("continuity_prepare_work", { requestedMutation: true }), "local");
	assert.equal(classifyTool("continuity_finalize_work", {}), "mutation");
	assert.equal(classifyMutationConsequence("continuity_finalize_work", {}), "local");
});
