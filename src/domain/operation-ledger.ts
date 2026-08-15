import { canonicalJson, sha256 } from "./canonical.js";
import type { TrackedOperation, UnresolvedOperation } from "./types.js";

export type EffectiveOperationStatus = "pending" | "uncertain" | "determined";

export function reconciliationDigest(input: {
	id: string;
	toolCallId: string;
	revision: number;
	outcome: string;
	noteDigest: string;
	actor: string;
	sessionKey: string;
	nodeId: string;
	createdAt: number;
}): string {
	return sha256(`pi-continuity-operation-reconciliation-v1\n${canonicalJson(input)}`);
}

export function effectiveOperationStatus(operation: TrackedOperation): EffectiveOperationStatus {
	if (operation.status === "pending") return "pending";
	if (operation.status === "uncertain" && (!operation.reconciliation || !operation.reconciliation.integrityValid)) return "uncertain";
	return "determined";
}

export function unresolvedOperation(operation: TrackedOperation): UnresolvedOperation | undefined {
	if (operation.kind !== "mutation") return undefined;
	const status = effectiveOperationStatus(operation);
	if (status === "determined") return undefined;
	return {
		toolCallId: operation.toolCallId,
		operationKey: operation.operationKey,
		toolName: operation.toolName,
		consequence: operation.consequence,
		command: operation.command,
		status,
		createdAt: operation.createdAt,
	};
}

export function operationLedgerDigest(operations: readonly TrackedOperation[]): string {
	const payload = operations
		.filter((operation) => operation.kind === "mutation")
		.map((operation) => ({
			toolCallId: operation.toolCallId,
			operationKey: operation.operationKey,
			nodeId: operation.nodeId,
			sequence: operation.sequence,
			toolName: operation.toolName,
			consequence: operation.consequence,
			inputDigest: operation.inputDigest,
			preFingerprint: operation.preFingerprint,
			commandDigest: operation.commandDigest,
			status: operation.status,
			isError: operation.isError,
			resultDigest: operation.resultDigest,
			createdAt: operation.createdAt,
			resolvedAt: operation.resolvedAt,
			reconciliation: operation.reconciliation ? {
				id: operation.reconciliation.id,
				revision: operation.reconciliation.revision,
				outcome: operation.reconciliation.outcome,
				noteDigest: operation.reconciliation.noteDigest,
				noteTextDigest: sha256(operation.reconciliation.note),
				recordDigest: operation.reconciliation.recordDigest,
				actor: operation.reconciliation.actor,
				sessionKey: operation.reconciliation.sessionKey,
				nodeId: operation.reconciliation.nodeId,
				createdAt: operation.reconciliation.createdAt,
				integrityValid: operation.reconciliation.integrityValid,
			} : null,
		}))
		.sort((left, right) => left.sequence - right.sequence || left.toolCallId.localeCompare(right.toolCallId));
	return sha256(`pi-continuity-operation-ledger-v1\n${canonicalJson(payload)}`);
}
