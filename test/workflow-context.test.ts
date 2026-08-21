import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { assessWorkflowEligibility, managedWorkflowPrompt } from "../src/application/workflow-context.js";
import { emptyWorkflowProjection } from "../src/domain/managed-workflow.js";
import { temporaryDirectory } from "./helpers.js";

test("workflow eligibility requires trust and an in-repository AGENTS context file", () => {
	const root = temporaryDirectory("workflow-context");
	const globalAgents = "/root/.pi/agent/AGENTS.md";
	assert.equal(assessWorkflowEligibility(root, false, [{ path: join(root, "AGENTS.md") }]).eligible, false);
	assert.equal(assessWorkflowEligibility(root, true, [{ path: globalAgents }]).eligible, false);
	const eligible = assessWorkflowEligibility(root, true, [
		{ path: globalAgents },
		{ path: join(root, "AGENTS.md") },
		{ path: join(root, "packages", "AGENTS.override.md") },
	]);
	assert.equal(eligible.eligible, true);
	assert.deepEqual(eligible.repositoryAgentsPaths, ["AGENTS.md", "packages/AGENTS.override.md"]);
});

test("managed workflow prompt preserves repository authority and separate checkpoint meaning", () => {
	const root = temporaryDirectory("workflow-prompt");
	const eligibility = assessWorkflowEligibility(root, true, [{ path: join(root, "AGENTS.md") }]);
	const prompt = managedWorkflowPrompt("managed", eligibility, emptyWorkflowProjection(1), "Verified package guidance.");
	assert.match(prompt, /Repository AGENTS\.md instructions/);
	assert.match(prompt, /Read-only work, and bounded work create no lifecycle documents/i);
	assert.match(prompt, /continuity_prepare_work/);
	assert.match(prompt, /safe checkpoint never proves task completion/i);
	assert.match(prompt, /Verified package guidance/);
	assert.equal(managedWorkflowPrompt("off", eligibility, emptyWorkflowProjection(1), "ignored"), "");
});
