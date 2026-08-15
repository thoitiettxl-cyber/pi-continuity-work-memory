import { canonicalJson, chainedHash, sha256 } from "./canonical.js";
import type { CheckpointRecord, WorkState } from "./types.js";

export interface CheckpointPayload {
	version: 1;
	sessionId: string;
	sessionFileKey: string;
	repositoryId: string;
	state: WorkState;
	validationEvidenceId: string;
	mutationSequence: number;
	repositoryFingerprint: string;
	createdAt: number;
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
		if (record.status === "quarantined") return { valid: false, reason: `checkpoint ${recordId} is quarantined`, ancestry };
		if (sha256(record.payloadJson) !== record.payloadHash) {
			return { valid: false, reason: `payload hash mismatch at ${recordId}`, ancestry };
		}
		if (chainedHash(record.parentHash, record.payloadHash) !== record.chainHash) {
			return { valid: false, reason: `chain hash mismatch at ${recordId}`, ancestry };
		}
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
	return { valid: true, reason: "hash chain verified", ancestry };
}
