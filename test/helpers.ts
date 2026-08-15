import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BranchContext } from "../src/application/continuity-service.js";
import type { EmbeddedState, SessionIdentity } from "../src/domain/types.js";
import type { CommandResult, CommandRunner } from "../src/infrastructure/git-fingerprint.js";

export function temporaryDirectory(prefix: string): string {
	return mkdtempSync(join(tmpdir(), `pi-continuity-${prefix}-`));
}

export function identity(overrides: Partial<SessionIdentity> = {}): SessionIdentity {
	return {
		sessionId: "session-a",
		sessionFileKey: "file-a",
		sessionKey: "session-a:file-a",
		parentSessionKey: null,
		repositoryId: "repo:a",
		trusted: true,
		...overrides,
	};
}

export function branch(nodeIds: string[], embeddedStates: EmbeddedState[] = []): BranchContext {
	return { nodeIds, currentNodeId: nodeIds.at(-1) || "root", embeddedStates };
}

export class FakeCommandRunner implements CommandRunner {
	version = 1;
	race = false;
	commands: Array<{ command: string; args: string[] }> = [];
	validationCode = 0;
	validationOutput = "validation passed";
	onRun?: (command: string, args: string[]) => void | Promise<void>;
	private statusCalls = 0;

	constructor(readonly root: string) {}

	async run(command: string, args: string[]): Promise<CommandResult> {
		this.commands.push({ command, args: [...args] });
		await this.onRun?.(command, args);
		if (command !== "git") return { stdout: this.validationOutput, stderr: "", code: this.validationCode, killed: false };
		const joined = args.join(" ");
		if (joined === "rev-parse --show-toplevel") return { stdout: `${this.root}\n`, stderr: "", code: 0 };
		if (joined === "rev-parse --verify HEAD") return { stdout: `head-${this.version}\n`, stderr: "", code: 0 };
		if (joined === "symbolic-ref --quiet --short HEAD") return { stdout: "main\n", stderr: "", code: 0 };
		if (joined === "status --porcelain=v2 -z --untracked-files=all") {
			const suffix = this.race ? ++this.statusCalls : this.version;
			return { stdout: `status-${suffix}`, stderr: "", code: 0 };
		}
		if (joined === "diff --no-ext-diff --binary --cached --") return { stdout: `index-${this.version}`, stderr: "", code: 0 };
		if (joined === "diff --no-ext-diff --binary --") return { stdout: `worktree-${this.version}`, stderr: "", code: 0 };
		if (joined === "ls-files --others --exclude-standard -z") return { stdout: "", stderr: "", code: 0 };
		return { stdout: "", stderr: `unexpected git command ${joined}`, code: 1 };
	}
}
