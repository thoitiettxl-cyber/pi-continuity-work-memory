import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ContinuityService } from "../src/application/continuity-service.js";
import { buildCheckpointHashes, type CheckpointPayloadV1 } from "../src/domain/checkpoint-chain.js";
import type { CheckpointRecord } from "../src/domain/types.js";
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

for (const tamper of [
	["command", "UPDATE validation_evidence SET command_text = 'git diff --check' WHERE id = ?"],
	["exit code", "UPDATE validation_evidence SET exit_code = 1 WHERE id = ?"],
	["output digest", "UPDATE validation_evidence SET output_digest = 'corrupt' WHERE id = ?"],
	["provider", "UPDATE validation_evidence SET provider = 'observed-tool' WHERE id = ?"],
] as const) {
	test(`validation receipt tampering (${tamper[0]}) quarantines the checkpoint`, async () => {
		const { service, store } = fixture(`receipt-tamper-${tamper[0].replaceAll(" ", "-")}`);
		const active = branch(["root", "node"]);
		service.initialize(active);
		const validation = await service.validate("npm test", active);
		assert.ok(validation.evidence);
		const checkpoint = await service.createCheckpoint(active);
		active.embeddedStates.push(service.embeddedState(checkpoint));
		store.db.prepare(tamper[1]).run(validation.evidence.id);
		const status = await service.status(active);
		assert.equal(status.authority, "quarantined");
		assert.match(status.reason, /receipt|exit code|digest|projection/);
		store.close();
	});
}

test("checkpoint column projection tampering is detected independently of payload hashes", async () => {
	const { service, store } = fixture("checkpoint-projection-tamper");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.validate("npm test", active);
	const checkpoint = await service.createCheckpoint(active);
	active.embeddedStates.push(service.embeddedState(checkpoint));
	store.db.prepare("UPDATE checkpoints SET mutation_sequence = mutation_sequence + 1 WHERE id = ?").run(checkpoint.id);
	const status = await service.status(active);
	assert.equal(status.authority, "quarantined");
	assert.match(status.reason, /projection mismatch/);
	store.close();
});

test("RC2 checkpoint remains recoverable as legacy and a fresh receipt starts a v2 genesis chain", async () => {
	const { service, store } = fixture("legacy-checkpoint");
	const active = branch(["root", "legacy"]);
	service.initialize(active);
	const evidenceId = "legacy-evidence";
	store.db.prepare(`INSERT INTO validation_evidence(
  id, session_key, node_id, command_text, exit_code, started_at, finished_at,
  mutation_sequence, repository_fingerprint, output_digest, provider
) VALUES (?, ?, ?, 'npm test', 0, 1, 2, 0, 'legacy-fingerprint', 'legacy-output', 'continuity-validate')`)
		.run(evidenceId, service.identity.sessionKey, active.currentNodeId);
	const createdAt = Date.now();
	const payload: CheckpointPayloadV1 = {
		version: 1,
		sessionId: service.identity.sessionId,
		sessionFileKey: service.identity.sessionFileKey,
		repositoryId: service.identity.repositoryId,
		state: service.currentState(),
		validationEvidenceId: evidenceId,
		mutationSequence: 0,
		repositoryFingerprint: "legacy-fingerprint",
		createdAt,
	};
	const hashes = buildCheckpointHashes(payload, "GENESIS");
	const legacy: CheckpointRecord = {
		id: "legacy-checkpoint",
		sessionKey: service.identity.sessionKey,
		sessionId: service.identity.sessionId,
		sessionFileKey: service.identity.sessionFileKey,
		repositoryId: service.identity.repositoryId,
		parentId: null,
		parentHash: "GENESIS",
		payloadVersion: 1,
		...hashes,
		repositoryFingerprint: "legacy-fingerprint",
		validationEvidenceId: evidenceId,
		validationReceiptDigest: null,
		operationLedgerDigest: null,
		mutationSequence: 0,
		status: "verified",
		createdAt,
	};
	store.insertCheckpoint(legacy);
	service.recover(active, legacy.id);
	active.embeddedStates.push(service.embeddedState(legacy));
	const legacyStatus = await service.status(active);
	assert.equal(legacyStatus.authority, "legacy");
	assert.equal(legacyStatus.health, "degraded");

	await service.validate("npm test", active);
	const fresh = await service.createCheckpoint(active);
	assert.equal(fresh.payloadVersion, 2);
	assert.equal(fresh.parentId, null);
	assert.equal(fresh.parentHash, "GENESIS");
	store.close();
});

