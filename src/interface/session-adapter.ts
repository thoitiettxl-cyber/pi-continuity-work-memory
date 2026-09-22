import { dirname, resolve } from "node:path";

import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

import { PROVIDER_SOURCE_MAX_CHARS, sanitizeProviderBoundText, sha256 } from "../domain/canonical.js";
import { CONTINUITY_SCHEMA_VERSION, migrateWorkState, type EmbeddedState } from "../domain/types.js";
import type { BranchContext } from "../application/continuity-service.js";
import type { SessionMemorySource } from "../application/memory-service.js";

export const CONTINUITY_ENTRY_TYPE = "pi-continuity-state-v1";

function embeddedEntry(entry: SessionEntry): EmbeddedState | undefined {
	if (entry.type !== "custom" || entry.customType !== CONTINUITY_ENTRY_TYPE) return undefined;
	const data = entry.data as Partial<EmbeddedState> | undefined;
	if (!data || data.authority !== "embedded" || !data.state || (data.schemaVersion !== 1 && data.schemaVersion !== CONTINUITY_SCHEMA_VERSION)) return undefined;
	return { ...data, schemaVersion: CONTINUITY_SCHEMA_VERSION, state: migrateWorkState(data.state) } as EmbeddedState;
}

export function branchContext(ctx: ExtensionContext): BranchContext {
	const branch = ctx.sessionManager.getBranch();
	const nodeIds = branch.map((entry) => entry.id).filter((id): id is string => typeof id === "string" && id.length > 0);
	const embeddedStates = branch.map(embeddedEntry).filter((state): state is EmbeddedState => state !== undefined);
	return {
		nodeIds,
		currentNodeId: ctx.sessionManager.getLeafId() || nodeIds.at(-1) || `session-root:${ctx.sessionManager.getSessionId()}`,
		embeddedStates,
	};
}

const PROVIDER_ENTRY_MAX_CHARS = 24_000;
const PROVIDER_TEXT_MAX_CHARS = 8_000;
const PROVIDER_COLLECTION_MAX_ITEMS = 48;
const SECRET_FIELD = /^(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?token|id[_-]?token|session[_-]?token|auth[_-]?token|token|client[_-]?secret|secret|credential(?:s)?|password|passwd|set-cookie|cookie)$/i;
const OPAQUE_FIELD = /^(?:data|base64|bytes|blob|binary|imageData|screenshot)$/i;
const OMITTED_FIELD = /^(?:thinkingSignature|textSignature|thoughtSignature|fullOutputPath|rawRequest|rawResponse)$/i;

function safeString(value: unknown, maximum = PROVIDER_TEXT_MAX_CHARS): string | undefined {
	return typeof value === "string" ? sanitizeProviderBoundText(value, maximum) : undefined;
}

function sanitizeValue(value: unknown, depth = 0, key = ""): unknown {
	if (value === null || typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "string") {
		if (SECRET_FIELD.test(key)) return "[REDACTED_SECRET]";
		if (OPAQUE_FIELD.test(key) && value.length >= 128) return "[OMITTED_OPAQUE_DATA]";
		return sanitizeProviderBoundText(value, PROVIDER_TEXT_MAX_CHARS);
	}
	if (depth >= 8) return "[OMITTED_NESTED_DATA]";
	if (Array.isArray(value)) {
		const output: unknown[] = [];
		for (const item of value.slice(0, PROVIDER_COLLECTION_MAX_ITEMS)) {
			const sanitized = sanitizeValue(item, depth + 1);
			if (sanitized !== undefined) output.push(sanitized);
		}
		if (value.length > PROVIDER_COLLECTION_MAX_ITEMS) output.push({ omittedItems: value.length - PROVIDER_COLLECTION_MAX_ITEMS });
		return output;
	}
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	if (record.type === "image") {
		return { type: "image", mimeType: safeString(record.mimeType, 200) || "unknown", omitted: true };
	}
	if (record.type === "thinking") return { type: "thinking", omitted: true };
	const output: Record<string, unknown> = {};
	const entries = Object.entries(record);
	for (const [field, item] of entries.slice(0, PROVIDER_COLLECTION_MAX_ITEMS)) {
		if (OMITTED_FIELD.test(field)) continue;
		if (SECRET_FIELD.test(field)) {
			output[field] = "[REDACTED_SECRET]";
			continue;
		}
		if (OPAQUE_FIELD.test(field) && item !== null && typeof item === "object") {
			output[field] = "[OMITTED_OPAQUE_DATA]";
			continue;
		}
		const sanitized = sanitizeValue(item, depth + 1, field);
		if (sanitized !== undefined) output[field] = sanitized;
	}
	if (entries.length > PROVIDER_COLLECTION_MAX_ITEMS) output.omittedFields = entries.length - PROVIDER_COLLECTION_MAX_ITEMS;
	return output;
}

