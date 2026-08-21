export type WorkflowMode = "off" | "advisory" | "managed";
export type WorkShape = "unclassified" | "read-only" | "bounded" | "durable" | "authority-blocked";
export type WorkflowPhase = "none" | "prepared" | "materializing" | "bound" | "drifted" | "conflict" | "finalized" | "recovery-required";
export type WorkflowDocumentKind = "execution-plan" | "decision-record" | "application-runbook";
export type WorkflowDocumentStatus = "active" | "completed";
export type MutationDisposition = "not-applicable" | "allowed" | "requires-execution-plan" | "blocked";

export interface WorkShapeEvidence {
	requestedMutation: boolean;
	authority: "resolved" | "ambiguous" | "missing";
	spansSessions: boolean;
	coordinatesContributors: boolean;
	hasMeaningfulDependencies: boolean;
	recoverySensitive: boolean;
	externalSideEffects: boolean;
	cannotResumeSafelyFromDiff: boolean;
}

export interface WorkPreparation {
	shape: Exclude<WorkShape, "unclassified">;
	documentKind: "execution-plan" | null;
	mutationDisposition: MutationDisposition;
	reason: string;
}

export interface WorkflowDocumentBinding {
	kind: WorkflowDocumentKind;
	status: WorkflowDocumentStatus;
	workItemId: string;
	relativePath: string;
	templateVersion: number | null;
	digest: string;
}

export interface WorkflowDocumentIntent {
	kind: "execution-plan";
	workItemId: string;
	relativePath: string;
	templateVersion: 1;
	expectedDigest: string;
}

export interface WorkflowProjection {
	version: 1;
	mode: WorkflowMode;
	shape: WorkShape;
	phase: WorkflowPhase;
	intent: WorkflowDocumentIntent | null;
	binding: WorkflowDocumentBinding | null;
	resumeHint: string | null;
	updatedAt: number;
}

export interface ExecutionPlanDraft {
	workItemId: string;
	title: string;
	date: string;
	slug: string;
	outcome: string;
	authorityAndContext: readonly string[];
	inScope: readonly string[];
	outOfScope: readonly string[];
	constraints: readonly string[];
	steps: readonly string[];
	risksAndRecovery: readonly string[];
	validation: readonly string[];
}

const EXECUTION_PLAN_TOKENS = [
	"{{WORK_ITEM_ID}}",
	"{{TITLE}}",
	"{{DATE}}",
	"{{OUTCOME}}",
	"{{AUTHORITY_ITEMS}}",
	"{{IN_SCOPE_ITEMS}}",
	"{{OUT_OF_SCOPE_ITEMS}}",
	"{{CONSTRAINT_ITEMS}}",
	"{{PLAN_ITEMS}}",
	"{{RISK_ITEMS}}",
	"{{VALIDATION_ITEMS}}",
] as const;

export function emptyWorkflowProjection(now = Date.now(), mode: WorkflowMode = "managed"): WorkflowProjection {
	return {
		version: 1,
		mode,
		shape: "unclassified",
		phase: "none",
		intent: null,
		binding: null,
		resumeHint: null,
		updatedAt: now,
	};
}

export function classifyWorkShape(evidence: WorkShapeEvidence): WorkPreparation {
	if (!evidence.requestedMutation) {
		return {
			shape: "read-only",
			documentKind: null,
			mutationDisposition: "not-applicable",
			reason: "Read-only work does not create or require repository workflow documents.",
		};
	}
	if (evidence.authority !== "resolved") {
		return {
			shape: "authority-blocked",
			documentKind: null,
			mutationDisposition: "blocked",
			reason: "Mutative work with ambiguous or missing authority creates no document and remains blocked.",
		};
	}
	if (
		evidence.spansSessions ||
		evidence.coordinatesContributors ||
		evidence.hasMeaningfulDependencies ||
		evidence.recoverySensitive ||
		evidence.externalSideEffects ||
		evidence.cannotResumeSafelyFromDiff
	) {
		return {
			shape: "durable",
			documentKind: "execution-plan",
			mutationDisposition: "requires-execution-plan",
			reason: "Durable work requires one explicitly created or bound execution plan before mutation.",
		};
	}
	return {
		shape: "bounded",
		documentKind: null,
		mutationDisposition: "allowed",
		reason: "Bounded mutative work remains document-free.",
	};
}

function requireText(value: string, field: string, maximum = 4_000): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${field} must not be empty`);
	if (normalized.includes("\0")) throw new Error(`${field} must not contain NUL`);
	return normalized.slice(0, maximum);
}

function renderItems(values: readonly string[], field: string): string {
	if (values.length === 0) return "- None.";
	return values.slice(0, 200).map((value, index) => `- ${requireText(value, `${field}[${index}]`)}`).join("\n");
}

export function executionPlanPath(slug: string): string {
	const normalized = requireText(slug, "slug", 80);
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
		throw new Error("slug must contain only lowercase letters, digits, and single hyphen separators");
	}
	return `docs/plans/active/${normalized}.md`;
}

export function renderExecutionPlan(template: string, draft: ExecutionPlanDraft): string {
	if (!/^[0-9a-f-]{36}$/i.test(draft.workItemId)) throw new Error("workItemId must be a UUID");
	if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) throw new Error("date must use YYYY-MM-DD format");
	executionPlanPath(draft.slug);
	const replacements = new Map<string, string>([
		["{{WORK_ITEM_ID}}", draft.workItemId.toLowerCase()],
		["{{TITLE}}", requireText(draft.title, "title")],
		["{{DATE}}", draft.date],
		["{{OUTCOME}}", requireText(draft.outcome, "outcome", 16_000)],
		["{{AUTHORITY_ITEMS}}", renderItems(draft.authorityAndContext, "authorityAndContext")],
		["{{IN_SCOPE_ITEMS}}", renderItems(draft.inScope, "inScope")],
		["{{OUT_OF_SCOPE_ITEMS}}", renderItems(draft.outOfScope, "outOfScope")],
		["{{CONSTRAINT_ITEMS}}", renderItems(draft.constraints, "constraints")],
		["{{PLAN_ITEMS}}", renderItems(draft.steps, "steps")],
		["{{RISK_ITEMS}}", renderItems(draft.risksAndRecovery, "risksAndRecovery")],
		["{{VALIDATION_ITEMS}}", renderItems(draft.validation, "validation")],
	]);
	let rendered = template.replaceAll("\r\n", "\n");
	for (const token of EXECUTION_PLAN_TOKENS) rendered = rendered.replaceAll(token, replacements.get(token)!);
	if (/{{[A-Z0-9_]+}}/.test(rendered)) throw new Error("execution plan template contains unsupported placeholders");
	return `${rendered.trimEnd()}\n`;
}
