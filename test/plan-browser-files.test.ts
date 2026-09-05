import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { ExecutionPlanFileService } from "../src/infrastructure/execution-plan-files.js";
import { temporaryDirectory } from "./helpers.js";

test("plan catalog is read-only, includes active/completed and supports legacy Markdown", async () => {
	const root = temporaryDirectory("plan-browser-catalog");
	const files = await ExecutionPlanFileService.open(root);
	assert.deepEqual(await files.listExecutionPlans(), { plans: [], issues: [], truncated: false });
	assert.deepEqual(await readdir(root), []);
	const active = "docs/plans/active/current.md";
	const completed = "docs/plans/completed/history.md";
	await mkdir(join(root, "docs/plans/active"), { recursive: true });
	await mkdir(join(root, "docs/plans/completed"), { recursive: true });
	const content = "# Execution Plan: Current work\n\n## Status\n\nIn progress\n";
	await writeFile(join(root, active), content);
	await writeFile(join(root, completed), "# History\n\n## Status\n\nCompleted\n");
	const result = await files.listExecutionPlans();
	assert.deepEqual(result.plans.map((plan) => [plan.relativePath, plan.title, plan.status, plan.declaredStatus]), [
		[active, "Current work", "active", "In progress"],
		[completed, "History", "completed", "Completed"],
	]);
	assert.match(result.plans[0]!.workItemId, /^plan:/);
	assert.deepEqual(result.issues, []);
	assert.equal(await readFile(join(root, active), "utf8"), content);
});

test("browser rejects symlinks, nonregular, oversized and invalid documents without exposing outside contents", async () => {
	const root = temporaryDirectory("plan-browser-unsafe");
	const files = await ExecutionPlanFileService.open(root);
	await mkdir(join(root, "docs/plans/active"), { recursive: true });
	const outside = temporaryDirectory("plan-browser-outside");
	await writeFile(join(outside, "secret.md"), "# Do not expose outside contents\n");
	await symlink(join(outside, "secret.md"), join(root, "docs/plans/active/link.md"));
	await mkdir(join(root, "docs/plans/active/directory.md"));
	await writeFile(join(root, "docs/plans/active/large.md"), "x".repeat(256 * 1024 + 1));
	await writeFile(join(root, "docs/plans/active/bad.md"), "<!-- pi-continuity-work-document: {\"kind\":\"wrong\"} -->\n");
	await writeFile(join(root, "docs/plans/active/line\nbreak.md"), "# Invalid filename\n");
	await symlink(outside, join(root, "docs/plans/completed"));
	const catalog = await files.listExecutionPlans();
	assert.equal(catalog.plans.length, 0);
	assert.equal(catalog.issues.length, 6);
	assert.doesNotMatch(JSON.stringify(catalog), /Do not expose|secret\.md/);
	for (const path of ["/tmp/file.md", "docs/plans/active/../escape.md", "docs/plans/active/link.md", "docs/plans/active/directory.md", "docs/plans/active/large.md", "docs/plans/completed/secret.md"]) {
		await assert.rejects(files.readExecutionPlan(path));
	}
});

test("browser re-read rejects content replacement and moved plans", async () => {
	const root = temporaryDirectory("plan-browser-stale");
	const files = await ExecutionPlanFileService.open(root);
	await mkdir(join(root, "docs/plans/active"), { recursive: true });
	await mkdir(join(root, "docs/plans/completed"));
	const path = "docs/plans/active/example.md";
	await writeFile(join(root, path), "# Original\n");
	const original = await files.readExecutionPlan(path);
	await writeFile(join(root, path), "# Changed\n");
	await assert.rejects(files.readExecutionPlan(path, original.digest), /changed since selection/);
	await rename(join(root, path), join(root, "docs/plans/completed/example.md"));
	await assert.rejects(files.readExecutionPlan(path, original.digest));
});

test("browser directory enumeration stops at a bounded entry count", async () => {
	const root = temporaryDirectory("plan-browser-bounded");
	const files = await ExecutionPlanFileService.open(root);
	await mkdir(join(root, "docs/plans/active"), { recursive: true });
	for (let index = 0; index < 501; index++) await writeFile(join(root, `docs/plans/active/ignored-${index}.txt`), "");
	const catalog = await files.listExecutionPlans();
	assert.equal(catalog.truncated, true);
	assert.deepEqual(catalog.plans, []);
});
