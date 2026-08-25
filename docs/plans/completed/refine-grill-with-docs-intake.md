<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"1ee3e04b-e651-4c26-a2ae-c46929c4c455","templateVersion":1} -->

# Execution Plan: Refine Grill With Docs Intake

Date: 2026-08-25

## Status

Ready for completion

## Outcome

Merge the reviewed adaptive intake improvements into the canonical explicit-only grill-with-docs skill while preserving fail-closed authority, managed-workflow semantics, source provenance, and the exact ten-skill package contract.

## Authority And Context

- The user confirmed the researched update approach in this session.
- AGENTS.md and docs/ARCHITECTURE.md define repository workflow, skill coupling, and validation authority.
- The reviewed reference is /storage/emulated/0/Download/grill-intake-SKILL.md; its unverified Harness-intake provenance will not be claimed.
- Existing unrelated modifications shown by git status must be preserved.

## Scope

In scope:

- Update skills/grill-with-docs/SKILL.md in place without renaming or adding a skill.
- Add focused package-skill assertions for adaptive questioning and fail-closed uncertainty/process-friction behavior.
- Update user-facing acceptance or changelog documentation required by the changed skill contract.
- Run focused and repository-required validation and review the final diff.

Out of scope:

- Changing the ten-skill inventory or /skill:grill-with-docs command.
- Changing Continuity runtime classification or managed-workflow implementation.
- Committing, pushing, releasing, deploying, or altering external state.
- Modifying or discarding unrelated worktree changes.

## Constraints

- Explicit invocation grants clarification only and never mutation authority.
- Unresolved material product, security, privacy, compatibility, cost, recovery, or external-state choices remain authority-blocked.
- Bounded mutation creates no lifecycle execution plan; durable work uses exactly one plan.
- Process friction remains read-only unless its exact correction is separately authorized.
- Keep existing Matt Pocock provenance unless an exact additional source is verified.

## Approach

- Establish focused failing assertions for the intended prompt contract.
- Merge the adaptive frontier, proportional Shared Understanding, correction loop, and safe process-friction handoff into grill-with-docs.
- Update coupled acceptance and user-visible change documentation without changing package inventory.
- Run focused tests, full validation required for package skills, and final diff review.
- Record validation and result in this plan, then finalize only with current receipt-bound evidence if appropriate.

## Risks And Recovery

- Prompt wording could accidentally allow mutation under unresolved authority; negative assertions and scenario review must retain fail-closed language.
- A duplicate or renamed skill would break inventory and cross-skill routing; keep the existing directory and frontmatter name.
- If validation fails, retain the bounded diff and diagnose rather than reverting unrelated work.
- Do not attribute the unverified Harness-intake variant in repository provenance.

## Progress

- [x] Added and observed a focused red prompt-contract assertion.
- [x] Updated the canonical `grill-with-docs` skill without changing its name or package inventory.
- [x] Updated the focused skill test, acceptance map, and Unreleased changelog entry.
- [x] Ran the full repository-required validation ladder and reviewed the final diff.
- [x] Recorded the verified result before finalization.

## Decisions

- Keep `grill-with-docs` as the sole canonical command and preserve the exact ten-skill inventory.
- Merge the adaptive intake behavior as a local refinement while retaining only the verified Matt Pocock provenance.
- A generic request to proceed does not resolve material uncertainty; only an explicit choice, accepted recommendation, delegated default, or changed outcome resolves that branch.
- Process friction remains a read-only handoff note unless the user separately authorizes the exact correction and target.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- RED — `npm test` failed only the new prompt-contract test because the old skill omitted `problem being addressed`.
- GREEN — `npm test -- --test-name-pattern='grill-with-docs scales'` passed 157/157 tests; the repository npm script executed the complete serial suite.
- PASS — `npm run typecheck`.
- PASS — `npm run validate`, including build, 157/157 serial tests, isolated two-workspace Pi 0.84.1 install proof with ten loaded skills, and release static validation.
- PASS — `scripts/validate-premerge.sh`.
- PASS — `git diff --check`.
- PASS — final targeted diff review confirmed the canonical skill name, exact ten-skill inventory, existing Matt Pocock provenance, and preservation of unrelated worktree paths.
- An earlier `npm run build:test` attempt exited 2 on a temporary duplicate test declaration and emitted partial ignored `.test-build` output; the source was corrected and the user reconciled the operation as partially applied.
- DEFERRED — no provider-backed conversational evaluation was run; the explicit command load and prompt contract are covered, but stochastic model adherence is not claimed by static tests.

## Result

The canonical explicit-only `grill-with-docs` skill now uses dependency-aware adaptive questioning, proportional Shared Understanding and correction loops, and explicit fail-closed transitions from unresolved material uncertainty to read-only handoff. Generic proceed-with-uncertainty language cannot authorize mutation, bounded documentation work is distinguished from lifecycle-plan creation, and process friction remains observational unless its exact correction is separately authorized. Focused contract coverage, package acceptance documentation, and the Unreleased changelog were updated without adding or renaming a skill. No commit, push, release, deployment, provider call, or unrelated worktree modification was performed.
