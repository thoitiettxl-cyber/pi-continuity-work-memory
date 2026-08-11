import { resolve } from "node:path";
import { redactSecrets, sha256 } from "../domain/canonical.js";
import { CONTINUITY_SCHEMA_VERSION } from "../domain/types.js";
export const CONTINUITY_ENTRY_TYPE = "pi-continuity-state-v1";
function embeddedEntry(entry) {
    if (entry.type !== "custom" || entry.customType !== CONTINUITY_ENTRY_TYPE)
        return undefined;
    const data = entry.data;
    if (!data || data.schemaVersion !== CONTINUITY_SCHEMA_VERSION || data.authority !== "embedded" || !data.state)
        return undefined;
    return data;
}
export function branchContext(ctx) {
    const branch = ctx.sessionManager.getBranch();
    const nodeIds = branch.map((entry) => entry.id).filter((id) => typeof id === "string" && id.length > 0);
    const embeddedStates = branch.map(embeddedEntry).filter((state) => state !== undefined);
    return {
        nodeIds,
        currentNodeId: ctx.sessionManager.getLeafId() || nodeIds.at(-1) || `session-root:${ctx.sessionManager.getSessionId()}`,
        embeddedStates,
    };
}
function serializeEntry(entry) {
    if (entry.type === "message") {
        const message = entry.message;
        if (message.role === "bashExecution") {
            if (message.excludeFromContext)
                return { id: entry.id, parentId: entry.parentId, type: "message", role: message.role, excludedFromContext: true };
            return {
                id: entry.id,
                parentId: entry.parentId,
                type: "message",
                role: message.role,
                command: message.command,
                output: message.output,
                exitCode: message.exitCode,
                cancelled: message.cancelled,
                truncated: message.truncated,
            };
        }
        return {
            id: entry.id,
            parentId: entry.parentId,
            type: "message",
            role: message.role,
            content: message.content,
            toolName: message.toolName,
            isError: message.isError,
        };
    }
    if (entry.type === "compaction")
        return { id: entry.id, parentId: entry.parentId, type: entry.type, summary: entry.summary };
    if (entry.type === "branch_summary")
        return { id: entry.id, parentId: entry.parentId, type: entry.type, summary: entry.summary };
    if (entry.type === "custom" && entry.customType === CONTINUITY_ENTRY_TYPE) {
        const data = embeddedEntry(entry);
        return data ? { id: entry.id, parentId: entry.parentId, type: "continuity", state: data.state } : undefined;
    }
    return { id: entry.id, parentId: entry.parentId, type: entry.type };
}
export function memorySource(ctx) {
    const serialized = ctx.sessionManager.getBranch().map(serializeEntry).filter((value) => value !== undefined);
    const text = redactSecrets(JSON.stringify(serialized));
    return {
        text,
        hash: sha256(text),
        citation: `session:${ctx.sessionManager.getSessionId()}#${ctx.sessionManager.getLeafId() || "root"}`,
    };
}
export function sessionFileKey(ctx) {
    const path = ctx.sessionManager.getSessionFile();
    return sha256(path ? resolve(path) : `ephemeral:${ctx.sessionManager.getSessionId()}`);
}
export function sessionKey(ctx) {
    return `${ctx.sessionManager.getSessionId()}:${sessionFileKey(ctx).slice(0, 16)}`;
}
//# sourceMappingURL=session-adapter.js.map