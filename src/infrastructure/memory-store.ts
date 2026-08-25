import { randomUUID } from "node:crypto";

import { MEMORY_DATABASE_SCHEMA_VERSION, isMemoryKind } from "../domain/types.js";
import type {
	MemoryKind,
	MemoryRecord,
	MemoryScope,
	PipelineRunResult,
	PipelineUsage,
	PublishedBaseline,
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

export interface ScopeSelector {
	scope: MemoryScope;
	scopeKey: string;
}

export interface PipelineLease {
	runId: string;
	owner: string;
	sessionKey: string;
	sourceHash: string;
	generation: string;
	leaseUntil: number;
}

export interface PipelineRecoveryResult {
	expiredRuns: number;
	orphanedRecords: number;
	orphanedBaselines: number;
}

export interface PendingMemoryInput {
	id: string;
	scope: MemoryScope;
	scopeKey: string;
	kind: MemoryKind;
	content: string;
	citation: string;
}

export interface BaselineInput {
	id: string;
	scope: MemoryScope;
	scopeKey: string;
	content: string;
}

export interface MemoryExtractCursor {
	lastEntryId: string | null;
	lastSourceHash: string;
	processedTurnCount: number;
	warmupStep: number;
}

function uniqueTokens(value: string): string[] {
	return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])];
}

function tokenOverlapScore(tokens: readonly string[], haystack: string): number {
	if (tokens.length === 0) return 0;
	const present = new Set(uniqueTokens(haystack));
	return tokens.reduce((score, token) => score + (present.has(token) ? 1 : 0), 0);
}

function scopeClause(selectors: readonly ScopeSelector[], alias = ""): { sql: string; params: string[] } {
	if (selectors.length === 0) return { sql: "0", params: [] };
	const prefix = alias ? `${alias}.` : "";
	return {
		sql: selectors.map(() => `(${prefix}scope = ? AND ${prefix}scope_key = ?)` ).join(" OR "),
		params: selectors.flatMap((selector) => [selector.scope, selector.scopeKey]),
	};
}

function rowToMemory(row: Record<string, unknown>): MemoryRecord {
	return {
		id: String(row.id),
		scope: String(row.scope) as MemoryScope,
		scopeKey: String(row.scope_key),
		kind: isMemoryKind(row.kind) ? row.kind : "fact",
		content: String(row.content),
		citation: String(row.citation),
		sourceSessionKey: String(row.source_session_key),
		sourceHash: String(row.source_hash),
		usageCount: asNumber(row.usage_count),
		createdAt: asNumber(row.created_at),
		updatedAt: asNumber(row.updated_at),
	};
}

function rowToBaseline(row: Record<string, unknown>): PublishedBaseline {
	return {
		id: String(row.id),
		scope: String(row.scope) as MemoryScope,
		scopeKey: String(row.scope_key),
		content: String(row.content),
		sourceGeneration: String(row.source_generation),
		createdAt: asNumber(row.created_at),
	};
}

const MEMORY_V1_SQL = `
CREATE TABLE IF NOT EXISTS memory_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO memory_meta(key, value) VALUES ('schema_version', '1')
  ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  generation TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'deferred', 'superseded', 'failed', 'published')),
  owner TEXT,
  lease_until INTEGER,
  reason TEXT,
  stage1_records INTEGER NOT NULL DEFAULT 0,
  stage2_baselines INTEGER NOT NULL DEFAULT 0,
  usage_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_key, source_hash)
);
CREATE INDEX IF NOT EXISTS idx_memory_run_lease ON pipeline_runs(status, lease_until);

CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('global-user', 'repository', 'work-item', 'session')),
  scope_key TEXT NOT NULL,
  content TEXT NOT NULL,
  citation TEXT NOT NULL,
  source_session_key TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  run_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'published')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(run_id) REFERENCES pipeline_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory_records(scope, scope_key, status, updated_at);

CREATE TABLE IF NOT EXISTS memory_baselines (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('global-user', 'repository', 'work-item', 'session')),
  scope_key TEXT NOT NULL,
  content TEXT NOT NULL,
  source_generation TEXT NOT NULL,
  run_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('building', 'published')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(run_id) REFERENCES pipeline_runs(id)
);
CREATE INDEX IF NOT EXISTS idx_baseline_scope ON memory_baselines(scope, scope_key, status, created_at);

CREATE TABLE IF NOT EXISTS baseline_heads (
  scope TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  baseline_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(scope, scope_key),
  FOREIGN KEY(baseline_id) REFERENCES memory_baselines(id)
);

CREATE TABLE IF NOT EXISTS citation_usage (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  session_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(memory_id) REFERENCES memory_records(id)
);
`;

