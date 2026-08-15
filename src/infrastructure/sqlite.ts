import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

const BUSY_ATTEMPTS = 8;
const BUSY_SLEEP = new Int32Array(new SharedArrayBuffer(4));

function isBusy(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const code = (error as Error & { code?: string }).code;
	return code === "ERR_SQLITE_BUSY" || code === "SQLITE_BUSY" || /SQLITE_BUSY|database is locked/i.test(error.message);
}

function retryBusy<T>(operation: () => T): T {
	let delay = 8;
	for (let attempt = 0; ; attempt += 1) {
		try {
			return operation();
		} catch (error) {
			if (!isBusy(error) || attempt >= BUSY_ATTEMPTS - 1) throw error;
			Atomics.wait(BUSY_SLEEP, 0, 0, delay);
			delay = Math.min(delay * 2, 200);
		}
	}
}

export class DurableSqlite {
	readonly database: DatabaseSync;
	private closed = false;

	constructor(readonly path: string) {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		this.database = new DatabaseSync(path);
		retryBusy(() => {
			this.database.exec("PRAGMA busy_timeout = 5000");
			this.database.exec("PRAGMA journal_mode = WAL");
			this.database.exec("PRAGMA synchronous = FULL");
			this.database.exec("PRAGMA foreign_keys = ON");
			this.database.exec("PRAGMA wal_autocheckpoint = 1000");
		});
	}

	exec(sql: string): void {
		this.assertOpen();
		retryBusy(() => this.database.exec(sql));
	}

	prepare(sql: string): StatementSync {
		this.assertOpen();
		return this.database.prepare(sql);
	}

	transaction<T>(operation: () => T): T {
		this.assertOpen();
		return retryBusy(() => {
			this.database.exec("BEGIN IMMEDIATE");
			try {
				const result = operation();
				this.database.exec("COMMIT");
				return result;
			} catch (error) {
				try {
					this.database.exec("ROLLBACK");
				} catch {
					// Preserve the original error. Recovery happens when the DB reopens.
				}
				throw error;
			}
		});
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		retryBusy(() => this.database.close());
	}

	private assertOpen(): void {
		if (this.closed) throw new Error(`SQLite store is closed: ${this.path}`);
	}
}

export function asNumber(value: unknown): number {
	return typeof value === "bigint" ? Number(value) : Number(value);
}
