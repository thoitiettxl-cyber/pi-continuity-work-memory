import { randomUUID } from "node:crypto";

import { effectiveOperationStatus, operationLedgerDigest as computeOperationLedgerDigest, reconciliationDigest, unresolvedOperation } from "../domain/operation-ledger.js";
import { canonicalJson, chainedHash, sha256 } from "../domain/canonical.js";
import { verifyCheckpointChain } from "../domain/checkpoint-chain.js";
import { verifyValidationEvidence } from "../domain/validation-receipt.js";
import {
	CONTINUITY_DATABASE_SCHEMA_VERSION,
	cloneWorkState,
	migrateWorkState,
	type CheckpointRecord,
	type MutationConsequence,
	type OperationReconciliation,
	type ReconciliationOutcome,
	type SessionIdentity,
	type TrackedOperation,
	type UnresolvedOperation,
	type ValidationEvidence,
	type WorkState,
} from "../domain/types.js";
import { DurableSqlite, asNumber } from "./sqlite.js";
import {
	requiredExactColumns,
	requiredForeignKeys,
	requiredIndexColumns,
	requiredOnlySchemaObjects,
	requiredSchemaMatchesSql,
	runSqliteMigrations,
	type SqliteMigration,
} from "./sqlite-migrations.js";

interface StateRow extends Record<string, unknown> {
	state_json: string;
	node_id: string;
	updated_at: number | bigint;
}

const CONTINUITY_V1_SQL = `
CREATE TABLE IF NOT EXISTS continuity_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO continuity_meta(key, value) VALUES ('schema_version', '1')
  ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS sessions (
  session_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  session_file_key TEXT NOT NULL,
  parent_session_key TEXT,
  repository_id TEXT NOT NULL,
  trusted INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_continuity_sessions_repo ON sessions(repository_id, updated_at);

CREATE TABLE IF NOT EXISTS branch_states (
  session_key TEXT NOT NULL,
  node_id TEXT NOT NULL,
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(session_key, node_id),
  FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pending_mutations (
  tool_call_id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  node_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('mutation', 'validation')),
  input_digest TEXT NOT NULL,
  command_text TEXT,
  pre_fingerprint TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'determined', 'uncertain')),
  is_error INTEGER,
  result_digest TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pending_branch ON pending_mutations(session_key, node_id, status);

CREATE TABLE IF NOT EXISTS validation_evidence (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  node_id TEXT NOT NULL,
  command_text TEXT NOT NULL,
  exit_code INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  mutation_sequence INTEGER NOT NULL,
  repository_fingerprint TEXT NOT NULL,
  output_digest TEXT NOT NULL,
  provider TEXT NOT NULL,
  FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_validation_branch ON validation_evidence(session_key, node_id, mutation_sequence, finished_at);

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_file_key TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  parent_id TEXT,
  parent_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  repository_fingerprint TEXT NOT NULL,
  validation_evidence_id TEXT NOT NULL,
  mutation_sequence INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('verified', 'quarantined')),
  quarantine_reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE,
  FOREIGN KEY(validation_evidence_id) REFERENCES validation_evidence(id)
);
CREATE INDEX IF NOT EXISTS idx_checkpoint_session ON checkpoints(session_key, created_at);

CREATE TABLE IF NOT EXISTS fork_intents (
  id TEXT PRIMARY KEY,
  source_session_key TEXT NOT NULL,
  source_session_file TEXT NOT NULL,
  target_entry_id TEXT NOT NULL,
  position TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_by_session_key TEXT
);
`;

const CONTINUITY_V2_SQL = `
ALTER TABLE pending_mutations ADD COLUMN consequence TEXT NOT NULL DEFAULT 'external'
  CHECK(consequence IN ('none', 'local', 'external'));
ALTER TABLE pending_mutations ADD COLUMN operation_key TEXT;
ALTER TABLE pending_mutations ADD COLUMN pre_operation_ledger_digest TEXT;
ALTER TABLE pending_mutations ADD COLUMN command_digest TEXT;
UPDATE pending_mutations SET consequence = 'none' WHERE kind = 'validation';
UPDATE pending_mutations SET consequence = 'local'
  WHERE kind = 'mutation' AND tool_name IN ('write', 'edit', 'apply_patch');
CREATE INDEX idx_operation_key ON pending_mutations(operation_key, created_at);
CREATE INDEX idx_operation_unresolved ON pending_mutations(session_key, node_id, consequence, status);

CREATE TABLE operation_claims (
  operation_key TEXT PRIMARY KEY,
  tool_call_id TEXT NOT NULL,
  generation INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE validation_evidence ADD COLUMN receipt_version INTEGER;
ALTER TABLE validation_evidence ADD COLUMN command_digest TEXT;
ALTER TABLE validation_evidence ADD COLUMN pre_fingerprint TEXT;
ALTER TABLE validation_evidence ADD COLUMN post_fingerprint TEXT;
ALTER TABLE validation_evidence ADD COLUMN operation_ledger_digest TEXT;
ALTER TABLE validation_evidence ADD COLUMN receipt_digest TEXT;

CREATE TABLE checkpoints_v2 (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_file_key TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  parent_id TEXT,
  parent_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  repository_fingerprint TEXT NOT NULL,
  validation_evidence_id TEXT NOT NULL,
  mutation_sequence INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('provisional', 'verified', 'quarantined')),
  quarantine_reason TEXT,
  created_at INTEGER NOT NULL,
  payload_version INTEGER NOT NULL DEFAULT 1,
  validation_receipt_digest TEXT,
  operation_ledger_digest TEXT,
  FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE,
  FOREIGN KEY(validation_evidence_id) REFERENCES validation_evidence(id)
);
INSERT INTO checkpoints_v2(
  id, session_key, session_id, session_file_key, repository_id, parent_id, parent_hash,
  payload_json, payload_hash, chain_hash, repository_fingerprint, validation_evidence_id,
  mutation_sequence, status, quarantine_reason, created_at, payload_version,
  validation_receipt_digest, operation_ledger_digest
)
SELECT id, session_key, session_id, session_file_key, repository_id, parent_id, parent_hash,
  payload_json, payload_hash, chain_hash, repository_fingerprint, validation_evidence_id,
  mutation_sequence, status, quarantine_reason, created_at, 1, NULL, NULL
FROM checkpoints;
DROP TABLE checkpoints;
ALTER TABLE checkpoints_v2 RENAME TO checkpoints;
CREATE INDEX idx_checkpoint_session ON checkpoints(session_key, created_at);

CREATE TABLE operation_reconciliations (
  id TEXT PRIMARY KEY,
  tool_call_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('applied', 'not_applied', 'partially_applied')),
  note_text TEXT NOT NULL,
  note_digest TEXT NOT NULL,
  record_digest TEXT NOT NULL,
  actor TEXT NOT NULL CHECK(actor = 'human-command'),
  session_key TEXT NOT NULL,
  node_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(tool_call_id, revision),
  FOREIGN KEY(tool_call_id) REFERENCES pending_mutations(tool_call_id),
  FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE
);
CREATE INDEX idx_reconciliation_operation ON operation_reconciliations(tool_call_id, revision);
`;

