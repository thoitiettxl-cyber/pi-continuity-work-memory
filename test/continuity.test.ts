import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ContinuityService } from "../src/application/continuity-service.js";
import { ContinuityStore } from "../src/infrastructure/continuity-store.js";
import { GitFingerprintService } from "../src/infrastructure/git-fingerprint.js";
import { branch, FakeCommandRunner, identity, temporaryDirectory } from "./helpers.js";

function fixture(name: string, identityOverrides = {}) {
	const root = temporaryDirectory(name);
	const runner = new FakeCommandRunner(root);
	const store = new ContinuityStore(join(root, "continuity.sqlite"));
	const sessionIdentity = identity(identityOverrides);
	const service = new ContinuityService(sessionIdentity, root, store, new GitFingerprintService(runner), runner);
	return { root, runner, store, identity: sessionIdentity, service };
}

test("safe checkpoint requires a determined mutation, executable validation, stable Git fingerprint, and valid chain", async () => {
	const { service, runner, store } = fixture("safe-boundary");
	const active = branch(["root", "assistant-1"]);
	service.initialize(active);
	service.update({ goal: "Ship continuity", currentStepId: "implement", plan: [{ id: "implement", text: "Implement", status: "in_progress" }] }, active);

	await service.observeToolCall({ toolCallId: "mutation-1", toolName: "write", input: { path: "x", content: "y" }, branch: active });
	await assert.rejects(service.createCheckpoint(active), /pending/);
	await service.observeToolResult({ toolCallId: "mutation-1", isError: false, contentText: "wrote x", branch: active });
	await assert.rejects(service.createCheckpoint(active), /No successful executable validation/);

	const validation = await service.validate("npm test", active);
	assert.ok(validation.evidence);
	const checkpoint = await service.createCheckpoint(active);
	active.embeddedStates.push(service.embeddedState(checkpoint));
	const status = await service.status(active);
	assert.equal(status.health, "safe");
	assert.equal(status.authority, "verified");

	runner.version += 1;
	const drifted = await service.status(active);
	assert.equal(drifted.health, "drifted");
	store.close();
});

test("crash between mutation call and result restores mutationUncertain", async () => {
	const root = temporaryDirectory("crash-mutation");
	const path = join(root, "continuity.sqlite");
	const runner = new FakeCommandRunner(root);
	const active = branch(["root", "assistant-crash"]);
	const firstStore = new ContinuityStore(path);
	const first = new ContinuityService(identity(), root, firstStore, new GitFingerprintService(runner), runner);
	first.initialize(active);
	await first.observeToolCall({ toolCallId: "lost-result", toolName: "edit", input: { path: "x" }, branch: active });
	firstStore.close();

	const resumedStore = new ContinuityStore(path);
	const resumed = new ContinuityService(identity(), root, resumedStore, new GitFingerprintService(runner), runner);
	const state = resumed.initialize(active);
	assert.equal(state.mutationUncertain, true);
	assert.equal(state.mutationStatus, "uncertain");
	const status = await resumed.status(active);
	assert.equal(status.health, "degraded");
	assert.match(status.reason, /uncertain/);
	resumedStore.close();
});

