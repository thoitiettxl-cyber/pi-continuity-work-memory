import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ContinuityService } from "../src/application/continuity-service.js";
import { emptyWorkflowProjection, type WorkPreparation, type WorkflowDocumentBinding } from "../src/domain/managed-workflow.js";
import { emptyWorkState, migrateWorkState } from "../src/domain/types.js";
import { ContinuityStore } from "../src/infrastructure/continuity-store.js";
import { GitFingerprintService } from "../src/infrastructure/git-fingerprint.js";
import { branch, FakeCommandRunner, identity, temporaryDirectory } from "./helpers.js";

function fixture(name: string) {
	const root = temporaryDirectory(name);
	const runner = new FakeCommandRunner(root);
	const store = new ContinuityStore(join(root, "continuity.sqlite"));
	const service = new ContinuityService(identity(), root, store, new GitFingerprintService(runner), runner);
	const active = branch(["root", "node"]);
	service.initialize(active);
	return { service, store, active, runner };
}

const bounded: WorkPreparation = {
	shape: "bounded",
	documentKind: null,
	mutationDisposition: "allowed",
	reason: "bounded",
};

const durable: WorkPreparation = {
	shape: "durable",
	documentKind: "execution-plan",
	mutationDisposition: "requires-execution-plan",
	reason: "durable",
};

const binding: WorkflowDocumentBinding = {
	kind: "execution-plan",
	status: "active",
	workItemId: "b1b782cc-4e4e-4e29-9c87-504123cd3de1",
	relativePath: "docs/plans/active/example.md",
	templateVersion: 1,
	digest: "a".repeat(64),
};

test("legacy WorkState migrates to advisory workflow without fabricating repository authority", () => {
	const legacy = { ...emptyWorkState(1), schemaVersion: 1 } as Record<string, unknown>;
	delete legacy.workflow;
	const migrated = migrateWorkState(legacy, 2);
	assert.equal(migrated.schemaVersion, 2);
	assert.equal(migrated.workflow.mode, "advisory");
	assert.equal(migrated.workflow.shape, "unclassified");
	assert.equal(migrated.workflow.binding, null);
});

test("embedded-only WorkState v1 remains recoverable after the schema upgrade", () => {
	const root = temporaryDirectory("workflow-embedded-v1");
	const runner = new FakeCommandRunner(root);
	const store = new ContinuityStore(join(root, "continuity.sqlite"));
	const service = new ContinuityService(identity(), root, store, new GitFingerprintService(runner), runner);
	const legacyState = { ...emptyWorkState(1), schemaVersion: 1, goal: "legacy embedded goal" } as Record<string, unknown>;
	delete legacyState.workflow;
	const embedded = {
		schemaVersion: 1,
		sessionId: identity().sessionId,
		repositoryId: identity().repositoryId,
		state: legacyState,
		checkpointId: null,
		checkpointHash: null,
		authority: "embedded",
		createdAt: 1,
	} as any;
	const recovered = service.initialize(branch(["root", "legacy"], [embedded]));
	assert.equal(recovered.goal, "legacy embedded goal");
	assert.equal(recovered.schemaVersion, 2);
	assert.equal(recovered.workflow.mode, "advisory");
	store.close();
});

test("managed workflow blocks unprepared, read-only, authority-blocked, and unbound durable mutations", async () => {
	const { service, store, active } = fixture("workflow-gate-blocks");
	for (const [toolCallId, expected] of [
		["unprepared", /continuity_prepare_work/],
	] as const) {
		const decision = await service.observeToolCall({ toolCallId, toolName: "write", input: { path: "x", content: "y" }, branch: active, enforceWorkflow: true });
		assert.equal(decision?.block, true);
		assert.match(decision?.reason ?? "", expected);
	}
	assert.equal(service.currentState().mutationSequence, 0);

	service.recordWorkPreparation({ ...bounded, shape: "read-only", mutationDisposition: "not-applicable" }, null, null, active);
	assert.match((await service.observeToolCall({ toolCallId: "read-only", toolName: "edit", input: { path: "x" }, branch: active, enforceWorkflow: true }))?.reason ?? "", /read-only/);

	service.recordWorkPreparation({ ...bounded, shape: "authority-blocked", mutationDisposition: "blocked" }, null, null, active);
	assert.match((await service.observeToolCall({ toolCallId: "authority", toolName: "write", input: { path: "x" }, branch: active, enforceWorkflow: true }))?.reason ?? "", /authority/);

	service.recordWorkPreparation(durable, null, null, active);
	assert.match((await service.observeToolCall({ toolCallId: "durable", toolName: "write", input: { path: "x" }, branch: active, enforceWorkflow: true }))?.reason ?? "", /execution plan/);
	store.close();
});

