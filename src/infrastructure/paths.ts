import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface StorePaths {
	continuityRoot: string;
	continuityDatabase: string;
	memoryRoot: string;
	memoryDatabase: string;
}

export function resolveStorePaths(environment: NodeJS.ProcessEnv = process.env): StorePaths {
	const continuityRoot = resolve(environment.PI_CONTINUITY_HOME || join(homedir(), ".pi", "continuity"));
	const memoryRoot = resolve(environment.PI_WORK_MEMORY_HOME || join(homedir(), ".pi", "work-memory"));
	return {
		continuityRoot,
		continuityDatabase: join(continuityRoot, "state.sqlite"),
		memoryRoot,
		memoryDatabase: join(memoryRoot, "memory.sqlite"),
	};
}