function serializeEntry(entry: SessionEntry): unknown {
	if (entry.type === "message") {
		const message = entry.message as unknown as Record<string, unknown>;
		// RECONSTRUCTED from the canonical rc.1 release-only bashExecution evidence repair.
		if (message.role === "bashExecution") {
			if (message.excludeFromContext) return { id: entry.id, parentId: entry.parentId, type: "message", role: message.role, excludedFromContext: true };
			return {
				id: entry.id,
				parentId: entry.parentId,
				type: "message",
				role: message.role,
				command: safeString(message.command, 4_000),
				output: safeString(message.output, 16_000),
				exitCode: message.exitCode,
				cancelled: message.cancelled,
				truncated: message.truncated,
			};
		}
		return {
			id: entry.id,
			parentId: entry.parentId,
			type: "message",
			role: safeString(message.role, 100),
			content: sanitizeValue(message.content),
			toolName: safeString(message.toolName, 500),
			isError: message.isError,
		};
	}
	if (entry.type === "compaction") return { id: entry.id, parentId: entry.parentId, type: entry.type, summary: safeString(entry.summary, 16_000) };
	if (entry.type === "branch_summary") return { id: entry.id, parentId: entry.parentId, type: entry.type, summary: safeString(entry.summary, 16_000) };
	if (entry.type === "custom" && entry.customType === CONTINUITY_ENTRY_TYPE) {
		const data = embeddedEntry(entry);
		return data ? { id: entry.id, parentId: entry.parentId, type: "continuity", state: sanitizeValue(data.state) } : undefined;
	}
	return { id: entry.id, parentId: entry.parentId, type: entry.type };
}

interface ProjectedContribution {
	sourceEntry: SessionEntry;
	messages: Array<{ role?: string; content?: unknown }>;
}

type ContextReplacement = { content: unknown } | null;

function projectionById(ctx: ExtensionContext): Map<string, ProjectedContribution> | undefined {
	const build = (ctx.sessionManager as { buildSessionProjection?: () => { entries?: ProjectedContribution[] } }).buildSessionProjection;
	if (typeof build !== "function") return undefined;
	const projection = build.call(ctx.sessionManager);
	const byId = new Map<string, ProjectedContribution>();
	for (const item of projection.entries ?? []) {
		if (item?.sourceEntry?.id) byId.set(item.sourceEntry.id, item);
	}
	return byId;
}

function latestContextEdits(branch: readonly SessionEntry[]): Map<string, ContextReplacement> {
	const edits = new Map<string, ContextReplacement>();
	for (const entry of branch) {
		if (entry.type !== "context_edit") continue;
		edits.set(entry.targetId, entry.replacement);
	}
	return edits;
}

function editRequiresResync(branch: readonly SessionEntry[], start: number): boolean {
	if (start <= 1) return false;
	for (let index = start; index < branch.length; index += 1) {
		const entry = branch[index];
		if (!entry || entry.type !== "context_edit") continue;
		const targetIndex = branch.findIndex((candidate) => candidate.id === entry.targetId);
		if (targetIndex >= 0 && targetIndex < start - 1) return true;
	}
	return false;
}

function omissionRecord(entry: SessionEntry): unknown {
	return {
		id: entry.id,
		parentId: entry.parentId,
		type: "context_omission",
		targetId: entry.id,
		omitted: true,
	};
}

function replacedMessage(entry: Extract<SessionEntry, { type: "message" }>, content: unknown): SessionEntry {
	const role = (entry.message as { role?: unknown }).role;
	const normalized = (role === "assistant" || role === "toolResult") && typeof content === "string"
		? [{ type: "text", text: content }]
		: content;
	return { ...entry, message: { ...entry.message, content: normalized } } as SessionEntry;
}

function serializeProjected(entry: SessionEntry, messages: Array<{ role?: string; content?: unknown }>): unknown {
	const first = messages[0];
	if (messages.length === 1 && entry.type === "message" && first) {
		return serializeEntry({ ...entry, message: first } as SessionEntry);
	}
	if (messages.length === 1 && entry.type === "custom_message") {
		return {
			id: entry.id,
			parentId: entry.parentId,
			type: "custom_message",
			customType: entry.customType,
			display: entry.display,
			content: sanitizeValue(first?.content),
		};
	}
	return {
		id: entry.id,
		parentId: entry.parentId,
		type: entry.type,
		messages: sanitizeValue(messages),
	};
}

