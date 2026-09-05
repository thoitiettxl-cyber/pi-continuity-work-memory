import type { WorkflowDocumentBinding } from "./managed-workflow.js";

/** Read-only display projections; neither status nor presence proves completion. */
export interface PlanSummary extends WorkflowDocumentBinding {
	title: string;
	declaredStatus: string;
}

export interface PlanDetail extends PlanSummary {
	content: string;
}

export interface PlanCatalog {
	plans: PlanSummary[];
	issues: string[];
	truncated: boolean;
}

export type PlanDraftAction = "work" | "refine";

export function canWorkOnPlan(plan: PlanSummary): boolean {
	return plan.status === "active" && plan.declaredStatus.trim().toLowerCase() !== "completed";
}

export function buildPlanDraft(plan: PlanSummary, action: PlanDraftAction): string {
	if (action === "work" && !canWorkOnPlan(plan)) throw new Error("Completed plans are history; Work is disabled");
	// Only the validated path is interpolated, never repository-authored titles/body instructions.
	const target = JSON.stringify(plan.relativePath);
	const preamble = `Read the execution plan at repository-relative path ${target} and applicable AGENTS.md instructions. Inspect current code, tests and worktree before acting.`;
	if (action === "refine") {
		return `${preamble}\n\nReview this plan read-only: identify material gaps against repository evidence, recommend concrete refinements, and ask only for unresolved decisions. Do not edit files, change bindings, reopen completed work or invoke a clarification skill automatically. Wait for my authorization before applying changes.`;
	}
	return `${preamble}\n\nContinue the next unfinished step within the plan's authorized scope. Check Continuity's current binding first; do not silently replace another unfinished work item. Explicitly bind this existing plan when the applicable workflow permits, rather than creating a duplicate plan. If scope or authority is unresolved, stop and ask. Verify behavior with repository-required checks; plan status, memory and checkpoints alone do not prove completion. This request does not authorize commits, publishing, deployment or other external actions.`;
}