const CONTINUITY_V1_OBJECTS = [
	"branch_states", "checkpoints", "continuity_meta", "fork_intents",
	"idx_checkpoint_session", "idx_continuity_sessions_repo", "idx_pending_branch", "idx_validation_branch",
	"pending_mutations", "schema_migrations", "sessions", "validation_evidence",
];

function verifyContinuityV1(db: DurableSqlite): void {
	requiredSchemaMatchesSql(db, CONTINUITY_V1_SQL, ["schema_migrations"]);
	requiredOnlySchemaObjects(db, CONTINUITY_V1_OBJECTS);
	requiredExactColumns(db, "continuity_meta", ["key", "value"]);
	requiredExactColumns(db, "sessions", ["session_key", "session_id", "session_file_key", "parent_session_key", "repository_id", "trusted", "created_at", "updated_at"]);
	requiredExactColumns(db, "branch_states", ["session_key", "node_id", "state_json", "revision", "updated_at"]);
	requiredExactColumns(db, "pending_mutations", ["tool_call_id", "session_key", "node_id", "sequence", "tool_name", "kind", "input_digest", "command_text", "pre_fingerprint", "status", "is_error", "result_digest", "created_at", "resolved_at"]);
	requiredExactColumns(db, "validation_evidence", ["id", "session_key", "node_id", "command_text", "exit_code", "started_at", "finished_at", "mutation_sequence", "repository_fingerprint", "output_digest", "provider"]);
	requiredExactColumns(db, "checkpoints", ["id", "session_key", "session_id", "session_file_key", "repository_id", "parent_id", "parent_hash", "payload_json", "payload_hash", "chain_hash", "repository_fingerprint", "validation_evidence_id", "mutation_sequence", "status", "quarantine_reason", "created_at"]);
	requiredExactColumns(db, "fork_intents", ["id", "source_session_key", "source_session_file", "target_entry_id", "position", "created_at", "consumed_by_session_key"]);
	requiredIndexColumns(db, "idx_continuity_sessions_repo", ["repository_id", "updated_at"]);
	requiredIndexColumns(db, "idx_pending_branch", ["session_key", "node_id", "status"]);
	requiredIndexColumns(db, "idx_validation_branch", ["session_key", "node_id", "mutation_sequence", "finished_at"]);
	requiredIndexColumns(db, "idx_checkpoint_session", ["session_key", "created_at"]);
	requiredForeignKeys(db, "branch_states", [{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" }]);
	requiredForeignKeys(db, "pending_mutations", [{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" }]);
	requiredForeignKeys(db, "validation_evidence", [{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" }]);
	requiredForeignKeys(db, "checkpoints", [
		{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" },
		{ from: "validation_evidence_id", table: "validation_evidence", to: "id" },
	]);
}

function verifyContinuityV2(db: DurableSqlite): void {
	requiredSchemaMatchesSql(db, `${CONTINUITY_V1_SQL}\n${CONTINUITY_V2_SQL}`, ["schema_migrations"]);
	requiredOnlySchemaObjects(db, [
		...CONTINUITY_V1_OBJECTS,
		"idx_operation_key", "idx_operation_unresolved", "idx_reconciliation_operation",
		"operation_claims", "operation_reconciliations",
	]);
	requiredExactColumns(db, "continuity_meta", ["key", "value"]);
	requiredExactColumns(db, "sessions", ["session_key", "session_id", "session_file_key", "parent_session_key", "repository_id", "trusted", "created_at", "updated_at"]);
	requiredExactColumns(db, "branch_states", ["session_key", "node_id", "state_json", "revision", "updated_at"]);
	requiredExactColumns(db, "pending_mutations", ["tool_call_id", "session_key", "node_id", "sequence", "tool_name", "kind", "input_digest", "command_text", "pre_fingerprint", "status", "is_error", "result_digest", "created_at", "resolved_at", "consequence", "operation_key", "pre_operation_ledger_digest", "command_digest"]);
	requiredExactColumns(db, "operation_claims", ["operation_key", "tool_call_id", "generation", "updated_at"]);
	requiredExactColumns(db, "validation_evidence", ["id", "session_key", "node_id", "command_text", "exit_code", "started_at", "finished_at", "mutation_sequence", "repository_fingerprint", "output_digest", "provider", "receipt_version", "command_digest", "pre_fingerprint", "post_fingerprint", "operation_ledger_digest", "receipt_digest"]);
	requiredExactColumns(db, "checkpoints", ["id", "session_key", "session_id", "session_file_key", "repository_id", "parent_id", "parent_hash", "payload_json", "payload_hash", "chain_hash", "repository_fingerprint", "validation_evidence_id", "mutation_sequence", "status", "quarantine_reason", "created_at", "payload_version", "validation_receipt_digest", "operation_ledger_digest"]);
	requiredExactColumns(db, "fork_intents", ["id", "source_session_key", "source_session_file", "target_entry_id", "position", "created_at", "consumed_by_session_key"]);
	requiredExactColumns(db, "operation_reconciliations", ["id", "tool_call_id", "revision", "outcome", "note_text", "note_digest", "record_digest", "actor", "session_key", "node_id", "created_at"]);
	requiredIndexColumns(db, "idx_continuity_sessions_repo", ["repository_id", "updated_at"]);
	requiredIndexColumns(db, "idx_pending_branch", ["session_key", "node_id", "status"]);
	requiredIndexColumns(db, "idx_validation_branch", ["session_key", "node_id", "mutation_sequence", "finished_at"]);
	requiredIndexColumns(db, "idx_checkpoint_session", ["session_key", "created_at"]);
	requiredIndexColumns(db, "idx_operation_key", ["operation_key", "created_at"]);
	requiredIndexColumns(db, "idx_operation_unresolved", ["session_key", "node_id", "consequence", "status"]);
	requiredIndexColumns(db, "idx_reconciliation_operation", ["tool_call_id", "revision"]);
	requiredForeignKeys(db, "branch_states", [{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" }]);
	requiredForeignKeys(db, "pending_mutations", [{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" }]);
	requiredForeignKeys(db, "validation_evidence", [{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" }]);
	requiredForeignKeys(db, "checkpoints", [
		{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" },
		{ from: "validation_evidence_id", table: "validation_evidence", to: "id" },
	]);
	requiredForeignKeys(db, "operation_reconciliations", [
		{ from: "tool_call_id", table: "pending_mutations", to: "tool_call_id" },
		{ from: "session_key", table: "sessions", to: "session_key", onDelete: "CASCADE" },
	]);
}

const CONTINUITY_MIGRATIONS: readonly SqliteMigration[] = [
	{
		version: 1,
		name: "initial-rc2-schema",
		checksumMaterial: CONTINUITY_V1_SQL,
		apply: (db) => db.exec(CONTINUITY_V1_SQL),
		verify: verifyContinuityV1,
	},
	{
		version: 2,
		name: "receipt-bound-checkpoints-and-operation-ledger",
		checksumMaterial: CONTINUITY_V2_SQL,
		apply: (db) => db.exec(CONTINUITY_V2_SQL),
		verify: verifyContinuityV2,
	},
];

function placeholders(length: number): string {
	return new Array(length).fill("?").join(",");
}

function parseState(row: StateRow): WorkState {
	return migrateWorkState(JSON.parse(String(row.state_json)));
}

export interface BeginTrackedCallResult {
	state: WorkState;
	inserted: boolean;
	reason?: string;
}

export class ContinuityStore {
	readonly db: DurableSqlite;

	constructor(path: string) {
		this.db = new DurableSqlite(path);
		runSqliteMigrations(this.db, {
			storeName: "continuity",
			metaTable: "continuity_meta",
			targetVersion: CONTINUITY_DATABASE_SCHEMA_VERSION,
			migrations: CONTINUITY_MIGRATIONS,
		});
	}

	registerSession(identity: SessionIdentity, now = Date.now()): void {
		this.db.transaction(() => {
			this.db.prepare(`INSERT INTO sessions(
  session_key, session_id, session_file_key, parent_session_key, repository_id, trusted, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(session_key) DO UPDATE SET
  parent_session_key = COALESCE(sessions.parent_session_key, excluded.parent_session_key),
  repository_id = excluded.repository_id,
  trusted = excluded.trusted,
  updated_at = excluded.updated_at`).run(
				identity.sessionKey,
				identity.sessionId,
				identity.sessionFileKey,
				identity.parentSessionKey,
				identity.repositoryId,
				identity.trusted ? 1 : 0,
				now,
				now,
			);
		});
	}

	mutateState(
		sessionKey: string,
		nodeId: string,
		inherited: WorkState,
		mutator: (state: WorkState) => void,
		now = Date.now(),
	): WorkState {
		return this.db.transaction(() => {
			const row = this.db.prepare("SELECT state_json, node_id, updated_at FROM branch_states WHERE session_key = ? AND node_id = ?")
				.get(sessionKey, nodeId) as StateRow | undefined;
			const state = row ? parseState(row) : cloneWorkState(inherited);
			mutator(state);
			state.updatedAt = now;
			this.db.prepare(`INSERT INTO branch_states(session_key, node_id, state_json, revision, updated_at)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(session_key, node_id) DO UPDATE SET
  state_json = excluded.state_json,
  revision = branch_states.revision + 1,
  updated_at = excluded.updated_at`).run(sessionKey, nodeId, JSON.stringify(state), now);
			this.db.prepare("UPDATE sessions SET updated_at = ? WHERE session_key = ?").run(now, sessionKey);
			return cloneWorkState(state);
		});
	}

	saveState(sessionKey: string, nodeId: string, state: WorkState, now = Date.now()): WorkState {
		return this.mutateState(sessionKey, nodeId, state, (next) => Object.assign(next, cloneWorkState(state)), now);
	}

	findNearestState(sessionKey: string, branchNodeIds: readonly string[]): WorkState | undefined {
		if (branchNodeIds.length === 0) return undefined;
		const rows = this.db.prepare(`SELECT state_json, node_id, updated_at FROM branch_states
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)})`).all(sessionKey, ...branchNodeIds) as StateRow[];
		const byNode = new Map(rows.map((row) => [String(row.node_id), row]));
		for (let index = branchNodeIds.length - 1; index >= 0; index -= 1) {
			const nodeId = branchNodeIds[index];
			if (!nodeId) continue;
			const row = byNode.get(nodeId);
			if (row) return parseState(row);
		}
		return undefined;
	}

	beginTrackedCall(input: {
		toolCallId: string;
		sessionKey: string;
		nodeId: string;
		toolName: string;
		kind: "mutation" | "validation";
		consequence: MutationConsequence;
		operationKey: string | null;
		inputDigest: string;
		command: string | null;
		commandDigest: string | null;
		preFingerprint: string | null;
		preOperationLedgerDigest: string | null;
		state: WorkState;
		now?: number;
	}): BeginTrackedCallResult {
		const now = input.now ?? Date.now();
		return this.db.transaction(() => {
			const row = this.db.prepare("SELECT state_json, node_id, updated_at FROM branch_states WHERE session_key = ? AND node_id = ?")
				.get(input.sessionKey, input.nodeId) as StateRow | undefined;
			const state = row ? parseState(row) : cloneWorkState(input.state);
			const existing = this.db.prepare("SELECT * FROM pending_mutations WHERE tool_call_id = ?").get(input.toolCallId) as Record<string, unknown> | undefined;
			if (existing) {
				const exactReplay = String(existing.session_key) === input.sessionKey
					&& String(existing.node_id) === input.nodeId
					&& String(existing.tool_name) === input.toolName
					&& String(existing.kind) === input.kind
					&& String(existing.input_digest) === input.inputDigest;
				return {
					state: cloneWorkState(state),
					inserted: false,
					reason: exactReplay
						? `Tool call ${input.toolCallId} was already tracked and cannot execute twice`
						: `Tool call ID collision for ${input.toolCallId}`,
				};
			}
			if (input.operationKey) {
				const claim = this.db.prepare("SELECT tool_call_id, generation FROM operation_claims WHERE operation_key = ?")
					.get(input.operationKey) as Record<string, unknown> | undefined;
				if (claim) {
					const previousRow = this.db.prepare("SELECT * FROM pending_mutations WHERE tool_call_id = ?")
						.get(String(claim.tool_call_id)) as Record<string, unknown> | undefined;
					if (!previousRow) return { state: cloneWorkState(state), inserted: false, reason: "Operation claim points to a missing ledger row" };
					const previous = this.rowToOperation(previousRow);
					const effective = effectiveOperationStatus(previous);
					if (effective !== "determined" || previous.reconciliation?.outcome !== "not_applied") {
						return {
							state: cloneWorkState(state),
							inserted: false,
							reason: effective !== "determined"
								? `Consequential operation ${previous.toolCallId} is ${effective}; reconcile it before retrying`
								: `Consequential operation ${previous.toolCallId} is already determined and cannot be repeated`,
						};
					}
					this.db.prepare("UPDATE operation_claims SET tool_call_id = ?, generation = ?, updated_at = ? WHERE operation_key = ?")
						.run(input.toolCallId, asNumber(claim.generation) + 1, now, input.operationKey);
				} else {
					this.db.prepare("INSERT INTO operation_claims(operation_key, tool_call_id, generation, updated_at) VALUES (?, ?, 1, ?)")
						.run(input.operationKey, input.toolCallId, now);
				}
			}
			if (input.kind === "mutation") {
				state.mutationSequence += 1;
				state.mutationStatus = "pending";
			}
			state.updatedAt = now;
			const sequence = state.mutationSequence;
			this.db.prepare(`INSERT INTO pending_mutations(
  tool_call_id, session_key, node_id, sequence, tool_name, kind, consequence, operation_key,
  input_digest, command_text, command_digest, pre_fingerprint, pre_operation_ledger_digest, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`).run(
				input.toolCallId,
				input.sessionKey,
				input.nodeId,
				sequence,
				input.toolName,
				input.kind,
				input.consequence,
				input.operationKey,
				input.inputDigest,
				input.command,
				input.commandDigest,
				input.preFingerprint,
				input.preOperationLedgerDigest,
				now,
			);
			this.db.prepare(`INSERT INTO branch_states(session_key, node_id, state_json, revision, updated_at)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(session_key, node_id) DO UPDATE SET
  state_json = excluded.state_json,
  revision = branch_states.revision + 1,
  updated_at = excluded.updated_at`).run(input.sessionKey, input.nodeId, JSON.stringify(state), now);
			return { state: cloneWorkState(state), inserted: true };
		});
	}

	resolveTrackedCall(toolCallId: string, sessionKey: string, branchNodeIds: readonly string[], isError: boolean, resultDigest: string, uncertainOnError: boolean, now = Date.now()): TrackedOperation | undefined {
		if (branchNodeIds.length === 0) return undefined;
		return this.db.transaction(() => {
			const row = this.db.prepare(`SELECT * FROM pending_mutations WHERE tool_call_id = ? AND session_key = ?
AND node_id IN (${placeholders(branchNodeIds.length)})`).get(toolCallId, sessionKey, ...branchNodeIds) as Record<string, unknown> | undefined;
			if (!row) return undefined;
			const status = isError && uncertainOnError ? "uncertain" : "determined";
			const changed = Number(this.db.prepare(`UPDATE pending_mutations
SET status = ?, is_error = ?, result_digest = ?, resolved_at = ?
WHERE tool_call_id = ? AND session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)}) AND status = 'pending'`)
				.run(status, isError ? 1 : 0, resultDigest, now, toolCallId, sessionKey, ...branchNodeIds).changes);
			if (changed !== 1) return undefined;
			return this.getTrackedCall(toolCallId, sessionKey, branchNodeIds);
		});
	}

	markPendingUncertain(sessionKey: string, branchNodeIds: readonly string[], now = Date.now()): number[] {
		if (branchNodeIds.length === 0) return [];
		return this.db.transaction(() => {
			const rows = this.db.prepare(`SELECT sequence FROM pending_mutations
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)}) AND status = 'pending'`)
				.all(sessionKey, ...branchNodeIds) as Array<Record<string, unknown>>;
			this.db.prepare(`UPDATE pending_mutations SET status = 'uncertain', resolved_at = ?
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)}) AND status = 'pending'`)
				.run(now, sessionKey, ...branchNodeIds);
			return rows.map((row) => asNumber(row.sequence));
		});
	}

	operationsForBranch(sessionKey: string, branchNodeIds: readonly string[]): TrackedOperation[] {
		if (branchNodeIds.length === 0) return [];
		const rows = this.db.prepare(`SELECT * FROM pending_mutations
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)})
ORDER BY sequence, created_at, tool_call_id`).all(sessionKey, ...branchNodeIds) as Array<Record<string, unknown>>;
		return rows.map((row) => this.rowToOperation(row));
	}

	unresolvedForBranch(sessionKey: string, branchNodeIds: readonly string[]): UnresolvedOperation[] {
		return this.operationsForBranch(sessionKey, branchNodeIds)
			.map(unresolvedOperation)
			.filter((operation): operation is UnresolvedOperation => Boolean(operation));
	}

	operationLedgerDigest(sessionKey: string, branchNodeIds: readonly string[]): string {
		const operations = this.operationsForBranch(sessionKey, branchNodeIds);
		const keys = [...new Set(operations.map((operation) => operation.operationKey).filter((key): key is string => Boolean(key)))].sort();
		const claims = keys.length === 0 ? [] : this.db.prepare(`SELECT operation_key, tool_call_id, generation, updated_at
FROM operation_claims WHERE operation_key IN (${placeholders(keys.length)}) ORDER BY operation_key`).all(...keys) as Array<Record<string, unknown>>;
		return sha256(canonicalJson({
			version: 1,
			operationsDigest: computeOperationLedgerDigest(operations),
			claims: claims.map((claim) => ({
				operationKey: String(claim.operation_key),
				toolCallId: String(claim.tool_call_id),
				generation: asNumber(claim.generation),
				updatedAt: asNumber(claim.updated_at),
			})),
		}));
	}

	operationIntegrityIssues(sessionKey: string, branchNodeIds: readonly string[]): string[] {
		const operations = this.operationsForBranch(sessionKey, branchNodeIds);
		const issues = operations
			.filter((operation) => operation.reconciliation && (
				!operation.reconciliation.integrityValid
				|| operation.reconciliation.sessionKey !== sessionKey
				|| !branchNodeIds.includes(operation.reconciliation.nodeId)
			))
			.map((operation) => `reconciliation integrity mismatch for ${operation.toolCallId}`);
		const byKey = new Map<string, TrackedOperation[]>();
		for (const operation of operations) {
			if (!operation.operationKey) continue;
			const values = byKey.get(operation.operationKey) ?? [];
			values.push(operation);
			byKey.set(operation.operationKey, values);
		}
		for (const [operationKey, values] of byKey) {
			const claim = this.db.prepare("SELECT tool_call_id FROM operation_claims WHERE operation_key = ?").get(operationKey) as Record<string, unknown> | undefined;
			const latest = [...values].sort((left, right) => right.sequence - left.sequence || right.createdAt - left.createdAt || right.toolCallId.localeCompare(left.toolCallId))[0]!;
			if (!claim || String(claim.tool_call_id) !== latest.toolCallId) issues.push(`operation claim mismatch for ${latest.toolCallId}`);
		}
		return issues;
	}

	getTrackedCall(toolCallId: string, sessionKey: string, branchNodeIds: readonly string[]): TrackedOperation | undefined {
		if (branchNodeIds.length === 0) return undefined;
		const row = this.db.prepare(`SELECT * FROM pending_mutations WHERE tool_call_id = ? AND session_key = ?
AND node_id IN (${placeholders(branchNodeIds.length)})`).get(toolCallId, sessionKey, ...branchNodeIds) as Record<string, unknown> | undefined;
		return row ? this.rowToOperation(row) : undefined;
	}

	private latestReconciliation(toolCallId: string): OperationReconciliation | null {
		const row = this.db.prepare(`SELECT * FROM operation_reconciliations
WHERE tool_call_id = ? ORDER BY revision DESC LIMIT 1`).get(toolCallId) as Record<string, unknown> | undefined;
		return row ? this.rowToReconciliation(row) : null;
	}

	private rowToOperation(row: Record<string, unknown>): TrackedOperation {
		return {
			toolCallId: String(row.tool_call_id),
			operationKey: row.operation_key === null || row.operation_key === undefined ? null : String(row.operation_key),
			nodeId: String(row.node_id),
			sequence: asNumber(row.sequence),
			toolName: String(row.tool_name),
			kind: String(row.kind) as TrackedOperation["kind"],
			consequence: String(row.consequence) as MutationConsequence,
			inputDigest: String(row.input_digest),
			preFingerprint: row.pre_fingerprint === null || row.pre_fingerprint === undefined ? null : String(row.pre_fingerprint),
			preOperationLedgerDigest: row.pre_operation_ledger_digest === null || row.pre_operation_ledger_digest === undefined ? null : String(row.pre_operation_ledger_digest),
			command: row.command_text === null || row.command_text === undefined ? null : String(row.command_text),
			commandDigest: row.command_digest === null || row.command_digest === undefined ? null : String(row.command_digest),
			status: String(row.status) as TrackedOperation["status"],
			isError: row.is_error === null || row.is_error === undefined ? null : asNumber(row.is_error) !== 0,
			resultDigest: row.result_digest === null || row.result_digest === undefined ? null : String(row.result_digest),
			createdAt: asNumber(row.created_at),
			resolvedAt: row.resolved_at === null || row.resolved_at === undefined ? null : asNumber(row.resolved_at),
			reconciliation: this.latestReconciliation(String(row.tool_call_id)),
		};
	}

	reconcileOperation(input: {
		sessionKey: string;
		branchNodeIds: readonly string[];
		nodeId: string;
		toolCallId: string;
		outcome: ReconciliationOutcome;
		note: string;
		now?: number;
	}): OperationReconciliation {
		if (input.branchNodeIds.length === 0) throw new Error("Active branch is empty");
		const now = input.now ?? Date.now();
		return this.db.transaction(() => {
			const row = this.db.prepare(`SELECT * FROM pending_mutations
WHERE tool_call_id = ? AND session_key = ? AND node_id IN (${placeholders(input.branchNodeIds.length)})`)
				.get(input.toolCallId, input.sessionKey, ...input.branchNodeIds) as Record<string, unknown> | undefined;
			if (!row) throw new Error(`Operation is not on the active branch: ${input.toolCallId}`);
			if (String(row.kind) !== "mutation") {
				throw new Error("Only uncertain mutations can be reconciled");
			}
			if (String(row.status) !== "uncertain") throw new Error("Operation is not uncertain");
			const revisionRow = this.db.prepare("SELECT COALESCE(MAX(revision), 0) AS revision FROM operation_reconciliations WHERE tool_call_id = ?")
				.get(input.toolCallId) as Record<string, unknown>;
			const revision = asNumber(revisionRow.revision) + 1;
			const recordBase = {
				id: randomUUID(),
				toolCallId: input.toolCallId,
				revision,
				outcome: input.outcome,
				note: input.note,
				noteDigest: sha256(input.note),
				actor: "human-command" as const,
				sessionKey: input.sessionKey,
				nodeId: input.nodeId,
				createdAt: now,
			};
			const record: OperationReconciliation = {
				...recordBase,
				recordDigest: reconciliationDigest(recordBase),
				integrityValid: true,
			};
			this.db.prepare(`INSERT INTO operation_reconciliations(
  id, tool_call_id, revision, outcome, note_text, note_digest, record_digest, actor, session_key, node_id, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
				record.id,
				record.toolCallId,
				record.revision,
				record.outcome,
				record.note,
				record.noteDigest,
				record.recordDigest,
				record.actor,
				record.sessionKey,
				record.nodeId,
				record.createdAt,
			);
			return record;
		});
	}

	private rowToReconciliation(row: Record<string, unknown>): OperationReconciliation {
		const note = String(row.note_text);
		const noteDigest = String(row.note_digest);
		const record = {
			id: String(row.id),
			toolCallId: String(row.tool_call_id),
			revision: asNumber(row.revision),
			outcome: String(row.outcome) as ReconciliationOutcome,
			note,
			noteDigest,
			actor: String(row.actor),
			sessionKey: String(row.session_key),
			nodeId: String(row.node_id),
			createdAt: asNumber(row.created_at),
		};
		const recordDigest = String(row.record_digest);
		return {
			...record,
			actor: "human-command",
			recordDigest,
			integrityValid: noteDigest === sha256(note)
				&& record.actor === "human-command"
				&& recordDigest === reconciliationDigest(record),
		};
	}

	recordValidation(sessionKey: string, nodeId: string, evidence: ValidationEvidence): void {
		this.db.transaction(() => {
			this.db.prepare(`INSERT INTO validation_evidence(
  id, session_key, node_id, command_text, exit_code, started_at, finished_at,
  command_digest, mutation_sequence, pre_fingerprint, post_fingerprint, repository_fingerprint,
  operation_ledger_digest, output_digest, provider, receipt_version, receipt_digest
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING`).run(
				evidence.id,
				sessionKey,
				nodeId,
				evidence.command,
				evidence.exitCode,
				evidence.startedAt,
				evidence.finishedAt,
				evidence.commandDigest,
				evidence.mutationSequence,
				evidence.preRepositoryFingerprint,
				evidence.postRepositoryFingerprint,
				evidence.repositoryFingerprint,
				evidence.operationLedgerDigest,
				evidence.outputDigest,
				evidence.provider,
				evidence.receiptVersion,
				evidence.receiptDigest,
			);
		});
	}

	getValidation(id: string): ValidationEvidence | undefined {
		const row = this.db.prepare("SELECT * FROM validation_evidence WHERE id = ?").get(id) as Record<string, unknown> | undefined;
		return row ? this.rowToEvidence(row) : undefined;
	}

	latestValidation(sessionKey: string, branchNodeIds: readonly string[], mutationSequence: number, ledgerDigest: string): ValidationEvidence | undefined {
		if (branchNodeIds.length === 0) return undefined;
		const row = this.db.prepare(`SELECT * FROM validation_evidence
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)})
  AND mutation_sequence = ? AND operation_ledger_digest = ?
  AND exit_code = 0 AND receipt_version = 1 AND receipt_digest IS NOT NULL
ORDER BY finished_at DESC LIMIT 1`).get(sessionKey, ...branchNodeIds, mutationSequence, ledgerDigest) as Record<string, unknown> | undefined;
		return row ? this.rowToEvidence(row) : undefined;
	}

	private rowToEvidence(row: Record<string, unknown>): ValidationEvidence {
		return {
			id: String(row.id),
			receiptVersion: row.receipt_version === null || row.receipt_version === undefined ? null : 1,
			sessionKey: String(row.session_key),
			nodeId: String(row.node_id),
			command: String(row.command_text),
			commandDigest: row.command_digest === null || row.command_digest === undefined ? "" : String(row.command_digest),
			exitCode: asNumber(row.exit_code),
			startedAt: asNumber(row.started_at),
			finishedAt: asNumber(row.finished_at),
			mutationSequence: asNumber(row.mutation_sequence),
			preRepositoryFingerprint: row.pre_fingerprint === null || row.pre_fingerprint === undefined ? null : String(row.pre_fingerprint),
			postRepositoryFingerprint: row.post_fingerprint === null || row.post_fingerprint === undefined ? null : String(row.post_fingerprint),
			repositoryFingerprint: String(row.repository_fingerprint),
			operationLedgerDigest: row.operation_ledger_digest === null || row.operation_ledger_digest === undefined ? null : String(row.operation_ledger_digest),
			outputDigest: String(row.output_digest),
			provider: String(row.provider) as ValidationEvidence["provider"],
			receiptDigest: row.receipt_digest === null || row.receipt_digest === undefined ? null : String(row.receipt_digest),
		};
	}

	insertCheckpoint(record: CheckpointRecord): void {
		this.db.transaction(() => {
			this.insertCheckpointRow(record);
		});
	}

	private insertCheckpointRow(record: CheckpointRecord): void {
		this.db.prepare(`INSERT INTO checkpoints(
  id, session_key, session_id, session_file_key, repository_id, parent_id, parent_hash,
  payload_version, payload_json, payload_hash, chain_hash, repository_fingerprint,
  validation_evidence_id, validation_receipt_digest, operation_ledger_digest,
  mutation_sequence, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
			record.id,
			record.sessionKey,
			record.sessionId,
			record.sessionFileKey,
			record.repositoryId,
			record.parentId,
			record.parentHash,
			record.payloadVersion,
			record.payloadJson,
			record.payloadHash,
			record.chainHash,
			record.repositoryFingerprint,
			record.validationEvidenceId,
			record.validationReceiptDigest,
			record.operationLedgerDigest,
			record.mutationSequence,
			record.status,
			record.createdAt,
		);
	}

	commitCheckpoint(input: {
		record: CheckpointRecord;
		branchNodeIds: readonly string[];
		nodeId: string;
		inheritedState: WorkState;
		checkpointAncestry: string[];
	}): WorkState {
		return this.db.transaction(() => {
			const row = this.db.prepare("SELECT state_json, node_id, updated_at FROM branch_states WHERE session_key = ? AND node_id = ?")
				.get(input.record.sessionKey, input.nodeId) as StateRow | undefined;
			const state = row ? parseState(row) : cloneWorkState(input.inheritedState);
			if (state.mutationSequence !== input.record.mutationSequence) throw new Error("Mutation sequence changed while creating checkpoint");
			const integrityIssues = this.operationIntegrityIssues(input.record.sessionKey, input.branchNodeIds);
			if (integrityIssues.length > 0) throw new Error(integrityIssues[0]);
			const unresolved = this.unresolvedForBranch(input.record.sessionKey, input.branchNodeIds);
			if (unresolved.length > 0) throw new Error(`Operation ${unresolved[0]!.toolCallId} changed while creating checkpoint`);
			const ledgerDigest = this.operationLedgerDigest(input.record.sessionKey, input.branchNodeIds);
			if (ledgerDigest !== input.record.operationLedgerDigest) throw new Error("Operation ledger changed while creating checkpoint");
			this.insertCheckpointRow(input.record);
			state.checkpointId = input.record.id;
			state.checkpointAncestry = input.checkpointAncestry.slice(0, 200);
			state.updatedAt = Date.now();
			this.db.prepare(`INSERT INTO branch_states(session_key, node_id, state_json, revision, updated_at)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(session_key, node_id) DO UPDATE SET
  state_json = excluded.state_json,
  revision = branch_states.revision + 1,
  updated_at = excluded.updated_at`).run(input.record.sessionKey, input.nodeId, JSON.stringify(state), state.updatedAt);
			return cloneWorkState(state);
		});
	}

	promoteCheckpoint(input: {
		record: CheckpointRecord;
		sessionKey: string;
		nodeId: string;
		branchNodeIds: readonly string[];
		mutationSequence: number;
		operationLedgerDigest: string;
	}): void {
		this.db.transaction(() => {
			const stateRow = this.db.prepare("SELECT state_json, node_id, updated_at FROM branch_states WHERE session_key = ? AND node_id = ?")
				.get(input.sessionKey, input.nodeId) as StateRow | undefined;
			if (!stateRow || parseState(stateRow).mutationSequence !== input.mutationSequence) throw new Error("Mutation sequence changed before checkpoint promotion");
			const integrityIssues = this.operationIntegrityIssues(input.sessionKey, input.branchNodeIds);
			if (integrityIssues.length > 0) throw new Error(integrityIssues[0]);
			if (this.unresolvedForBranch(input.sessionKey, input.branchNodeIds).length > 0) throw new Error("An operation changed before checkpoint promotion");
			if (this.operationLedgerDigest(input.sessionKey, input.branchNodeIds) !== input.operationLedgerDigest) throw new Error("Operation ledger changed before checkpoint promotion");
			const persisted = this.getCheckpoint(input.record.id);
			if (!persisted || canonicalJson({ ...persisted, status: "provisional" }) !== canonicalJson({ ...input.record, status: "provisional" })) {
				throw new Error("Checkpoint projection changed before promotion");
			}
			if (sha256(persisted.payloadJson) !== persisted.payloadHash || chainedHash(persisted.parentHash, persisted.payloadHash) !== persisted.chainHash) {
				throw new Error("Checkpoint hash changed before promotion");
			}
			const evidence = this.getValidation(persisted.validationEvidenceId);
			const receipt = evidence ? verifyValidationEvidence(evidence) : { valid: false };
			if (!evidence || !receipt.valid || evidence.receiptDigest !== persisted.validationReceiptDigest) throw new Error("Validation receipt changed before checkpoint promotion");
			if (persisted.parentId) {
				const parent = verifyCheckpointChain(persisted.parentId, this);
				if (!parent.valid) throw new Error(`Checkpoint parent changed before promotion: ${parent.reason}`);
				if (this.getCheckpoint(persisted.parentId)?.chainHash !== persisted.parentHash) throw new Error("Checkpoint parent hash changed before promotion");
			} else if (persisted.parentHash !== "GENESIS") throw new Error("Checkpoint genesis changed before promotion");
			const changed = Number(this.db.prepare("UPDATE checkpoints SET status = 'verified' WHERE id = ? AND session_key = ? AND status = 'provisional'")
				.run(input.record.id, input.sessionKey).changes);
			if (changed !== 1) throw new Error("Checkpoint is not available for promotion");
		});
	}

	getCheckpoint(id: string): CheckpointRecord | undefined {
		const row = this.db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id) as Record<string, unknown> | undefined;
		if (!row) return undefined;
		return {
			id: String(row.id),
			sessionKey: String(row.session_key),
			sessionId: String(row.session_id),
			sessionFileKey: String(row.session_file_key),
			repositoryId: String(row.repository_id),
			parentId: row.parent_id === null ? null : String(row.parent_id),
			parentHash: String(row.parent_hash),
			payloadVersion: asNumber(row.payload_version) as 1 | 2,
			payloadJson: String(row.payload_json),
			payloadHash: String(row.payload_hash),
			chainHash: String(row.chain_hash),
			repositoryFingerprint: String(row.repository_fingerprint),
			validationEvidenceId: String(row.validation_evidence_id),
			validationReceiptDigest: row.validation_receipt_digest === null || row.validation_receipt_digest === undefined ? null : String(row.validation_receipt_digest),
			operationLedgerDigest: row.operation_ledger_digest === null || row.operation_ledger_digest === undefined ? null : String(row.operation_ledger_digest),
			mutationSequence: asNumber(row.mutation_sequence),
			status: String(row.status) as CheckpointRecord["status"],
			createdAt: asNumber(row.created_at),
		};
	}

	quarantineCheckpoint(id: string, reason: string): void {
		this.db.transaction(() => {
			this.db.prepare("UPDATE checkpoints SET status = 'quarantined', quarantine_reason = ? WHERE id = ?")
				.run(reason.slice(0, 2_000), id);
		});
	}

	recordForkIntent(sourceSessionKey: string, sourceSessionFile: string, targetEntryId: string, position: string): string {
		const id = randomUUID();
		const sourceSessionFileKey = sha256(sourceSessionFile);
		this.db.transaction(() => {
			this.db.prepare(`INSERT INTO fork_intents(
  id, source_session_key, source_session_file, target_entry_id, position, created_at
) VALUES (?, ?, ?, ?, ?, ?)`).run(id, sourceSessionKey, sourceSessionFileKey, targetEntryId, position, Date.now());
		});
		return id;
	}

	consumeForkIntent(previousSessionFile: string, childSessionKey: string): { sourceSessionKey: string; targetEntryId: string } | undefined {
		const previousSessionFileKey = sha256(previousSessionFile);
		return this.db.transaction(() => {
			const row = this.db.prepare(`SELECT id, source_session_key, target_entry_id FROM fork_intents
WHERE source_session_file = ? AND consumed_by_session_key IS NULL
ORDER BY created_at DESC LIMIT 1`).get(previousSessionFileKey) as Record<string, unknown> | undefined;
			if (!row) return undefined;
			this.db.prepare("UPDATE fork_intents SET consumed_by_session_key = ? WHERE id = ?")
				.run(childSessionKey, String(row.id));
			return { sourceSessionKey: String(row.source_session_key), targetEntryId: String(row.target_entry_id) };
		});
	}

	close(): void {
		this.db.close();
	}
}
