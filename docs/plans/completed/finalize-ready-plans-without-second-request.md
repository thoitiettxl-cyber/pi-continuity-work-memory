<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"bb879b27-0fbd-477a-9f5c-a67a8c9e5444","templateVersion":1} -->

# Execution Plan: Finalize ready plans without a second user request

Date: 2026-09-09

## Status

Ready for completion

## Outcome

When a bound execution plan's in-scope outcome is implemented, required proof is recorded, and Result is no longer pending, the same agent run sets Status to Ready for completion and calls continuity_finalize_work without waiting for a second user request. agent_settled still never auto-finalizes. Remaining in-scope delivery such as commit, push, or deploy keeps the plan active.

## Authority And Context

- User observed that Pi rarely completes plans unless they explicitly ask, after a gist plan had recorded Result while Status stayed Active.
- Existing contract: session_start, user input, agent completion, and agent_settled never create or finalize repository documents. continuity_finalize_work is an in-run agent tool gated on Ready for completion or Completed plus a non-pending Result and immediately preceding validation.
- session-objective-policy currently says the block grants no completion authority and not to mark complete because the turn is ending. That wording is being read as 'wait for the user to ask'.
- Accepted default: encode an agent duty to finalize in the same run when in-scope work is done. Do not add an agent_settled auto-finalize hook. Do not mass-complete leftover active plans.

## Scope

In scope:

- Clarify bound-active session-objective-policy so agents finalize ready plans in this turn without a second user request, while still forbidding complete-because-the-turn-is-ending.
- Update WORKFLOW.md, execution-plan template Progress, AGENTS.md, ARCHITECTURE Complete And Deliver, README managed-workflow steps, skills shared contract, and CHANGELOG.
- Update workflow manifest checksums and focused contextSummary tests.
- Keep agent_settled from creating or finalizing documents.

Out of scope:

- Do not auto-finalize on session_start, user input, agent completion, or agent_settled.
- Do not mass-move leftover docs/plans/active files.
- Do not change finalize receipt, fingerprint, or Ready-for-completion gates.
- Do not commit, push, release, or deploy.

## Constraints

- Fail-closed finalize gates stay as they are.
- Do not treat a checkpoint or plan move as product-behavior proof.
- Packaged workflow assets must keep a sorted SHA-256 manifest.

## Approach

- Add the same-run finalize duty to session-objective-policy and its unique-string tests.
- Update workflow template, WORKFLOW.md, AGENTS.md, ARCHITECTURE, README, skills README, and CHANGELOG.
- Refresh workflow/manifest.json checksums.
- Run focused continuity tests, typecheck, and git diff --check.

## Risks And Recovery

- Over-eager finalize could close a plan that still lists commit/push/deploy. Recovery: keep remaining in-scope delivery as a hard exception.
- Agents might still wait if policy stays buried. Recovery: unique testable sentence in bound-active policy.
- Wrong workflow checksums fail the loader. Recovery: recompute sorted SHA-256 manifest from current files.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.

## Decisions

- Same-run finalize is an agent duty, not an `agent_settled` hook: when in-scope work, proof, and Result are recorded and no remaining authorized delivery is listed, set Status to Ready for completion and call `continuity_finalize_work` without a second user request.
- Remaining in-scope commit, push, deploy, or other named delivery keeps the plan active.
- Do not mass-complete leftover `docs/plans/active/` files.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run typecheck
- npm run build:test
- node --test --test-concurrency=1 .test-build/test/continuity.test.js
- git diff --check
- Inspect workflow/manifest.json hashes against WORKFLOW.md and templates/execution-plan.md

## Result

Implemented in the worktree. Focused proof passed:

- `npm run typecheck` — PASS (`continuity_validate` receipt `23359cff-503d-4ec8-aed5-b71fb214baaf`)
- `node_modules/.bin/tsc -p tsconfig.test.json` — PASS (`npm run build:test` was already determined this session)
- `node --test --test-concurrency=1 .test-build/test/continuity.test.js` — PASS (50/50)
- `node --test --test-concurrency=1 .test-build/test/workflow-assets.test.js` — PASS (4/4)
- `git diff --check` — PASS (`continuity_validate` receipt `63f413eb-710f-48bc-b332-297436ebe4be`)
- `workflow/manifest.json` SHA-256 matches `WORKFLOW.md` (`ea697bf2c0e3`) and `templates/execution-plan.md` (`13bd62669c37`).

The gist plan was moved to `docs/plans/completed/gist-read-classifier-cwm-skills.md` in this session as the immediate instance. Leftover unrelated active plans were not mass-completed. Commit, push, and deploy stayed out of scope.