const MEMORY_V2_SQL = "SELECT 1;";

const MEMORY_V3_SQL = `
ALTER TABLE memory_records ADD COLUMN kind TEXT NOT NULL DEFAULT 'fact';
CREATE TABLE IF NOT EXISTS memory_cursors (
  session_key TEXT PRIMARY KEY,
  last_entry_id TEXT,
  last_source_hash TEXT NOT NULL,
  processed_turn_count INTEGER NOT NULL DEFAULT 0,
  warmup_step INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
`;

function verifyMemoryV1(db: DurableSqlite): void {
	requiredSchemaMatchesSql(db, MEMORY_V1_SQL, ["schema_migrations"]);
	requiredOnlySchemaObjects(db, [
		"baseline_heads", "citation_usage", "idx_baseline_scope", "idx_memory_run_lease", "idx_memory_scope",
		"memory_baselines", "memory_meta", "memory_records", "pipeline_runs", "schema_migrations",
	]);
	requiredExactColumns(db, "memory_meta", ["key", "value"]);
	requiredExactColumns(db, "pipeline_runs", ["id", "session_key", "source_hash", "generation", "status", "owner", "lease_until", "reason", "stage1_records", "stage2_baselines", "usage_json", "created_at", "updated_at"]);
	requiredExactColumns(db, "memory_records", ["id", "scope", "scope_key", "content", "citation", "source_session_key", "source_hash", "run_id", "status", "usage_count", "last_used_at", "created_at", "updated_at"]);
	requiredExactColumns(db, "memory_baselines", ["id", "scope", "scope_key", "content", "source_generation", "run_id", "status", "created_at"]);
	requiredExactColumns(db, "baseline_heads", ["scope", "scope_key", "baseline_id", "updated_at"]);
	requiredExactColumns(db, "citation_usage", ["id", "memory_id", "session_key", "created_at"]);
	requiredIndexColumns(db, "idx_memory_run_lease", ["status", "lease_until"]);
	requiredIndexColumns(db, "idx_memory_scope", ["scope", "scope_key", "status", "updated_at"]);
	requiredIndexColumns(db, "idx_baseline_scope", ["scope", "scope_key", "status", "created_at"]);
	requiredForeignKeys(db, "memory_records", [{ from: "run_id", table: "pipeline_runs", to: "id" }]);
	requiredForeignKeys(db, "memory_baselines", [{ from: "run_id", table: "pipeline_runs", to: "id" }]);
	requiredForeignKeys(db, "baseline_heads", [{ from: "baseline_id", table: "memory_baselines", to: "id" }]);
	requiredForeignKeys(db, "citation_usage", [{ from: "memory_id", table: "memory_records", to: "id" }]);
}

function verifyMemoryV3(db: DurableSqlite): void {
	requiredOnlySchemaObjects(db, [
		"baseline_heads", "citation_usage", "idx_baseline_scope", "idx_memory_run_lease", "idx_memory_scope",
		"memory_baselines", "memory_cursors", "memory_meta", "memory_records", "pipeline_runs", "schema_migrations",
	]);
	requiredExactColumns(db, "memory_meta", ["key", "value"]);
	requiredExactColumns(db, "pipeline_runs", ["id", "session_key", "source_hash", "generation", "status", "owner", "lease_until", "reason", "stage1_records", "stage2_baselines", "usage_json", "created_at", "updated_at"]);
	requiredExactColumns(db, "memory_records", ["id", "scope", "scope_key", "content", "citation", "source_session_key", "source_hash", "run_id", "status", "usage_count", "last_used_at", "created_at", "updated_at", "kind"]);
	requiredExactColumns(db, "memory_baselines", ["id", "scope", "scope_key", "content", "source_generation", "run_id", "status", "created_at"]);
	requiredExactColumns(db, "baseline_heads", ["scope", "scope_key", "baseline_id", "updated_at"]);
	requiredExactColumns(db, "citation_usage", ["id", "memory_id", "session_key", "created_at"]);
	requiredExactColumns(db, "memory_cursors", ["session_key", "last_entry_id", "last_source_hash", "processed_turn_count", "warmup_step", "updated_at"]);
	requiredIndexColumns(db, "idx_memory_run_lease", ["status", "lease_until"]);
	requiredIndexColumns(db, "idx_memory_scope", ["scope", "scope_key", "status", "updated_at"]);
	requiredIndexColumns(db, "idx_baseline_scope", ["scope", "scope_key", "status", "created_at"]);
	requiredForeignKeys(db, "memory_records", [{ from: "run_id", table: "pipeline_runs", to: "id" }]);
	requiredForeignKeys(db, "memory_baselines", [{ from: "run_id", table: "pipeline_runs", to: "id" }]);
	requiredForeignKeys(db, "baseline_heads", [{ from: "baseline_id", table: "memory_baselines", to: "id" }]);
	requiredForeignKeys(db, "citation_usage", [{ from: "memory_id", table: "memory_records", to: "id" }]);
}