test("an uncertain external operation survives unrelated mutations until human reconciliation", async () => {
	const root = temporaryDirectory("operation-reconciliation");
	const path = join(root, "continuity.sqlite");
	const runner = new FakeCommandRunner(root);
	const active = branch(["root", "work"]);
	const firstStore = new ContinuityStore(path);
	const first = new ContinuityService(identity(), root, firstStore, new GitFingerprintService(runner), runner);
	first.initialize(active);
	await first.observeToolCall({ toolCallId: "push-1", toolName: "bash", input: { command: "git push origin main" }, branch: active });
	firstStore.close();

	const resumedStore = new ContinuityStore(path);
	const resumed = new ContinuityService(identity(), root, resumedStore, new GitFingerprintService(runner), runner);
	resumed.initialize(active);
	assert.equal(resumed.listOperations(active).find((item) => item.toolCallId === "push-1")?.status, "uncertain");
	await resumed.observeToolCall({ toolCallId: "local-edit", toolName: "write", input: { path: "x", content: "y" }, branch: active });
	await resumed.observeToolResult({ toolCallId: "local-edit", isError: false, contentText: "written", branch: active });
	const degraded = await resumed.status(active);
	assert.equal(degraded.unresolvedOperations.some((item) => item.toolCallId === "push-1"), true);
	await assert.rejects(resumed.createCheckpoint(active), /push-1|Unresolved operation/);

	const beforeSequence = resumed.currentState().mutationSequence;
	resumed.reconcileOperation(active, "push-1", "applied", "Verified the remote branch contains the intended commit");
	assert.equal(resumed.currentState().mutationSequence, beforeSequence + 1);
	assert.equal((await resumed.status(active)).unresolvedOperations.length, 0);
	await assert.rejects(resumed.createCheckpoint(active), /No successful/);
	await resumed.validate("npm test", active);
	assert.equal((await resumed.createCheckpoint(active)).payloadVersion, 2);
	resumedStore.close();
});

test("duplicate consequential operations are blocked unless the prior attempt was observed absent", async () => {
	const { service, store } = fixture("operation-idempotency");
	const active = branch(["root", "work"]);
	service.initialize(active);
	const input = { command: "git push origin main" };
	assert.equal(await service.observeToolCall({ toolCallId: "push-success", toolName: "bash", input, branch: active }), undefined);
	await service.observeToolResult({ toolCallId: "push-success", isError: false, contentText: "pushed", branch: active });
	const duplicate = await service.observeToolCall({ toolCallId: "push-duplicate", toolName: "bash", input, branch: active });
	assert.equal(duplicate?.block, true);
	assert.equal(Object.hasOwn(duplicate ?? {}, "terminate"), false);

	const failedInput = { command: "npm publish" };
	await service.observeToolCall({ toolCallId: "publish-uncertain", toolName: "bash", input: failedInput, branch: active });
	await service.observeToolResult({ toolCallId: "publish-uncertain", isError: true, contentText: "connection lost", branch: active });
	service.reconcileOperation(active, "publish-uncertain", "not_applied", "Registry lookup confirmed that the version is absent");
	assert.equal(await service.observeToolCall({ toolCallId: "publish-retry", toolName: "bash", input: failedInput, branch: active }), undefined);
	store.close();
});

test("operation-ledger tampering invalidates an otherwise unchanged checkpoint", async () => {
	const { service, store } = fixture("ledger-tamper");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.observeToolCall({ toolCallId: "local", toolName: "write", input: { path: "x", content: "y" }, branch: active });
	await service.observeToolResult({ toolCallId: "local", isError: false, contentText: "written", branch: active });
	await service.validate("npm test", active);
	const checkpoint = await service.createCheckpoint(active);
	active.embeddedStates.push(service.embeddedState(checkpoint));
	store.db.prepare("UPDATE pending_mutations SET result_digest = 'corrupt' WHERE tool_call_id = 'local'").run();
	const status = await service.status(active);
	assert.equal(status.authority, "quarantined");
	assert.match(status.reason, /operation ledger digest mismatch/);
	store.close();
});

