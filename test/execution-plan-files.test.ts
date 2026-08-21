import assert from "node:assert/strict";
import { access, link, mkdir, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
	ExecutionPlanConflictError,
	ExecutionPlanDigestMismatchError,
	ExecutionPlanFileService,
	ExecutionPlanPathError,
} from "../src/infrastructure/execution-plan-files.js";
import { temporaryDirectory } from "./helpers.js";

const planPath = "docs/plans/active/example-plan.md";
const planContent = "# Execution Plan: Example\n\nPending implementation and executable proof.\n";
const readyPlanContent = "# Execution Plan: Example\n\n## Status\n\nReady for completion\n\n## Result\n\nObserved result with executable proof recorded.\n";

test("execution plan create is exclusive and bind can adopt one explicit existing plan", async () => {
	const root = temporaryDirectory("plan-create");
	const service = await ExecutionPlanFileService.open(root);
	const created = await service.createExecutionPlan(planPath, planContent);
	assert.equal(created.relativePath, planPath);
	assert.equal(created.status, "active");
	assert.equal(created.size, Buffer.byteLength(planContent));
	assert.equal((await service.bindExecutionPlan(planPath)).digest, created.digest);
	await assert.rejects(service.bindExecutionPlan(planPath, "0".repeat(64)), ExecutionPlanDigestMismatchError);
	await assert.rejects(service.createExecutionPlan(planPath, "replacement"), ExecutionPlanConflictError);
	assert.equal(await readFile(join(root, planPath), "utf8"), planContent);
	assert.deepEqual(await readdir(join(root, "docs", "plans", "active")), ["example-plan.md"]);

	const explicitPath = "docs/plans/active/existing-explicit.md";
	await writeFile(join(root, explicitPath), "# Existing\n", "utf8");
	const bound = await service.bindExecutionPlan(explicitPath);
	assert.equal(bound.relativePath, explicitPath);
	assert.equal(bound.status, "active");
});

test("concurrent creates produce exactly one plan and never select another filename", async () => {
	const root = temporaryDirectory("plan-concurrent");
	const service = await ExecutionPlanFileService.open(root);
	const results = await Promise.allSettled([
		service.createExecutionPlan(planPath, "first\n"),
		service.createExecutionPlan(planPath, "second\n"),
	]);
	assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
	const rejection = results.find((result) => result.status === "rejected");
	assert.ok(rejection && rejection.status === "rejected");
	assert.ok(rejection.reason instanceof ExecutionPlanConflictError);
	assert.deepEqual(await readdir(join(root, "docs", "plans", "active")), ["example-plan.md"]);
	assert.match(await readFile(join(root, planPath), "utf8"), /^(first|second)\n$/);
});

test("plan paths reject absolute, traversal, NUL, wrong directory, and symlink escapes", async () => {
	const root = temporaryDirectory("plan-safety");
	const service = await ExecutionPlanFileService.open(root);
	for (const unsafe of [
		"/tmp/absolute.md",
		"docs/plans/active/../outside.md",
		"docs/plans/active/bad\0name.md",
		"docs/plans/active/nested/plan.md",
		"other/plan.md",
	]) {
		await assert.rejects(service.createExecutionPlan(unsafe, planContent), ExecutionPlanPathError);
	}

	const outside = temporaryDirectory("plan-outside");
	await mkdir(join(outside, "plans", "active"), { recursive: true });
	await writeFile(join(outside, "plans", "active", "escape.md"), "outside", "utf8");
	await symlink(outside, join(root, "docs"));
	await assert.rejects(service.createExecutionPlan("docs/plans/active/escape.md", planContent), ExecutionPlanPathError);
	await assert.rejects(service.bindExecutionPlan("docs/plans/active/escape.md"), ExecutionPlanPathError);
	assert.equal(await readFile(join(outside, "plans", "active", "escape.md"), "utf8"), "outside");
});

test("finalize refuses a plan that has not recorded ready status and result", async () => {
	const root = temporaryDirectory("plan-finalize-not-ready");
	const service = await ExecutionPlanFileService.open(root);
	const created = await service.createExecutionPlan(planPath, planContent);
	await assert.rejects(service.finalizeExecutionPlan(planPath, created.digest), /Ready for completion/);
	assert.equal(await readFile(join(root, planPath), "utf8"), planContent);
});

