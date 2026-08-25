# Cooperative Context Pressure Governor

Date: 2026-08-25

## Status And Ownership

Accepted design proposal and implementation design history for version 1.

The implemented policy, adapter, tests, and user contract live in
`src/application/context-pressure-governor.ts`, `src/extension.ts`,
`test/context-pressure-*.test.ts`, and `README.md`. This proposal remains design
input under `docs/proposals/`; it is not an execution plan, mutation authority,
runtime contract, validation result, or completion evidence. The implementation
session separately reassessed Pi behavior, prepared durable work through
Continuity, and records delivery evidence in its repository execution plan.

## Objective

Keep long interactive Pi agent runs from silently growing far beyond the
configured context window by combining:

1. numeric context pressure known to the Pi runtime;
2. semantic work state known to the active agent; and
3. existing Continuity state preservation and Pi compaction lifecycle.

Before each pressured LLM call, the extension gives the active agent a bounded,
ephemeral runtime advisory. The agent should finish only the current coherent
step, preserve a recoverable boundary under existing authority, and settle so
Pi can evaluate its configured compaction policy. Version 1 remains cooperative:
it never aborts the run, blocks a tool, invokes compaction, or resumes work
automatically.

## Evidence Baseline

The following claims were checked against the repository, Pi documentation, and
the public/type/runtime surfaces shipped with the package's supported lower
bound (`0.84.1`) and the deployed Pi runtime observed during design (`0.84.3`).

| Claim | Confidence | Evidence |
|---|---|---|
| `ctx.getContextUsage()` exposes estimated `tokens`, `contextWindow`, and `percent` | Confirmed | Pi extension types in `0.84.1` and `0.84.3` |
| The `context` event runs before each LLM call and can non-destructively replace the outgoing `AgentMessage[]` | Confirmed | Pi `extensions.md` and `ContextEvent` types |
| An extension-injected custom message is converted to an LLM-visible user message | Confirmed | Pi `core/messages` conversion |
| `ctx.compact()` first aborts the current agent operation and manual compaction does not resume that run | Confirmed | `AgentSession.compact()` in Pi `0.84.1` and `0.84.3` |
| Native threshold compaction is checked after the full agent run or before the next prompt, not between repeated internal tool turns | Confirmed | `AgentSession._checkCompaction()` call sites |
| Native threshold is `contextTokens > contextWindow - reserveTokens` | Confirmed | Pi `compaction.md` and implementation |
| Context usage may be unknown immediately after compaction until a later assistant response reports usage | Confirmed | Pi types and `AgentSession.getContextUsage()` |
| The extension already embeds Continuity before compaction and reconstructs branch state after successful compaction | Confirmed | `src/extension.ts` |
| A long internal tool loop is the likely cause of observed context estimates above 100% before Pi receives a full-run boundary | Inferred, high confidence | Matches the confirmed lifecycle; the historical session did not record per-turn governor telemetry |
| A model will always comply with a cooperative advisory | Unknown | Requires bounded real-provider observation and cannot be guaranteed by unit tests |

The design-time deployment had native compaction enabled with a 98,304-token
reserve and a 32,768-token recent-message budget. These personal settings are
not a package contract and must not be read, changed, or assumed by the runtime
implementation.

## Problem Statement

A Pi agent run can contain many cycles of:

```text
LLM response -> tool batch -> tool results -> next LLM response
```

Pi exposes `turn_end` and `context` events for those cycles, but its native
threshold compaction check occurs after the full agent run has ended. Tool
results can therefore consume the remaining headroom before the next native
check. The footer displays this pressure to the human, while the active model
does not automatically receive the footer's numeric usage.

Calling `ctx.compact()` from `turn_end`, `context`, or a tool-result handler is
not a safe workaround: the supported Pi implementation aborts the active run
and does not automatically continue a manually compacted turn. Using
`continuity reconcile` as an incidental pause is also invalid because
reconciliation exists only for uncertain real-world operation outcomes.

The missing capability is a bounded feedback loop:

```text
runtime pressure measurement -> agent-visible advisory -> recoverable yield
-> native idle-boundary compaction or explicit /compact
```

## In Scope

- A pure context-pressure policy module.
- Context usage evaluation before each interactive LLM request.
- An ephemeral, authority-bounded advisory visible only to the current provider
  request.
- Monotonic pressure severity within one compaction epoch.
- TUI-only status and session-local enable/disable controls.
- Correct reset behavior for compaction, model changes, session start, and tree
  replacement.
