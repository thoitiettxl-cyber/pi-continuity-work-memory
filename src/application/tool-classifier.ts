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
	/^(?:pwd|ls|rg|grep|head|tail|wc|stat|file|which|type|uname|printenv)(?:\s+[^;&|]*)?$/,
	/^git\s+(?:status|diff|show|log|rev-parse|ls-files)(?:\s+[^;&|]*)?$/,
	/^git\s+branch(?:\s+(?:--show-current|--list|-a|-r|-v|-vv))*$/,
	/^npm\s+(?:view|list|ls|explain)(?:\s+[^;&|]*)?$/,
	/^node\s+(?:--version|-v)$/,
];

const SENSITIVE_VALIDATION_ARGUMENT = /(?:^|\s)--(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|secret|client[_-]?secret|authorization|cookie)(?:=|\s)/i;

export type ToolClassification = "ignored" | "read" | "mutation" | "validation";
export type MutationConsequence = "none" | "local" | "external";

export function splitSimpleCommand(command: string): { program: string; args: string[]; tokens: string[] } {
	if (!command.trim() || /[\n\r\0]/.test(command)) throw new Error("Command is empty or contains a line boundary");
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;
	for (let index = 0; index < command.length; index += 1) {
		const character = command[index]!;
		if (character === "`" || character === "$" || character === "\0") throw new Error("Shell expansion is not allowed");
		if (quote) {
			if (character === quote) quote = null;
			else current += character;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			continue;
		}
		if (/[;&|<>()[\]{}*?~#]/.test(character)) throw new Error("Shell operators and expansions are not allowed");
		if (/\s/.test(character)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}
		if (character === "\\") {
			index += 1;
			if (index >= command.length) throw new Error("Trailing escape in command");
			current += command[index]!;
			continue;
		}
		current += character;
	}
	if (quote) throw new Error("Unclosed quote in command");
	if (current) tokens.push(current);
	const program = tokens[0];
	if (!program) throw new Error("Command is empty");
	return { program, args: tokens.slice(1), tokens };
}

export function isExecutableValidationCommand(command: string): boolean {
	let parsed: ReturnType<typeof splitSimpleCommand>;
	try {
		parsed = splitSimpleCommand(command);
	} catch {
		return false;
	}
	const normalized = parsed.tokens.join(" ");
	if (/(?:^|\s)(?:sh|bash|zsh)\s+-c\b/.test(normalized)) return false;
	if (SENSITIVE_VALIDATION_ARGUMENT.test(normalized)) return false;
	return VALIDATION_COMMANDS.some((pattern) => pattern.test(normalized));
}

export function splitValidationCommand(command: string): { program: string; args: string[] } {
	if (!isExecutableValidationCommand(command)) throw new Error("Command is not an allow-listed executable validation");
	const { program, args } = splitSimpleCommand(command);
	return { program, args };
}

export function classifyTool(toolName: string, input: Record<string, unknown>): ToolClassification {
	if (EXCLUDED_TOOLS.has(toolName)) return "ignored";
	if (READ_ONLY_TOOLS.has(toolName)) return "read";
	if (MUTATION_TOOLS.has(toolName)) return "mutation";
	if (toolName !== "bash") return "mutation";
	const rawCommand = typeof input.command === "string" ? input.command : "";
	if (isExecutableValidationCommand(rawCommand)) return "validation";
	let normalized = "";
	try {
		normalized = splitSimpleCommand(rawCommand).tokens.join(" ");
	} catch {
		return "mutation";
	}
	if (READ_ONLY_COMMANDS.some((pattern) => pattern.test(normalized))) return "read";
	return "mutation";
}

export function classifyMutationConsequence(toolName: string, input: Record<string, unknown>): MutationConsequence {
	const classification = classifyTool(toolName, input);
	if (classification !== "mutation") return "none";
	if (MUTATION_TOOLS.has(toolName)) return "local";
	return "external";
}
