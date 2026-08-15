import { createHash, randomUUID } from "node:crypto";
import {
	chmodSync,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { canonicalJson, sha256 } from "../domain/canonical.js";
import { DurableSqlite, asNumber } from "./sqlite.js";

export interface SqliteMigration {
	version: number;
	name: string;
	checksumMaterial: string;
	apply(db: DurableSqlite): void;
	verify(db: DurableSqlite): void;
}

export interface MigrationConfig {
	storeName: string;
	metaTable: string;
	targetVersion: number;
	migrations: readonly SqliteMigration[];
}

export interface MigrationResult {
	fromVersion: number;
	toVersion: number;
	backupPath: string | null;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteSqlString(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function tableExists(db: DurableSqlite, table: string): boolean {
	return Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(table));
}

function currentVersion(db: DurableSqlite, metaTable: string): number {
	if (!tableExists(db, metaTable)) return 0;
	const row = db.prepare(`SELECT value FROM ${metaTable} WHERE key = 'schema_version'`).get() as Record<string, unknown> | undefined;
	if (!row) throw new Error(`${metaTable} is missing schema_version`);
	const raw = String(row.value);
	if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${metaTable} schema_version: ${raw}`);
	const version = Number(raw);
	if (!Number.isSafeInteger(version) || version < 0) throw new Error(`Invalid ${metaTable} schema_version: ${raw}`);
	return version;
}

function migrationChecksum(storeName: string, migration: SqliteMigration): string {
	return sha256(`${storeName}:migration:${migration.version}:${migration.name}\n${migration.checksumMaterial}`);
}

function validateMigrationPlan(config: MigrationConfig): SqliteMigration[] {
	if (!IDENTIFIER.test(config.metaTable)) throw new Error(`Unsafe migration meta table: ${config.metaTable}`);
	if (!Number.isSafeInteger(config.targetVersion) || config.targetVersion < 1) throw new Error("Migration target version must be positive");
	const migrations = [...config.migrations].sort((left, right) => left.version - right.version);
	if (migrations.length !== config.targetVersion) {
		throw new Error(`${config.storeName} migration plan must contain exactly versions 1..${config.targetVersion}`);
	}
	for (let index = 0; index < migrations.length; index += 1) {
		const expected = index + 1;
		if (migrations[index]?.version !== expected) throw new Error(`${config.storeName} migration gap at version ${expected}`);
	}
	return migrations;
}

function sha256File(path: string): string {
	const digest = createHash("sha256");
	const buffer = Buffer.allocUnsafe(64 * 1024);
	const descriptor = openSync(path, "r");
	try {
		for (;;) {
			const count = readSync(descriptor, buffer, 0, buffer.length, null);
			if (count === 0) break;
			digest.update(buffer.subarray(0, count));
		}
	} finally {
		closeSync(descriptor);
	}
	return digest.digest("hex");
}

function createBackup(db: DurableSqlite, fromVersion: number, toVersion: number): string {
	const backupDirectory = join(dirname(db.path), "backups");
	mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
	chmodSync(backupDirectory, 0o700);
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = join(
		backupDirectory,
		`${basename(db.path)}.v${fromVersion}-to-v${toVersion}.${stamp}.${randomUUID()}.sqlite`,
	);
	if (existsSync(backupPath)) throw new Error(`Migration backup already exists: ${backupPath}`);
	db.exec("PRAGMA wal_checkpoint(FULL)");
	db.exec(`VACUUM INTO ${quoteSqlString(backupPath)}`);
	chmodSync(backupPath, 0o600);
	const digest = sha256File(backupPath);
	const sidecar = `${backupPath}.sha256`;
	writeFileSync(sidecar, `${digest}  ${basename(backupPath)}\n`, { mode: 0o600, flag: "wx" });
	chmodSync(sidecar, 0o600);
	if (sha256File(backupPath) !== digest) throw new Error(`Migration backup verification failed: ${backupPath}`);
	return backupPath;
}

function schemaDigest(db: DurableSqlite): string {
	const rows = db.prepare(`SELECT type, name, tbl_name, COALESCE(sql, '') AS sql
FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name, tbl_name`).all() as Array<Record<string, unknown>>;
	return sha256(canonicalJson(rows.map((row) => ({
		type: String(row.type),
		name: String(row.name),
		table: String(row.tbl_name),
		sql: String(row.sql).replace(/\s+/g, " ").trim(),
	}))));
}

function verifyDatabaseIntegrity(db: DurableSqlite): void {
	const quick = db.prepare("PRAGMA quick_check").all() as Array<Record<string, unknown>>;
	if (quick.length !== 1 || String(Object.values(quick[0] ?? {})[0]) !== "ok") {
		throw new Error(`SQLite quick_check failed for ${db.path}`);
	}
	const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
	if (foreignKeys.length > 0) throw new Error(`SQLite foreign_key_check failed for ${db.path}`);
}

function ensureHistoryTable(db: DurableSqlite): void {
	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at INTEGER NOT NULL
)`);
}

function verifyHistory(
	db: DurableSqlite,
	config: MigrationConfig,
	migrations: readonly SqliteMigration[],
	version: number,
): void {
	if (!tableExists(db, "schema_migrations")) throw new Error(`${config.storeName} schema_migrations is missing`);
	const rows = db.prepare("SELECT version, name, checksum FROM schema_migrations ORDER BY version").all() as Array<Record<string, unknown>>;
	if (rows.length !== version) throw new Error(`${config.storeName} migration history length does not match schema version ${version}`);
	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index]!;
		const migration = migrations[index]!;
		if (asNumber(row.version) !== migration.version || String(row.name) !== migration.name) {
			throw new Error(`${config.storeName} migration history mismatch at version ${migration.version}`);
		}
		if (String(row.checksum) !== migrationChecksum(config.storeName, migration)) {
			throw new Error(`${config.storeName} migration checksum mismatch at version ${migration.version}`);
		}
	}
}

