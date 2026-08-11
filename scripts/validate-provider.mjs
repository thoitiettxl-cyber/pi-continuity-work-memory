import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = resolve(import.meta.dirname, "..");
const model = process.env.PI_PROVIDER_PROOF_MODEL;
const agentDir = process.env.PI_PROVIDER_PROOF_AGENT_DIR || process.env.PI_CODING_AGENT_DIR;
const localPi = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "pi.cmd" : "pi");
const pi = process.env.PI_PROVIDER_PROOF_PI || (existsSync(localPi) ? localPi : "pi");

function report(status, reason, extra = {}) {
	process.stdout.write(`${JSON.stringify({ status, reason, ...extra })}\n`);
}

if (!model || !agentDir) {
	report("DEFERRED", "Set PI_PROVIDER_PROOF_MODEL and PI_PROVIDER_PROOF_AGENT_DIR to a credential-configured Pi 0.84.1 environment");
	process.exit(0);
}

const version = spawnSync(pi, ["--version"], { encoding: "utf8" });
if (version.status !== 0 || version.stdout.trim() !== "0.84.1") {
	report("DEFERRED", "Pi 0.84.1 is not available for the real-provider proof");
	process.exit(0);
}

const proofRoot = mkdtempSync(join(tmpdir(), "pi-real-provider-proof-"));
const workspace = join(proofRoot, "workspace");
const sessionDir = join(proofRoot, "sessions");
const memoryRoot = join(proofRoot, "memory");
const continuityRoot = join(proofRoot, "continuity");
mkdirSync(workspace, { recursive: true });
mkdirSync(sessionDir, { recursive: true });
writeFileSync(join(workspace, "package.json"), '{"scripts":{"test":"node --test"}}\n', "utf8");
mkdirSync(join(workspace, "test"), { recursive: true });
writeFileSync(join(workspace, "test", "proof.test.mjs"), 'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("provider proof", () => assert.equal(2 + 2, 4));\n', "utf8");
for (const args of [["init", "-q"], ["config", "user.email", "proof@example.invalid"], ["config", "user.name", "Proof"], ["add", "package.json", "test/proof.test.mjs"], ["commit", "-qm", "initial"]]) {
	const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8" });
	if (result.status !== 0) {
		report("DEFERRED", "Git could not initialize the provider-proof workspace");
		process.exit(0);
	}
}

const environment = {
	...process.env,
	PI_CODING_AGENT_DIR: agentDir,
	PI_CODING_AGENT_SESSION_DIR: sessionDir,
	PI_CONTINUITY_HOME: continuityRoot,
	PI_WORK_MEMORY_HOME: memoryRoot,
};

const auth = spawnSync(pi, ["auth", "check", "--model", model, "--json", "--no-refresh"], {
	encoding: "utf8",
	env: environment,
});
let authStatus;
try {
	authStatus = JSON.parse(auth.stdout.trim());
} catch {
	authStatus = undefined;
}
if (auth.status !== 0 || authStatus?.status !== "ready") {
	report("DEFERRED", "The configured Pi model does not currently have a usable credential", { model });
	rmSync(proofRoot, { recursive: true, force: true });
	process.exit(0);
}

function runRpc() {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(pi, [
			"--mode", "rpc",
			"--approve",
			"--model", model,
			"--extension", resolve(root, "dist", "extension.js"),
			"--session-dir", sessionDir,
		], { cwd: workspace, env: environment, stdio: ["pipe", "pipe", "pipe"] });
		let buffer = "";
		let stderr = "";
		let sentPipeline = false;
		let finished = false;
		const timer = setTimeout(() => finish(new Error("provider proof timed out")), 45 * 60_000);
		function finish(error) {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			child.kill("SIGTERM");
			if (error) reject(error);
			else resolvePromise();
		}
		child.stderr.on("data", (chunk) => { stderr += String(chunk); });
		child.on("error", finish);
		child.on("exit", (code) => {
			if (!finished) finish(new Error(`Pi RPC exited ${code}: ${stderr.slice(-1_000)}`));
		});
		child.stdout.on("data", (chunk) => {
			buffer += String(chunk);
			for (;;) {
				const newline = buffer.indexOf("\n");
				if (newline < 0) break;
				const line = buffer.slice(0, newline);
				buffer = buffer.slice(newline + 1);
				if (!line.trim()) continue;
				let value;
				try { value = JSON.parse(line); } catch { continue; }
				if (value.type !== "response") continue;
				if (value.id === "seed" && value.success && !sentPipeline) {
					sentPipeline = true;
					child.stdin.write(`${JSON.stringify({ id: "pipeline", type: "prompt", message: "/memory run" })}\n`);
				} else if (value.id === "pipeline") {
					finish(value.success ? undefined : new Error("/memory run command failed"));
				}
			}
		});
		child.stdin.write(`${JSON.stringify({
			id: "seed",
			type: "bash",
			command: "npm test",
		})}\n`);
	});
}