- Focused unit and extension integration tests.
- User-facing and contributor-facing documentation and acceptance evidence.

## Out Of Scope

Version 1 must not:

- call `ctx.abort()` or `ctx.compact()`;
- block or terminate tool calls;
- inject `steer`, `followUp`, or synthetic user input through `pi.sendMessage()`
  or `pi.sendUserMessage()`;
- automatically continue after compaction;
- replace or customize Pi's compaction summary;
- change `reserveTokens`, `keepRecentTokens`, or personal Pi settings;
- operate in `rpc`, `json`, or `print` mode;
- persist governor state in Continuity, learning memory, SQLite, or Pi session
  entries;
- reinterpret context pressure as workflow authority, validation, a safe
  checkpoint, a blocker, reconciliation evidence, or task completion;
- guarantee that context can never cross 100%; or
- modify Pi core.

## Authority And Safety Invariants

1. **Advisory only.** Pressure changes work sequencing, not user scope or
   authority.
2. **No active-run interruption.** The governor never aborts, compacts, blocks,
   or terminates a run or tool.
3. **No completion shortcut.** Yielding for compaction must never be reported as
   task completion.
4. **No uncertainty rewrite.** Pending or uncertain operations remain pending
   or uncertain; the advisory must not authorize retry or reconciliation.
5. **Repository truth remains repository-owned.** A bound execution plan, code,
   tests, Git state, and executable evidence continue to own durable work truth.
6. **Ephemeral prompt material.** The advisory participates only in the current
   provider request and is not appended to session JSONL or summarized later.
7. **Mode isolation.** Non-TUI behavior remains byte-for-byte unaffected by the
   governor path, apart from handler registration.
8. **Fail open locally.** Invalid or unavailable context usage disables the
   advisory for that call without making Continuity unavailable.
9. **No secret interpolation.** Advisory text contains only package-owned static
   text and rounded numeric usage metadata.
10. **Native compaction remains owner.** Pi or an explicit user `/compact`
    command decides whether and how compaction executes.

## Proposed Module Boundary

Create:

```text
src/application/context-pressure-governor.ts
```

The module must not import Pi runtime types. It owns deterministic threshold,
state-transition, and advisory-rendering policy. `src/extension.ts` remains the
adapter that reads `ExtensionContext`, constructs Pi `CustomMessage` values,
and updates TUI status.

Do not place this policy in `src/domain/`: context pressure is session runtime
orchestration, not a persistent product-authority invariant.

### Suggested Types

```ts
export type ContextPressureLevel =
	| "unknown"
	| "normal"
	| "pressure"
	| "critical"
	| "over-limit";

export interface ContextUsageInput {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
}

export interface ContextPressureSnapshot {
	known: boolean;
	observedLevel: ContextPressureLevel;
	activeLevel: Exclude<ContextPressureLevel, "unknown">;
	tokens: number | null;
	contextWindow: number | null;
	percent: number | null;
	remainingTokens: number | null;
	softHeadroom: number | null;
	criticalHeadroom: number | null;
	transitioned: boolean;
	epoch: number;
}

export interface ContextPressureState {
	epoch: number;
	activeLevel: "normal" | "pressure" | "critical" | "over-limit";
	peakPercent: number | null;
}
```

The concrete implementation may use pure functions plus a small stateful class,
but all state transitions must remain deterministic and directly testable.

## Pressure Calculation

### Constants

```ts
const SOFT_HEADROOM_RATIO = 0.20;
const MIN_SOFT_HEADROOM = 32_768;
const MAX_SOFT_HEADROOM = 98_304;
const SMALL_WINDOW_HEADROOM_RATIO = 0.50;
```

For a known usage snapshot:

```text
W = contextWindow
T = tokens
R = W - T
```

Calculate:

```text
desiredSoft = max(32,768, ceil(W * 0.20))

softHeadroom =
  max(
    1,
    min(
      desiredSoft,
      98,304,
      floor(W * 0.50)
    )
  )

criticalHeadroom = max(1, floor(softHeadroom / 2))
```

Classify the observation in this exact precedence order:

```text
R <= 0                  -> over-limit
R <= criticalHeadroom   -> critical
R <= softHeadroom       -> pressure
otherwise               -> normal
```

Examples:

| Configured window | Pressure begins | Critical begins |
|---:|---:|---:|
| 32,768 | 50% | 75% |
| 131,072 | 75% | 87.5% |
| 272,000 | 80% | 90% |
| 1,048,576 | about 90.6% | about 95.3% |