function verifyStoredSchemaDigest(db: DurableSqlite, metaTable: string): void {
	const row = db.prepare(`SELECT value FROM ${metaTable} WHERE key = 'schema_checksum'`).get() as Record<string, unknown> | undefined;
	if (!row) throw new Error(`${metaTable} is missing schema_checksum`);
	const actual = schemaDigest(db);
	if (String(row.value) !== actual) throw new Error(`${metaTable} schema checksum mismatch`);
}

export function runSqliteMigrations(db: DurableSqlite, config: MigrationConfig): MigrationResult {
	const migrations = validateMigrationPlan(config);
	const initialVersion = currentVersion(db, config.metaTable);
	if (initialVersion === 0) {
		const existingObjects = db.prepare("SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<Record<string, unknown>>;
		if (existingObjects.length > 0) {
			throw new Error(`${config.storeName} database has existing schema objects but no recognized schema version`);
		}
	}
	if (initialVersion > config.targetVersion) {
		throw new Error(`${config.storeName} database schema ${initialVersion} is newer than supported ${config.targetVersion}`);
	}
	const hasHistory = tableExists(db, "schema_migrations");
	if (initialVersion > 1 && !hasHistory) {
		throw new Error(`${config.storeName} schema ${initialVersion} has no migration history`);
	}
	if (initialVersion > 0) migrations[initialVersion - 1]!.verify(db);
	if (hasHistory) verifyHistory(db, config, migrations, initialVersion);
	if (initialVersion === config.targetVersion && hasHistory) {
		verifyStoredSchemaDigest(db, config.metaTable);
		verifyDatabaseIntegrity(db);
		return { fromVersion: initialVersion, toVersion: initialVersion, backupPath: null };
	}

	const backupPath = initialVersion > 0 ? createBackup(db, initialVersion, config.targetVersion) : null;
	db.transaction(() => {
		let version = currentVersion(db, config.metaTable);
		if (version > config.targetVersion) {
			throw new Error(`${config.storeName} database schema ${version} is newer than supported ${config.targetVersion}`);
		}
		if (version > 0) migrations[version - 1]!.verify(db);
		const historyExists = tableExists(db, "schema_migrations");
		if (version > 1 && !historyExists) throw new Error(`${config.storeName} schema ${version} has no migration history`);
		ensureHistoryTable(db);
		if (!historyExists && version === 1) {
			const baseline = migrations[0]!;
			baseline.verify(db);
			db.prepare("INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)")
				.run(1, baseline.name, migrationChecksum(config.storeName, baseline), Date.now());
		}
		for (const migration of migrations.slice(version)) {
			migration.apply(db);
			migration.verify(db);
			db.prepare("INSERT INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)")
				.run(migration.version, migration.name, migrationChecksum(config.storeName, migration), Date.now());
			db.prepare(`INSERT INTO ${config.metaTable}(key, value) VALUES ('schema_version', ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(migration.version));
			version = migration.version;
		}
		if (version !== config.targetVersion) throw new Error(`${config.storeName} migration stopped at version ${version}`);
		const digest = schemaDigest(db);
		db.prepare(`INSERT INTO ${config.metaTable}(key, value) VALUES ('schema_checksum', ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(digest);
		verifyHistory(db, config, migrations, version);
	});

	migrations[config.targetVersion - 1]!.verify(db);
	verifyHistory(db, config, migrations, config.targetVersion);
	verifyStoredSchemaDigest(db, config.metaTable);
	verifyDatabaseIntegrity(db);
	return { fromVersion: initialVersion, toVersion: config.targetVersion, backupPath };
}

export function requiredTable(db: DurableSqlite, table: string): void {
	if (!tableExists(db, table)) throw new Error(`Required SQLite table is missing: ${table}`);
}

export function requiredColumns(db: DurableSqlite, table: string, columns: readonly string[]): void {
	requiredTable(db, table);
	const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<Record<string, unknown>>;
	const actual = new Set(rows.map((row) => String(row.name)));
	for (const column of columns) if (!actual.has(column)) throw new Error(`Required SQLite column is missing: ${table}.${column}`);
}

export function requiredIndex(db: DurableSqlite, index: string): void {
	const row = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = ?").get(index);
	if (!row) throw new Error(`Required SQLite index is missing: ${index}`);
}

export function requiredExactColumns(db: DurableSqlite, table: string, columns: readonly string[]): void {
	requiredTable(db, table);
	const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<Record<string, unknown>>;
	const actual = rows.map((row) => String(row.name));
	if (canonicalJson(actual) !== canonicalJson(columns)) {
		throw new Error(`SQLite columns do not match the supported schema for ${table}`);
	}
}

export function requiredOnlySchemaObjects(db: DurableSqlite, allowedNames: readonly string[]): void {
	const rows = db.prepare("SELECT name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<Record<string, unknown>>;
	const actual = rows.map((row) => String(row.name));
	const allowed = new Set(allowedNames);
	const unexpected = actual.filter((name) => !allowed.has(name));
	if (unexpected.length > 0) throw new Error(`Unexpected SQLite schema objects: ${unexpected.join(", ")}`);
}

export function requiredIndexColumns(db: DurableSqlite, index: string, columns: readonly string[]): void {
	requiredIndex(db, index);
	const rows = db.prepare(`PRAGMA index_info(${index})`).all() as Array<Record<string, unknown>>;
	const actual = rows.map((row) => String(row.name));
	if (canonicalJson(actual) !== canonicalJson(columns)) {
		throw new Error(`SQLite index columns do not match the supported schema for ${index}`);
	}
}

export interface RequiredForeignKey {
	from: string;
	table: string;
	to: string;
	onDelete?: string;
}

export function requiredForeignKeys(db: DurableSqlite, table: string, expected: readonly RequiredForeignKey[]): void {
	requiredTable(db, table);
	const rows = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<Record<string, unknown>>;
	const actual = rows.map((row) => ({
		from: String(row.from),
		table: String(row.table),
		to: String(row.to),
		onDelete: String(row.on_delete),
	})).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
	const normalizedExpected = expected.map((item) => ({
		from: item.from,
		table: item.table,
		to: item.to,
		onDelete: item.onDelete ?? "NO ACTION",
	})).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
	if (canonicalJson(actual) !== canonicalJson(normalizedExpected)) {
		throw new Error(`SQLite foreign keys do not match the supported schema for ${table}`);
	}
}

function normalizedSchemaProjection(database: DatabaseSync, ignoredNames: ReadonlySet<string>): Array<Record<string, string>> {
	const rows = database.prepare(`SELECT type, name, tbl_name, COALESCE(sql, '') AS sql
FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name, tbl_name`).all() as Array<Record<string, unknown>>;
	return rows
		.filter((row) => !ignoredNames.has(String(row.name)))
		.map((row) => ({
			type: String(row.type),
			name: String(row.name),
			table: String(row.tbl_name),
			sql: String(row.sql).replace(/\s+/g, ""),
		}));
}

export function requiredSchemaMatchesSql(db: DurableSqlite, sql: string, ignoredNames: readonly string[] = []): void {
	const expected = new DatabaseSync(":memory:");
	try {
		expected.exec("PRAGMA foreign_keys = ON");
		expected.exec(sql);
		const ignored = new Set(ignoredNames);
		const actualProjection = normalizedSchemaProjection(db.database, ignored);
		const expectedProjection = normalizedSchemaProjection(expected, ignored);
		if (canonicalJson(actualProjection) !== canonicalJson(expectedProjection)) {
			throw new Error("SQLite schema definition does not match the supported released schema");
		}
	} finally {
		expected.close();
	}
}
