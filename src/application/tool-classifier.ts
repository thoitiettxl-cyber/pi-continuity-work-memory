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
	"continuity_workflow_status",
	"continuity_workflow_read",
	"continuity_bind_work_document",
]);

const MANAGED_WORKFLOW_MUTATION_TOOLS = new Set(["continuity_prepare_work", "continuity_finalize_work"]);

const READ_ONLY_TOOLS = new Set(["read", "grep", "find", "ls", "web_search", "x_search", "mcpScript", "subagent"]);
const MUTATION_TOOLS = new Set(["write", "edit", "apply_patch"]);
const MCP_AUTH_ACTIONS = new Set(["auth-start", "auth-complete"]);

const ETA_BROWSER_READ_ACTIONS = new Set([
	"health",
	"navigate",
	"get_readable",
	"get_text",
	"find_elements",
	"observe",
	"hover",
	"scroll",
	"screenshot",
	"get_page_info",
	"go_back",
	"go_forward",
	"reload",
	"wait_for_selector",
	"console",
	"network",
]);

const VALIDATION_COMMANDS = [
	/^npm\s+(?:test|run\s+(?:test|validate|check|lint|typecheck|build))(?:\s+.*)?$/,
	/^pnpm\s+(?:test|run\s+(?:test|validate|check|lint|typecheck|build))(?:\s+.*)?$/,
	/^yarn\s+(?:test|run\s+(?:test|validate|check|lint|typecheck|build))(?:\s+.*)?$/,
	/^node\s+--test(?:\s+.*)?$/,
	/^pytest(?:\s+.*)?$/,
	/^python(?:3)?\s+-m\s+pytest(?:\s+.*)?$/,
	/^cargo\s+(?:test|check|clippy)(?:\s+.*)?$/,
	/^go\s+test(?:\s+.*)?$/,
	/^dotnet\s+test(?:\s+.*)?$/,
	/^mvn(?:w)?\s+(?:test|verify)(?:\s+.*)?$/,
	/^gradle(?:w)?\s+(?:test|check)(?:\s+.*)?$/,
	/^scripts\/validate-premerge\.sh(?:\s+.*)?$/,
];

const SIMPLE_READ_PROGRAMS = new Set([
	"pwd",
	"ls",
	"grep",
	"head",
	"tail",
	"wc",
	"stat",
	"file",
	"which",
	"type",
	"uname",
	"printenv",
	"cat",
	"ldd",
	"sha256sum",
]);

const GIT_READ_SUBCOMMANDS = new Set(["status", "diff", "show", "log", "rev-parse", "ls-files", "cat-file"]);
const GIT_BRANCH_READ_ARGUMENTS = new Set(["--show-current", "--list", "-a", "-r", "-v", "-vv"]);
const GIT_HAZARDOUS_OPTIONS = new Set(["--output", "--ext-diff", "--textconv"]);
const GIT_BENIGN_HAZARD_PREFIX_COLLISIONS = new Set(["--text"]);

const GH_READ_ACTIONS = new Map<string, ReadonlySet<string>>([
	["repo", new Set(["list", "view"])],
	["issue", new Set(["list", "status", "view"])],
	["label", new Set(["list"])],
	["pr", new Set(["checks", "diff", "list", "status", "view"])],
	["run", new Set(["list", "view", "watch"])],
	["workflow", new Set(["list", "view"])],
	["release", new Set(["list", "view"])],
	["search", new Set(["code", "commits", "issues", "prs", "repos"])],
	["config", new Set(["get", "list"])],
	["gist", new Set(["list", "view"])],
]);

const FIND_MUTATING_ACTIONS = new Set([
	"-delete",
	"-exec",
	"-execdir",
	"-ok",
	"-okdir",
	"-fprint",
	"-fprint0",
	"-fprintf",
	"-fls",
]);

