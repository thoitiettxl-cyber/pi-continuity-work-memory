const EXCLUDED_TOOLS = new Set([
    "continuity_status",
    "continuity_update",
    "continuity_validate",
    "continuity_checkpoint",
    "continuity_recover",
    "memory_list",
    "memory_read",
    "memory_search",
    "memory_add",
]);
const READ_ONLY_TOOLS = new Set(["read", "grep", "find", "ls"]);
const MUTATION_TOOLS = new Set(["write", "edit", "apply_patch"]);
const VALIDATION_COMMANDS = [
    /^npm\s+(?:test|run\s+(?:test|validate|check|lint|typecheck|build))(?:\s+--[^;&|]*)?$/,
    /^pnpm\s+(?:test|run\s+(?:test|validate|check|lint|typecheck|build))(?:\s+--[^;&|]*)?$/,
    /^yarn\s+(?:test|run\s+(?:test|validate|check|lint|typecheck|build))(?:\s+--[^;&|]*)?$/,
    /^node\s+--test(?:\s+[^;&|]*)?$/,
    /^pytest(?:\s+[^;&|]*)?$/,
    /^python(?:3)?\s+-m\s+pytest(?:\s+[^;&|]*)?$/,
    /^cargo\s+(?:test|check|clippy)(?:\s+[^;&|]*)?$/,
    /^go\s+test(?:\s+[^;&|]*)?$/,
    /^dotnet\s+test(?:\s+[^;&|]*)?$/,
    /^mvn(?:w)?\s+(?:test|verify)(?:\s+[^;&|]*)?$/,
    /^gradle(?:w)?\s+(?:test|check)(?:\s+[^;&|]*)?$/,
    /^scripts\/validate-premerge\.sh(?:\s+[^;&|]*)?$/,
    /^git\s+diff\s+--check(?:\s+[^;&|]*)?$/,
];
const READ_ONLY_COMMANDS = [
    /^(?:pwd|ls|find|rg|grep|sed|head|tail|wc|stat|file|which|type|uname|env|printenv)(?:\s+[^;&|]*)?$/,
    /^git\s+(?:status|diff|show|log|rev-parse|branch|ls-files)(?:\s+[^;&|]*)?$/,
    /^npm\s+(?:view|list|ls|explain)(?:\s+[^;&|]*)?$/,
    /^node\s+(?:--version|-v)$/,
];
export function normalizeCommand(command) {
    return command.trim().replace(/\s+/g, " ");
}
export function isExecutableValidationCommand(command) {
    const normalized = normalizeCommand(command);
    if (!normalized || /[\n\r;&|<>`$()]/.test(normalized) || /(?:^|\s)(?:sh|bash|zsh)\s+-c\b/.test(normalized))
        return false;
    return VALIDATION_COMMANDS.some((pattern) => pattern.test(normalized));
}
export function splitValidationCommand(command) {
    if (!isExecutableValidationCommand(command))
        throw new Error("Command is not an allow-listed executable validation");
    const tokens = [];
    let current = "";
    let quote = null;
    for (let index = 0; index < command.length; index += 1) {
        const character = command[index];
        if (quote) {
            if (character === quote)
                quote = null;
            else
                current += character;
            continue;
        }
        if (character === "'" || character === '"') {
            quote = character;
            continue;
        }
        if (/\s/.test(character)) {
            if (current) {
                tokens.push(current);
                current = "";
            }
            continue;
        }
        if (character === "\\") {
            index += 1;
            if (index >= command.length)
                throw new Error("Trailing escape in validation command");
            current += command[index];
            continue;
        }
        current += character;
    }
    if (quote)
        throw new Error("Unclosed quote in validation command");
    if (current)
        tokens.push(current);
    const program = tokens.shift();
    if (!program)
        throw new Error("Validation command is empty");
    return { program, args: tokens };
}
export function classifyTool(toolName, input) {
    if (EXCLUDED_TOOLS.has(toolName))
        return "ignored";
    if (READ_ONLY_TOOLS.has(toolName))
        return "read";
    if (MUTATION_TOOLS.has(toolName))
        return "mutation";
    if (toolName !== "bash")
        return "mutation";
    const command = typeof input.command === "string" ? normalizeCommand(input.command) : "";
    if (isExecutableValidationCommand(command))
        return "validation";
    if (READ_ONLY_COMMANDS.some((pattern) => pattern.test(command)))
        return "read";
    return "mutation";
}
//# sourceMappingURL=tool-classifier.js.map