const MEMORY_MIGRATIONS: readonly SqliteMigration[] = [
	{
		version: 1,
		name: "initial-rc2-schema",
		checksumMaterial: MEMORY_V1_SQL,
		apply: (db) => db.exec(MEMORY_V1_SQL),
		verify: verifyMemoryV1,
	},
	{
		version: 2,
		name: "ordered-migration-metadata",
		checksumMaterial: MEMORY_V2_SQL,
		apply: (db) => db.exec(MEMORY_V2_SQL),
		verify: verifyMemoryV1,
	},
	{
		version: 3,
		name: "typed-atoms-and-extract-cursor",
		checksumMaterial: MEMORY_V3_SQL,
		apply: (db) => db.exec(MEMORY_V3_SQL),
		verify: verifyMemoryV3,
	},
];

export class MemoryStore {
	readonly db: DurableSqlite;

	constructor(path: string) {
		this.db = new DurableSqlite(path);
		runSqliteMigrations(this.db, {
			storeName: "memory",
			metaTable: "memory_meta",
			targetVersion: MEMORY_DATABASE_SCHEMA_VERSION,
			migrations: MEMORY_MIGRATIONS,
		});
		this.recoverAbandonedPipelines();
	}

	recoverAbandonedPipelines(now?: number): PipelineRecoveryResult {
		return this.db.transaction(() => {
			const effectiveNow = now ?? Date.now();
			const expiredRuns = Number(this.db.prepare(`UPDATE pipeline_runs SET
  status = 'failed', owner = NULL, lease_until = NULL, reason = 'expired lease recovered',
  stage1_records = 0, stage2_baselines = 0, usage_json = '{}', updated_at = ?
WHERE status = 'running' AND (lease_until IS NULL OR lease_until < ?)`)
				.run(effectiveNow, effectiveNow).changes);
			const orphanedRecords = Number(this.db.prepare(`DELETE FROM memory_records
WHERE status = 'pending' AND (
  run_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM pipeline_runs r
    WHERE r.id = memory_records.run_id AND r.status = 'running' AND r.lease_until >= ?
  )
)`).run(effectiveNow).changes);
			const orphanedBaselines = Number(this.db.prepare(`DELETE FROM memory_baselines
WHERE status = 'building' AND (
  run_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM pipeline_runs r
    WHERE r.id = memory_baselines.run_id AND r.status = 'running' AND r.lease_until >= ?
  )
)`).run(effectiveNow).changes);
			return { expiredRuns, orphanedRecords, orphanedBaselines };
		});
	}

