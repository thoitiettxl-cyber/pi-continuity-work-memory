import { basename, isAbsolute, relative, resolve, sep } from "node:path";

import type { WorkflowMode, WorkflowProjection } from "../domain/managed-workflow.js";

export interface ContextFileReference {
	path: string;
	content?: string;
}

export interface WorkflowEligibility {
	eligible: boolean;
	repositoryAgentsPaths: string[];
	reason: string;
}

function within(root: string, path: string): boolean {
	const fromRoot = relative(root, path);
	return fromRoot === "" || (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot));
}

export function assessWorkflowEligibility(
	repositoryRoot: string | undefined,
	trusted: boolean,
	contextFiles: readonly ContextFileReference[] | undefined,
): WorkflowEligibility {
	if (!trusted) return { eligible: false, repositoryAgentsPaths: [], reason: "Project is untrusted; managed repository writes are disabled." };
	if (!repositoryRoot) return { eligible: false, repositoryAgentsPaths: [], reason: "A canonical Git repository root is unavailable." };
	const root = resolve(repositoryRoot);
	const paths = (contextFiles ?? [])
		.map((file) => isAbsolute(file.path) ? resolve(file.path) : resolve(root, file.path))
		.filter((path) => within(root, path))
		.filter((path) => basename(path) === "AGENTS.md" || basename(path) === "AGENTS.override.md")
		.map((path) => relative(root, path).split(sep).join("/") || basename(path));
	const repositoryAgentsPaths = [...new Set(paths)].sort((left, right) => left.localeCompare(right));
	if (repositoryAgentsPaths.length === 0) {
		return {
			eligible: false,
			repositoryAgentsPaths,
			reason: "No in-repository AGENTS.md context file was loaded; managed auto-document behavior is disabled.",
		};
	}
	return {
		eligible: true,
		repositoryAgentsPaths,
		reason: `Managed workflow may supplement repository instructions from ${repositoryAgentsPaths.join(", ")}.`,
	};
}

export function managedWorkflowPrompt(
	mode: WorkflowMode,
	eligibility: WorkflowEligibility,
	projection: WorkflowProjection,
	guidance: string,
): string {
	if (mode === "off") return "";
	const binding = projection.binding
		? `${projection.binding.relativePath} (${projection.binding.status}, sha256:${projection.binding.digest.slice(0, 12)})`
		: "(none)";
	return [
		`<managed-repository-workflow mode="${mode}" authority="package-process-default-only">`,
		`Eligibility: ${eligibility.eligible ? "eligible" : "ineligible"} — ${eligibility.reason}`,
		`Work shape: ${projection.shape}; phase: ${projection.phase}; authoritative repository document: ${binding}.`,
		"Repository AGENTS.md instructions, user authority, repository documents, code, tests, and runtime evidence remain the system of record.",
		"Opening a repository, read-only work, and bounded work create no lifecycle documents.",
		"Before the first repository mutation in managed mode, call continuity_prepare_work after reading applicable repository authority.",
		"Durable work must create or bind exactly one execution plan through an observable tool call; ambiguous or missing authority creates nothing and blocks mutation.",
		"Continuity keeps only operational binding/recovery state. Repository documents own durable progress, decisions, validation, and result.",
		"A safe checkpoint never proves task completion. Completion requires repository-appropriate executable or observable evidence.",
		guidance.trim(),
		"</managed-repository-workflow>",
	].join("\n");
}