### Input Validation

Return an `unknown` observation and inject nothing when:

- usage is absent;
- `tokens === null`;
- `tokens` or `contextWindow` is not finite;
- `tokens < 0`; or
- `contextWindow <= 0`.

Recompute the operational percentage from `tokens / contextWindow`. The
runtime-provided `percent` may be retained for diagnostics, but it must not
change classification if it conflicts with those two source values.

## Epoch And Hysteresis

Severity rank is:

```text
normal < pressure < critical < over-limit
```

An epoch begins at extension/session initialization and restarts after:

- successful `session_compact`;
- `session_tree`;
- `model_select`; or
- a new `session_start` lifecycle.

Within an epoch:

1. `activeLevel` is the highest known level observed so far.
2. A lower observation does not de-escalate `activeLevel`.
3. An `unknown` observation neither escalates nor resets state.
4. `peakPercent` is monotonic.
5. Only an explicit epoch reset returns the state to `normal`.

This hysteresis prevents advisory/status flicker around a threshold. State is
in-memory only. Extension reload may start a new epoch and safely reassess the
next known usage snapshot.

## Context Event Integration

The effective governor is enabled only when:

```ts
ctx.mode === "tui"
&& ctx.hasUI
&& sessionGovernorEnabled
```

`sessionGovernorEnabled` defaults to `true` for a TUI extension lifecycle.
Non-TUI modes must return without touching `ctx.ui`.

### Handler Algorithm

```ts
pi.on("context", (event, ctx) => {
	if (!isContextGovernorEnabled(ctx)) return;

	const snapshot = governor.observe(ctx.getContextUsage());
	if (!snapshot.known || snapshot.activeLevel === "normal") return;

	const messages = removeOnlyGovernorMessages(event.messages);
	const advisory = createGovernorCustomMessage(snapshot);

	updateGovernorTuiStatusOnTransition(ctx, snapshot);
	return { messages: [...messages, advisory] };
});
```

Requirements:

- Do not mutate `event.messages` in place.
- Preserve every message except a prior message whose role/custom type exactly
  identifies this governor.
- Append exactly one current advisory as the last outgoing `AgentMessage`.
- Use `display: false`.
- Do not call `pi.sendMessage()`, `pi.sendUserMessage()`, or `pi.appendEntry()`.
- Re-inject the advisory for every pressured provider call because a prior
  context-event result is deliberately not persisted.
- Deduplicate TUI transitions, not provider-call advisories.

### Pi Message Shape

```ts
{
	role: "custom",
	customType: "continuity-context-pressure",
	content: renderContextPressureAdvisory(snapshot),
	display: false,
	timestamp: Date.now(),
}
```

Pi converts this custom message to an LLM-visible user-role message. The content
therefore must explicitly identify its source and limited authority.

## Advisory Contract

All variants must be deterministic, no longer than 1,200 characters, and
contain no repository/session content. Display percentage as an integer and
headroom rounded to the nearest 1,024 tokens.

### Pressure

```xml
<context-pressure
  source="pi-continuity-work-memory"
  authority="runtime-safety-advisory"
  level="pressure">
Estimated context use is {percent}% of Pi's configured window, with approximately
{remainingTokens} tokens of headroom. Do not begin another multi-step subtask.
Finish only the current coherent step, keep already-authorized repository and
Continuity state recoverable, then end this agent run so Pi can evaluate its
configured compaction policy at idle. Do not claim completion merely to yield.
This advisory grants no mutation, external-action, reconciliation, validation,
checkpoint, or completion authority.
</context-pressure>
```

### Critical

```xml
<context-pressure
  source="pi-continuity-work-memory"
  authority="runtime-safety-advisory"
  level="critical">
Context pressure is critical at approximately {percent}% of Pi's configured
window. Do not start another tool batch or subtask. Finish only an already-started
atomic step if required for a recoverable state; otherwise return a concise
progress handoff and end this agent run now. Never retry or reconcile an uncertain
operation automatically. This advisory grants no mutation, external-action,
validation, checkpoint, or completion authority.
</context-pressure>
```

### Over Limit

```xml
<context-pressure
  source="pi-continuity-work-memory"
  authority="runtime-safety-advisory"
  level="over-limit">
Estimated context use has exceeded Pi's configured window. Issue no new tool
calls. Return a concise recoverable status and end this agent run now. Preserve
any blocker or uncertain operation as unresolved; do not retry, reconcile, or
claim completion. This advisory grants no additional authority.
</context-pressure>
```

