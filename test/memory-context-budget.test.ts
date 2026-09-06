import assert from "node:assert/strict";
import test from "node:test";

import {
	characterBudget,
	effectiveContextWindow,
	estimatedTokenBudget,
	sliceUtf16Safe,
	shouldOmitMemoryBlock,
} from "../src/domain/memory-context-budget.js";

test("effectiveContextWindow uses floor of finite positive numbers and otherwise falls back to 16384", () => {
	assert.equal(effectiveContextWindow(16_384), 16_384);
	assert.equal(effectiveContextWindow(16_384.9), 16_384);
	assert.equal(effectiveContextWindow(32_768), 32_768);
	assert.equal(effectiveContextWindow(undefined), 16_384);
	assert.equal(effectiveContextWindow(Number.NaN), 16_384);
	assert.equal(effectiveContextWindow(Number.POSITIVE_INFINITY), 16_384);
	assert.equal(effectiveContextWindow(Number.NEGATIVE_INFINITY), 16_384);
	assert.equal(effectiveContextWindow(0), 16_384);
	assert.equal(effectiveContextWindow(-1), 16_384);
	assert.equal(effectiveContextWindow("16384"), 16_384);
	assert.equal(effectiveContextWindow(null), 16_384);
	assert.equal(effectiveContextWindow(true), 16_384);
});

test("estimatedTokenBudget is min(16000, floor(window / 8))", () => {
	assert.equal(estimatedTokenBudget(undefined), 2_048);
	assert.equal(estimatedTokenBudget(16_384), 2_048);
	assert.equal(estimatedTokenBudget(32_768), 4_096);
	assert.equal(estimatedTokenBudget(128_000), 16_000);
	assert.equal(estimatedTokenBudget(272_000), 16_000);
	assert.equal(estimatedTokenBudget(1_000_000), 16_000);
});

test("characterBudget maps missing, invalid, and named windows to the specified character ceilings", () => {
	assert.equal(characterBudget(undefined), 8_192);
	assert.equal(characterBudget(Number.NaN), 8_192);
	assert.equal(characterBudget(Number.POSITIVE_INFINITY), 8_192);
	assert.equal(characterBudget(0), 8_192);
	assert.equal(characterBudget(-8), 8_192);
	assert.equal(characterBudget("128000"), 8_192);
	assert.equal(characterBudget(16_384), 8_192);
	assert.equal(characterBudget(32_768), 16_384);
	assert.equal(characterBudget(128_000), 64_000);
	assert.equal(characterBudget(272_000), 64_000);
	assert.equal(characterBudget(1_000_000), 64_000);
});

test("shouldOmitMemoryBlock omits below wrapper plus 64 body characters and keeps at the boundary", () => {
	assert.equal(shouldOmitMemoryBlock(187, 100, 20), true);
	assert.equal(shouldOmitMemoryBlock(188, 100, 20), false);
	assert.equal(shouldOmitMemoryBlock(8_192, 416, 20), false);
	assert.equal(shouldOmitMemoryBlock(4, 416, 20), true);
});

test("sliceUtf16Safe does not emit a trailing high surrogate", () => {
	const emoji = "\uD83D\uDE00";
	assert.equal(sliceUtf16Safe(emoji, 2), emoji);
	assert.equal(sliceUtf16Safe(emoji, 1), "");
	assert.equal(sliceUtf16Safe(`A${emoji}`, 2), "A");
	assert.equal(sliceUtf16Safe("abc", 2), "ab");
	assert.equal(sliceUtf16Safe("abc", 8), "abc");
	assert.equal(sliceUtf16Safe("abc", 0), "");
});