	claimPipeline(
		sessionKey: string,
		sourceHash: string,
		generation: string,
		owner: string,
		now?: number,
		leaseMs = 10 * 60_000,
	): PipelineLease | undefined {
		return this.db.transaction(() => {
			const effectiveNow = now ?? Date.now();
			const id = randomUUID();
			this.db.prepare(`INSERT INTO pipeline_runs(
  id, session_key, source_hash, generation, status, created_at, updated_at
) VALUES (?, ?, ?, ?, 'pending', ?, ?)
ON CONFLICT(session_key, source_hash) DO NOTHING`).run(id, sessionKey, sourceHash, generation, effectiveNow, effectiveNow);
			const row = this.db.prepare(`SELECT * FROM pipeline_runs
WHERE session_key = ? AND source_hash = ?`).get(sessionKey, sourceHash) as Record<string, unknown> | undefined;
			if (!row) return undefined;
			const status = String(row.status);
			const leaseUntil = row.lease_until === null ? 0 : asNumber(row.lease_until);
			if (status === "published") return undefined;
			if (status === "running" && leaseUntil >= effectiveNow) return undefined;
			const runId = String(row.id);
			const changed = this.db.prepare(`UPDATE pipeline_runs SET
  status = 'running', owner = ?, lease_until = ?, generation = ?, updated_at = ?,
  reason = ?, stage1_records = 0, stage2_baselines = 0, usage_json = '{}'
WHERE id = ? AND (
  status IN ('pending', 'deferred', 'failed', 'superseded')
  OR (status = 'running' AND (lease_until IS NULL OR lease_until < ?))
)`)
				.run(owner, effectiveNow + leaseMs, generation, effectiveNow, status === "running" ? "reclaimed expired lease" : `retrying ${status}`, runId, effectiveNow).changes;
			if (Number(changed) !== 1) return undefined;
			this.db.prepare("DELETE FROM memory_records WHERE run_id = ? AND status = 'pending'").run(runId);
			this.db.prepare("DELETE FROM memory_baselines WHERE run_id = ? AND status = 'building'").run(runId);
			return { runId, owner, sessionKey, sourceHash, generation, leaseUntil: effectiveNow + leaseMs };
		});
	}

	heartbeat(lease: PipelineLease, now?: number, leaseMs = 10 * 60_000): boolean {
		return this.db.transaction(() => {
			const effectiveNow = now ?? Date.now();
			const leaseUntil = effectiveNow + leaseMs;
			const renewed = Number(this.db.prepare(`UPDATE pipeline_runs SET lease_until = ?, updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running' AND lease_until >= ?`)
				.run(leaseUntil, effectiveNow, lease.runId, lease.owner, effectiveNow).changes) === 1;
			if (renewed) lease.leaseUntil = leaseUntil;
			return renewed;
		});
	}

	stage1(lease: PipelineLease, inputs: readonly PendingMemoryInput[], usage: PipelineUsage, now?: number): boolean {
		return this.db.transaction(() => {
			const effectiveNow = now ?? Date.now();
			const run = this.db.prepare(`SELECT status, owner, source_hash, generation, lease_until FROM pipeline_runs WHERE id = ?`).get(lease.runId) as Record<string, unknown> | undefined;
			if (!run || String(run.status) !== "running" || String(run.owner) !== lease.owner
				|| String(run.source_hash) !== lease.sourceHash || String(run.generation) !== lease.generation
				|| run.lease_until === null || asNumber(run.lease_until) < effectiveNow) return false;
			const insert = this.db.prepare(`INSERT INTO memory_records(
  id, scope, scope_key, kind, content, citation, source_session_key, source_hash, run_id, status,
  created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
ON CONFLICT(id) DO NOTHING`);
			for (const input of inputs) {
				insert.run(input.id, input.scope, input.scopeKey, input.kind, input.content, input.citation, lease.sessionKey, lease.sourceHash, lease.runId, effectiveNow, effectiveNow);
			}
			this.db.prepare(`UPDATE pipeline_runs SET stage1_records = ?, usage_json = ?, updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(inputs.length, JSON.stringify(usage), effectiveNow, lease.runId, lease.owner);
			return true;
		});
	}

	publish(
		lease: PipelineLease,
		baselines: readonly BaselineInput[],
		usage: PipelineUsage,
		now?: number,
	): boolean {
		return this.db.transaction(() => {
			const effectiveNow = now ?? Date.now();
			const run = this.db.prepare(`SELECT status, owner, source_hash, generation, lease_until FROM pipeline_runs WHERE id = ?`).get(lease.runId) as Record<string, unknown> | undefined;
			if (!run || String(run.status) !== "running" || String(run.owner) !== lease.owner
				|| String(run.source_hash) !== lease.sourceHash || String(run.generation) !== lease.generation
				|| run.lease_until === null || asNumber(run.lease_until) < effectiveNow) return false;
			const insert = this.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, run_id, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, 'building', ?)`);
			for (const baseline of baselines) insert.run(baseline.id, baseline.scope, baseline.scopeKey, baseline.content, lease.generation, lease.runId, effectiveNow);
			this.db.prepare("UPDATE memory_records SET status = 'published', updated_at = ? WHERE run_id = ? AND status = 'pending'")
				.run(effectiveNow, lease.runId);
			for (const baseline of baselines) {
				this.db.prepare("UPDATE memory_baselines SET status = 'published' WHERE id = ? AND status = 'building'").run(baseline.id);
				this.db.prepare(`INSERT INTO baseline_heads(scope, scope_key, baseline_id, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(scope, scope_key) DO UPDATE SET baseline_id = excluded.baseline_id, updated_at = excluded.updated_at`)
					.run(baseline.scope, baseline.scopeKey, baseline.id, effectiveNow);
			}
			this.db.prepare(`UPDATE pipeline_runs SET
  status = 'published', owner = NULL, lease_until = NULL, stage2_baselines = ?, usage_json = ?, reason = 'published', updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(baselines.length, JSON.stringify(usage), effectiveNow, lease.runId, lease.owner);
			return true;
		});
	}

	finish(lease: PipelineLease, status: "deferred" | "superseded" | "failed", reason: string, now?: number): boolean {
		return this.db.transaction(() => {
			const effectiveNow = now ?? Date.now();
			const changed = Number(this.db.prepare(`UPDATE pipeline_runs SET status = ?, reason = ?, owner = NULL, lease_until = NULL, updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(status, reason.slice(0, 4_000), effectiveNow, lease.runId, lease.owner).changes);
			if (changed !== 1) return false;
			this.db.prepare("DELETE FROM memory_records WHERE run_id = ? AND status = 'pending'").run(lease.runId);
			this.db.prepare("DELETE FROM memory_baselines WHERE run_id = ? AND status = 'building'").run(lease.runId);
			return true;
		});
	}