test("finalize moves active to completed without asserting validation or completion", async () => {
	const root = temporaryDirectory("plan-finalize");
	const service = await ExecutionPlanFileService.open(root);
	const created = await service.createExecutionPlan(planPath, readyPlanContent);
	const finalized = await service.finalizeExecutionPlan(planPath, created.digest);
	assert.equal(finalized.previous.digest, created.digest);
	assert.equal(finalized.current.relativePath, "docs/plans/completed/example-plan.md");
	assert.equal(finalized.current.status, "completed");
	assert.equal(finalized.current.digest, created.digest);
	assert.equal(finalized.validationRequired, true);
	assert.match(finalized.notice, /without claiming validation or completion/);
	assert.match(finalized.notice, /Fresh executable or observable validation is required/);
	await assert.rejects(access(join(root, planPath)));
	assert.equal(await readFile(join(root, finalized.current.relativePath), "utf8"), readyPlanContent);
});

test("destination-only recovery still enforces ready status and recorded result", async () => {
	const root = temporaryDirectory("plan-finalize-destination-unready");
	const service = await ExecutionPlanFileService.open(root);
	const created = await service.createExecutionPlan(planPath, planContent);
	const completedDirectory = join(root, "docs", "plans", "completed");
	await mkdir(completedDirectory, { recursive: true });
	const source = join(root, planPath);
	const destination = join(completedDirectory, "example-plan.md");
	await link(source, destination);
	await unlink(source);
	await assert.rejects(service.finalizeExecutionPlan(planPath, created.digest, created.workItemId), /Ready for completion/);
	assert.equal(await readFile(destination, "utf8"), planContent);
});

test("finalize recovers the two-link and destination-only states of an interrupted same-identity move", async () => {
	for (const state of ["both", "destination-only"] as const) {
		const root = temporaryDirectory(`plan-finalize-recover-${state}`);
		const service = await ExecutionPlanFileService.open(root);
		const created = await service.createExecutionPlan(planPath, readyPlanContent);
		const completedDirectory = join(root, "docs", "plans", "completed");
		await mkdir(completedDirectory, { recursive: true });
		const source = join(root, planPath);
		const destination = join(completedDirectory, "example-plan.md");
		await link(source, destination);
		if (state === "destination-only") await unlink(source);
		const finalized = await service.finalizeExecutionPlan(planPath, created.digest, created.workItemId);
		assert.match(finalized.notice, /Recovered an interrupted/);
		await assert.rejects(access(source));
		assert.equal(await readFile(destination, "utf8"), readyPlanContent);
	}
});

test("finalize refuses an existing destination and preserves the active plan", async () => {
	const root = temporaryDirectory("plan-finalize-conflict");
	const service = await ExecutionPlanFileService.open(root);
	await service.createExecutionPlan(planPath, readyPlanContent);
	const completedDirectory = join(root, "docs", "plans", "completed");
	await mkdir(completedDirectory, { recursive: true });
	const completed = join(completedDirectory, "example-plan.md");
	await writeFile(completed, "existing completed plan\n", "utf8");
	await assert.rejects(service.finalizeExecutionPlan(planPath), ExecutionPlanConflictError);
	assert.equal(await readFile(join(root, planPath), "utf8"), readyPlanContent);
	assert.equal(await readFile(completed, "utf8"), "existing completed plan\n");
});

test("finalize rejects a symlinked completed directory", async () => {
	const root = temporaryDirectory("plan-finalize-symlink");
	const service = await ExecutionPlanFileService.open(root);
	await service.createExecutionPlan(planPath, readyPlanContent);
	const outside = temporaryDirectory("plan-completed-outside");
	await symlink(outside, join(root, "docs", "plans", "completed"));
	await assert.rejects(service.finalizeExecutionPlan(planPath), ExecutionPlanPathError);
	assert.equal(await readFile(join(root, planPath), "utf8"), readyPlanContent);
	assert.deepEqual(await readdir(outside), []);
});
