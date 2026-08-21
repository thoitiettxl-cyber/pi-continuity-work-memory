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
