---
name: tdd
description: "Implement a feature or bug fix test-first through public behavior using focused red/green vertical slices. Use when the user requests TDD, red-green development, regression coverage, or an implementation whose behavior should be established by automated tests."
license: "MIT; adapted from mattpocock/skills and affaan-m/ECC — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; repository-native test runners; Alpine-compatible commands"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  additional-source: "https://github.com/affaan-m/ECC"
  additional-source-commit: "d8409a4b0813771235555e32e3d8046a73988bfa"
  adapted-for: "pi-continuity-work-memory"
---

# Test-Driven Development

Build one observable behavior at a time through a public seam. Repository
instructions, accepted architecture, and the user's requested outcome define
what behavior is authorized.

## Prepare

Read applicable instructions, relevant code/tests, architecture decisions, and
the current worktree. Identify the highest stable seam that can observe the
behavior without reaching through internals.

Recommend the seam and proceed when the user delegated technical choices and it
preserves the requested contract. Ask only when competing seams materially
change product behavior, compatibility, security, migration, or recovery. When
interface shape itself is unresolved, load `codebase-design` from its discovered
`SKILL.md` location before writing tests.

Before the first repository mutation, call `continuity_prepare_work` when
managed workflow eligibility is active. Update a bound execution plan for
durable work; do not create a parallel test plan or task checklist as durable
truth.

Read [tests.md](tests.md) for behavior-test examples and
[mocking.md](mocking.md) before introducing a test double.

## Red/Green Vertical Slices

For each smallest coherent behavior:

1. **Red** — add one focused test expressing observable behavior with an
   independent expected result.
2. Run the narrowest repository-supported command and confirm the test fails for
   the intended missing or broken behavior, not setup noise.
3. **Green** — implement only enough production behavior to satisfy that test
   without speculative options or unrelated cleanup.
4. Rerun the focused test and confirm it passes.
5. Run nearby tests or type checks proportional to the affected seam.
6. Continue with the next vertical slice informed by the previous result.

A vertical slice may cross storage, application, interface, and tests when that
is the smallest independently observable behavior. Avoid writing all tests
first and all implementation later.

## Regression-First Bug Fixes

For a reproducible bug, add the smallest focused regression test through the
public seam before changing production behavior. Confirm it fails because it
exposes the reported behavior, not because of setup noise or an unrelated
failure. Then make that same test green with the smallest coherent fix.

Do not fabricate a RED state when the bug cannot be reproduced. Preserve the
observed report, investigate with the repository's diagnosis workflow, and
state the evidence gap instead of writing a test that already passes or encodes
an assumed cause.

Map the affected behavior across materially distinct execution paths before
declaring the regression closed. Depending on the repository, these may include:

- production and sandbox behavior;
- a real adapter and a test adapter;
- each affected feature flag state;
- the success path and documented error path; or
- versioned, cached, retry, or fallback behavior that can diverge.

Exercise only paths with a plausible independent drift mechanism. Do not
enumerate unaffected combinations or turn one regression into a coverage quota.
Derive the expected result from the report, accepted contract, invariant, or
known example. Review by the same agent that wrote the fix is not independent
proof; executable behavior evidence must be able to falsify the fix.

## Test Quality

Tests must:

- use public interfaces and observable results;
- survive internal refactoring that preserves behavior;
- derive expected values from a specification, known example, invariant, or
  other independent source;
- cover material allowed and forbidden cases;
- isolate time, randomness, filesystem, network, and databases using
  repository-supported boundaries; and
- avoid asserting private calls, incidental log order, or implementation-only
  state.

A test that reproduces the implementation's own calculation is tautological. A
test that mocks internal collaborators describes structure rather than behavior.

## Refine And Validate

Refactor only after the current slices are green, and keep behavior unchanged.
Do not widen scope into architecture work without authority. Run focused proof,
then every mandatory repository gate. Use `continuity_validate` for an
allow-listed authoritative command when available and review the final diff.

Report observed red and green commands, broader validation, skipped/deferred
checks, and residual risk separately. Do not claim completion from a plan,
learning memory, or checkpoint. Do not commit, push, publish, or deploy unless
the user explicitly requested that exact action and target.