test("duplicate tool-call IDs are blocked without advancing mutation sequence or losing ledger rows", async () => {
	const { service, store } = fixture("duplicate-tool-call-id");
	const active = branch(["root", "node"]);
	service.initialize(active);
	const input = { path: "x", content: "y" };
	assert.equal(await service.observeToolCall({ toolCallId: "duplicate", toolName: "write", input, branch: active }), undefined);
	const sequence = service.currentState().mutationSequence;
	const duplicate = await service.observeToolCall({ toolCallId: "duplicate", toolName: "write", input, branch: active });
	assert.equal(duplicate?.block, true);
	assert.equal(Object.hasOwn(duplicate ?? {}, "terminate"), false);
	assert.equal(service.currentState().mutationSequence, sequence);
	assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM pending_mutations WHERE tool_call_id = 'duplicate'").get() as Record<string, unknown>).count, 1);
	store.close();
});

test("replayed validation tool results cannot mint a second receipt", async () => {
	const { service, store } = fixture("validation-result-replay");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.observeToolCall({ toolCallId: "validation", toolName: "bash", input: { command: "npm test" }, branch: active });
	const first = await service.observeToolResult({ toolCallId: "validation", isError: false, contentText: "passed", branch: active });
	assert.ok(first);
	const replay = await service.observeToolResult({ toolCallId: "validation", isError: false, contentText: "passed", branch: active });
	assert.equal(replay, undefined);
	assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM validation_evidence").get() as Record<string, unknown>).count, 1);
	store.close();
});

test("changing agent-controlled work metadata cannot bypass an uncertain operation claim", async () => {
	const { service, store } = fixture("stable-operation-intent");
	const active = branch(["root", "node"]);
	service.initialize(active);
	const input = { command: "npm publish" };
	await service.observeToolCall({ toolCallId: "publish", toolName: "bash", input, branch: active });
	await service.observeToolResult({ toolCallId: "publish", isError: true, contentText: "connection lost", branch: active });
	service.update({ workItemId: "different-work", currentStepId: "different-step" }, active);
	const retry = await service.observeToolCall({ toolCallId: "publish-retry", toolName: "bash", input, branch: active });
	assert.equal(retry?.block, true);
	assert.equal(Object.hasOwn(retry ?? {}, "terminate"), false);
	assert.match(retry?.reason ?? "", /uncertain|reconcile/);
	store.close();
});

test("two services atomically claim only one identical consequential operation", async () => {
	const root = temporaryDirectory("operation-claim-concurrency");
	const path = join(root, "continuity.sqlite");
	const storeA = new ContinuityStore(path);
	const storeB = new ContinuityStore(path);
	const runner = new FakeCommandRunner(root);
	const active = branch(["root", "node"]);
	const first = new ContinuityService(identity(), root, storeA, new GitFingerprintService(runner), runner);
	const second = new ContinuityService(identity(), root, storeB, new GitFingerprintService(runner), runner);
	first.initialize(active);
	second.initialize(active);
	const input = { command: "git push origin main" };
	const results = await Promise.all([
		first.observeToolCall({ toolCallId: "push-a", toolName: "bash", input, branch: active }),
		second.observeToolCall({ toolCallId: "push-b", toolName: "bash", input, branch: active }),
	]);
	assert.equal(results.filter((result) => result?.block).length, 1);
	assert.equal((storeA.db.prepare("SELECT COUNT(*) AS count FROM pending_mutations WHERE operation_key IS NOT NULL").get() as Record<string, unknown>).count, 1);
	assert.equal((storeA.db.prepare("SELECT COUNT(*) AS count FROM operation_claims").get() as Record<string, unknown>).count, 1);
	storeA.close();
	storeB.close();
});

