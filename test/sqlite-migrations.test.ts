import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { emptyWorkState } from "../src/domain/types.js";
import { ContinuityStore } from "../src/infrastructure/continuity-store.js";
import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { DurableSqlite } from "../src/infrastructure/sqlite.js";
import { requiredTable, runSqliteMigrations, type SqliteMigration } from "../src/infrastructure/sqlite-migrations.js";
import { identity, temporaryDirectory } from "./helpers.js";

const CONTINUITY_V1 = `
CREATE TABLE continuity_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO continuity_meta VALUES ('schema_version', '1');
CREATE TABLE sessions (session_key TEXT PRIMARY KEY, session_id TEXT NOT NULL, session_file_key TEXT NOT NULL, parent_session_key TEXT, repository_id TEXT NOT NULL, trusted INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX idx_continuity_sessions_repo ON sessions(repository_id, updated_at);
CREATE TABLE branch_states (session_key TEXT NOT NULL, node_id TEXT NOT NULL, state_json TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(session_key, node_id), FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE);
CREATE TABLE pending_mutations (tool_call_id TEXT PRIMARY KEY, session_key TEXT NOT NULL, node_id TEXT NOT NULL, sequence INTEGER NOT NULL, tool_name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('mutation', 'validation')), input_digest TEXT NOT NULL, command_text TEXT, pre_fingerprint TEXT, status TEXT NOT NULL CHECK(status IN ('pending', 'determined', 'uncertain')), is_error INTEGER, result_digest TEXT, created_at INTEGER NOT NULL, resolved_at INTEGER, FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE);
CREATE INDEX idx_pending_branch ON pending_mutations(session_key, node_id, status);
CREATE TABLE validation_evidence (id TEXT PRIMARY KEY, session_key TEXT NOT NULL, node_id TEXT NOT NULL, command_text TEXT NOT NULL, exit_code INTEGER NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER NOT NULL, mutation_sequence INTEGER NOT NULL, repository_fingerprint TEXT NOT NULL, output_digest TEXT NOT NULL, provider TEXT NOT NULL, FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE);
CREATE INDEX idx_validation_branch ON validation_evidence(session_key, node_id, mutation_sequence, finished_at);
CREATE TABLE checkpoints (id TEXT PRIMARY KEY, session_key TEXT NOT NULL, session_id TEXT NOT NULL, session_file_key TEXT NOT NULL, repository_id TEXT NOT NULL, parent_id TEXT, parent_hash TEXT NOT NULL, payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL, chain_hash TEXT NOT NULL, repository_fingerprint TEXT NOT NULL, validation_evidence_id TEXT NOT NULL, mutation_sequence INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('verified', 'quarantined')), quarantine_reason TEXT, created_at INTEGER NOT NULL, FOREIGN KEY(session_key) REFERENCES sessions(session_key) ON DELETE CASCADE, FOREIGN KEY(validation_evidence_id) REFERENCES validation_evidence(id));
CREATE INDEX idx_checkpoint_session ON checkpoints(session_key, created_at);
CREATE TABLE fork_intents (id TEXT PRIMARY KEY, source_session_key TEXT NOT NULL, source_session_file TEXT NOT NULL, target_entry_id TEXT NOT NULL, position TEXT NOT NULL, created_at INTEGER NOT NULL, consumed_by_session_key TEXT);
`;

const MEMORY_V1 = `
CREATE TABLE memory_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO memory_meta VALUES ('schema_version', '1');
CREATE TABLE pipeline_runs (id TEXT PRIMARY KEY, session_key TEXT NOT NULL, source_hash TEXT NOT NULL, generation TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'deferred', 'superseded', 'failed', 'published')), owner TEXT, lease_until INTEGER, reason TEXT, stage1_records INTEGER NOT NULL DEFAULT 0, stage2_baselines INTEGER NOT NULL DEFAULT 0, usage_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(session_key, source_hash));
CREATE INDEX idx_memory_run_lease ON pipeline_runs(status, lease_until);
CREATE TABLE memory_records (id TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK(scope IN ('global-user', 'repository', 'work-item', 'session')), scope_key TEXT NOT NULL, content TEXT NOT NULL, citation TEXT NOT NULL, source_session_key TEXT NOT NULL, source_hash TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL CHECK(status IN ('pending', 'published')), usage_count INTEGER NOT NULL DEFAULT 0, last_used_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(run_id) REFERENCES pipeline_runs(id));
CREATE INDEX idx_memory_scope ON memory_records(scope, scope_key, status, updated_at);
CREATE TABLE memory_baselines (id TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK(scope IN ('global-user', 'repository', 'work-item', 'session')), scope_key TEXT NOT NULL, content TEXT NOT NULL, source_generation TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL CHECK(status IN ('building', 'published')), created_at INTEGER NOT NULL, FOREIGN KEY(run_id) REFERENCES pipeline_runs(id));
CREATE INDEX idx_baseline_scope ON memory_baselines(scope, scope_key, status, created_at);
CREATE TABLE baseline_heads (scope TEXT NOT NULL, scope_key TEXT NOT NULL, baseline_id TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(scope, scope_key), FOREIGN KEY(baseline_id) REFERENCES memory_baselines(id));
CREATE TABLE citation_usage (id TEXT PRIMARY KEY, memory_id TEXT NOT NULL, session_key TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY(memory_id) REFERENCES memory_records(id));
`;