const FIND_NO_ARGUMENT_FORMS = new Set([
	"-daystart",
	"-depth",
	"-follow",
	"-help",
	"--help",
	"-ignore_readdir_race",
	"-mount",
	"-noignore_readdir_race",
	"-noleaf",
	"-nowarn",
	"-warn",
	"-xdev",
	"-empty",
	"-false",
	"-nogroup",
	"-nouser",
	"-readable",
	"-writable",
	"-executable",
	"-true",
	"-ls",
	"-print",
	"-print0",
	"-prune",
	"-quit",
	"-version",
	"--version",
]);

const FIND_ONE_ARGUMENT_FORMS = new Set([
	"-D",
	"-files0-from",
	"-maxdepth",
	"-mindepth",
	"-regextype",
	"-amin",
	"-anewer",
	"-atime",
	"-cmin",
	"-cnewer",
	"-ctime",
	"-mmin",
	"-mtime",
	"-newer",
	"-used",
	"-gid",
	"-group",
	"-uid",
	"-user",
	"-inum",
	"-links",
	"-name",
	"-iname",
	"-path",
	"-ipath",
	"-regex",
	"-iregex",
	"-lname",
	"-ilname",
	"-size",
	"-type",
	"-xtype",
	"-context",
	"-perm",
	"-samefile",
	"-fstype",
	"-printf",
]);

const FIND_OPERATORS = new Set(["!", "-not", "-a", "-and", "-o", "-or", "(", ")", ","]);
const SENSITIVE_VALIDATION_ARGUMENT = /(?:^|\s)--(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|secret|client[_-]?secret|authorization|cookie)(?:=|\s)/i;

export type ToolClassification = "ignored" | "read" | "mutation" | "validation";
export type MutationConsequence = "none" | "local" | "external";

export function isManagedWorkflowMutationTool(toolName: string): boolean {
	return MANAGED_WORKFLOW_MUTATION_TOOLS.has(toolName);
}

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

function argumentsBeforeSeparator(args: readonly string[]): readonly string[] {
	const separator = args.indexOf("--");
	return separator < 0 ? args : args.slice(0, separator);
}

function hasAssignedOption(args: readonly string[], options: ReadonlySet<string>): boolean {
	return argumentsBeforeSeparator(args).some((argument) => {
		const name = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
		return options.has(name);
	});
}

function hasGitHazard(args: readonly string[]): boolean {
	return argumentsBeforeSeparator(args).some((argument) => {
		const name = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
		if (GIT_BENIGN_HAZARD_PREFIX_COLLISIONS.has(name)) return false;
		return [...GIT_HAZARDOUS_OPTIONS].some((hazard) => hazard.startsWith(name));
	});
}

function gitHashObjectWrites(args: readonly string[]): boolean {
	return argumentsBeforeSeparator(args).some(
		(argument) => argument === "-w" || (argument.startsWith("-w") && !argument.startsWith("--")),
	);
}

const GIT_CLONE_FLAGS = new Set([
	"--quiet",
	"-q",
	"--verbose",
	"-v",
	"--progress",
	"--no-checkout",
	"-n",
	"--single-branch",
	"--no-single-branch",
	"--no-tags",
	"--sparse",
	"--reject-shallow",
	"--no-reject-shallow",
	"--no-hardlinks",
	"--dissociate",
	"--ipv4",
	"--ipv6",
]);

const GIT_CLONE_VALUE_OPTIONS = new Set([
	"--filter",
	"--depth",
	"--branch",
	"-b",
	"--origin",
	"-o",
	"--shallow-since",
	"--shallow-exclude",
	"--revision",
]);

const UNSAFE_CLONE_DESTINATIONS = new Set([".", "./", "..", "../", "/"]);

function parseGitCloneArguments(args: readonly string[]): readonly string[] | undefined {
	const positionals: string[] = [];
	let separator = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (!separator && argument === "--") {
			separator = true;
			continue;
		}
		if (!separator && argument.startsWith("-") && argument !== "-") {
			if (positionals.length > 0) return undefined;
			const name = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
			if (GIT_CLONE_FLAGS.has(name)) {
				if (argument.includes("=")) return undefined;
				continue;
			}
			if (!GIT_CLONE_VALUE_OPTIONS.has(name)) return undefined;
			if (argument.includes("=")) {
				if (argument.slice(argument.indexOf("=") + 1).length === 0) return undefined;
				continue;
			}
			if (index + 1 >= args.length) return undefined;
			index += 1;
			continue;
		}
		positionals.push(argument);
	}
	return positionals;
}