test("normal exit and resume retain the complete work state, evidence, lineage, and ancestry", async () => {
	const root = temporaryDirectory("resume-complete-state");
	const path = join(root, "continuity.sqlite");
	const runner = new FakeCommandRunner(root);
	const active = branch(["root", "work"]);
	const firstStore = new ContinuityStore(path);
	const first = new ContinuityService(identity(), root, firstStore, new GitFingerprintService(runner), runner);
	first.initialize(active);
	first.update({
		goal: "finish exact continuity",
		workItemId: "work-42",
		plan: [
			{ id: "done", text: "completed step", status: "completed" },
			{ id: "current", text: "current step", status: "in_progress" },
		],
		currentStepId: "current",
		nextActions: ["run release proof"],
		completedWork: ["implemented persistence"],
		decisions: ["use node:sqlite"],
		blockers: ["provider credential missing"],
		constraints: ["recovery is store-only"],
	}, active);
	await first.validate("npm test", active);
	const checkpoint = await first.createCheckpoint(active);
	const embedded = first.embeddedState(checkpoint);
	firstStore.close();

	const resumedStore = new ContinuityStore(path);
	const resumed = new ContinuityService(identity(), root, resumedStore, new GitFingerprintService(runner), runner);
	const resumedBranch = branch(["root", "work", "embedded"], [embedded]);
	const state = resumed.initialize(resumedBranch);
	assert.equal(state.goal, "finish exact continuity");
	assert.equal(state.workItemId, "work-42");
	assert.equal(state.currentStepId, "current");
	assert.deepEqual(state.nextActions, ["run release proof"]);
	assert.deepEqual(state.completedWork, ["implemented persistence"]);
	assert.deepEqual(state.decisions, ["use node:sqlite"]);
	assert.deepEqual(state.blockers, ["provider credential missing"]);
	assert.deepEqual(state.constraints, ["recovery is store-only"]);
	assert.equal(state.validationEvidence.length, 1);
	assert.deepEqual(state.checkpointAncestry, [checkpoint.id]);
	const status = await resumed.status(resumedBranch);
	assert.equal(status.health, "safe");
	assert.equal(status.lineage.sessionKey, identity().sessionKey);
	resumedStore.close();
});

test("branch reconstruction and forked embedded state never leak safe authority", async () => {
	const { root, runner, store, service } = fixture("branches");
	const common = branch(["root"]);
	service.initialize(common);
	service.update({ goal: "common" }, common);
	const commonEmbedded = service.embeddedState();

	const branchA = branch(["root", "a"], [commonEmbedded]);
	service.reconstructBranch(branchA);
	service.update({ goal: "branch A marker" }, branchA);
	await service.validate("npm test", branchA);
	const checkpoint = await service.createCheckpoint(branchA);
	const branchAEmbedded = service.embeddedState(checkpoint);
	branchA.embeddedStates.push(branchAEmbedded);
	assert.equal((await service.status(branchA)).health, "safe");

	const branchB = branch(["root", "b"], [commonEmbedded]);
	assert.equal(service.reconstructBranch(branchB).goal, "common");
	service.update({ goal: "branch B marker" }, branchB);
	assert.equal(service.currentState().goal, "branch B marker");
	service.reconstructBranch(branchA);
	assert.equal(service.currentState().goal, "branch A marker");

	const forkIdentity = identity({ sessionId: "session-fork", sessionFileKey: "file-fork", sessionKey: "session-fork:file-fork", parentSessionKey: identity().sessionKey });
	const fork = new ContinuityService(forkIdentity, root, store, new GitFingerprintService(runner), runner);
	const forkBranch = branch(["root", "a", "fork-leaf"], [branchAEmbedded]);
	assert.equal(fork.initialize(forkBranch).goal, "branch A marker");
	const forkStatus = await fork.status(forkBranch);
	assert.equal(forkStatus.health, "degraded");
	assert.equal(forkStatus.authority, "embedded");
	assert.match(forkStatus.reason, /copied|forked/);
	assert.equal(forkStatus.lineage.parentSessionKey, identity().sessionKey);
	await fork.validate("npm test", forkBranch);
	const forkCheckpoint = await fork.createCheckpoint(forkBranch);
	assert.equal(forkCheckpoint.parentId, null, "a fork must start a fresh authority chain");
	assert.deepEqual(fork.currentState().checkpointAncestry, [forkCheckpoint.id]);
	forkBranch.embeddedStates.push(fork.embeddedState(forkCheckpoint));
	assert.equal((await fork.status(forkBranch)).health, "safe");
	store.close();
});

