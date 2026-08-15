// RECONSTRUCTED baseline: restores the canonical rc.1 real npm-test provider proof before P0 hardening.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SUPPORTED_PI_RANGE, assertSupportedPiVersion } from "./pi-version.mjs";

const root = resolve(import.meta.dirname, "..");
const model = process.env.PI_PROVIDER_PROOF_MODEL;
const agentDir = process.env.PI_PROVIDER_PROOF_AGENT_DIR || process.env.PI_CODING_AGENT_DIR;
const localPi = resolve(root, "node_modules", ".bin", process.platform === "win32" ? "pi.cmd" : "pi");
const pi = process.env.PI_PROVIDER_PROOF_PI || (existsSync(localPi) ? localPi : "pi");

let piVersion;

function safeDiagnostic(error, privatePaths = []) {
	let value = error instanceof Error ? error.message : String(error);
	value = value
		.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, "[REDACTED]")
		.replace(/\b(?:sk|rk|pk)-[-A-Za-z0-9_]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\b(?:glpat|xox[baprs])-[-A-Za-z0-9_]{12,}|\bgsk_[A-Za-z0-9]{20,}|\bnpm_[A-Za-z0-9]{20,}|\bya29\.[A-Za-z0-9._-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b/gi, "[REDACTED]")
		.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
		.replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|token)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
	for (const privatePath of privatePaths) {
		if (privatePath) value = value.replaceAll(privatePath, "[private-path]");
	}
	return value.slice(-1_000);
}

function report(status, reason, extra = {}) {
	process.stdout.write(`${JSON.stringify({
		status,
		reason,
		...(piVersion ? { pi: piVersion } : {}),
		piRange: SUPPORTED_PI_RANGE,
		...extra,
	})}\n`);
}

class ProofStop extends Error {
	constructor(exitCode) {
		super("provider proof stopped after reporting a terminal result");
		this.exitCode = exitCode;
	}
}

function stop(status, reason, extra = {}, exitCode = 0) {
	report(status, reason, extra);
	throw new ProofStop(exitCode);
}

const version = spawnSync(pi, ["--version"], { encoding: "utf8" });
try {
	if (version.status !== 0) throw new Error(version.stderr || version.stdout || "Pi version command failed");
	piVersion = assertSupportedPiVersion(version.stdout);
} catch (error) {
	report("DEFERRED", error instanceof Error ? error.message : String(error));
	process.exit(0);
}

if (!model || !agentDir) {
	report("DEFERRED", `Set PI_PROVIDER_PROOF_MODEL and PI_PROVIDER_PROOF_AGENT_DIR to a credential-configured Pi ${SUPPORTED_PI_RANGE} environment`);
	process.exit(0);
}

