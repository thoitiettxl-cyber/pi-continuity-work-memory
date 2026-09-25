# Execution Plan: TypeSafe / Jev Harness Optimization

Status: Ready for completion
Work Item ID: typesafe-jev-harness-opt

## Outcome

Make the harness measurably faster by integrating TypeSafe / Jev fast judgment at audited decision points behind independent feature flags, preserving fail-closed authority rules, deterministic invariants, and full reversibility.

## Audit Of 7 Opportunities

| Opportunity | Disposition | Integration Point | Mechanism | Status |
|---|---|---|---|---|
| 1. Tool-output chunking | Enabled | `src/domain/canonical.ts` / `tool_result` | Deterministic head/tail chunking + optional score | Verified |
| 2. Context retention during compaction | Retained deterministic | `src/application/context-pressure-governor.ts` | Pure deterministic rules for safety/authority invariants | Verified |
| 3. Prepared tool workflows without GPT turns | Enabled | `src/application/managed-workflow-service.ts` | Deterministic pipeline chaining | Verified |
| 4. Relevant tool catalog selection | Enabled | `src/application/tool-classifier.ts` | Deterministic allowlist + optional classification | Verified |
| 5. Ambiguous properties evaluation | Enabled | `src/application/typesafe-service.ts` | Jev `noul` / `choice` judgment with native fallback | Verified |
| 6. Predefined recovery actions | Enabled | `src/application/typesafe-service.ts` | Jev `choice` with deterministic recovery fallback | Verified |
| 7. Task routing & agent coordination | Enabled | `src/application/typesafe-service.ts` | Jev `score` / `choice` with native heuristic fallback | Verified |

## In Scope

- Implement `TypeSafeService` with `noul`, `choice`, and `score` primitives.
- Support feature flags (`TYPESAFE_ENABLED`, `JEV_OPTIMIZATION_ENABLED`) and timeout/circuit-breaker fallbacks.
- Unit and integration tests in `test/typesafe-service.test.ts`.
- Expose TypeSafe evaluator in the web developer explorer.

## Out Of Scope

- Modifying upstream Pi host or inaccessible Codex internals.
- Replacing Git checkpoints or executable validation with probabilistic AI judgments.
- Adding unreviewed external npm runtime dependencies.

## Constraints

- Zero new runtime npm dependencies; portable built-in fetch and Node.js APIs.
- Fail-closed security: never send unredacted secrets or private session paths.
- Preserved native fallback path whenever Jev is disabled, times out, or abstains.

## Steps

- [x] Audit 7 opportunities and establish baseline dispositions.
- [x] Implement `TypeSafeService` in `src/application/typesafe-service.ts`.
- [x] Connect feature flags and native fallbacks for ambiguous call evaluation and recovery choice.
- [x] Add comprehensive test coverage in `test/typesafe-service.test.ts`.
- [x] Expose TypeSafe / Jev evaluation in preview web explorer.
- [x] Verify build, typecheck, lint, and test suites.

## Risks And Recovery

- Failure Mode: TypeSafe API unavailable or times out.
  Mitigation: Strict timeout (default 2500ms) and automatic instant fallback to deterministic heuristic rules.
- Failure Mode: Probabilistic judgment violates authority invariant.
  Mitigation: Jev is advisory only; safe checkpoints and validation receipts remain 100% deterministic and evidence-backed.

## Validation Evidence

- Unit tests: `test/typesafe-service.test.ts` (7 passing tests covering noul, choice, score, fallback, timeout, secrets redaction, and deterministic shortcuts).
- Build compilation: `bun run build` and `compile_applet` clean.
- Lint: `tsc -p tsconfig.json --noEmit` and `lint_applet` clean.
- Integration: API `/api/typesafe/evaluate` responding on port 3000.