	addPublished(input: Omit<MemoryRecord, "usageCount" | "createdAt" | "updatedAt" | "kind"> & { kind?: MemoryKind }, now = Date.now()): MemoryRecord {
		const kind = isMemoryKind(input.kind) ? input.kind : "fact";
		this.db.transaction(() => {
			this.db.prepare(`INSERT INTO memory_records(
  id, scope, scope_key, kind, content, citation, source_session_key, source_hash, status, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
ON CONFLICT(id) DO NOTHING`).run(
				input.id,
				input.scope,
				input.scopeKey,
				kind,
				input.content,
				input.citation,
				input.sourceSessionKey,
				input.sourceHash,
				now,
				now,
			);
		});
		return { ...input, kind, usageCount: 0, createdAt: now, updatedAt: now };
	}

	list(selectors: readonly ScopeSelector[], limit = 100): MemoryRecord[] {
		const clause = scopeClause(selectors);
		if (!clause.params.length) return [];
		const rows = this.db.prepare(`SELECT * FROM memory_records
WHERE status = 'published' AND (${clause.sql})
ORDER BY usage_count DESC, updated_at DESC, id ASC LIMIT ?`).all(...clause.params, Math.max(1, Math.min(limit, 500))) as Array<Record<string, unknown>>;
		return rows.map(rowToMemory);
	}

	read(id: string, selectors: readonly ScopeSelector[]): MemoryRecord | undefined {
		const allowed = new Set(selectors.map((selector) => `${selector.scope}\0${selector.scopeKey}`));
		const row = this.db.prepare("SELECT * FROM memory_records WHERE id = ? AND status = 'published'").get(id) as Record<string, unknown> | undefined;
		if (!row || !allowed.has(`${String(row.scope)}\0${String(row.scope_key)}`)) return undefined;
		return rowToMemory(row);
	}

	search(query: string, selectors: readonly ScopeSelector[], limit = 50): MemoryRecord[] {
		const tokens = uniqueTokens(query);
		if (tokens.length === 0) return [];
		return this.list(selectors, 500)
			.map((record) => ({ record, score: tokenOverlapScore(tokens, `${record.content}\n${record.citation}`) }))
			.filter((item) => item.score > 0)
			.sort((left, right) => right.score - left.score
				|| right.record.usageCount - left.record.usageCount
				|| right.record.updatedAt - left.record.updatedAt
				|| left.record.id.localeCompare(right.record.id))
			.slice(0, Math.max(1, Math.min(limit, 100)))
			.map((item) => item.record);
	}

