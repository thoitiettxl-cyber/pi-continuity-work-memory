import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { promisify } from "node:util";

import { FingerprintRaceError, GitFingerprintService, type CommandRunner } from "../src/infrastructure/git-fingerprint.js";
import { FakeCommandRunner, temporaryDirectory } from "./helpers.js";

test("untrusted project performs zero Git commands", async () => {
	const root = temporaryDirectory("untrusted-git");
	const runner = new FakeCommandRunner(root);
	const service = new GitFingerprintService(runner);
	await assert.rejects(service.captureStable(root, false), /untrusted/i);
	assert.equal(runner.commands.length, 0);
});

test("fingerprint race cannot create a stable result", async () => {
	const root = temporaryDirectory("fingerprint-race");
	const runner = new FakeCommandRunner(root);
	runner.race = true;
	const service = new GitFingerprintService(runner);
	await assert.rejects(service.captureStable(root, true), FingerprintRaceError);
});

test("full fingerprint changes when untracked file content changes", async () => {
	const root = temporaryDirectory("fingerprint-untracked");
	const execute = promisify(execFile);
	await execute("git", ["init", "-q"], { cwd: root });
	const runner: CommandRunner = {
		async run(command, args, options) {
			try {
				const result = await execute(command, args, { cwd: options.cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
				return { stdout: result.stdout, stderr: result.stderr, code: 0 };
			} catch (error) {
				const failure = error as Error & { stdout?: string; stderr?: string; code?: number };
				return { stdout: failure.stdout || "", stderr: failure.stderr || failure.message, code: typeof failure.code === "number" ? failure.code : 1 };
			}
		},
	};
	const service = new GitFingerprintService(runner);
	writeFileSync(`${root}/marker.txt`, "first", "utf8");
	const first = await service.captureStable(root, true);
	writeFileSync(`${root}/marker.txt`, "second", "utf8");
	const second = await service.captureStable(root, true);
	assert.notEqual(first.untrackedDigest, second.untrackedDigest);
	assert.notEqual(first.combined, second.combined);
});
