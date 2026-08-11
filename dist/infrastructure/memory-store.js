import { randomUUID } from "node:crypto";
import { DurableSqlite, asNumber } from "./sqlite.js";
function scopeClause(selectors, alias = "") {
    if (selectors.length === 0)
        return { sql: "0", params: [] };
    const prefix = alias ? `${alias}.` : "";
    return {
        sql: selectors.map(() => `(${prefix}scope = ? AND ${prefix}scope_key = ?)`).join(" OR "),
        params: selectors.flatMap((selector) => [selector.scope, selector.scopeKey]),
    };
}
function rowToMemory(row) {
    return {
        id: String(row.id),
        scope: String(row.scope),
        scopeKey: String(row.scope_key),
        content: String(row.content),
        citation: String(row.citation),
        sourceSessionKey: String(row.source_session_key),
        sourceHash: String(row.source_hash),
        usageCount: asNumber(row.usage_count),
        createdAt: asNumber(row.created_at),
        updatedAt: asNumber(row.updated_at),
    };
}
function rowToBaseline(row) {
    return {
        id: String(row.id),
        scope: String(row.scope),
        scopeKey: String(row.scope_key),
        content: String(row.content),
        sourceGeneration: String(row.source_generation),
        createdAt: asNumber(row.created_at),
    };
}
export class MemoryStore {
    db;
    constructor(path) {
        this.db = new DurableSqlite(path);
        this.migrate();
    }
    migrate() {
        this.db.exec(`
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
`);
    }
    claimPipeline(sessionKey, sourceHash, generation, owner, now = Date.now(), leaseMs = 10 * 60_000) {
        return this.db.transaction(() => {
            const id = randomUUID();
            this.db.prepare(`INSERT INTO pipeline_runs(
  id, session_key, source_hash, generation, status, created_at, updated_at
) VALUES (?, ?, ?, ?, 'pending', ?, ?)
ON CONFLICT(session_key, source_hash) DO NOTHING`).run(id, sessionKey, sourceHash, generation, now, now);
            const row = this.db.prepare(`SELECT * FROM pipeline_runs
WHERE session_key = ? AND source_hash = ?`).get(sessionKey, sourceHash);
            if (!row)
                return undefined;
            const status = String(row.status);
            const leaseUntil = row.lease_until === null ? 0 : asNumber(row.lease_until);
            if (status === "published" || status === "superseded")
                return undefined;
            if (status === "running" && leaseUntil >= now && String(row.owner) !== owner)
                return undefined;
            const runId = String(row.id);
            const changed = this.db.prepare(`UPDATE pipeline_runs SET
  status = 'running', owner = ?, lease_until = ?, generation = ?, updated_at = ?, reason = NULL
WHERE id = ? AND (status IN ('pending', 'deferred', 'failed') OR (status = 'running' AND lease_until < ?) OR owner = ?)`)
                .run(owner, now + leaseMs, generation, now, runId, now, owner).changes;
            if (Number(changed) !== 1)
                return undefined;
            return { runId, owner, sessionKey, sourceHash, generation, leaseUntil: now + leaseMs };
        });
    }
    heartbeat(lease, now = Date.now(), leaseMs = 10 * 60_000) {
        return this.db.transaction(() => Number(this.db.prepare(`UPDATE pipeline_runs SET lease_until = ?, updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(now + leaseMs, now, lease.runId, lease.owner).changes) === 1);
    }
    stage1(lease, inputs, usage, now = Date.now()) {
        return this.db.transaction(() => {
            const run = this.db.prepare(`SELECT status, owner, source_hash, generation FROM pipeline_runs WHERE id = ?`).get(lease.runId);
            if (!run || String(run.status) !== "running" || String(run.owner) !== lease.owner
                || String(run.source_hash) !== lease.sourceHash || String(run.generation) !== lease.generation)
                return false;
            const insert = this.db.prepare(`INSERT INTO memory_records(
  id, scope, scope_key, content, citation, source_session_key, source_hash, run_id, status,
  created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
ON CONFLICT(id) DO NOTHING`);
            for (const input of inputs) {
                insert.run(input.id, input.scope, input.scopeKey, input.content, input.citation, lease.sessionKey, lease.sourceHash, lease.runId, now, now);
            }
            this.db.prepare(`UPDATE pipeline_runs SET stage1_records = ?, usage_json = ?, updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(inputs.length, JSON.stringify(usage), now, lease.runId, lease.owner);
            return true;
        });
    }
    publish(lease, baselines, usage, now = Date.now()) {
        return this.db.transaction(() => {
            const run = this.db.prepare(`SELECT status, owner, source_hash, generation FROM pipeline_runs WHERE id = ?`).get(lease.runId);
            if (!run || String(run.status) !== "running" || String(run.owner) !== lease.owner
                || String(run.source_hash) !== lease.sourceHash || String(run.generation) !== lease.generation)
                return false;
            const insert = this.db.prepare(`INSERT INTO memory_baselines(
  id, scope, scope_key, content, source_generation, run_id, status, created_at
) VALUES (?, ?, ?, ?, ?, ?, 'building', ?)`);
            for (const baseline of baselines)
                insert.run(baseline.id, baseline.scope, baseline.scopeKey, baseline.content, lease.generation, lease.runId, now);
            this.db.prepare("UPDATE memory_records SET status = 'published', updated_at = ? WHERE run_id = ? AND status = 'pending'")
                .run(now, lease.runId);
            for (const baseline of baselines) {
                this.db.prepare("UPDATE memory_baselines SET status = 'published' WHERE id = ? AND status = 'building'").run(baseline.id);
                this.db.prepare(`INSERT INTO baseline_heads(scope, scope_key, baseline_id, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(scope, scope_key) DO UPDATE SET baseline_id = excluded.baseline_id, updated_at = excluded.updated_at`)
                    .run(baseline.scope, baseline.scopeKey, baseline.id, now);
            }
            this.db.prepare(`UPDATE pipeline_runs SET
  status = 'published', owner = NULL, lease_until = NULL, stage2_baselines = ?, usage_json = ?, reason = 'published', updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(baselines.length, JSON.stringify(usage), now, lease.runId, lease.owner);
            return true;
        });
    }
    finish(lease, status, reason, now = Date.now()) {
        this.db.transaction(() => {
            this.db.prepare(`UPDATE pipeline_runs SET status = ?, reason = ?, owner = NULL, lease_until = NULL, updated_at = ?
WHERE id = ? AND owner = ? AND status = 'running'`).run(status, reason.slice(0, 4_000), now, lease.runId, lease.owner);
            this.db.prepare("DELETE FROM memory_records WHERE run_id = ? AND status = 'pending'").run(lease.runId);
            this.db.prepare("DELETE FROM memory_baselines WHERE run_id = ? AND status = 'building'").run(lease.runId);
        });
    }
    addPublished(input, now = Date.now()) {
        this.db.transaction(() => {
            this.db.prepare(`INSERT INTO memory_records(
  id, scope, scope_key, content, citation, source_session_key, source_hash, status, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
ON CONFLICT(id) DO NOTHING`).run(input.id, input.scope, input.scopeKey, input.content, input.citation, input.sourceSessionKey, input.sourceHash, now, now);
        });
        return { ...input, usageCount: 0, createdAt: now, updatedAt: now };
    }
    list(selectors, limit = 100) {
        const clause = scopeClause(selectors);
        if (!clause.params.length)
            return [];
        const rows = this.db.prepare(`SELECT * FROM memory_records
WHERE status = 'published' AND (${clause.sql})
ORDER BY usage_count DESC, updated_at DESC, id ASC LIMIT ?`).all(...clause.params, Math.max(1, Math.min(limit, 500)));
        return rows.map(rowToMemory);
    }
    read(id, selectors) {
        const allowed = new Set(selectors.map((selector) => `${selector.scope}\0${selector.scopeKey}`));
        const row = this.db.prepare("SELECT * FROM memory_records WHERE id = ? AND status = 'published'").get(id);
        if (!row || !allowed.has(`${String(row.scope)}\0${String(row.scope_key)}`))
            return undefined;
        return rowToMemory(row);
    }
    search(query, selectors, limit = 50) {
        const normalized = query.trim().toLowerCase();
        if (!normalized)
            return [];
        return this.list(selectors, 500)
            .filter((record) => `${record.content}\n${record.citation}`.toLowerCase().includes(normalized))
            .slice(0, Math.max(1, Math.min(limit, 100)));
    }
    publishedBaselines(selectors) {
        const clause = scopeClause(selectors, "b");
        if (!clause.params.length)
            return [];
        const rows = this.db.prepare(`SELECT b.* FROM baseline_heads h
JOIN memory_baselines b ON b.id = h.baseline_id
WHERE b.status = 'published' AND (${clause.sql})
ORDER BY b.scope, b.scope_key`).all(...clause.params);
        return rows.map(rowToBaseline);
    }
    recordCitations(memoryIds, sessionKey, now = Date.now()) {
        return this.db.transaction(() => {
            let count = 0;
            for (const memoryId of new Set(memoryIds)) {
                const exists = this.db.prepare("SELECT 1 FROM memory_records WHERE id = ? AND status = 'published'").get(memoryId);
                if (!exists)
                    continue;
                this.db.prepare("INSERT INTO citation_usage(id, memory_id, session_key, created_at) VALUES (?, ?, ?, ?)")
                    .run(randomUUID(), memoryId, sessionKey, now);
                this.db.prepare("UPDATE memory_records SET usage_count = usage_count + 1, last_used_at = ?, updated_at = ? WHERE id = ?")
                    .run(now, now, memoryId);
                count += 1;
            }
            return count;
        });
    }
    latestRun(sessionKey) {
        const row = this.db.prepare("SELECT * FROM pipeline_runs WHERE session_key = ? ORDER BY created_at DESC LIMIT 1").get(sessionKey);
        if (!row)
            return undefined;
        const usage = JSON.parse(String(row.usage_json || "{}"));
        return {
            runId: String(row.id),
            status: String(row.status) === "published" ? "published" : String(row.status),
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
    reset() {
        this.db.transaction(() => {
            this.db.exec("DELETE FROM citation_usage");
            this.db.exec("DELETE FROM baseline_heads");
            this.db.exec("DELETE FROM memory_baselines");
            this.db.exec("DELETE FROM memory_records");
            this.db.exec("DELETE FROM pipeline_runs");
        });
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=memory-store.js.map