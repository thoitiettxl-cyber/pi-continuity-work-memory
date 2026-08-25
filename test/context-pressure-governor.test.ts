import assert from "node:assert/strict";
import test from "node:test";

import {
	ContextPressureGovernor,
	renderContextPressureAdvisory,
} from "../src/application/context-pressure-governor.js";

function usage(tokens: number | null, contextWindow: number, percent: number | null = null) {
	return { tokens, contextWindow, percent };
}

test("missing and invalid usage stays unknown without changing the epoch", () => {
	const governor = new ContextPressureGovernor();
	for (const input of [
		undefined,
		usage(null, 131_072),
		usage(Number.NaN, 131_072),
		usage(Number.POSITIVE_INFINITY, 131_072),
		usage(-1, 131_072),
		usage(1, 0),
		usage(1, -1),
		usage(1, Number.NaN),
		usage(1, Number.POSITIVE_INFINITY),
		usage(Number.MAX_VALUE, Number.MIN_VALUE),
	]) {
		const snapshot = governor.observe(input);
		assert.equal(snapshot.known, false);
		assert.equal(snapshot.observedLevel, "unknown");
		assert.equal(snapshot.activeLevel, "normal");
		assert.equal(snapshot.transitioned, false);
		assert.equal(snapshot.epoch, 0);
	}
	assert.deepEqual(governor.currentState(), {
		epoch: 0,
		activeLevel: "normal",
		peakPercent: null,
	});
});

test("classification uses inclusive boundaries and small-window headroom", () => {
	const governor = new ContextPressureGovernor();
	const beforePressure = governor.observe(usage(16_383, 32_768));
	assert.equal(beforePressure.observedLevel, "normal");
	assert.equal(beforePressure.softHeadroom, 16_384);
	assert.equal(beforePressure.criticalHeadroom, 8_192);

	const pressure = governor.observe(usage(16_384, 32_768));
	assert.equal(pressure.observedLevel, "pressure");
	assert.equal(pressure.remainingTokens, 16_384);

	const critical = governor.observe(usage(24_576, 32_768));
	assert.equal(critical.observedLevel, "critical");
	assert.equal(critical.remainingTokens, 8_192);

	const overLimit = governor.observe(usage(32_768, 32_768));
	assert.equal(overLimit.observedLevel, "over-limit");
	assert.equal(overLimit.remainingTokens, 0);
});

test("medium windows use the exact 20% headroom branch and ceil fractional thresholds", () => {
	const governor = new ContextPressureGovernor();
	const beforePressure = governor.observe(usage(217_599, 272_000));
	assert.equal(beforePressure.observedLevel, "normal");
	assert.equal(beforePressure.softHeadroom, 54_400);
	assert.equal(beforePressure.criticalHeadroom, 27_200);

	const pressure = governor.observe(usage(217_600, 272_000));
	assert.equal(pressure.observedLevel, "pressure");
	assert.equal(pressure.remainingTokens, 54_400);

	const critical = governor.observe(usage(244_800, 272_000));
	assert.equal(critical.observedLevel, "critical");
	assert.equal(critical.remainingTokens, 27_200);

	const fractional = new ContextPressureGovernor();
	assert.equal(fractional.observe(usage(217_601, 272_003)).observedLevel, "normal");
	const fractionalBoundary = fractional.observe(usage(217_602, 272_003));
	assert.equal(fractionalBoundary.observedLevel, "pressure");
	assert.equal(fractionalBoundary.softHeadroom, 54_401);
});

test("large windows cap soft headroom at 98,304 tokens", () => {
	const governor = new ContextPressureGovernor();
	const normal = governor.observe(usage(950_271, 1_048_576));
	assert.equal(normal.observedLevel, "normal");
	assert.equal(normal.softHeadroom, 98_304);
	assert.equal(normal.criticalHeadroom, 49_152);

	const pressure = governor.observe(usage(950_272, 1_048_576));
	assert.equal(pressure.observedLevel, "pressure");
	assert.equal(pressure.percent, 90.625);

	const critical = governor.observe(usage(999_424, 1_048_576));
	assert.equal(critical.observedLevel, "critical");
	assert.equal(critical.percent, 95.3125);
});

test("operational percent is recomputed from tokens and window", () => {
	const snapshot = new ContextPressureGovernor().observe(usage(60, 100, 1));
	assert.equal(snapshot.percent, 60);
	assert.equal(snapshot.observedLevel, "pressure");
});

test("severity and peak percentage stay monotonic until an explicit reset", () => {
	const governor = new ContextPressureGovernor();
	const pressure = governor.observe(usage(100_000, 131_072));
	assert.equal(pressure.activeLevel, "pressure");
	assert.equal(pressure.transitioned, true);

	const lower = governor.observe(usage(10_000, 131_072));
	assert.equal(lower.observedLevel, "normal");
	assert.equal(lower.activeLevel, "pressure");
	assert.equal(lower.transitioned, false);

	const unknown = governor.observe(undefined);
	assert.equal(unknown.activeLevel, "pressure");
	assert.equal(governor.currentState().peakPercent, pressure.percent);

	const critical = governor.observe(usage(120_000, 131_072));
	assert.equal(critical.activeLevel, "critical");
	assert.equal(critical.transitioned, true);
	assert.equal(governor.currentState().peakPercent, critical.percent);

	const previousEpoch = critical.epoch;
	governor.reset();
	assert.deepEqual(governor.currentState(), {
		epoch: previousEpoch + 1,
		activeLevel: "normal",
		peakPercent: null,
	});
	assert.equal(governor.currentSnapshot().known, false);
});

test("advisories are deterministic, bounded, rounded, and authority-limited", () => {
	const cases = [
		{
			snapshot: new ContextPressureGovernor().observe(usage(98_304, 131_072)),
			level: "pressure",
			fragments: ["Estimated context use is 75%", "32,768 tokens of headroom", "Do not claim completion merely to yield", "grants no mutation"],
		},
		{
			snapshot: new ContextPressureGovernor().observe(usage(114_688, 131_072)),
			level: "critical",
			fragments: ["critical at approximately 88%", "Do not start another tool batch", "Never retry or reconcile", "operation automatically", "grants no mutation"],
		},
		{
			snapshot: new ContextPressureGovernor().observe(usage(131_073, 131_072)),
			level: "over-limit",
			fragments: ["has exceeded Pi's configured window", "Issue no new tool calls", "Preserve any blocker or uncertain operation as unresolved", "grants no additional authority"],
		},
	] as const;

	for (const item of cases) {
		const first = renderContextPressureAdvisory(item.snapshot);
		const second = renderContextPressureAdvisory(item.snapshot);
		assert.equal(first, second);
		assert.ok(first.length <= 1_200);
		assert.match(first, new RegExp(`level="${item.level}"`));
		assert.match(first, /source="pi-continuity-work-memory"/);
		assert.match(first, /authority="runtime-safety-advisory"/);
		const normalized = first.replace(/\s+/g, " ");
		for (const fragment of item.fragments) assert.ok(normalized.includes(fragment), fragment);
		assert.ok(!normalized.includes("arbitrary-user-marker"));
	}
});
