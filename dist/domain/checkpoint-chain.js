import { canonicalJson, chainedHash, sha256 } from "./canonical.js";
export function buildCheckpointHashes(payload, parentHash) {
    const payloadJson = canonicalJson(payload);
    const payloadHash = sha256(payloadJson);
    return { payloadJson, payloadHash, chainHash: chainedHash(parentHash, payloadHash) };
}
export function verifyCheckpointChain(id, lookup) {
    const seen = new Set();
    const ancestry = [];
    const records = [];
    let cursor = id;
    while (cursor) {
        if (seen.has(cursor))
            return { valid: false, reason: `cycle at ${cursor}`, ancestry };
        seen.add(cursor);
        const record = lookup.getCheckpoint(cursor);
        if (!record)
            return { valid: false, reason: `missing checkpoint ${cursor}`, ancestry };
        ancestry.push(record.id);
        records.push(record);
        cursor = record.parentId;
    }
    for (const record of records) {
        const recordId = record.id;
        if (record.status === "quarantined")
            return { valid: false, reason: `checkpoint ${recordId} is quarantined`, ancestry };
        if (sha256(record.payloadJson) !== record.payloadHash) {
            return { valid: false, reason: `payload hash mismatch at ${recordId}`, ancestry };
        }
        if (chainedHash(record.parentHash, record.payloadHash) !== record.chainHash) {
            return { valid: false, reason: `chain hash mismatch at ${recordId}`, ancestry };
        }
        if (record.parentId) {
            const parent = lookup.getCheckpoint(record.parentId);
            if (!parent)
                return { valid: false, reason: `missing parent ${record.parentId}`, ancestry };
            if (parent.chainHash !== record.parentHash) {
                return { valid: false, reason: `parent hash mismatch at ${recordId}`, ancestry };
            }
        }
        else if (record.parentHash !== "GENESIS") {
            return { valid: false, reason: `invalid genesis hash at ${recordId}`, ancestry };
        }
    }
    return { valid: true, reason: "hash chain verified", ancestry };
}
//# sourceMappingURL=checkpoint-chain.js.map