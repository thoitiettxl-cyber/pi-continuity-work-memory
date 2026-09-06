export const MEMORY_TOKEN_ESTIMATE_DIVISOR = 4;
export const MEMORY_ABSOLUTE_CHARACTER_CEILING = 64_000;
export const MEMORY_MAX_ESTIMATED_TOKENS = 16_000;
export const MEMORY_FALLBACK_CONTEXT_WINDOW = 16_384;
export const MEMORY_WINDOW_DENOMINATOR = 8;
export const MEMORY_MIN_BODY_CHARACTERS = 64;
export const MEMORY_WRAPPER_SEPARATOR_CHARACTERS = 4;

export function estimatedTokenCount(characterCount: number): number {
	return Math.ceil(characterCount / MEMORY_TOKEN_ESTIMATE_DIVISOR);
}

export function effectiveContextWindow(raw: unknown): number {
	if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
		return Math.floor(raw);
	}
	return MEMORY_FALLBACK_CONTEXT_WINDOW;
}

export function estimatedTokenBudget(raw: unknown): number {
	return Math.min(
		MEMORY_MAX_ESTIMATED_TOKENS,
		Math.floor(effectiveContextWindow(raw) / MEMORY_WINDOW_DENOMINATOR),
	);
}

export function characterBudget(raw: unknown): number {
	return Math.min(
		MEMORY_ABSOLUTE_CHARACTER_CEILING,
		estimatedTokenBudget(raw) * MEMORY_TOKEN_ESTIMATE_DIVISOR,
	);
}

export function shouldOmitMemoryBlock(
	budget: number,
	preambleLength: number,
	footerLength: number,
	separatorLength = MEMORY_WRAPPER_SEPARATOR_CHARACTERS,
): boolean {
	return budget < preambleLength + footerLength + separatorLength + MEMORY_MIN_BODY_CHARACTERS;
}

export function sliceUtf16Safe(text: string, maxChars: number): string {
	if (maxChars <= 0) return "";
	if (text.length <= maxChars) return text;
	let end = maxChars;
	const last = text.charCodeAt(end - 1);
	if (last >= 0xd800 && last <= 0xdbff) {
		end -= 1;
	}
	return text.slice(0, Math.max(0, end));
}