## Pi Lifecycle Integration

| Event | Governor behavior |
|---|---|
| `session_start` | Initialize a fresh epoch and default TUI enablement |
| `context` | Observe usage and append one ephemeral advisory when pressured |
| `turn_end` | Keep existing Continuity `appendState()` behavior; do not trigger compaction |
| `agent_start` | Do not reset the pressure epoch |
| `agent_settled` | Never compact; if known pressure remains after native lifecycle, expose `/compact recommended` in TUI status |
| `session_before_compact` | Keep existing latest-state embedding; do not cancel or customize compaction |
| `session_compact` | Reconstruct Continuity as today, reset the epoch, and clear governor status |
| `session_tree` | Reset after branch replacement alongside existing reconstruction |
| `model_select` | Reset because the active context window changed |
| `input` | Do not reset pressure; let native pre-prompt checks run normally |
| `session_shutdown` | Drop in-memory governor state and clear its status if necessary |

Do not register `session_compact_failed` in version 1. That event is absent from
Pi `0.84.1`, which remains the package's supported lower bound. A failed native
compaction therefore causes no reset; the next known `context` event continues
from the existing pressured epoch.

## TUI Control And Observability

Extend the existing command without creating a new top-level command:

```text
/continuity context-governor status
/continuity context-governor on
/continuity context-governor off
```

Semantics:

- `on` enables the governor for the current extension lifecycle.
- `off` clears governor advisory/status behavior but does not change Pi's native
  compaction setting.
- `status` reports effective mode, current/active level, peak percentage,
  current known usage, and calculated thresholds.
- The override is session/process-local and is not persisted across `/new`,
  `/resume`, reload, or process restart.
- In `rpc`, `json`, or `print`, controls are inert: they do not activate the
  governor, transform messages, or touch UI APIs.

Use a separate TUI status key:

```text
context-governor
```

Do not alter `continuity: safe|drifted|degraded|unavailable`, because context
pressure is not Continuity health or checkpoint authority.

Suggested labels:

```text
context: pressure
context: critical
context: over configured window
context: /compact recommended
```

Do not emit repeated popup notifications.

## Failure And Recovery Behavior

| Condition | Required behavior |
|---|---|
| Usage unknown after compaction | No advisory until a later assistant response establishes usage |
| Invalid numeric data | Fail open for that call; do not compromise Continuity authority |
| Policy or renderer exception | Catch locally, clear governor status if necessary, and preserve normal Pi execution |
| Agent ignores pressure | Re-inject on the next pressured provider call and escalate when thresholds cross |
| Agent settles without native compaction | Show `/compact recommended`; do not compact automatically |
| Native compaction fails | Keep the epoch; later known context continues to receive the advisory |
| Assistant ends with abort/error | Do not compact or resume through the governor |
| Model changes | Reset and calculate against the new window |
| Session/tree changes | Reset; never carry pressure state to another branch/session |
| Governor disabled | Remove its TUI status and perform no context transformation |

A governor failure must not call the existing `compromiseAuthority()` path.
Continuity authority remains available because this policy is optional runtime
guidance, not operation tracking or checkpoint evidence.

## Implementation Surface

### Add

```text
src/application/context-pressure-governor.ts
test/context-pressure-governor.test.ts
test/context-pressure-extension.test.ts
```

### Modify

```text
src/extension.ts
README.md
docs/ARCHITECTURE.md
proof/ACCEPTANCE.md
CHANGELOG.md
```

### Must Not Require

- a SQLite migration;
- a production dependency;
- changes to persisted `WorkState` or memory schemas;
- a custom compaction implementation;
- a new LLM-call tool;
- changes to workflow assets; or
- personal settings migration.

## Test Specification

### Pure Policy Tests

1. Missing usage and `tokens: null` produce `unknown` and no transition.
2. Non-finite, negative, or zero-window inputs produce `unknown`.
3. Exact `pressure`, `critical`, and `over-limit` boundaries use inclusive
   comparisons.
4. Small windows cap soft headroom at half of the window.
5. Large windows cap soft headroom at 98,304 tokens.
6. Operational percent is recomputed from tokens/window.
7. Severity is monotonic within an epoch.
8. `unknown` does not reset a pressured epoch.
9. Explicit reset increments the epoch and returns to `normal`.
10. Advisory rendering is deterministic, bounded, rounded, and includes the
    limited-authority clauses.
