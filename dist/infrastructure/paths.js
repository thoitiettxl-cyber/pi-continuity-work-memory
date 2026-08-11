import { homedir } from "node:os";
import { join, resolve } from "node:path";
export function resolveStorePaths(environment = process.env) {
    const continuityRoot = resolve(environment.PI_CONTINUITY_HOME || join(homedir(), ".pi", "continuity"));
    const memoryRoot = resolve(environment.PI_WORK_MEMORY_HOME || join(homedir(), ".pi", "work-memory"));
    return {
        continuityRoot,
        continuityDatabase: join(continuityRoot, "state.sqlite"),
        memoryRoot,
        memoryDatabase: join(memoryRoot, "memory.sqlite"),
    };
}
//# sourceMappingURL=paths.js.map