const proofRoot = mkdtempSync(join(tmpdir(), "pi-real-provider-proof-"));
const workspace = join(proofRoot, "workspace");
const sessionDir = join(proofRoot, "sessions");
const memoryRoot = join(proofRoot, "memory");
const continuityRoot = join(proofRoot, "continuity");
let proofExitCode = 0;
try {
	mkdirSync(workspace, { recursive: true });
	mkdirSync(sessionDir, { recursive: true });
	writeFileSync(join(workspace, "package.json"), '{"scripts":{"test":"node --test"}}\n', "utf8");
	mkdirSync(join(workspace, "test"), { recursive: true });
	writeFileSync(join(workspace, "test", "proof.test.mjs"), 'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("provider proof", () => assert.equal(2 + 2, 4));\n', "utf8");
	for (const args of [["init", "-q"], ["config", "user.email", "proof@example.invalid"], ["config", "user.name", "Proof"], ["add", "package.json", "test/proof.test.mjs"], ["commit", "-qm", "initial"]]) {
		const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8" });
		if (result.status !== 0) {
			stop("DEFERRED", "Git could not initialize the provider-proof workspace");
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
		stop("DEFERRED", "The configured Pi model does not currently have a usable credential", { model });
	}

	function runRpc() {
		return new Promise((resolvePromise, reject) => {
			const child = spawn(pi, [
				"--mode", "rpc",
				"--approve",
				"--no-extensions",
				"--no-skills",
				"--no-prompt-templates",
				"--no-context-files",
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
			child.stderr.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-4_000); });
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
					if (value.id === "seed") {
						if (!value.success) {
							finish(new Error(`npm test seed failed: ${String(value.error || "RPC command rejected")}`));
						} else if (!sentPipeline) {
							sentPipeline = true;
							child.stdin.write(`${JSON.stringify({ id: "pipeline", type: "prompt", message: "/memory run" })}\n`);
						}
					} else if (value.id === "pipeline") {
						finish(value.success ? undefined : new Error(`/memory run command failed: ${String(value.error || "RPC command rejected")}`));
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
		await runRpc();
	} catch (error) {
		stop("FAIL", "Credential was ready, but the real provider proof could not complete Stage 1 and Stage 2", {
			model,
			diagnostic: safeDiagnostic(error, [proofRoot, agentDir]),
		}, 1);
	}
	const databasePath = join(memoryRoot, "memory.sqlite");
	if (!existsSync(databasePath)) {
		stop("DEFERRED", "The memory pipeline did not create a store", { model });
	}
	const db = new DatabaseSync(databasePath);
	try {
		const run = db.prepare("SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT 1").get();
		if (!run || run.status === "deferred") {
			stop("DEFERRED", "Provider/model credential or transport was unavailable", { model });
		}
		if (run.status !== "published" || Number(run.stage2_baselines) < 1 || Number(run.stage1_records) < 1) {
			stop("FAIL", "Stage 1 or Stage 2 did not publish a non-empty real-provider result", {
				model,
				pipelineStatus: run.status,
				pipelineReason: safeDiagnostic(run.reason || "unknown", [proofRoot, agentDir]),
				stage1Records: Number(run.stage1_records),
				stage2Baselines: Number(run.stage2_baselines),
			}, 1);
		}
		const usage = JSON.parse(String(run.usage_json));
		if (!(usage.inputTokens > 0) || !(usage.outputTokens > 0)) {
			stop("FAIL", "Provider usage accounting is empty", { model }, 1);
		}
		const record = db.prepare("SELECT id FROM memory_records WHERE status = 'published' ORDER BY created_at LIMIT 1").get();
		if (!record) {
			stop("FAIL", "Stage 1 published no citable memory", { model }, 1);
		}
		db.prepare("INSERT INTO citation_usage(id, memory_id, session_key, created_at) VALUES (?, ?, ?, ?)")
			.run(crypto.randomUUID(), record.id, "provider-proof", Date.now());
		db.prepare("UPDATE memory_records SET usage_count = usage_count + 1 WHERE id = ?").run(record.id);
		const cited = db.prepare("SELECT usage_count FROM memory_records WHERE id = ?").get(record.id);
		const sensitiveRows = [
			...db.prepare("SELECT content AS text FROM memory_records UNION ALL SELECT citation AS text FROM memory_records").all(),
			...db.prepare("SELECT content AS text FROM memory_baselines").all(),
		];
		const secretPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|rk|pk)-[-A-Za-z0-9_]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\b(?:glpat|xox[baprs])-[-A-Za-z0-9_]{12,}|\bgsk_[A-Za-z0-9]{20,}|\bnpm_[A-Za-z0-9]{20,}|\bya29\.[A-Za-z0-9._-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b|Bearer\s+[A-Za-z0-9._~+\/-]{12,}/i;
		if (sensitiveRows.some((row) => secretPattern.test(String(row.text)))) {
			stop("FAIL", "A secret-like value appeared in published memory", { model }, 1);
		}
		if (Number(cited?.usage_count) < 1) {
			stop("FAIL", "Citation usage accounting did not increment", { model }, 1);
		}
		report("PASS", "Stage 1, Stage 2, published baseline, citation, usage, and secret hygiene verified with the configured real provider", {
			model,
			stage1Records: Number(run.stage1_records),
			stage2Baselines: Number(run.stage2_baselines),
			usageAccounted: true,
			citationAccounted: true,
		});
	} finally {
		db.close();
	}
} catch (error) {
	if (error instanceof ProofStop) proofExitCode = error.exitCode;
	else {
		report("FAIL", "The real-provider proof encountered an unexpected validation error", {
			model,
			diagnostic: safeDiagnostic(error, [proofRoot, agentDir]),
		});
		proofExitCode = 1;
	}
} finally {
	rmSync(proofRoot, { recursive: true, force: true });
}
if (proofExitCode !== 0) process.exitCode = proofExitCode;