function createV1(path: string, sql: string): DatabaseSync {
	const db = new DatabaseSync(path);
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(sql);
	return db;
}

function digest(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertBackup(root: string): void {
	const directory = join(root, "backups");
	const files = readdirSync(directory).sort();
	const backups = files.filter((name) => name.endsWith(".sqlite"));
	assert.equal(backups.length, 1);
	const backup = join(directory, backups[0]!);
	const sidecar = `${backup}.sha256`;
	assert.equal(statSync(directory).mode & 0o777, 0o700);
	assert.equal(statSync(backup).mode & 0o777, 0o600);
	assert.equal(statSync(sidecar).mode & 0o777, 0o600);
	assert.equal(readFileSync(sidecar, "utf8").split(/\s+/)[0], digest(backup));
}

test("literal RC2 continuity schema migrates to v2 with a verified private backup", () => {
	const root = temporaryDirectory("continuity-migration-v1");
	const path = join(root, "state.sqlite");
	const legacy = createV1(path, CONTINUITY_V1);
	const session = identity();
	legacy.prepare("INSERT INTO sessions VALUES (?, ?, ?, NULL, ?, 1, 1, 1)")
		.run(session.sessionKey, session.sessionId, session.sessionFileKey, session.repositoryId);
	legacy.prepare("INSERT INTO branch_states VALUES (?, 'root', ?, 1, 1)")
		.run(session.sessionKey, JSON.stringify({ ...emptyWorkState(), goal: "legacy continuity marker" }));
	legacy.close();

	const store = new ContinuityStore(path);
	assert.equal(String((store.db.prepare("SELECT value FROM continuity_meta WHERE key = 'schema_version'").get() as Record<string, unknown>).value), "2");
	assert.equal(store.findNearestState(session.sessionKey, ["root"])?.goal, "legacy continuity marker");
	assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as Record<string, unknown>).count, 2);
	store.close();
	assertBackup(root);
});

test("literal RC2 memory schema migrates without losing published records or heads", () => {
	const root = temporaryDirectory("memory-migration-v1");
	const path = join(root, "memory.sqlite");
	const legacy = createV1(path, MEMORY_V1);
	legacy.prepare("INSERT INTO memory_records(id, scope, scope_key, content, citation, source_session_key, source_hash, status, created_at, updated_at) VALUES ('record', 'repository', 'repo:a', 'legacy memory marker', 'legacy', 'session', 'source', 'published', 1, 1)").run();
	legacy.prepare("INSERT INTO memory_baselines(id, scope, scope_key, content, source_generation, status, created_at) VALUES ('baseline', 'repository', 'repo:a', 'legacy baseline marker', 'generation', 'published', 1)").run();
	legacy.prepare("INSERT INTO baseline_heads VALUES ('repository', 'repo:a', 'baseline', 1)").run();
	legacy.close();

	const store = new MemoryStore(path);
	assert.equal(String((store.db.prepare("SELECT value FROM memory_meta WHERE key = 'schema_version'").get() as Record<string, unknown>).value), "3");
	assert.equal(store.list([{ scope: "repository", scopeKey: "repo:a" }], 10)[0]?.content, "legacy memory marker");
	assert.equal(store.list([{ scope: "repository", scopeKey: "repo:a" }], 10)[0]?.kind, "fact");
	assert.equal(store.publishedBaselines([{ scope: "repository", scopeKey: "repo:a" }])[0]?.content, "legacy baseline marker");
	store.close();
	assertBackup(root);
});

test("future schemas and migration checksum drift fail closed", () => {
	const root = temporaryDirectory("migration-guards");
	const futurePath = join(root, "future.sqlite");
	new ContinuityStore(futurePath).close();
	const future = new DatabaseSync(futurePath);
	future.prepare("UPDATE continuity_meta SET value = '99' WHERE key = 'schema_version'").run();
	future.close();
	assert.throws(() => new ContinuityStore(futurePath), /newer than supported/);

	const checksumPath = join(root, "checksum.sqlite");
	new MemoryStore(checksumPath).close();
	const checksum = new DatabaseSync(checksumPath);
	checksum.prepare("UPDATE schema_migrations SET checksum = 'corrupt' WHERE version = 1").run();
	checksum.close();
	assert.throws(() => new MemoryStore(checksumPath), /checksum mismatch/);
});

