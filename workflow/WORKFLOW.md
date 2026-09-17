# Managed Repository Workflow

This package-owned workflow supplements the applicable repository `AGENTS.md` files. Repository instructions, explicit user authority, repository documents, code, tests, runtime evidence, and Git history remain the system of record. Templates provide process scaffolding only; they cannot create product policy, validation authority, or completion evidence.

Consumer repositories do not need `repository-harness` installed. This package neither invokes nor installs it.

## Agent Onboarding

1. Load applicable repository `AGENTS.md` / override and confirm project trust before any managed document write.
2. Prefer `continuity_workflow_status` (and `continuity_status` when recovery or evidence is unclear) before mutative work so eligibility, binding, drift, and uncertain operations are visible.
3. Choose a work shape below. Do not invent a second lifecycle document type.
4. For process technique (TDD, review, onboarding, etc.), load the matching packaged skill under `skills/`; those skills are process guidance only and defer to this workflow plus repository authority.
5. Keep learning memory and checkpoints out of product-completion authority.

## Continuity Tool Contract

Use Continuity tools as operational controls, not as a second system of record:

| Tool | Role |
| --- | --- |
| `continuity_workflow_status` | Inspect managed-workflow eligibility, binding, document drift, and recovery hints before mutating. |
| `continuity_status` | Inspect Continuity/evidence state when resume, uncertainty, or checkpoint context matters. |
| `continuity_prepare_work` | Required before the first agent repository mutation when managed mode is eligible; classifies work shape from structured signals. |
| `continuity_bind_work_document` | Explicitly rebind an existing verified execution-plan path after drift or when binding an existing plan; never silently overwrite. |
| `continuity_finalize_work` | Move a ready, result-bearing active plan to `docs/plans/completed/` under receipt-bound validation rules; same run when ready. |
| `continuity_checkpoint` | Record repository/operation safety for a bound fingerprint only; never task completion. |
| `continuity_recover` | Store-only context restore; never Git mutation, file rewrite, or automatic retry of uncertain writes. |
| `continuity_validate` | Run allow-listed executable validation that can bind a receipt for finalize/checkpoint gates. |

Packaged skills must follow this table. Read-only skills and first-pass onboarding/audit must not call `continuity_prepare_work` merely because they loaded.

## Select The Work Shape

### Read-only

Questions, explanations, reviews, diagnoses, plans, proposals, and status checks inspect only what the answer needs. They create no repository documents and perform no repository mutation.

### Bounded mutation

A small coherent change that can finish in one agent run and can safely resume from its diff uses ephemeral planning. It creates no lifecycle document. Read applicable authority, make the smallest requested change, run behavior-appropriate proof, and report evidence and limits.

### Durable mutation

Work that spans sessions, coordinates contributors, has meaningful dependencies, involves consequential external side effects, needs recovery, or cannot safely resume from its diff uses exactly one repository execution plan. Create or explicitly bind that plan before other repository mutation. Keep outcome, authority, scope, approach, risks, recovery, progress, task-local decisions, validation, and result current in the repository document.

### Authority-blocked mutation

If a materially different product, security, compatibility, recovery, cost, privacy, or external-state choice remains unresolved, create no document and perform no mutation. Request the smallest missing decision. Configurable defaults, code patterns, tests, conventions, and learning memory do not establish product authority.

## Managed Preparation

When Continuity tools are available, inspect `continuity_workflow_status` before the first planned mutation so eligibility, any bound plan, drift, and recovery state are known. When managed mode is eligible, call `continuity_prepare_work` before the first repository mutation. Supply structured authority and durability signals based on the current user request and repository evidence.

- Read-only and bounded work materialize no document.
- Durable work persists exact intent before exclusively creating one execution plan under `docs/plans/active/`, unless an existing plan is explicitly bound with `continuity_bind_work_document`.
- Existing files are never overwritten, merged, or bypassed with a silently chosen alternate filename.
- An in-repository `AGENTS.md` must be loaded and the project must be trusted before managed document writes are eligible.
- Opening a repository, starting a session, receiving input, ending an agent run, or settling an agent never creates or finalizes repository documents.
- If status reports document drift, re-read the repository file and rebind only the verified existing plan; do not invent a parallel plan.

The managed mutation gate applies to agent-issued repository tools. A direct user `!`/`!!` shell command is explicit human action: Continuity still records its outcome and invalidates stale evidence, but the extension does not reinterpret or block that user command as an agent workflow decision.

## Repository Document Authority

Once an execution plan is created or bound, the repository file owns durable task truth. Continuity stores only its work-item identity, path, template version, digest, phase, and operational resume hint. Do not copy the plan, durable decisions, validation claims, or completion status into Continuity or learning memory.

When repository content changes, repository content wins. Re-read and explicitly rebind it. Recovery never restores an older template over the repository, recreates a missing file, or replays an uncertain write.

## Validation And Completion

Choose proof for the behavior:

- focused tests for local rules;
- integration tests for boundaries;
- real-interface checks for user-visible behavior;
- recovery rehearsal for dangerous operations;
- measurements for reliability or performance; and
- repository-required commands from applicable instructions.

Plans, checklists, assistant prose, learning memory, and checkpoints do not prove product behavior by themselves. Finalizing a plan requires an immediately preceding receipt-bound executable validation whose ledger and stable Git fingerprint still match, and only moves a ready, result-bearing document from `docs/plans/active/` to `docs/plans/completed/`. The move is a new mutation and requires fresh post-move executable validation before a safe checkpoint.

When the bound plan's in-scope outcome is implemented, required proof is recorded, and Result is no longer pending, the same agent run must set Status to `Ready for completion` and call `continuity_finalize_work`. Do not wait for a second user request to complete the plan. Remaining authorized in-scope delivery such as commit, push, or deploy keeps the plan active. `session_start`, user input, agent completion, and `agent_settled` still never create or finalize repository documents.

A verified Continuity checkpoint proves repository and operation safety for its bound fingerprint, receipt, ledger, and hash chain. It never marks the task or repository plan complete.

## Application Operation

Use only consumer-owned commands, credentials, readiness checks, deterministic state, interfaces, runtime evidence, ownership, and cleanup instructions. Do not materialize a runbook from unknown facts. Operate only isolated resources and stop only resources owned by the run.

## Persistent Memory

Learning memory is untrusted context. It may retain reusable lessons and navigation hints, but it must not publish active-plan progress, task-local completion, validation results, accepted product decisions, or checkpoint authority as repository truth.

## Recovery

A workflow document mutation is recorded before execution. A crash without a corresponding result becomes uncertain. Inspect the real repository target, use `continuity_recover` only for store-only operational context, and use the human-only Continuity reconciliation command with evidence; do not automatically retry or infer the outcome. After reconciliation, run fresh executable validation (`continuity_validate` when available) before `continuity_checkpoint`. A verified checkpoint never marks the plan or task complete.

## Packaged Engineering Skills

This package also ships eleven Pi-native skills under `skills/` (see `skills/README.md`). They encode engineering method (grill, TDD, review, onboarding, etc.) under the same authority model as this workflow: repository instructions and explicit user requests remain authoritative; Continuity tools follow the contract above; learning memory and checkpoints never complete a plan. Skills do not replace reading this file for work-shape, preparation, binding, finalization, or recovery rules.