	publishedBaselines(selectors: readonly ScopeSelector[]): PublishedBaseline[] {
		const clause = scopeClause(selectors, "b");
		if (!clause.params.length) return [];
		const rows = this.db.prepare(`SELECT b.* FROM baseline_heads h
JOIN memory_baselines b ON b.id = h.baseline_id
WHERE b.status = 'published' AND (${clause.sql})
ORDER BY b.scope, b.scope_key`).all(...clause.params) as Array<Record<string, unknown>>;
		return rows.map(rowToBaseline);
	}

	recordCitations(memoryIds: readonly string[], sessionKey: string, now = Date.now()): number {
		return this.db.transaction(() => {
			let count = 0;
			for (const memoryId of new Set(memoryIds)) {
				const exists = this.db.prepare("SELECT 1 FROM memory_records WHERE id = ? AND status = 'published'").get(memoryId);
				if (!exists) continue;
				this.db.prepare("INSERT INTO citation_usage(id, memory_id, session_key, created_at) VALUES (?, ?, ?, ?)")
					.run(randomUUID(), memoryId, sessionKey, now);
				this.db.prepare("UPDATE memory_records SET usage_count = usage_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?")
					.run(now, now, memoryId);
				count += 1;
			}
			return count;
		});
	}

	latestRun(sessionKey: string): PipelineRunResult | undefined {
		const row = this.db.prepare("SELECT * FROM pipeline_runs WHERE session_key = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1").get(sessionKey) as Record<string, unknown> | undefined;
		if (!row) return undefined;
		const usage = JSON.parse(String(row.usage_json || "{}")) as Partial<PipelineUsage>;
		return {
			runId: String(row.id),
			status: String(row.status) === "published" ? "published" : String(row.status) as PipelineRunResult["status"],
			stage1Records: asNumber(row.stage1_records),
			stage2Baselines: asNumber(row.stage2_baselines),
			usage: {
				inputTokens: usage.inputTokens ?? 0,
				outputTokens: usage.outputTokens ?? 0,
				cacheReadTokens: usage.cacheReadTokens ?? 0,
				cacheWriteTokens: usage.cacheWriteTokens ?? 0,
				cost: usage.cost ?? 0,
			},
			reason: row.reason === null ? String(row.status) : String(row.reason),
		};
	}

	publishedContentExists(scope: MemoryScope, scopeKey: string, content: string): boolean {
		return Boolean(this.db.prepare(`SELECT 1 FROM memory_records
WHERE status = 'published' AND scope = ? AND scope_key = ? AND content = ?`).get(scope, scopeKey, content));
	}

	getCursor(sessionKey: string): MemoryExtractCursor | undefined {
		const row = this.db.prepare("SELECT * FROM memory_cursors WHERE session_key = ?").get(sessionKey) as Record<string, unknown> | undefined;
		if (!row) return undefined;
		return {
			lastEntryId: row.last_entry_id === null ? null : String(row.last_entry_id),
			lastSourceHash: String(row.last_source_hash),
			processedTurnCount: asNumber(row.processed_turn_count),
			warmupStep: asNumber(row.warmup_step),
		};
	}

	putCursor(sessionKey: string, cursor: MemoryExtractCursor, now = Date.now()): void {
		this.db.prepare(`INSERT INTO memory_cursors(
  session_key, last_entry_id, last_source_hash, processed_turn_count, warmup_step, updated_at
) VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(session_key) DO UPDATE SET
  last_entry_id = excluded.last_entry_id,
  last_source_hash = excluded.last_source_hash,
  processed_turn_count = excluded.processed_turn_count,
  warmup_step = excluded.warmup_step,
  updated_at = excluded.updated_at`).run(
			sessionKey,
			cursor.lastEntryId,
			cursor.lastSourceHash,
			cursor.processedTurnCount,
			cursor.warmupStep,
			now,
		);
	}

	reset(): void {
		this.db.transaction(() => {
			this.db.exec("DELETE FROM citation_usage");
			this.db.exec("DELETE FROM baseline_heads");
			this.db.exec("DELETE FROM memory_baselines");
			this.db.exec("DELETE FROM memory_records");
			this.db.exec("DELETE FROM pipeline_runs");
			this.db.exec("DELETE FROM memory_cursors");
		});
	}

	close(): void {
		this.db.close();
	}
}