test("an invalid claimed v1 schema is rejected before adoption", () => {
	const root = temporaryDirectory("migration-invalid-v1");
	const path = join(root, "state.sqlite");
	const db = new DatabaseSync(path);
	db.exec("CREATE TABLE continuity_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO continuity_meta VALUES ('schema_version', '1');");
	db.close();
	assert.throws(() => new ContinuityStore(path), /Required SQLite|schema definition/);
	assert.equal(readdirSync(root).includes("backups"), false);
});

test("failed ordered migration rolls back schema and preserves a recovery backup", () => {
	const root = temporaryDirectory("migration-rollback");
	const path = join(root, "custom.sqlite");
	const first: SqliteMigration = {
		version: 1,
		name: "base",
		checksumMaterial: "CREATE TABLE base(id INTEGER PRIMARY KEY); CREATE TABLE custom_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);",
		apply(db) { db.exec("CREATE TABLE base(id INTEGER PRIMARY KEY); CREATE TABLE custom_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO custom_meta VALUES ('schema_version', '1');"); },
		verify(db) { requiredTable(db, "base"); requiredTable(db, "custom_meta"); },
	};
	const initial = new DurableSqlite(path);
	runSqliteMigrations(initial, { storeName: "custom", metaTable: "custom_meta", targetVersion: 1, migrations: [first] });
	initial.close();

	const second: SqliteMigration = {
		version: 2,
		name: "forced-failure",
		checksumMaterial: "CREATE TABLE doomed(id INTEGER); fail-after-ddl",
		apply(db) { db.exec("CREATE TABLE doomed(id INTEGER)"); },
		verify() { throw new Error("forced migration failure"); },
	};
	const migrating = new DurableSqlite(path);
	assert.throws(() => runSqliteMigrations(migrating, { storeName: "custom", metaTable: "custom_meta", targetVersion: 2, migrations: [first, second] }), /forced migration failure/);
	assert.equal(Boolean(migrating.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'doomed'").get()), false);
	assert.equal(String((migrating.prepare("SELECT value FROM custom_meta WHERE key = 'schema_version'").get() as Record<string, unknown>).value), "1");
	migrating.close();
	assertBackup(root);
});

function runMigrationChild(moduleUrl: string, path: string): Promise<void> {
	const source = `import { ContinuityStore } from ${JSON.stringify(moduleUrl)}; const store = new ContinuityStore(${JSON.stringify(path)}); store.close();`;
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, ["--input-type=module", "--eval", source], { stdio: ["ignore", "ignore", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += String(chunk); });
		child.on("error", reject);
		child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`migration child exited ${code}: ${stderr}`)));
	});
}

test("two processes opening one RC2 store converge on one valid v2 schema", async () => {
	const root = temporaryDirectory("migration-concurrency");
	const path = join(root, "state.sqlite");
	createV1(path, CONTINUITY_V1).close();
	chmodSync(path, 0o600);
	const moduleUrl = pathToFileURL(resolve(".test-build/src/infrastructure/continuity-store.js")).href;
	await Promise.all([runMigrationChild(moduleUrl, path), runMigrationChild(moduleUrl, path)]);
	const store = new ContinuityStore(path);
	assert.equal(String((store.db.prepare("SELECT value FROM continuity_meta WHERE key = 'schema_version'").get() as Record<string, unknown>).value), "2");
	assert.equal((store.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as Record<string, unknown>).count, 2);
	store.close();
});

test("a non-empty database without recognized metadata is never adopted as fresh", () => {
	const root = temporaryDirectory("migration-unrecognized-v0");
	const path = join(root, "state.sqlite");
	const db = new DatabaseSync(path);
	db.exec("CREATE TABLE foreign_application_state(id INTEGER PRIMARY KEY)");
	db.close();
	assert.throws(() => new ContinuityStore(path), /existing schema objects but no recognized schema version/);
	assert.equal(readdirSync(root).includes("backups"), false);
});

test("a near-v1 schema with unexpected objects or altered definitions is rejected", () => {
	const root = temporaryDirectory("migration-near-v1");
	const extraPath = join(root, "extra.sqlite");
	const extra = createV1(extraPath, CONTINUITY_V1);
	extra.exec("CREATE TABLE injected_authority(id TEXT PRIMARY KEY)");
	extra.close();
	assert.throws(() => new ContinuityStore(extraPath), /schema definition|Unexpected SQLite schema/);

	const alteredPath = join(root, "altered.sqlite");
	const alteredSql = CONTINUITY_V1.replace("trusted INTEGER NOT NULL", "trusted TEXT NOT NULL");
	createV1(alteredPath, alteredSql).close();
	assert.throws(() => new ContinuityStore(alteredPath), /schema definition/);
});
