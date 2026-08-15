import { canonicalJson, chainedHash, sha256 } from "./canonical.js";
import type { CheckpointRecord, WorkState } from "./types.js";

interface CheckpointPayloadBase {
	sessionId: string;
	sessionFileKey: string;
	repositoryId: string;
	state: WorkState;
	validationEvidenceId: string;
	mutationSequence: number;
	repositoryFingerprint: string;
	createdAt: number;
}

export interface CheckpointPayloadV1 extends CheckpointPayloadBase {
	version: 1;
}

export interface CheckpointPayloadV2 extends CheckpointPayloadBase {
	version: 2;
	validationReceiptDigest: string;
	operationLedgerDigest: string;
}

export type CheckpointPayload = CheckpointPayloadV1 | CheckpointPayloadV2;

export function parseCheckpointPayload(record: CheckpointRecord): CheckpointPayload {
	const payload = JSON.parse(record.payloadJson) as Partial<CheckpointPayload>;
	if (payload.version !== 1 && payload.version !== 2) throw new Error(`unsupported checkpoint payload version ${String(payload.version)}`);
	return payload as CheckpointPayload;
}

export function buildCheckpointHashes(payload: CheckpointPayload, parentHash: string): {
	payloadJson: string;
	payloadHash: string;
	chainHash: string;
} {
	const payloadJson = canonicalJson(payload);
	const payloadHash = sha256(payloadJson);
	return { payloadJson, payloadHash, chainHash: chainedHash(parentHash, payloadHash) };
}

export interface ChainLookup {
	getCheckpoint(id: string): CheckpointRecord | undefined;
}

export interface ChainVerification {
	valid: boolean;
	reason: string;
	ancestry: string[];
}

function verifyProjection(record: CheckpointRecord): string | undefined {
	let payload: CheckpointPayload;
	try {
		payload = parseCheckpointPayload(record);
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	if (record.payloadVersion !== payload.version) return `payload version projection mismatch at ${record.id}`;
	if (record.sessionId !== payload.sessionId) return `session ID projection mismatch at ${record.id}`;
	if (record.sessionFileKey !== payload.sessionFileKey) return `session file projection mismatch at ${record.id}`;
	if (record.repositoryId !== payload.repositoryId) return `repository projection mismatch at ${record.id}`;
	if (record.validationEvidenceId !== payload.validationEvidenceId) return `validation evidence projection mismatch at ${record.id}`;
	if (record.mutationSequence !== payload.mutationSequence) return `mutation sequence projection mismatch at ${record.id}`;
	if (record.repositoryFingerprint !== payload.repositoryFingerprint) return `repository fingerprint projection mismatch at ${record.id}`;
	if (record.createdAt !== payload.createdAt) return `created timestamp projection mismatch at ${record.id}`;
	if (payload.version === 1) {
		if (record.validationReceiptDigest !== null || record.operationLedgerDigest !== null) {
			return `legacy checkpoint contains v2 authority projection at ${record.id}`;
		}
	} else {
		if (record.validationReceiptDigest !== payload.validationReceiptDigest) return `validation receipt projection mismatch at ${record.id}`;
		if (record.operationLedgerDigest !== payload.operationLedgerDigest) return `operation ledger projection mismatch at ${record.id}`;
	}
	return undefined;
}

export function verifyCheckpointChain(id: string, lookup: ChainLookup): ChainVerification {
	const seen = new Set<string>();
	const ancestry: string[] = [];
	const records: CheckpointRecord[] = [];
	let cursor: string | null = id;
	while (cursor) {
		if (seen.has(cursor)) return { valid: false, reason: `cycle at ${cursor}`, ancestry };
		seen.add(cursor);
		const record = lookup.getCheckpoint(cursor);
		if (!record) return { valid: false, reason: `missing checkpoint ${cursor}`, ancestry };
		ancestry.push(record.id);
		records.push(record);
		cursor = record.parentId;
	}
	for (const record of records) {
		const recordId = record.id;
		if (record.status !== "verified") return { valid: false, reason: `checkpoint ${recordId} is ${record.status}`, ancestry };
		if (sha256(record.payloadJson) !== record.payloadHash) {
			return { valid: false, reason: `payload hash mismatch at ${recordId}`, ancestry };
		}
		if (chainedHash(record.parentHash, record.payloadHash) !== record.chainHash) {
			return { valid: false, reason: `chain hash mismatch at ${recordId}`, ancestry };
		}
		const projectionFailure = verifyProjection(record);
		if (projectionFailure) return { valid: false, reason: projectionFailure, ancestry };
		if (record.parentId) {
			const parent = lookup.getCheckpoint(record.parentId);
			if (!parent) return { valid: false, reason: `missing parent ${record.parentId}`, ancestry };
			if (parent.chainHash !== record.parentHash) {
				return { valid: false, reason: `parent hash mismatch at ${recordId}`, ancestry };
			}
		} else if (record.parentHash !== "GENESIS") {
			return { valid: false, reason: `invalid genesis hash at ${recordId}`, ancestry };
		}
	}
	return { valid: true, reason: "hash chain and checkpoint projections verified", ancestry };
}