function isUnsafeCloneDestination(destination: string): boolean {
	return UNSAFE_CLONE_DESTINATIONS.has(destination);
}

function isReadOnlyGitClone(args: readonly string[]): boolean {
	const positionals = parseGitCloneArguments(args);
	if (!positionals || positionals.length < 1 || positionals.length > 2) return false;
	return positionals[1] === undefined || !isUnsafeCloneDestination(positionals[1]);
}

function isReadOnlyGhRepoClone(args: readonly string[]): boolean {
	const separator = args.indexOf("--");
	const ghArgs = separator < 0 ? args : args.slice(0, separator);
	const gitFlags = separator < 0 ? [] : args.slice(separator + 1);
	const positionals: string[] = [];
	for (let index = 0; index < ghArgs.length; index += 1) {
		const argument = ghArgs[index]!;
		if (argument === "-u" || argument === "--upstream-remote-name") {
			if (index + 1 >= ghArgs.length) return false;
			index += 1;
			continue;
		}
		if (argument.startsWith("--upstream-remote-name=")) {
			if (argument.slice("--upstream-remote-name=".length).length === 0) return false;
			continue;
		}
		if (argument.startsWith("-") && argument !== "-") return false;
		positionals.push(argument);
	}
	if (positionals.length < 1 || positionals.length > 2) return false;
	if (positionals[1] !== undefined && isUnsafeCloneDestination(positionals[1])) return false;
	if (gitFlags.length === 0) return true;
	const flagPositionals = parseGitCloneArguments(gitFlags);
	return flagPositionals?.length === 0;
}

function isGitDiffCheck(args: readonly string[]): boolean {
	return args[0] === "diff" && args[1] === "--check" && !hasGitHazard(args.slice(1));
}

function stripGitReadGlobals(args: readonly string[]): readonly string[] | undefined {
	let index = 0;
	while (index < args.length) {
		const argument = args[index]!;
		if (argument === "--no-pager" || argument === "--paginate") {
			index += 1;
			continue;
		}
		if (argument === "-C" || argument === "--git-dir" || argument === "--work-tree") {
			if (index + 1 >= args.length) return undefined;
			index += 2;
			continue;
		}
		if (argument.startsWith("--git-dir=") || argument.startsWith("--work-tree=")) {
			index += 1;
			continue;
		}
		break;
	}
	return args.slice(index);
}

function isReadOnlyGit(args: readonly string[]): boolean {
	const command = stripGitReadGlobals(args);
	if (!command || command.length === 0) return false;
	if ((command[0] === "--version" || command[0] === "-v") && command.length === 1) return true;
	const [subcommand, ...subcommandArgs] = command;
	if (!subcommand) return false;
	if (subcommand === "clone") return isReadOnlyGitClone(subcommandArgs);
	if (hasGitHazard(subcommandArgs)) return false;
	if (subcommand === "hash-object") return !gitHashObjectWrites(subcommandArgs);
	if (GIT_READ_SUBCOMMANDS.has(subcommand)) return true;
	if (subcommand === "branch") return subcommandArgs.every((argument) => GIT_BRANCH_READ_ARGUMENTS.has(argument));
	if (subcommand !== "remote") return false;
	if (subcommandArgs.length === 0) return true;
	if (subcommandArgs.length === 1 && (subcommandArgs[0] === "-v" || subcommandArgs[0] === "--verbose")) return true;
	if (subcommandArgs[0] !== "get-url") return false;
	return subcommandArgs.slice(1).every((argument) => argument === "--all" || argument === "--push" || !argument.startsWith("-"));
}

