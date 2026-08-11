export const CONTINUITY_SCHEMA_VERSION = 1;
export const MEMORY_SCHEMA_VERSION = 1;
export function emptyWorkState(now = Date.now()) {
    return {
        schemaVersion: CONTINUITY_SCHEMA_VERSION,
        goal: "",
        workItemId: "default",
        plan: [],
        currentStepId: null,
        nextActions: [],
        completedWork: [],
        decisions: [],
        blockers: [],
        constraints: [],
        validationEvidence: [],
        checkpointId: null,
        checkpointAncestry: [],
        mutationSequence: 0,
        mutationStatus: "none",
        mutationUncertain: false,
        updatedAt: now,
    };
}
export function cloneWorkState(state) {
    return structuredClone(state);
}
//# sourceMappingURL=types.js.map