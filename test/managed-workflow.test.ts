import assert from "node:assert/strict";
import test from "node:test";

import {
	classifyWorkShape,
	emptyWorkflowProjection,
	executionPlanPath,
	renderExecutionPlan,
	type WorkShapeEvidence,
} from "../src/domain/managed-workflow.js";

const boundedEvidence: WorkShapeEvidence = {
	requestedMutation: true,
	authority: "resolved",
	spansSessions: false,
	coordinatesContributors: false,
	hasMeaningfulDependencies: false,
	recoverySensitive: false,
	externalSideEffects: false,
	cannotResumeSafelyFromDiff: false,
};

const workItemId = "4c6cf7dc-395a-4ca5-bb46-c2b3ad0b9505";

function draft() {
	return {
		workItemId,
		title: "Managed workflow",
		date: "2026-08-21",
		slug: "managed-workflow",
		outcome: "Ship one coherent slice.",
		authorityAndContext: ["AGENTS.md"],
		inScope: ["Domain policy", "Safe files"],
		outOfScope: ["Product policy"],
		constraints: [],
		steps: ["Implement", "Verify"],
		risksAndRecovery: ["Rollback the coherent commit."],
		validation: ["npm run typecheck"],
	};
}

test("work shape keeps read-only and bounded work document-free", () => {
	const readOnly = classifyWorkShape({ ...boundedEvidence, requestedMutation: false, authority: "missing" });
	assert.deepEqual(readOnly, {
		shape: "read-only",
		documentKind: null,
		mutationDisposition: "not-applicable",
		reason: "Read-only work does not create or require repository workflow documents.",
	});
	const bounded = classifyWorkShape(boundedEvidence);
	assert.equal(bounded.shape, "bounded");
	assert.equal(bounded.documentKind, null);
	assert.equal(bounded.mutationDisposition, "allowed");
});

test("durable work requires one execution plan while unresolved authority creates no document", () => {
	for (const key of [
		"spansSessions",
		"coordinatesContributors",
		"hasMeaningfulDependencies",
		"recoverySensitive",
		"externalSideEffects",
		"cannotResumeSafelyFromDiff",
	] as const) {
		const durable = classifyWorkShape({ ...boundedEvidence, [key]: true });
		assert.equal(durable.shape, "durable");
		assert.equal(durable.documentKind, "execution-plan");
		assert.equal(durable.mutationDisposition, "requires-execution-plan");
	}
	for (const authority of ["ambiguous", "missing"] as const) {
		const blocked = classifyWorkShape({ ...boundedEvidence, authority, spansSessions: true });
		assert.equal(blocked.shape, "authority-blocked");
		assert.equal(blocked.documentKind, null);
		assert.equal(blocked.mutationDisposition, "blocked");
	}
});

test("execution plan rendering is deterministic, identity-bound, and does not claim validation or completion", () => {
	const template = "<!-- {{WORK_ITEM_ID}} -->\r\n# {{TITLE}}\n{{DATE}}\n{{OUTCOME}}\n{{AUTHORITY_ITEMS}}\n{{IN_SCOPE_ITEMS}}\n{{OUT_OF_SCOPE_ITEMS}}\n{{CONSTRAINT_ITEMS}}\n{{PLAN_ITEMS}}\n{{RISK_ITEMS}}\n{{VALIDATION_ITEMS}}\n";
	const expected = `<!-- ${workItemId} -->\n# Managed workflow\n2026-08-21\nShip one coherent slice.\n- AGENTS.md\n- Domain policy\n- Safe files\n- Product policy\n- None.\n- Implement\n- Verify\n- Rollback the coherent commit.\n- npm run typecheck\n`;
	assert.equal(renderExecutionPlan(template, draft()), expected);
	assert.equal(renderExecutionPlan(template, draft()), expected);
	assert.equal(executionPlanPath("managed-workflow"), "docs/plans/active/managed-workflow.md");
	assert.doesNotMatch(expected, /validated|completed/i);
});

test("execution plan model rejects unsafe slugs, identities, and unsupported template placeholders", () => {
	assert.throws(() => executionPlanPath("../outside"), /slug/);
	assert.throws(() => executionPlanPath("Uppercase"), /slug/);
	assert.throws(() => renderExecutionPlan("{{UNKNOWN}}", draft()), /unsupported placeholders/);
	assert.throws(() => renderExecutionPlan("{{WORK_ITEM_ID}}", { ...draft(), workItemId: "not-a-uuid" }), /UUID/);
});

test("new workflow state is managed while callers can explicitly choose advisory migration mode", () => {
	assert.equal(emptyWorkflowProjection(1).mode, "managed");
	assert.equal(emptyWorkflowProjection(1, "advisory").mode, "advisory");
});