function isReadOnlyCommandBuiltin(args: readonly string[]): boolean {
	if (args[0] !== "-v" && args[0] !== "-V") return false;
	const names = args[1] === "--" ? args.slice(2) : args.slice(1);
	return names.length > 0;
}

function isReadOnlyRipgrep(args: readonly string[]): boolean {
	for (const argument of argumentsBeforeSeparator(args)) {
		if (argument === "--pre" || argument.startsWith("--pre=")) return false;
		if (argument === "--search-zip" || argument.startsWith("--search-zip=")) return false;
		if (/^-[^-]*z/.test(argument)) return false;
	}
	return true;
}

function isReadOnlyFind(args: readonly string[]): boolean {
	let expressionStarted = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--" || argument === "-H" || argument === "-L" || argument === "-P" || /^-O\d+$/.test(argument)) continue;
		if (!expressionStarted && !argument.startsWith("-") && !FIND_OPERATORS.has(argument)) continue;
		expressionStarted = true;
		if (FIND_MUTATING_ACTIONS.has(argument)) return false;
		if (FIND_OPERATORS.has(argument) || FIND_NO_ARGUMENT_FORMS.has(argument)) continue;
		if (FIND_ONE_ARGUMENT_FORMS.has(argument) || /^-newer[A-Za-z]{2}$/.test(argument)) {
			if (index + 1 >= args.length) return false;
			index += 1;
			continue;
		}
		return false;
	}
	return true;
}

function hasGhFlag(args: readonly string[], names: ReadonlySet<string>): boolean {
	return argumentsBeforeSeparator(args).some((argument) => {
		const name = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
		return names.has(name);
	});
}

function hasGhMethodOverrideHeader(args: readonly string[]): boolean {
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		let value: string | undefined;
		if (argument === "-H" || argument === "--header") value = args[index + 1];
		else if (argument.startsWith("-H") && argument.length > 2) value = argument.slice(2).replace(/^=/, "");
		else if (argument.startsWith("--header=")) value = argument.slice("--header=".length);
		if (value && /^x-(?:http-)?method(?:-override)?\s*:/i.test(value)) return true;
	}
	return false;
}

function hasGhGraphqlEndpoint(args: readonly string[]): boolean {
	return args.some((argument) => /^\/?graphql(?:[?#].*)?$/i.test(argument));
}

function isReadOnlyGhApi(args: readonly string[]): boolean {
	if (args.length === 0 || hasGhGraphqlEndpoint(args) || hasGhMethodOverrideHeader(args)) return false;
	if (hasGhFlag(args, new Set(["--cache", "--input", "--verbose"]))) return false;
	let hasExplicitMethod = false;
	let hasField = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--method" || argument === "-X") {
			const method = args[index + 1];
			if (!method || method.toUpperCase() !== "GET") return false;
			hasExplicitMethod = true;
			index += 1;
			continue;
		}
		if (argument.startsWith("--method=")) {
			if (argument.slice("--method=".length).toUpperCase() !== "GET") return false;
			hasExplicitMethod = true;
		} else if (/^-X.+/.test(argument)) {
			if (argument.slice(2).toUpperCase() !== "GET") return false;
			hasExplicitMethod = true;
		}
		if (argument === "-f" || argument === "-F" || argument === "--field" || argument === "--raw-field") {
			hasField = true;
			index += 1;
			continue;
		}
		if (/^-[fF].+/.test(argument) || argument.startsWith("--field=") || argument.startsWith("--raw-field=")) hasField = true;
	}
	return hasExplicitMethod || !hasField;
}

function isReadOnlyGh(args: readonly string[]): boolean {
	if (args.length === 1 && (args[0] === "--version" || args[0] === "version" || args[0] === "help")) return true;
	const [group, action, ...actionArgs] = args;
	if (!group) return false;
	if (group === "api") return isReadOnlyGhApi(args.slice(1));
	if (!action || hasGhFlag(actionArgs, new Set(["--web"]))) return false;
	if (group === "auth" && action === "status") {
		return !hasGhFlag(actionArgs, new Set(["--show-token", "-t"]));
	}
	if (group === "repo" && action === "clone") return isReadOnlyGhRepoClone(actionArgs);
	return GH_READ_ACTIONS.get(group)?.has(action) === true;
}

function isReadOnlyNpm(args: readonly string[]): boolean {
	return args.length > 0 && new Set(["view", "list", "ls", "explain"]).has(args[0]!);
}

const GIST_HOSTS = new Set(["gist.github.com", "gist.githubusercontent.com"]);
const CURL_SAFE_LONG_FLAGS = new Set([
	"--silent",
	"--show-error",
	"--fail",
	"--fail-early",
	"--location",
	"--compressed",
	"--globoff",
	"--get",
	"--head",
	"--no-progress-meter",
]);
const CURL_SAFE_SHORT_CLUSTER = new Set(["s", "S", "f", "L", "g", "I", "G"]);
const CURL_SAFE_VALUE_LONG = new Set([
	"--max-time",
	"--connect-timeout",
	"--max-redirs",
	"--retry",
	"--retry-delay",
	"--user-agent",
	"--header",
	"--url",
	"--request",
]);
const CURL_SAFE_VALUE_SHORT = new Set(["m", "A", "H", "X"]);
const SENSITIVE_HEADER = /^(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key)\s*:/i;

function isGistHttpsUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.protocol !== "https:") return false;
	if (url.username !== "" || url.password !== "") return false;
	return GIST_HOSTS.has(url.hostname);
}

