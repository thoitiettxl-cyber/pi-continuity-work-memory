import { randomUUID } from "node:crypto";
import { sha256 } from "../domain/canonical.js";

import {
	classifyWorkShape,
	executionPlanPath,
	renderExecutionPlan,
	type ExecutionPlanDraft,
	type WorkPreparation,
	type WorkShapeEvidence,
	type WorkflowDocumentBinding,
	type WorkflowDocumentIntent,
} from "../domain/managed-workflow.js";
import {
	ExecutionPlanDigestMismatchError,
	ExecutionPlanFileService,
	ExecutionPlanPathError,
	type FinalizedExecutionPlan,
} from "../infrastructure/execution-plan-files.js";
import type { WorkflowAssetBundle } from "../infrastructure/workflow-assets.js";

export type WorkflowAssetName = "workflow" | "execution-plan" | "decision-record" | "application-runbook";

export interface ExecutionPlanPreparationInput {
	title: string;
	slug: string;
	outcome: string;
	authorityAndContext: string[];
	inScope: string[];
	outOfScope: string[];
	constraints: string[];
	steps: string[];
	risksAndRecovery: string[];
	validation: string[];
}

export interface PrepareManagedWorkInput extends WorkShapeEvidence {
	resumeHint?: string;
	document?: ExecutionPlanPreparationInput;
}

export interface PrepareManagedWorkResult {
	preparation: WorkPreparation;
	binding: WorkflowDocumentBinding | null;
	plannedPath: string | null;
	workItemId: string | null;
	materialized: boolean;
	resumeHint: string | null;
}

export interface PlannedManagedWork {
	preparation: WorkPreparation;
	intent: WorkflowDocumentIntent | null;
	content: string | null;
	resumeHint: string | null;
}

export interface WorkflowDocumentAlignment {
	state: "unbound" | "aligned" | "changed" | "missing" | "invalid";
	binding: WorkflowDocumentBinding | null;
	reason: string;
}

const ASSET_PATHS: Record<WorkflowAssetName, string> = {
	workflow: "WORKFLOW.md",
	"execution-plan": "templates/execution-plan.md",
	"decision-record": "templates/decision-record.md",
	"application-runbook": "templates/application-runbook.md",
};

function publicBinding(binding: Awaited<ReturnType<ExecutionPlanFileService["bindExecutionPlan"]>>): WorkflowDocumentBinding {
	return {
		kind: binding.kind,
		status: binding.status,
		workItemId: binding.workItemId,
		relativePath: binding.relativePath,
		templateVersion: binding.templateVersion,
		digest: binding.digest,
	};
}

function boundedResumeHint(value: string | undefined): string | null {
	const normalized = value?.trim();
	return normalized ? normalized.slice(0, 4_000) : null;
}

export class ManagedWorkflowService {
	constructor(
		private readonly assets: WorkflowAssetBundle,
		private readonly files?: ExecutionPlanFileService,
	) {}

	readAsset(name: WorkflowAssetName): { name: WorkflowAssetName; path: string; content: string; digest: string } {
		const path = ASSET_PATHS[name];
		const content = this.assets.assets[path];
		const entry = this.assets.manifest.assets.find((candidate) => candidate.path === path);
		if (content === undefined || !entry) throw new Error(`Workflow asset is unavailable: ${path}`);
		return { name, path, content, digest: entry.sha256 };
	}

	private requireFiles(): ExecutionPlanFileService {
		if (!this.files) throw new Error("Managed repository documents require a trusted canonical Git repository root");
		return this.files;
	}