for (const tamper of [
	"UPDATE operation_reconciliations SET note_text = 'No verification was performed'",
	"UPDATE operation_reconciliations SET note_digest = 'corrupt'",
	"UPDATE operation_reconciliations SET outcome = 'not_applied'",
	"UPDATE operation_reconciliations SET actor = 'human-command', session_key = 'other-session'",
	"UPDATE operation_reconciliations SET node_id = 'off-branch'",
] as const) {
	test(`reconciliation tampering is detected: ${tamper}`, async () => {
		const { service, store } = fixture(`reconciliation-tamper-${sha256ForTest(tamper).slice(0, 8)}`);
		const active = branch(["root", "node"]);
		service.initialize(active);
		await service.observeToolCall({ toolCallId: "publish", toolName: "bash", input: { command: "npm publish" }, branch: active });
		await service.observeToolResult({ toolCallId: "publish", isError: true, contentText: "connection lost", branch: active });
		service.reconcileOperation(active, "publish", "applied", "Registry lookup confirmed the intended version exists");
		await service.validate("npm test", active);
		const checkpoint = await service.createCheckpoint(active);
		active.embeddedStates.push(service.embeddedState(checkpoint));
		if (tamper.includes("other-session")) {
			store.db.prepare("INSERT INTO sessions(session_key, session_id, session_file_key, repository_id, trusted, created_at, updated_at) VALUES ('other-session', 'other', 'other-file', 'repo:a', 1, 1, 1)").run();
		}
		store.db.prepare(tamper).run();
		const status = await service.status(active);
		assert.equal(status.authority, "quarantined");
		assert.match(status.reason, /reconciliation integrity mismatch/);
		store.close();
	});
}

test("validation commands persist only redacted text plus a digest", async () => {
	const { service, store } = fixture("validation-command-secret");
	const active = branch(["root", "node"]);
	service.initialize(active);
	const secret = "sk-review-EXPOSED123456789";
	const command = `npm test -- --test-name-pattern=api_key=${secret}`;
	const validation = await service.validate(command, active);
	assert.ok(validation.evidence);
	assert.ok(validation.evidence.commandDigest);
	assert.doesNotMatch(validation.evidence.command, new RegExp(secret));
	const checkpoint = await service.createCheckpoint(active);
	const persisted = JSON.stringify({
		evidence: store.db.prepare("SELECT * FROM validation_evidence WHERE id = ?").get(validation.evidence.id),
		checkpoint: store.getCheckpoint(checkpoint.id),
		embedded: service.embeddedState(checkpoint),
	});
	assert.doesNotMatch(persisted, new RegExp(secret));
	store.close();
});

test("validation rejects output-writing or executable git diff forms before command execution", async () => {
	const { service, runner, store } = fixture("validation-git-diff-hazards");
	const active = branch(["root", "node"]);
	service.initialize(active);
	for (const command of [
		"git diff --check --output=/tmp/continuity-diff",
		"git diff --check --output /tmp/continuity-diff",
		"git diff --check --out=/tmp/continuity-diff",
		"git diff --check --ext-dif",
		"git diff --check --textco",
		"git diff --check --ext-diff",
		"git diff --check --textconv",
	]) {
		const commandCount = runner.commands.length;
		await assert.rejects(service.validate(command, active), /executable allow-list/);
		assert.equal(runner.commands.length, commandCount, command);
	}
	store.close();
});

test("checkpoint creation aborts atomically when mutation state changes during fingerprint collection", async () => {
	const { service, runner, store } = fixture("checkpoint-race");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.validate("npm test", active);
	let fired = false;
	runner.onRun = async (command, args) => {
		if (fired || command !== "git" || args[0] !== "status") return;
		fired = true;
		await service.observeToolCall({ toolCallId: "racing-write", toolName: "write", input: { path: "race", content: "x" }, branch: active });
		await service.observeToolResult({ toolCallId: "racing-write", isError: false, contentText: "written", branch: active });
	};
	await assert.rejects(service.createCheckpoint(active), /changed while creating checkpoint|No successful/);
	assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM checkpoints").get() as Record<string, unknown>).count, 0);
	store.close();
});

function sha256ForTest(value: string): string {
	let hash = 0;
	for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	return hash.toString(16).padStart(8, "0");
}