function isSensitiveHeader(value: string): boolean {
	return SENSITIVE_HEADER.test(value.trim());
}

function isReadOnlyGistCurl(args: readonly string[]): boolean {
	const urls: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--") {
			for (const positional of args.slice(index + 1)) {
				if (!isGistHttpsUrl(positional)) return false;
				urls.push(positional);
			}
			break;
		}
		if (argument.startsWith("--")) {
			const name = argument.includes("=") ? argument.slice(0, argument.indexOf("=")) : argument;
			if (CURL_SAFE_LONG_FLAGS.has(name)) {
				if (argument.includes("=")) return false;
				continue;
			}
			if (!CURL_SAFE_VALUE_LONG.has(name)) return false;
			const value = argument.includes("=") ? argument.slice(argument.indexOf("=") + 1) : args[++index];
			if (value === undefined || value.length === 0) return false;
			if (name === "--url") {
				if (!isGistHttpsUrl(value)) return false;
				urls.push(value);
				continue;
			}
			if (name === "--request" && value.toUpperCase() !== "GET" && value.toUpperCase() !== "HEAD") return false;
			if (name === "--header" && isSensitiveHeader(value)) return false;
			continue;
		}
		if (argument.startsWith("-") && argument !== "-") {
			if (argument.startsWith("-X") && argument.length > 2) {
				const method = argument.slice(2);
				if (method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") return false;
				continue;
			}
			if (argument.startsWith("-H") && argument.length > 2) {
				const value = argument.slice(2).replace(/^=/, "");
				if (isSensitiveHeader(value)) return false;
				continue;
			}
			if (argument.length === 2 && CURL_SAFE_VALUE_SHORT.has(argument.slice(1))) {
				const name = argument.slice(1);
				const value = args[++index];
				if (value === undefined) return false;
				if (name === "X" && value.toUpperCase() !== "GET" && value.toUpperCase() !== "HEAD") return false;
				if (name === "H" && isSensitiveHeader(value)) return false;
				continue;
			}
			if (argument.length > 1 && [...argument.slice(1)].every((flag) => CURL_SAFE_SHORT_CLUSTER.has(flag))) continue;
			return false;
		}
		if (!isGistHttpsUrl(argument)) return false;
		urls.push(argument);
	}
	return urls.length > 0;
}

