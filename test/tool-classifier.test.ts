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
