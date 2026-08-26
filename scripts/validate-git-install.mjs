import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { SUPPORTED_PI_RANGE, assertSupportedPiVersion } from "./pi-version.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const proofRoot = mkdtempSync(join(tmpdir(), "pi-git-install-proof-"));
const seedRoot = join(proofRoot, "seed");
const daemonRoot = join(proofRoot, "git-daemon");
const bareRoot = join(daemonRoot, "owner", "pi-continuity-work-memory.git");
const agentDir = join(proofRoot, "agent");
const workspace = join(proofRoot, "workspace");
const sessionDir = join(proofRoot, "sessions");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const piCandidate = resolve(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "pi.cmd" : "pi");
const pi = process.env.PI_VALIDATION_PI || (existsSync(piCandidate) ? piCandidate : "pi");
let gitServer;

function fail(message) {
	throw new Error(message);
}

function run(command, args, cwd, environment = process.env) {
	const result = spawnSync(command, args, {
		cwd,
		env: environment,
		encoding: "utf8",
		timeout: 10 * 60_000,
	});
	if (result.status !== 0) fail(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
	return result.stdout;
}


function runAsync(command, args, cwd, environment = process.env) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, { cwd, env: environment, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => child.kill("SIGTERM"), 10 * 60_000);
		child.stdout.on("data", (chunk) => { stdout += String(chunk); });
		child.stderr.on("data", (chunk) => { stderr += String(chunk); });
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("exit", (code, signal) => {
			clearTimeout(timer);
			if (code === 0) resolvePromise(stdout);
			else reject(new Error(`${command} ${args.join(" ")} failed (${code ?? signal}):\n${stdout}\n${stderr}`));
		});
	});
}
function copySource(relativePath) {
	const source = resolve(projectRoot, relativePath);
	if (!existsSync(source)) fail(`Git install source is missing: ${relativePath}`);
	const target = resolve(seedRoot, relativePath);
	mkdirSync(dirname(target), { recursive: true });
	cpSync(source, target, { recursive: true });
}

function startGitServer() {
	gitServer = createServer((request, response) => {
		try {
			if (request.method !== "GET" && request.method !== "HEAD") {
				response.writeHead(405).end();
				return;
			}
			const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
			const path = resolve(daemonRoot, pathname.replace(/^\/+/, ""));
			if (path !== resolve(daemonRoot) && !path.startsWith(`${resolve(daemonRoot)}/`)) {
				response.writeHead(403).end();
				return;
			}
			if (!existsSync(path) || !statSync(path).isFile()) {
				response.writeHead(404).end();
				return;
			}
			const bytes = readFileSync(path);
			response.writeHead(200, { "Content-Length": bytes.length, "Content-Type": "application/octet-stream" });
			response.end(request.method === "HEAD" ? undefined : bytes);
		} catch (error) {
			response.writeHead(500).end(error instanceof Error ? error.message : String(error));
		}
	});
	return new Promise((resolvePromise, reject) => {
		gitServer.once("error", reject);
		gitServer.listen(0, "127.0.0.1", () => {
			const address = gitServer.address();
			if (!address || typeof address === "string") reject(new Error("Could not start the loopback Git server"));
			else resolvePromise(address.port);
		});
	});
}

function rpcCommands(environment) {
	return new Promise((resolvePromise, reject) => {
		const child = spawn(pi, ["--mode", "rpc", "--approve", "--offline", "--session-dir", sessionDir], {
			cwd: workspace,
			env: environment,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = (error, commands) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (!child.killed) child.kill("SIGTERM");
			if (error) reject(error);
			else resolvePromise(commands);
		};
		child.stderr.on("data", (chunk) => { stderr += String(chunk); });
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
			for (;;) {
				const newline = stdout.indexOf("\n");
				if (newline < 0) break;
				const line = stdout.slice(0, newline);
				stdout = stdout.slice(newline + 1);
				if (!line.trim()) continue;
				try {
					const response = JSON.parse(line);
					if (response.type === "response" && response.id === "commands") {
						finish(undefined, response.data?.commands ?? []);
						return;
					}
				} catch {
					finish(new Error(`Non-JSON Pi RPC output: ${line}`));
					return;
				}
			}
		});
		child.once("error", (error) => finish(error));
		child.once("exit", (code) => {
			if (!settled) finish(new Error(`Pi RPC exited ${code} before command discovery: ${stderr}`));
		});
		const timer = setTimeout(() => finish(new Error(`Pi RPC timeout: ${stderr}`)), 30_000);
		child.stdin.write(`${JSON.stringify({ id: "commands", type: "get_commands" })}\n`);
	});
}

function assertCommands(commands, checkoutRoot) {
	const names = new Set(commands.map((command) => command.name));
	if (!names.has("continuity") || !names.has("memory")) fail("Git-installed extension commands were not discovered");
	for (const skill of manifest.pi?.skills ?? []) {
		const name = `skill:${skill.split("/").at(-1)}`;
		const command = commands.find((candidate) => candidate.name === name);
		if (!command) fail(`Git-installed skill command is missing: ${name}`);
		if (!resolve(String(command.sourceInfo?.path || "")).startsWith(`${checkoutRoot}/`)) {
			fail(`Git-installed skill did not load from Pi's managed checkout: ${name}`);
		}
	}
}