11. Advisory rendering never accepts arbitrary session/user text.

### Extension Integration Tests

1. Normal TUI usage returns no context replacement.
2. Pressure appends exactly one governor custom message at the end.
3. The original `event.messages` array and message objects are not mutated.
4. Repeated pressured calls each receive an advisory without creating a session
   entry.
5. Critical and over-limit observations render the correct variant.
6. A successful `session_compact` resets pressure and clears TUI status.
7. The first `tokens: null` observation after compaction does not retrigger.
8. `model_select` and `session_tree` reset the epoch.
9. `rpc`, `json`, and `print` do not call TUI APIs or alter messages.
10. Governor paths never call `ctx.compact`, `ctx.abort`, `pi.sendMessage`,
    `pi.sendUserMessage`, or `pi.appendEntry`.
11. Existing mutation state is still embedded before and after manual and
    threshold compaction.
12. Existing managed-workflow eligibility for active-run `steer` and `followUp`
    remains unchanged.
13. `/continuity context-governor off` disables the next context transformation.
14. `/continuity context-governor status` reports bounded numeric metadata only.
15. `/compact recommended` appears only when pressure remains at
    `agent_settled` without a successful compaction reset.

### Compatibility Proof

- Typecheck and run extension tests against the pinned Pi `0.84.1` development
  dependency.
- Install/release proof must exercise the package against the repository's
  supported Pi range contract without relying on `session_compact_failed` or
  another newer-only API.
- Preserve non-interactive mode proofs and the exact ten-skill package
  inventory.

## Validation Ladder

Focused proof:

```text
npm run typecheck
npm test
```

Repository runtime/integration proof:

```text
npm run validate
```

Premerge proof:

```text
scripts/validate-premerge.sh
git diff --check
```

If a release or managed deployment is separately authorized:

```text
npm run release
```

Then perform a bounded fresh-process TUI smoke:

1. Start below the soft threshold.
2. Generate a controlled multi-turn tool loop.
3. Observe the advisory before critical pressure.
4. Verify no tool or agent operation is aborted by the governor.
5. Verify the agent yields with a recoverable handoff.
6. Verify native threshold compaction or the `/compact recommended` fallback.
7. Verify Continuity reconstructs the same branch-correct state afterward.

Model compliance is a real-provider behavioral observation. Record it as
`PASS`, `FAIL`, or `DEFERRED`; deterministic message-injection tests alone do
not prove it.

## Rollout And Recovery

Version 1 is intentionally reversible:

- `/continuity context-governor off` disables it for the current lifecycle.
- Non-TUI consumers remain unaffected.
- Removing the `context` handler and pure module restores native Pi behavior.
- No database rollback or state migration is required.
- The implementation must not change personal compaction settings as part of
  deployment.

Because the design is cooperative, a provider/model may still issue another
tool call after an advisory. This is a known limitation, not evidence that the
runtime metric or Continuity state is invalid.

## Deferred Work

Not part of version 1:

- safe-idle `ctx.compact()` fallback at `agent_settled`;
- automatic resume after compaction;
- persistent governor configuration;
- adaptive headroom based on recent per-turn growth;
- persisted telemetry;
- non-TUI governor behavior;
- custom compaction prompts or summaries; and
- Pi core changes.

The long-term upstream solution is a Pi core threshold check between internal
turns: after all tool results are finalized, before the next provider request,
and with a compact-and-continue path that preserves the active user run without
aborting or duplicating tool execution. Until such an API exists, the extension
must remain cooperative and avoid pretending it can guarantee an uninterrupted
mid-run compact.

## Implementation Sources

Version 1 is represented by:

- pure threshold, validation, epoch, advisory, and status policy in
  `src/application/context-pressure-governor.ts`;
- Pi event, lifecycle, command, and TUI adaptation in `src/extension.ts`;
- deterministic policy and extension integration proof in
  `test/context-pressure-governor.test.ts` and
  `test/context-pressure-extension.test.ts`; and
- the user/runtime contract in `README.md`, architecture map in
  `docs/ARCHITECTURE.md`, and executable-evidence map in
  `proof/ACCEPTANCE.md`.

The implementation deliberately retains this proposal's version-1 boundaries.
Any future automatic compaction/resume behavior or non-TUI expansion requires a
new authority and compatibility review rather than being inferred from this
historical design.