function serializeProviderEntry(
	entry: SessionEntry,
	projection: Map<string, ProjectedContribution> | undefined,
	edits: Map<string, ContextReplacement>,
): unknown {
	if (projection) {
		const projected = projection.get(entry.id);
		if (!projected) return undefined;
		if (projected.messages.length > 0) return serializeProjected(entry, projected.messages);
		if (entry.type === "message" || entry.type === "custom_message") return omissionRecord(entry);
		return serializeEntry(entry);
	}
	if (entry.type === "context_edit") return undefined;
	if (!edits.has(entry.id)) return serializeEntry(entry);
	const replacement = edits.get(entry.id) ?? null;
	if (replacement === null) return omissionRecord(entry);
	if (entry.type === "message") return serializeEntry(replacedMessage(entry, replacement.content));
	if (entry.type === "custom_message") {
		return {
			id: entry.id,
			parentId: entry.parentId,
			type: "custom_message",
			customType: entry.customType,
			display: entry.display,
			content: sanitizeValue(replacement.content),
		};
	}
	return serializeEntry(entry);
}

function boundedEntry(value: unknown): { value: unknown; json: string } {
	const json = JSON.stringify(value);
	if (json.length <= PROVIDER_ENTRY_MAX_CHARS) return { value, json };
	const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
	const bounded = {
		id: record.id,
		parentId: record.parentId,
		type: record.type,
		entryTruncated: true,
		content: sanitizeProviderBoundText(json, PROVIDER_ENTRY_MAX_CHARS - 1_000),
	};
	return { value: bounded, json: JSON.stringify(bounded) };
}

function boundedSource(entries: readonly unknown[]): string {
	const bounded = entries.map(boundedEntry);
	const selected: Array<{ value: unknown; json: string }> = [];
	let size = 2;
	let omittedEntries = 0;
	for (let index = bounded.length - 1; index >= 0; index -= 1) {
		const candidate = bounded[index]!;
		const additional = candidate.json.length + (selected.length > 0 ? 1 : 0);
		if (size + additional > PROVIDER_SOURCE_MAX_CHARS) {
			omittedEntries = index + 1;
			break;
		}
		selected.unshift(candidate);
		size += additional;
	}
	const values = selected.map((item) => item.value);
	if (omittedEntries === 0) return JSON.stringify(values);
	const sentinel = { type: "source_truncation", omittedEntries };
	while (values.length > 0 && JSON.stringify([sentinel, ...values]).length > PROVIDER_SOURCE_MAX_CHARS) {
		values.shift();
		sentinel.omittedEntries += 1;
	}
	return JSON.stringify([sentinel, ...values]);
}

function sessionPrivatePaths(sessionFile: string | undefined): string[] {
	return sessionFile ? [sessionFile, dirname(sessionFile)] : [];
}

function isCountedTurn(entry: SessionEntry): boolean {
	if (entry.type !== "message") return false;
	const role = (entry.message as { role?: unknown }).role;
	return role === "user" || role === "assistant";
}

export function memorySource(ctx: ExtensionContext, afterEntryId?: string | null): SessionMemorySource {
	const branch = ctx.sessionManager.getBranch();
	const privatePaths = sessionPrivatePaths(ctx.sessionManager.getSessionFile());
	let start = 0;
	let resync = false;
	if (afterEntryId) {
		const index = branch.findIndex((entry) => entry.id === afterEntryId);
		if (index >= 0) start = index + 1;
		else resync = true;
	}
	// Pi 0.87 model context is the session projection, not the raw branch.
	const projection = projectionById(ctx);
	const edits = projection ? new Map<string, ContextReplacement>() : latestContextEdits(branch);
	if (!resync && editRequiresResync(branch, start)) resync = true;
	const selected = resync || start === 0 ? branch : branch.slice(Math.max(0, start - 1));
	const serialized = selected
		.map((entry) => serializeProviderEntry(entry, projection, edits))
		.filter((value) => value !== undefined);
	const text = sanitizeProviderBoundText(boundedSource(serialized), PROVIDER_SOURCE_MAX_CHARS, privatePaths);
	const newEntries = resync ? branch : branch.slice(start);
	return {
		text,
		hash: sha256(text),
		citation: `session:${ctx.sessionManager.getSessionId()}#${ctx.sessionManager.getLeafId() || "root"}`,
		privatePaths,
		lastEntryId: ctx.sessionManager.getLeafId() || branch.at(-1)?.id || null,
		newTurnCount: newEntries.filter(isCountedTurn).length,
		resync,
	};
}

export function sessionFileKey(ctx: ExtensionContext): string {
	const path = ctx.sessionManager.getSessionFile();
	return sha256(path ? resolve(path) : `ephemeral:${ctx.sessionManager.getSessionId()}`);
}

export function sessionKey(ctx: ExtensionContext): string {
	return `${ctx.sessionManager.getSessionId()}:${sessionFileKey(ctx).slice(0, 16)}`;
}
