import { canonicalJson, sha256 } from "./canonical.js";
import type { ValidationEvidence } from "./types.js";

export interface ValidationReceiptInput {
	id: string;
	sessionKey: string;
	nodeId: string;
	command: string;
	commandDigest: string;
	exitCode: number;
	startedAt: number;
	finishedAt: number;
	mutationSequence: number;
	preRepositoryFingerprint: string;
	postRepositoryFingerprint: string;
	repositoryFingerprint: string;
	operationLedgerDigest: string;
	outputDigest: string;
	provider: ValidationEvidence["provider"];
}

function receiptPayload(input: ValidationReceiptInput): Record<string, unknown> {
	return {
		version: 1,
		id: input.id,
		sessionKey: input.sessionKey,
		nodeId: input.nodeId,
		command: input.command,
		commandDigest: input.commandDigest,
		exitCode: input.exitCode,
		startedAt: input.startedAt,
		finishedAt: input.finishedAt,
		mutationSequence: input.mutationSequence,
		preRepositoryFingerprint: input.preRepositoryFingerprint,
		postRepositoryFingerprint: input.postRepositoryFingerprint,
		repositoryFingerprint: input.repositoryFingerprint,
		operationLedgerDigest: input.operationLedgerDigest,
		outputDigest: input.outputDigest,
		provider: input.provider,
	};
}

export function validationReceiptDigest(input: ValidationReceiptInput): string {
	return sha256(`pi-continuity-validation-receipt-v1\n${canonicalJson(receiptPayload(input))}`);
}

export function buildValidationEvidence(input: ValidationReceiptInput): ValidationEvidence {
	return {
		...input,
		receiptVersion: 1,
		receiptDigest: validationReceiptDigest(input),
	};
}

export function verifyValidationEvidence(evidence: ValidationEvidence): { valid: boolean; legacy: boolean; reason: string } {
	if (evidence.receiptVersion === null || evidence.receiptDigest === null) {
		return { valid: false, legacy: true, reason: "validation evidence predates receipt binding" };
	}
	if (evidence.receiptVersion !== 1) return { valid: false, legacy: false, reason: `unsupported validation receipt version ${evidence.receiptVersion}` };
	if (!evidence.preRepositoryFingerprint || !evidence.postRepositoryFingerprint || !evidence.operationLedgerDigest) {
		return { valid: false, legacy: false, reason: "validation receipt is missing authoritative fields" };
	}
	if (evidence.exitCode !== 0) return { valid: false, legacy: false, reason: "validation receipt exit code is not zero" };
	if (!evidence.commandDigest) return { valid: false, legacy: false, reason: "validation receipt command digest is missing" };
	if (evidence.preRepositoryFingerprint !== evidence.postRepositoryFingerprint
		|| evidence.postRepositoryFingerprint !== evidence.repositoryFingerprint) {
		return { valid: false, legacy: false, reason: "validation receipt repository fingerprints do not match" };
	}
	const expected = validationReceiptDigest({
		id: evidence.id,
		sessionKey: evidence.sessionKey,
		nodeId: evidence.nodeId,
		command: evidence.command,
		commandDigest: evidence.commandDigest,
		exitCode: evidence.exitCode,
		startedAt: evidence.startedAt,
		finishedAt: evidence.finishedAt,
		mutationSequence: evidence.mutationSequence,
		preRepositoryFingerprint: evidence.preRepositoryFingerprint,
		postRepositoryFingerprint: evidence.postRepositoryFingerprint,
		repositoryFingerprint: evidence.repositoryFingerprint,
		operationLedgerDigest: evidence.operationLedgerDigest,
		outputDigest: evidence.outputDigest,
		provider: evidence.provider,
	});
	if (expected !== evidence.receiptDigest) return { valid: false, legacy: false, reason: "validation receipt digest mismatch" };
	return { valid: true, legacy: false, reason: "validation receipt verified" };
}