try {
	try {
		await runRpc();
	} catch {
		report("FAIL", "Credential was ready, but the real provider proof could not complete Stage 1 and Stage 2", { model });
		rmSync(proofRoot, { recursive: true, force: true });
		process.exit(1);
	}
	const databasePath = join(memoryRoot, "memory.sqlite");
	if (!existsSync(databasePath)) {
		report("DEFERRED", "The memory pipeline did not create a store", { model });
		process.exit(0);
	}
	const db = new DatabaseSync(databasePath);
	const run = db.prepare("SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT 1").get();
	if (!run || run.status === "deferred") {
		db.close();
		report("DEFERRED", "Provider/model credential or transport was unavailable", { model });
		process.exit(0);
	}
	if (run.status !== "published" || Number(run.stage2_baselines) < 1 || Number(run.stage1_records) < 1) {
		db.close();
		report("FAIL", "Stage 1 or Stage 2 did not publish a non-empty real-provider result", {
			model,
			pipelineStatus: run.status,
			pipelineReason: String(run.reason || "unknown"),
			stage1Records: Number(run.stage1_records),
			stage2Baselines: Number(run.stage2_baselines),
		});
		process.exit(1);
	}
	const usage = JSON.parse(String(run.usage_json));
	if (!(usage.inputTokens > 0) || !(usage.outputTokens > 0)) {
		db.close();
		report("FAIL", "Provider usage accounting is empty", { model });
		process.exit(1);
	}
	const record = db.prepare("SELECT id FROM memory_records WHERE status = 'published' ORDER BY created_at LIMIT 1").get();
	if (!record) {
		db.close();
		report("FAIL", "Stage 1 published no citable memory", { model });
		process.exit(1);
	}
	db.prepare("INSERT INTO citation_usage(id, memory_id, session_key, created_at) VALUES (?, ?, ?, ?)")
		.run(crypto.randomUUID(), record.id, "provider-proof", Date.now());
	db.prepare("UPDATE memory_records SET usage_count = usage_count + 1 WHERE id = ?").run(record.id);
	const cited = db.prepare("SELECT usage_count FROM memory_records WHERE id = ?").get(record.id);
	const sensitiveRows = [
		...db.prepare("SELECT content AS text FROM memory_records UNION ALL SELECT citation AS text FROM memory_records").all(),
		...db.prepare("SELECT content AS text FROM memory_baselines").all(),
	];
	db.close();
	const secretPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat|glpat|xox[baprs])-[-A-Za-z0-9_]{12,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i;
	if (sensitiveRows.some((row) => secretPattern.test(String(row.text)))) {
		report("FAIL", "A secret-like value appeared in published memory", { model });
		process.exit(1);
	}
	if (Number(cited.usage_count) < 1) {
		report("FAIL", "Citation usage accounting did not increment", { model });
		process.exit(1);
	}
	report("PASS", "Stage 1, Stage 2, published baseline, citation, usage, and secret hygiene verified with the configured real provider", {
		model,
		stage1Records: Number(run.stage1_records),
		stage2Baselines: Number(run.stage2_baselines),
		usageAccounted: true,
		citationAccounted: true,
	});
} finally {
	rmSync(proofRoot, { recursive: true, force: true });
}
