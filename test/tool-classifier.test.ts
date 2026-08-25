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

test("ordinary shell, Git, and GitHub discovery remains read-only", () => {
	for (const command of [
		"command -v gh",
		"git --version",
		"git remote -v",
		"git remote get-url origin",
		"git diff --text",
		"cat /etc/os-release",
		"ldd /usr/bin/node",
		"pi --version",
		"pi -v",
		"gh --version",
		"gh auth status",
		"gh repo view --json nameWithOwner,url,defaultBranchRef",
		"gh issue list --limit 20 --json number,title,state,url",
		"gh issue view 1 --json number,title,state,url",
		"gh label list",
		"gh label list --limit 50 --json name,description,color",
		"gh pr list --limit 20 --json number,title,state,url",
		"gh pr view 1 --json number,title,state,url",
		"gh pr diff 1",
		"gh pr checks 1",
		"gh run list --limit 20",
		"gh run view 123 --log-failed",
		"gh workflow view validate.yml",
		"gh api repos/example/project/pulls/1 --jq .title",
		"gh api repos/example/project/issues/1/comments --jq '.[].body'",
		"gh api --method GET -f state=open repos/example/project/issues",
		"find test -maxdepth 2 -type f -name '*.test.ts' -print",
		"rg -n 'memory|classifier' src test",
	]) {
		assert.equal(classifyTool("bash", { command }), "read", command);
		assert.equal(classifyMutationConsequence("bash", { command }), "none", command);
	}
});

test("executable, output-writing, mutating, and credential-revealing command forms stay external", () => {
	for (const command of [
		"command gh auth status",
		"git remote add upstream https://example.invalid/repository.git",
		"git remote set-url origin https://example.invalid/repository.git",
		"git diff --output=/tmp/continuity-diff",
		"git diff --output /tmp/continuity-diff",
		"git diff --out=/tmp/continuity-diff",
		"git diff --ext-dif",
		"git show --textco HEAD",
		"git diff --ext-diff",
		"git show --textconv HEAD",
		"pi",
		"pi -p prompt",
		"gh auth token",
		"gh auth status --show-token",
		"gh repo clone example/project",
		"gh label create bug",
		"gh label delete bug",
		"gh pr checkout 1",
		"gh pr create --title change --body body",
		"gh pr merge 1",
		"gh run rerun 123",
		"gh api repos/example/project/issues -f title=change",
		"gh api --method POST repos/example/project/issues",
		"gh api -XPOST repos/example/project/issues",
		"gh api --method GET -H 'X-HTTP-Method-Override: POST' repos/example/project/issues",
		"gh api --method GET -H='X-Method-Override: PATCH' repos/example/project/issues",
		"gh api --method GET /graphql -f query=mutation",
		"gh api graphql -f query=query",
		"gh api repos/example/project/issues/1/comments --jq .[].body",
		"find . -delete",
		"find . -exec touch marker +",
		"find . -fprint /tmp/continuity-find",
		"rg --pre ./helper pattern .",
		"rg --pre=./helper pattern .",
		"rg --search-zip pattern .",
		"rg -z pattern .",
	]) {
		assert.equal(classifyTool("bash", { command }), "mutation", command);
		assert.equal(classifyMutationConsequence("bash", { command }), "external", command);
	}
});

test("literal metacharacters in parsed argv do not lose read or validation authority", () => {
	assert.equal(classifyTool("bash", { command: "rg -n 'alpha|beta' src" }), "read");
	assert.equal(isExecutableValidationCommand("npm test -- --test-name-pattern='memory|classifier'"), true);
});

test("git diff validation accepts explicit filter opt-outs", () => {
	assert.equal(isExecutableValidationCommand("git diff --check --no-ext-diff --no-textconv --text"), true);
});

test("git diff validation rejects output and executable-filter hazards", () => {
	for (const command of [
		"git diff --check --output=/tmp/continuity-diff",
		"git diff --check --output /tmp/continuity-diff",
		"git diff --check --out=/tmp/continuity-diff",
		"git diff --check --ext-dif",
		"git diff --check --textco",
		"git diff --check --ext-diff",
		"git diff --check --textconv",
	]) {
		assert.equal(isExecutableValidationCommand(command), false, command);
		assert.equal(classifyTool("bash", { command }), "mutation", command);
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

test("web search, X search, MCP discovery, and non-interactive browser discovery remain read-only for repository workflow", () => {
	assert.equal(classifyTool("web_search", { query: "Codex web_search documentation", max_results: 5 }), "read");
	assert.equal(classifyMutationConsequence("web_search", { query: "Codex web_search documentation", max_results: 5 }), "none");
	assert.equal(classifyTool("x_search", { query: "public posts about Continuity search gating" }), "read");
	assert.equal(classifyMutationConsequence("x_search", { query: "public posts about Continuity search gating" }), "none");
	for (const input of [
		{},
		{ search: "openai responses api" },
		{ describe: "search_openai_docs" },
		{ instructions: "openai-docs" },
		{ server: "openai-docs" },
		{ connect: "openai-docs" },
		{ tool: "search_openai_docs", args: { query: "responses api" } },
		{ action: "ui-messages" },
	]) {
		assert.equal(classifyTool("mcp", input), "read");
		assert.equal(classifyMutationConsequence("mcp", input), "none");
	}
	assert.equal(classifyTool("mcpScript", { code: "emit(1)" }), "read");
	assert.equal(classifyMutationConsequence("mcpScript", { code: "emit(1)" }), "none");
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

test("MCP auth actions remain external mutations", () => {
	for (const action of ["auth-start", "auth-complete"] as const) {
		assert.equal(classifyTool("mcp", { action }), "mutation");
		assert.equal(classifyMutationConsequence("mcp", { action }), "external");
	}
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