test("a tool result cannot resolve a pending operation owned by another session", async () => {
	const root = temporaryDirectory("cross-session-result");
	const path = join(root, "continuity.sqlite");
	const storeA = new ContinuityStore(path);
	const storeB = new ContinuityStore(path);
	const runner = new FakeCommandRunner(root);
	const branchA = branch(["a-root", "a-node"]);
	const branchB = branch(["b-root", "b-node"]);
	const first = new ContinuityService(identity(), root, storeA, new GitFingerprintService(runner), runner);
	const second = new ContinuityService(identity({ sessionId: "session-b", sessionFileKey: "file-b", sessionKey: "session-b:file-b" }), root, storeB, new GitFingerprintService(runner), runner);
	first.initialize(branchA);
	second.initialize(branchB);
	await first.observeToolCall({ toolCallId: "owned-by-a", toolName: "bash", input: { command: "npm publish" }, branch: branchA });
	assert.equal(await second.observeToolResult({ toolCallId: "owned-by-a", isError: false, contentText: "published", branch: branchB }), undefined);
	assert.equal(storeA.unresolvedForBranch(first.identity.sessionKey, branchA.nodeIds)[0]?.status, "pending");
	await first.observeToolResult({ toolCallId: "owned-by-a", isError: false, contentText: "published", branch: branchA });
	assert.equal(storeA.unresolvedForBranch(first.identity.sessionKey, branchA.nodeIds).length, 0);
	storeA.close();
	storeB.close();
});

test("semantic operation claims canonicalize equivalent shell quoting", async () => {
	const { service, store } = fixture("semantic-operation-key");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.observeToolCall({ toolCallId: "push", toolName: "bash", input: { command: "git push origin main" }, branch: active });
	await service.observeToolResult({ toolCallId: "push", isError: false, contentText: "pushed", branch: active });
	const duplicate = await service.observeToolCall({ toolCallId: "quoted-push", toolName: "bash", input: { command: "git push origin 'main'" }, branch: active });
	assert.equal(duplicate?.block, true);
	store.close();
});

test("agent compound shell commands are blocked before any side effect can escape the ledger", async () => {
	const { service, store } = fixture("compound-shell-block");
	const active = branch(["root", "node"]);
	service.initialize(active);
	const decision = await service.observeToolCall({ toolCallId: "compound", toolName: "bash", input: { command: "node --test\nnpm publish" }, branch: active });
	assert.equal(decision?.block, true);
	assert.equal(Object.hasOwn(decision ?? {}, "terminate"), false);
	assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM pending_mutations").get() as Record<string, unknown>).count, 0);
	store.close();
});

test("whitespace-separated credential text is not persisted in validation evidence or checkpoints", async () => {
	const { service, store } = fixture("validation-command-whitespace-secret");
	const active = branch(["root", "node"]);
	service.initialize(active);
	const secret = "hunter2-plaintext-secret";
	const validation = await service.validate(`npm test -- --test-name-pattern="password ${secret}"`, active);
	assert.ok(validation.evidence);
	const checkpoint = await service.createCheckpoint(active);
	const persisted = JSON.stringify({
		evidence: store.db.prepare("SELECT * FROM validation_evidence WHERE id = ?").get(validation.evidence.id),
		checkpoint: store.getCheckpoint(checkpoint.id),
		embedded: service.embeddedState(checkpoint),
	});
	assert.doesNotMatch(persisted, new RegExp(secret));
	store.close();
});

test("a repository change after provisional insert prevents checkpoint promotion", async () => {
	const { service, runner, store } = fixture("checkpoint-final-fingerprint-race");
	const active = branch(["root", "node"]);
	service.initialize(active);
	await service.validate("npm test", active);
	let changed = false;
	runner.onRun = async () => {
		const count = Number((store.db.prepare("SELECT COUNT(*) AS count FROM checkpoints").get() as Record<string, unknown>).count);
		if (!changed && count === 1) {
			changed = true;
			runner.version += 1;
		}
	};
	await assert.rejects(service.createCheckpoint(active), /Repository changed before checkpoint promotion/);
	const row = store.db.prepare("SELECT status FROM checkpoints").get() as Record<string, unknown>;
	assert.equal(row.status, "quarantined");
	store.close();
});