test("bounded preparation and bound durable work permit repository mutation while workflow bootstrap remains callable", async () => {
	const { service, store, active } = fixture("workflow-gate-allows");
	const bootstrap = await service.observeToolCall({
		toolCallId: "prepare",
		toolName: "continuity_prepare_work",
		input: { requestedMutation: true },
		branch: active,
		enforceWorkflow: true,
	});
	assert.equal(bootstrap, undefined);
	await service.observeToolResult({ toolCallId: "prepare", isError: false, contentText: "prepared", branch: active });

	service.recordWorkPreparation(bounded, null, "finish bounded work", active);
	assert.equal(await service.observeToolCall({ toolCallId: "bounded-write", toolName: "write", input: { path: "x", content: "y" }, branch: active, enforceWorkflow: true }), undefined);
	await service.observeToolResult({ toolCallId: "bounded-write", isError: false, contentText: "written", branch: active });

	service.bindWorkflowDocument(binding, active);
	assert.equal(await service.observeToolCall({ toolCallId: "durable-write", toolName: "edit", input: { path: "x" }, branch: active, enforceWorkflow: true }), undefined);
	await service.observeToolResult({ toolCallId: "durable-write", isError: false, contentText: "edited", branch: active });
	assert.throws(() => service.update({ plan: [{ id: "duplicate", text: "duplicate", status: "pending" }] }, active), /repository plan.*authoritative/i);
	assert.equal(service.resetWorkflowPreparation(active).workItemId, "default");
	store.close();
});

test("a conflicted materialization retains its generated identity until explicit reset clears it", () => {
	const { service, store, active } = fixture("workflow-conflict-identity");
	service.recordWorkflowIntent(durable, {
		kind: "execution-plan",
		workItemId: binding.workItemId,
		relativePath: "docs/plans/active/conflict.md",
		templateVersion: 1,
		expectedDigest: "d".repeat(64),
	}, "resolve conflict", active);
	const conflicted = service.recordWorkflowAlignment("conflict", null, active);
	assert.equal(conflicted.workflow.intent?.workItemId, binding.workItemId);
	assert.equal(conflicted.workItemId, binding.workItemId);
	const reset = service.resetWorkflowPreparation(active);
	assert.equal(reset.workflow.intent, null);
	assert.equal(reset.workItemId, "default");
	store.close();
});