try {
	if (manifest.scripts?.prepare !== "npm run build:git-install") fail("Git installs require prepare to emit the package runtime");
	if (JSON.stringify(manifest.dependencies) !== JSON.stringify({ typescript: "5.9.3" })) {
		fail("Git installs require exactly the pinned build-only dependencies");
	}
	if (!Array.isArray(manifest.files)) fail("package.json files must define the install payload");

	for (const relativePath of [
		"package.json",
		"package-lock.json",
		"tsconfig.json",
		"tsconfig.build.json",
		"tsconfig.git-install.json",
		"src",
		...manifest.files.filter((entry) => entry !== "dist"),
	]) copySource(relativePath);
	if (existsSync(resolve(seedRoot, "dist"))) fail("Git install proof must start without generated dist output");

	run("git", ["init", "-q"], seedRoot);
	run("git", ["config", "user.email", "proof@example.invalid"], seedRoot);
	run("git", ["config", "user.name", "Git install proof"], seedRoot);
	run("git", ["add", "."], seedRoot);
	run("git", ["commit", "-qm", "git install proof"], seedRoot);
	mkdirSync(dirname(bareRoot), { recursive: true });
	run("git", ["clone", "-q", "--bare", seedRoot, bareRoot], proofRoot);
	run("git", ["update-server-info"], bareRoot);

	const port = await startGitServer();

	mkdirSync(workspace, { recursive: true });
	writeFileSync(resolve(workspace, "README.md"), "Git install proof workspace\n", "utf8");
	writeFileSync(resolve(workspace, "AGENTS.md"), "# Git install proof instructions\n", "utf8");
	run("git", ["init", "-q"], workspace);
	run("git", ["config", "user.email", "proof@example.invalid"], workspace);
	run("git", ["config", "user.name", "Git install proof"], workspace);
	run("git", ["add", "README.md", "AGENTS.md"], workspace);
	run("git", ["commit", "-qm", "initial"], workspace);

	const source = `git:http://127.0.0.1:${port}/owner/pi-continuity-work-memory.git`;
	const environment = {
		...process.env,
		HOME: join(proofRoot, "home"),
		PI_CODING_AGENT_DIR: agentDir,
		PI_CONTINUITY_HOME: join(proofRoot, "continuity"),
		PI_WORK_MEMORY_HOME: join(proofRoot, "memory"),
		PI_OFFLINE: "0",
		npm_config_cache: join(proofRoot, "npm-cache"),
	};
	await runAsync(pi, ["install", source], workspace, environment);
	const checkoutRoot = resolve(agentDir, "git", "127.0.0.1", "owner", "pi-continuity-work-memory");
	const entrypoint = resolve(checkoutRoot, "dist", "extension.js");
	if (!existsSync(entrypoint)) fail("Pi Git install did not generate dist/extension.js");
	assertCommands(await rpcCommands({ ...environment, PI_OFFLINE: "1" }), checkoutRoot);

	writeFileSync(resolve(seedRoot, "git-update-proof.txt"), "updated\n", "utf8");
	run("git", ["add", "git-update-proof.txt"], seedRoot);
	run("git", ["commit", "-qm", "update proof"], seedRoot);
	run("git", ["push", "-q", bareRoot, "HEAD"], seedRoot);
	run("git", ["update-server-info"], bareRoot);
	writeFileSync(resolve(checkoutRoot, "dist", "stale-before-update"), "must be cleaned\n", "utf8");
	await runAsync(pi, ["update", "--extensions"], workspace, environment);
	if (!existsSync(entrypoint)) fail("Pi Git update did not regenerate dist/extension.js");
	if (existsSync(resolve(checkoutRoot, "dist", "stale-before-update"))) fail("Pi Git update did not clean stale generated output");
	if (!existsSync(resolve(checkoutRoot, "git-update-proof.txt"))) fail("Pi Git update did not move the managed checkout to the new commit");
	assertCommands(await rpcCommands({ ...environment, PI_OFFLINE: "1" }), checkoutRoot);

	const piVersion = assertSupportedPiVersion(run(pi, ["--version"], workspace, environment));
	process.stdout.write(`${JSON.stringify({
		status: "PASS",
		pi: piVersion,
		piRange: SUPPORTED_PI_RANGE,
		gitSource: true,
		managedCheckout: true,
		defaultOmitDevInstall: true,
		prepareBuild: true,
		generatedEntrypoint: true,
		isolatedPiLoad: true,
		gitUpdateRebuild: true,
	})}\n`);
} finally {
	gitServer?.closeAllConnections();
	gitServer?.close();
	rmSync(proofRoot, { recursive: true, force: true });
}
