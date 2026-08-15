import { randomUUID } from "node:crypto";

import { sha256 } from "../domain/canonical.js";
import type {
	CheckpointRecord,
	SessionIdentity,
	ValidationEvidence,
	WorkState,
} from "../domain/types.js";
import { cloneWorkState } from "../domain/types.js";
import { DurableSqlite, asNumber } from "./sqlite.js";

interface StateRow extends Record<string, unknown> {
	state_json: string;
	node_id: string;
	updated_at: number | bigint;
}

export interface PendingMutation {
	toolCallId: string;
	nodeId: string;
	sequence: number;
	toolName: string;
	kind: "mutation" | "validation";
	preFingerprint: string | null;
	command: string | null;
	status: "pending" | "determined" | "uncertain";
	createdAt: number;
}

function placeholders(length: number): string {
	return new Array(length).fill("?").join(",");
}

function parseState(row: StateRow): WorkState {
	return JSON.parse(String(row.state_json)) as WorkState;
}

export class ContinuityStore {
	readonly db: DurableSqlite;

	constructor(path: string) {
		this.db = new DurableSqlite(path);
		this.migrate();
	}

	private migrate(): void {
		this.db.exec(`
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
`);
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
		inputDigest: string;
		command: string | null;
		preFingerprint: string | null;
		state: WorkState;
		now?: number;
	}): WorkState {
		const now = input.now ?? Date.now();
		return this.db.transaction(() => {
			const row = this.db.prepare("SELECT state_json, node_id, updated_at FROM branch_states WHERE session_key = ? AND node_id = ?")
				.get(input.sessionKey, input.nodeId) as StateRow | undefined;
			const state = row ? parseState(row) : cloneWorkState(input.state);
			if (input.kind === "mutation") {
				state.mutationSequence += 1;
				state.mutationStatus = "pending";
				state.mutationUncertain = false;
			}
			state.updatedAt = now;
			const sequence = state.mutationSequence;
			this.db.prepare(`INSERT INTO pending_mutations(
  tool_call_id, session_key, node_id, sequence, tool_name, kind, input_digest, command_text,
  pre_fingerprint, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
ON CONFLICT(tool_call_id) DO NOTHING`).run(
				input.toolCallId,
				input.sessionKey,
				input.nodeId,
				sequence,
				input.toolName,
				input.kind,
				input.inputDigest,
				input.command,
				input.preFingerprint,
				now,
			);
			this.db.prepare(`INSERT INTO branch_states(session_key, node_id, state_json, revision, updated_at)
VALUES (?, ?, ?, 1, ?)
ON CONFLICT(session_key, node_id) DO UPDATE SET
  state_json = excluded.state_json,
  revision = branch_states.revision + 1,
  updated_at = excluded.updated_at`).run(input.sessionKey, input.nodeId, JSON.stringify(state), now);
			return cloneWorkState(state);
		});
	}

	resolveTrackedCall(toolCallId: string, isError: boolean, resultDigest: string, now = Date.now()): PendingMutation | undefined {
		return this.db.transaction(() => {
			const row = this.db.prepare("SELECT * FROM pending_mutations WHERE tool_call_id = ?").get(toolCallId) as Record<string, unknown> | undefined;
			if (!row) return undefined;
			this.db.prepare(`UPDATE pending_mutations
SET status = 'determined', is_error = ?, result_digest = ?, resolved_at = ?
WHERE tool_call_id = ? AND status = 'pending'`).run(isError ? 1 : 0, resultDigest, now, toolCallId);
			return this.rowToPending({ ...row, status: "determined" });
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

	pendingForBranch(sessionKey: string, branchNodeIds: readonly string[]): PendingMutation[] {
		if (branchNodeIds.length === 0) return [];
		const rows = this.db.prepare(`SELECT * FROM pending_mutations
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)}) AND status = 'pending'
ORDER BY sequence`).all(sessionKey, ...branchNodeIds) as Array<Record<string, unknown>>;
		return rows.map((row) => this.rowToPending(row));
	}

	getTrackedCall(toolCallId: string): PendingMutation | undefined {
		const row = this.db.prepare("SELECT * FROM pending_mutations WHERE tool_call_id = ?").get(toolCallId) as Record<string, unknown> | undefined;
		return row ? this.rowToPending(row) : undefined;
	}

	private rowToPending(row: Record<string, unknown>): PendingMutation {
		return {
			toolCallId: String(row.tool_call_id),
			nodeId: String(row.node_id),
			sequence: asNumber(row.sequence),
			toolName: String(row.tool_name),
			kind: String(row.kind) as "mutation" | "validation",
			preFingerprint: row.pre_fingerprint === null || row.pre_fingerprint === undefined ? null : String(row.pre_fingerprint),
			command: row.command_text === null || row.command_text === undefined ? null : String(row.command_text),
			status: String(row.status) as PendingMutation["status"],
			createdAt: asNumber(row.created_at),
		};
	}

	recordValidation(sessionKey: string, nodeId: string, evidence: ValidationEvidence): void {
		this.db.transaction(() => {
			this.db.prepare(`INSERT INTO validation_evidence(
  id, session_key, node_id, command_text, exit_code, started_at, finished_at,
  mutation_sequence, repository_fingerprint, output_digest, provider
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING`).run(
				evidence.id,
				sessionKey,
				nodeId,
				evidence.command,
				evidence.exitCode,
				evidence.startedAt,
				evidence.finishedAt,
				evidence.mutationSequence,
				evidence.repositoryFingerprint,
				evidence.outputDigest,
				evidence.provider,
			);
		});
	}

	getValidation(id: string): ValidationEvidence | undefined {
		const row = this.db.prepare("SELECT * FROM validation_evidence WHERE id = ?").get(id) as Record<string, unknown> | undefined;
		return row ? this.rowToEvidence(row) : undefined;
	}

	latestValidation(sessionKey: string, branchNodeIds: readonly string[], mutationSequence: number): ValidationEvidence | undefined {
		if (branchNodeIds.length === 0) return undefined;
		const row = this.db.prepare(`SELECT * FROM validation_evidence
WHERE session_key = ? AND node_id IN (${placeholders(branchNodeIds.length)}) AND mutation_sequence = ? AND exit_code = 0
ORDER BY finished_at DESC LIMIT 1`).get(sessionKey, ...branchNodeIds, mutationSequence) as Record<string, unknown> | undefined;
		return row ? this.rowToEvidence(row) : undefined;
	}

	private rowToEvidence(row: Record<string, unknown>): ValidationEvidence {
		return {
			id: String(row.id),
			command: String(row.command_text),
			exitCode: asNumber(row.exit_code),
			startedAt: asNumber(row.started_at),
			finishedAt: asNumber(row.finished_at),
			mutationSequence: asNumber(row.mutation_sequence),
			repositoryFingerprint: String(row.repository_fingerprint),
			outputDigest: String(row.output_digest),
			provider: String(row.provider) as ValidationEvidence["provider"],
		};
	}

	insertCheckpoint(record: CheckpointRecord): void {
		this.db.transaction(() => {
			this.db.prepare(`INSERT INTO checkpoints(
  id, session_key, session_id, session_file_key, repository_id, parent_id, parent_hash,
  payload_json, payload_hash, chain_hash, repository_fingerprint, validation_evidence_id,
  mutation_sequence, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
				record.id,
				record.sessionKey,
				record.sessionId,
				record.sessionFileKey,
				record.repositoryId,
				record.parentId,
				record.parentHash,
				record.payloadJson,
				record.payloadHash,
				record.chainHash,
				record.repositoryFingerprint,
				record.validationEvidenceId,
				record.mutationSequence,
				record.status,
				record.createdAt,
			);
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
			payloadJson: String(row.payload_json),
			payloadHash: String(row.payload_hash),
			chainHash: String(row.chain_hash),
			repositoryFingerprint: String(row.repository_fingerprint),
			validationEvidenceId: String(row.validation_evidence_id),
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