test("managed finalization accepts only a receipt-bound current repository validation", async () => {
	const { service, store, active } = fixture("workflow-finalization-evidence");
	service.bindWorkflowDocument(binding, active);
	const validation = await service.validate("npm test", active);
	assert.ok(validation.evidence);
	assert.equal(await service.observeToolCall({
		toolCallId: "finalize-current",
		toolName: "continuity_finalize_work",
		input: {},
		branch: active,
		enforceWorkflow: true,
	}), undefined);
	assert.equal((await service.workflowFinalizationEvidence("finalize-current", active)).id, validation.evidence.id);
	await service.observeToolResult({ toolCallId: "finalize-current", isError: false, contentText: "not moved in service proof", branch: active });
	store.close();

	const legacyFixture = fixture("workflow-finalization-legacy");
	legacyFixture.service.bindWorkflowDocument(binding, legacyFixture.active);
	const legacyState = legacyFixture.service.currentState();
	legacyState.validationEvidence.push({
		id: "legacy-unsealed",
		receiptVersion: null,
		sessionKey: legacyFixture.service.identity.sessionKey,
		nodeId: legacyFixture.active.currentNodeId,
		command: "npm test",
		commandDigest: "",
		exitCode: 0,
		startedAt: 1,
		finishedAt: 2,
		mutationSequence: 0,
		preRepositoryFingerprint: null,
		postRepositoryFingerprint: null,
		repositoryFingerprint: "legacy",
		operationLedgerDigest: null,
		outputDigest: "legacy",
		provider: "continuity-validate",
		receiptDigest: null,
	});
	legacyFixture.store.saveState(legacyFixture.service.identity.sessionKey, legacyFixture.active.currentNodeId, legacyState);
	legacyFixture.service.reconstructBranch(legacyFixture.active);
	await legacyFixture.service.observeToolCall({
		toolCallId: "finalize-legacy",
		toolName: "continuity_finalize_work",
		input: {},
		branch: legacyFixture.active,
		enforceWorkflow: true,
	});
	await assert.rejects(legacyFixture.service.workflowFinalizationEvidence("finalize-legacy", legacyFixture.active), /No receipt-bound/);
	legacyFixture.store.close();
});

test("repository drift after validation cannot authorize managed finalization", async () => {
	const { service, store, active, runner } = fixture("workflow-finalization-drift");
	service.bindWorkflowDocument(binding, active);
	await service.validate("npm test", active);
	runner.version += 1;
	await service.observeToolCall({
		toolCallId: "finalize-drifted",
		toolName: "continuity_finalize_work",
		input: {},
		branch: active,
		enforceWorkflow: true,
	});
	await assert.rejects(service.workflowFinalizationEvidence("finalize-drifted", active), /differs|changed/);
	store.close();
});

test("a crash after durable document intent blocks a second materialization until reconciliation", async () => {
	const root = temporaryDirectory("workflow-intent-crash");
	const path = join(root, "continuity.sqlite");
	const runner = new FakeCommandRunner(root);
	const active = branch(["root", "node"]);
	const firstStore = new ContinuityStore(path);
	const first = new ContinuityService(identity(), root, firstStore, new GitFingerprintService(runner), runner);
	first.initialize(active);
	await first.observeToolCall({
		toolCallId: "prepare-lost-result",
		toolName: "continuity_prepare_work",
		input: { requestedMutation: true, document: { slug: "first-plan" } },
		branch: active,
		enforceWorkflow: true,
	});
	first.recordWorkflowIntent(durable, {
		kind: "execution-plan",
		workItemId: binding.workItemId,
		relativePath: "docs/plans/active/first-plan.md",
		templateVersion: 1,
		expectedDigest: "c".repeat(64),
	}, "inspect the planned target", active);
	firstStore.close();

	const resumedStore = new ContinuityStore(path);
	const resumed = new ContinuityService(identity(), root, resumedStore, new GitFingerprintService(runner), runner);
	const state = resumed.initialize(active);
	assert.equal(state.workflow.phase, "recovery-required");
	assert.equal(state.workflow.intent?.relativePath, "docs/plans/active/first-plan.md");
	const decision = await resumed.observeToolCall({
		toolCallId: "prepare-second-plan",
		toolName: "continuity_prepare_work",
		input: { requestedMutation: true, document: { slug: "second-plan" } },
		branch: active,
		enforceWorkflow: true,
	});
	assert.equal(decision?.block, true);
	assert.match(decision?.reason ?? "", /prepare-lost-result|reconcile/);
	resumedStore.close();
});

test("advisory mode never enforces the mutation gate", async () => {
	const { service, store, active } = fixture("workflow-advisory");
	service.configureWorkflow("advisory", active);
	assert.equal(await service.observeToolCall({ toolCallId: "advisory-write", toolName: "write", input: { path: "x" }, branch: active, enforceWorkflow: true }), undefined);
	store.close();
});
