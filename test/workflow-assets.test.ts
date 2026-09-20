import assert from "node:assert/strict";
import { cp, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import { loadWorkflowAssets, WorkflowAssetIntegrityError } from "../src/infrastructure/workflow-assets.js";
import { temporaryDirectory } from "./helpers.js";

async function copiedWorkflow(prefix: string): Promise<string> {
	const root = temporaryDirectory(prefix);
	const workflow = join(root, "workflow");
	await cp(resolve("workflow"), workflow, { recursive: true });
	return workflow;
}

test("package workflow assets match the sorted checksum manifest", async () => {
	const bundle = await loadWorkflowAssets(resolve("workflow"));
	assert.deepEqual(bundle.manifest.assets.map((entry) => entry.path), [
		"WORKFLOW.md",
		"templates/application-runbook.md",
		"templates/decision-record.md",
		"templates/execution-plan.md",
	]);
	assert.match(bundle.assets["WORKFLOW.md"]!, /do not need `repository-harness` installed/);
	assert.match(bundle.assets["templates/execution-plan.md"]!, /Pending implementation and executable proof/);
	assert.equal(Object.isFrozen(bundle.assets), true);
});

test("asset loader rejects checksum drift and undeclared files", async () => {
	const tampered = await copiedWorkflow("workflow-tampered");
	await writeFile(join(tampered, "WORKFLOW.md"), "tampered", "utf8");
	await assert.rejects(loadWorkflowAssets(tampered), WorkflowAssetIntegrityError);

	const unlisted = await copiedWorkflow("workflow-unlisted");
	await writeFile(join(unlisted, "extra.md"), "not declared", "utf8");
	await assert.rejects(loadWorkflowAssets(unlisted), /inventory does not match/);
});

test("asset loader rejects symlinks instead of following package escapes", async () => {
	const workflow = await copiedWorkflow("workflow-symlink");
	const outside = join(temporaryDirectory("workflow-outside"), "outside.md");
	await writeFile(outside, "outside", "utf8");
	await symlink(outside, join(workflow, "escape.md"));
	await assert.rejects(loadWorkflowAssets(workflow), /must not contain symlinks/);
});

test("asset loader rejects a symlink package workflow root", async () => {
	const root = temporaryDirectory("workflow-root-symlink");
	const alias = join(root, "workflow-alias");
	await symlink(resolve("workflow"), alias);
	await assert.rejects(loadWorkflowAssets(alias), /root must be a real directory/);
});

test("WORKFLOW.md encodes onboarding and Continuity tool contracts", async () => {
	const bundle = await loadWorkflowAssets(resolve("workflow"));
	const workflow = bundle.assets["WORKFLOW.md"]!;
	for (const section of [
		"## Agent Onboarding",
		"## Continuity Tool Contract",
		"## Working Loop",
		"## Select The Work Shape",
		"## Managed Preparation",
		"## Repository Document Authority",
		"### Document roles",
		"## Validation And Completion",
		"## Recovery",
		"## Packaged Engineering Skills",
	]) assert.ok(workflow.includes(section), `missing section ${section}`);
	for (const tool of [
		"continuity_workflow_status",
		"continuity_status",
		"continuity_prepare_work",
		"continuity_bind_work_document",
		"continuity_finalize_work",
		"continuity_checkpoint",
		"continuity_recover",
		"continuity_validate",
	]) assert.ok(workflow.includes("`" + tool + "`"), `WORKFLOW must document ${tool}`);
	assert.match(workflow, /skills\/README\.md/);
	assert.match(workflow, /do not need `repository-harness` installed/);
	assert.match(workflow, /Task architecture spec/);
	assert.match(workflow, /docs\/audits\//);
	assert.match(workflow, /must not become plan Result/);
	assert.match(workflow, /Do not alias it to conversation/);
});