test("embedded-only checkpoint context cannot silently become a missing-parent chain", async () => {
	const { service, store } = fixture("embedded-missing-authority");
	const embedded = service.embeddedState();
	embedded.state.goal = "copied context";
	embedded.state.checkpointId = "missing-external-checkpoint";
	embedded.state.checkpointAncestry = ["missing-external-checkpoint"];
	embedded.checkpointId = "missing-external-checkpoint";
	const active = branch(["root", "copied"], [embedded]);
	service.initialize(active);
	await service.validate("npm test", active);
	await assert.rejects(service.createCheckpoint(active), /parent is missing|cannot grant safe authority/);
	store.close();
});

test("corrupt checkpoint ancestry is quarantined", async () => {
	const { service, store } = fixture("quarantine");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.validate("npm test", active);
	const checkpoint = await service.createCheckpoint(active);
	active.embeddedStates.push(service.embeddedState(checkpoint));
	store.db.prepare("UPDATE checkpoints SET payload_hash = 'corrupt' WHERE id = ?").run(checkpoint.id);
	const status = await service.status(active);
	assert.equal(status.authority, "quarantined");
	assert.equal(store.getCheckpoint(checkpoint.id)?.status, "quarantined");
	store.close();
});

for (const corruption of ["missing-parent", "cycle"] as const) {
	test(`${corruption} checkpoint ancestry is quarantined`, async () => {
		const { service, store } = fixture(corruption);
		const active = branch(["root", "node"]);
		service.initialize(active);
		await service.validate("npm test", active);
		const checkpoint = await service.createCheckpoint(active);
		active.embeddedStates.push(service.embeddedState(checkpoint));
		if (corruption === "missing-parent") {
			store.db.prepare("UPDATE checkpoints SET parent_id = 'does-not-exist' WHERE id = ?").run(checkpoint.id);
		} else {
			store.db.prepare("UPDATE checkpoints SET parent_id = ? WHERE id = ?").run(checkpoint.id, checkpoint.id);
		}
		const status = await service.status(active);
		assert.equal(status.authority, "quarantined");
		assert.match(status.reason, corruption === "cycle" ? /cycle/ : /missing/);
		store.close();
	});
}

test("recover restores work state only and executes no repository command", async () => {
	const { service, runner, store } = fixture("recover-no-repo");
	const active = branch(["root", "node"]);
	service.initialize(active);
	service.update({ goal: "recover marker", blockers: ["credential missing"] }, active);
	const embedded = service.embeddedState();
	const recoveryBranch = branch(["root", "node", "later"], [embedded]);
	const before = runner.commands.length;
	const recovered = service.recover(recoveryBranch);
	assert.equal(recovered.goal, "recover marker");
	assert.deepEqual(recovered.blockers, ["credential missing"]);
	assert.equal(runner.commands.length, before);
	store.close();
});

test("repository and session state remain isolated in one global store", () => {
	const root = temporaryDirectory("workspace-isolation");
	const store = new ContinuityStore(join(root, "continuity.sqlite"));
	const runner = new FakeCommandRunner(root);
	const first = new ContinuityService(identity(), root, store, new GitFingerprintService(runner), runner);
	const secondIdentity = identity({ sessionId: "session-b", sessionFileKey: "file-b", sessionKey: "session-b:file-b", repositoryId: "repo:b" });
	const second = new ContinuityService(secondIdentity, root, store, new GitFingerprintService(runner), runner);
	const firstBranch = branch(["root-a"]);
	const secondBranch = branch(["root-b"]);
	first.initialize(firstBranch);
	second.initialize(secondBranch);
	first.update({ goal: "repository A marker" }, firstBranch);
	second.update({ goal: "repository B marker" }, secondBranch);
	assert.equal(first.reconstructBranch(firstBranch).goal, "repository A marker");
	assert.equal(second.reconstructBranch(secondBranch).goal, "repository B marker");
	store.close();
});