	plan(input: PrepareManagedWorkInput, now = new Date()): PlannedManagedWork {
		const preparation = classifyWorkShape(input);
		const resumeHint = boundedResumeHint(input.resumeHint);
		if (preparation.shape !== "durable") return { preparation, intent: null, content: null, resumeHint };
		if (!input.document) throw new Error("Durable work requires execution-plan document fields");
		const workItemId = randomUUID();
		const plannedPath = executionPlanPath(input.document.slug);
		const template = this.readAsset("execution-plan").content;
		const draft: ExecutionPlanDraft = {
			workItemId,
			title: input.document.title,
			date: now.toISOString().slice(0, 10),
			slug: input.document.slug,
			outcome: input.document.outcome,
			authorityAndContext: input.document.authorityAndContext,
			inScope: input.document.inScope,
			outOfScope: input.document.outOfScope,
			constraints: input.document.constraints,
			steps: input.document.steps,
			risksAndRecovery: input.document.risksAndRecovery,
			validation: input.document.validation,
		};
		const content = renderExecutionPlan(template, draft);
		return {
			preparation,
			intent: {
				kind: "execution-plan",
				workItemId,
				relativePath: plannedPath,
				templateVersion: 1,
				expectedDigest: sha256(content),
			},
			content,
			resumeHint,
		};
	}

	async materialize(planned: PlannedManagedWork): Promise<WorkflowDocumentBinding> {
		if (planned.preparation.shape !== "durable" || !planned.intent || planned.content === null) {
			throw new Error("Only planned durable work can materialize an execution plan");
		}
		const created = await this.requireFiles().createExecutionPlan(planned.intent.relativePath, planned.content);
		if (created.workItemId !== planned.intent.workItemId || created.digest !== planned.intent.expectedDigest) {
			throw new Error("Materialized execution plan does not match its persisted workflow intent");
		}
		return publicBinding(created);
	}

	async prepare(input: PrepareManagedWorkInput, materialize: boolean, now = new Date()): Promise<PrepareManagedWorkResult> {
		const planned = this.plan(input, now);
		if (planned.preparation.shape !== "durable" || !planned.intent) {
			return { preparation: planned.preparation, binding: null, plannedPath: null, workItemId: null, materialized: false, resumeHint: planned.resumeHint };
		}
		if (!materialize) {
			return {
				preparation: planned.preparation,
				binding: null,
				plannedPath: planned.intent.relativePath,
				workItemId: planned.intent.workItemId,
				materialized: false,
				resumeHint: planned.resumeHint,
			};
		}
		const binding = await this.materialize(planned);
		return {
			preparation: planned.preparation,
			binding,
			plannedPath: planned.intent.relativePath,
			workItemId: binding.workItemId,
			materialized: true,
			resumeHint: planned.resumeHint,
		};
	}

	async bind(relativePath: string, expectedDigest?: string): Promise<WorkflowDocumentBinding> {
		return publicBinding(await this.requireFiles().bindExecutionPlan(relativePath, expectedDigest));
	}

	async alignment(binding: WorkflowDocumentBinding | null): Promise<WorkflowDocumentAlignment> {
		if (!binding) return { state: "unbound", binding: null, reason: "No repository workflow document is bound." };
		try {
			const current = publicBinding(await this.requireFiles().bindExecutionPlan(binding.relativePath));
			if (current.workItemId !== binding.workItemId || current.kind !== binding.kind) {
				return { state: "invalid", binding: current, reason: "The repository document identity no longer matches its Continuity binding." };
			}
			if (current.digest !== binding.digest) {
				return { state: "changed", binding: current, reason: "The repository document changed after its last Continuity binding; repository content wins and must be re-read." };
			}
			return { state: "aligned", binding: current, reason: "The repository document path, identity, and digest match the active binding." };
		} catch (error) {
			if (error instanceof ExecutionPlanPathError) {
				const state = /does not exist|directory does not exist/.test(error.message) ? "missing" : "invalid";
				return { state, binding: null, reason: error.message };
			}
			if (error instanceof ExecutionPlanDigestMismatchError) {
				return { state: "changed", binding: null, reason: error.message };
			}
			throw error;
		}
	}

	async finalize(binding: WorkflowDocumentBinding): Promise<{ finalized: FinalizedExecutionPlan; binding: WorkflowDocumentBinding }> {
		if (binding.kind !== "execution-plan" || binding.status !== "active") {
			throw new Error("Only an active execution-plan binding can be finalized");
		}
		const finalized = await this.requireFiles().finalizeExecutionPlan(binding.relativePath, binding.digest, binding.workItemId);
		return { finalized, binding: publicBinding(finalized.current) };
	}
}
