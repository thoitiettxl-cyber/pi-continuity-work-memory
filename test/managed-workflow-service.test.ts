import assert from "node:assert/strict";
import { access, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import { ManagedWorkflowService, type PrepareManagedWorkInput } from "../src/application/managed-workflow-service.js";
import { ExecutionPlanFileService } from "../src/infrastructure/execution-plan-files.js";
import { loadWorkflowAssets } from "../src/infrastructure/workflow-assets.js";
import { temporaryDirectory } from "./helpers.js";

const base: PrepareManagedWorkInput = {
	requestedMutation: true,
	authority: "resolved",
	spansSessions: false,
	coordinatesContributors: false,
	hasMeaningfulDependencies: false,
	recoverySensitive: false,
	externalSideEffects: false,
	cannotResumeSafelyFromDiff: false,
	resumeHint: "Continue from repository evidence.",
};

const document = {
	title: "Durable work",
	slug: "durable-work",
	outcome: "Produce an observable durable result.",
	authorityAndContext: ["AGENTS.md", "User request"],
	inScope: ["Managed workflow"],
	outOfScope: ["Product policy"],
	constraints: ["No overwrite"],
	steps: ["Implement", "Verify"],
	risksAndRecovery: ["Revert the coherent change."],
	validation: ["npm test"],
};

async function service(prefix: string): Promise<{ root: string; workflow: ManagedWorkflowService }> {
	const root = temporaryDirectory(prefix);
	const assets = await loadWorkflowAssets(resolve("workflow"));
	const files = await ExecutionPlanFileService.open(root);
	return { root, workflow: new ManagedWorkflowService(assets, files) };
}

test("managed preparation leaves read-only and bounded work document-free", async () => {
	const { root, workflow } = await service("workflow-service-bounded");
	const readOnly = await workflow.prepare({ ...base, requestedMutation: false, authority: "missing" }, true);
	assert.equal(readOnly.preparation.shape, "read-only");
	assert.equal(readOnly.materialized, false);
	const bounded = await workflow.prepare(base, true);
	assert.equal(bounded.preparation.shape, "bounded");
	assert.equal(bounded.binding, null);
	await assert.rejects(access(join(root, "docs")));
});

test("advisory durable preparation reports a deterministic target without writing", async () => {
	const { root, workflow } = await service("workflow-service-advisory");
	const result = await workflow.prepare({ ...base, spansSessions: true, document }, false, new Date("2026-08-21T00:00:00Z"));
	assert.equal(result.preparation.shape, "durable");
	assert.equal(result.plannedPath, "docs/plans/active/durable-work.md");
	assert.equal(result.materialized, false);
	assert.match(result.workItemId ?? "", /^[0-9a-f-]{36}$/);
	await assert.rejects(access(join(root, "docs")));
});

test("managed durable preparation creates and binds exactly one identity-bearing repository plan", async () => {
	const { root, workflow } = await service("workflow-service-managed");
	const result = await workflow.prepare({ ...base, recoverySensitive: true, document }, true, new Date("2026-08-21T00:00:00Z"));
	assert.equal(result.materialized, true);
	assert.equal(result.binding?.relativePath, "docs/plans/active/durable-work.md");
	assert.equal(result.binding?.workItemId, result.workItemId);
	assert.equal(result.binding?.templateVersion, 1);
	const content = await readFile(join(root, result.binding!.relativePath), "utf8");
	assert.match(content, new RegExp(result.workItemId!));
	assert.match(content, /## Authority And Context/);
	assert.match(content, /Pending implementation and executable proof/);
	assert.equal((await workflow.alignment(result.binding)).state, "aligned");

	await writeFile(join(root, result.binding!.relativePath), `${content}\nRepository update.\n`, "utf8");
	const changed = await workflow.alignment(result.binding);
	assert.equal(changed.state, "changed");
	assert.match(changed.reason, /repository content wins/);
	const rebound = await workflow.bind(result.binding!.relativePath);
	assert.notEqual(rebound.digest, result.binding!.digest);
	assert.equal(rebound.workItemId, result.binding!.workItemId);
});

test("finalization preserves document identity and requires fresh validation", async () => {
	const { root, workflow } = await service("workflow-service-finalize");
	const prepared = await workflow.prepare({ ...base, externalSideEffects: true, document }, true, new Date("2026-08-21T00:00:00Z"));
	const path = join(root, prepared.binding!.relativePath);
	const content = await readFile(path, "utf8");
	await writeFile(path, content
		.replace("\nActive\n", "\nReady for completion\n")
		.replace("Pending implementation and executable proof.", "Observed result and executable proof recorded."), "utf8");
	const rebound = await workflow.bind(prepared.binding!.relativePath);
	const result = await workflow.finalize(rebound);
	assert.equal(result.binding.status, "completed");
	assert.equal(result.binding.workItemId, prepared.binding!.workItemId);
	assert.equal(result.finalized.validationRequired, true);
	assert.match(result.finalized.notice, /without claiming/);
});
