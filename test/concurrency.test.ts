import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import test from "node:test";

import { MemoryStore } from "../src/infrastructure/memory-store.js";
import { temporaryDirectory } from "./helpers.js";

function runWriter(moduleUrl: string, database: string, prefix: string, count: number): Promise<void> {
	const source = `
import { MemoryStore } from ${JSON.stringify(moduleUrl)};
const store = new MemoryStore(${JSON.stringify(database)});
for (let i = 0; i < ${count}; i += 1) {
  store.addPublished({
    id: ${JSON.stringify(prefix)} + '-' + String(i).padStart(4, '0'),
    scope: 'session', scopeKey: 'shared', content: ${JSON.stringify(prefix)} + ':' + i,
    citation: 'concurrency-proof', sourceSessionKey: ${JSON.stringify(prefix)}, sourceHash: String(i)
  });
}
store.close();
`;
	return new Promise((resolvePromise, reject) => {
		const child = spawn(process.execPath, ["--input-type=module", "--eval", source], { stdio: ["ignore", "pipe", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += String(chunk); });
		child.on("error", reject);
		child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`writer ${prefix} exited ${code}: ${stderr}`)));
	});
}

test("two Node/Pi processes sharing one store lose no records and surface no SQLITE_BUSY", async () => {
	const root = temporaryDirectory("concurrency");
	const database = join(root, "memory.sqlite");
	const moduleUrl = pathToFileURL(resolve(".test-build/src/infrastructure/memory-store.js")).href;
	await Promise.all([
		runWriter(moduleUrl, database, "process-a", 150),
		runWriter(moduleUrl, database, "process-b", 150),
	]);
	const store = new MemoryStore(database);
	const records = store.list([{ scope: "session", scopeKey: "shared" }], 500);
	assert.equal(records.length, 300);
	assert.equal(new Set(records.map((record) => record.id)).size, 300);
	store.close();
});