function isReadOnlyGistWget(args: readonly string[]): boolean {
	let stdout = false;
	const urls: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "-q" || argument === "--quiet" || argument === "--no-verbose") continue;
		if (argument === "-O" || argument === "--output-document") {
			const value = args[++index];
			if (value !== "-") return false;
			stdout = true;
			continue;
		}
		if (argument === "-O-" || argument === "--output-document=-") {
			stdout = true;
			continue;
		}
		if (argument.startsWith("-")) return false;
		if (!isGistHttpsUrl(argument)) return false;
		urls.push(argument);
	}
	return stdout && urls.length === 1;
}

function isReadOnlyGistSummarize(args: readonly string[]): boolean {
	if (args.length < 2) return false;
	if (!args[0]!.endsWith("/skills/summarize/to-markdown.mjs")) return false;
	let url: string | undefined;
	for (const argument of args.slice(1)) {
		if (argument === "--tmp") continue;
		if (argument.startsWith("-")) return false;
		if (url !== undefined) return false;
		url = argument;
	}
	return url !== undefined && isGistHttpsUrl(url);
}

function isReadOnlyShellCommand(parsed: ReturnType<typeof splitSimpleCommand>): boolean {
	if (SIMPLE_READ_PROGRAMS.has(parsed.program)) return true;
	switch (parsed.program) {
		case "command": return isReadOnlyCommandBuiltin(parsed.args);
		case "git": return isReadOnlyGit(parsed.args);
		case "gh": return isReadOnlyGh(parsed.args);
		case "rg": return isReadOnlyRipgrep(parsed.args);
		case "find": return isReadOnlyFind(parsed.args);
		case "npm": return isReadOnlyNpm(parsed.args);
		case "curl": return isReadOnlyGistCurl(parsed.args);
		case "wget": return isReadOnlyGistWget(parsed.args);
		case "node":
			return (
				(parsed.args.length === 1 && (parsed.args[0] === "--version" || parsed.args[0] === "-v"))
				|| isReadOnlyGistSummarize(parsed.args)
			);
		case "pi": return parsed.args.length === 1 && (parsed.args[0] === "--version" || parsed.args[0] === "-v");
		default: return false;
	}
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
	if (parsed.program === "git") return isGitDiffCheck(parsed.args);
	return VALIDATION_COMMANDS.some((pattern) => pattern.test(normalized));
}

export function splitValidationCommand(command: string): { program: string; args: string[] } {
	if (!isExecutableValidationCommand(command)) throw new Error("Command is not an allow-listed executable validation");
	const { program, args } = splitSimpleCommand(command);
	return { program, args };
}

export function classifyTool(toolName: string, input: Record<string, unknown>): ToolClassification {
	if (EXCLUDED_TOOLS.has(toolName)) return "ignored";
	if (MANAGED_WORKFLOW_MUTATION_TOOLS.has(toolName)) return "mutation";
	if (toolName === "mcp" || toolName.startsWith("mcp__")) {
		return MCP_AUTH_ACTIONS.has(typeof input.action === "string" ? input.action : "") ? "mutation" : "read";
	}
	if (READ_ONLY_TOOLS.has(toolName)) return "read";
	if (toolName === "eta_browser_use" && ETA_BROWSER_READ_ACTIONS.has(typeof input.action === "string" ? input.action : "")) return "read";
	if (MUTATION_TOOLS.has(toolName)) return "mutation";
	if (toolName !== "bash") return "mutation";
	const rawCommand = typeof input.command === "string" ? input.command : "";
	if (isExecutableValidationCommand(rawCommand)) return "validation";
	let parsed: ReturnType<typeof splitSimpleCommand>;
	try {
		parsed = splitSimpleCommand(rawCommand);
	} catch {
		return "mutation";
	}
	return isReadOnlyShellCommand(parsed) ? "read" : "mutation";
}

export function classifyMutationConsequence(toolName: string, input: Record<string, unknown>): MutationConsequence {
	const classification = classifyTool(toolName, input);
	if (classification !== "mutation") return "none";
	if (MANAGED_WORKFLOW_MUTATION_TOOLS.has(toolName)) return "local";
	if (MUTATION_TOOLS.has(toolName)) return "local";
	return "external";
}
