# Managed Repository Workflow

This package-owned workflow supplements the applicable repository `AGENTS.md` files. Repository instructions, explicit user authority, repository documents, code, tests, runtime evidence, and Git history remain the system of record. Templates provide process scaffolding only; they cannot create product policy, validation authority, or completion evidence.

Consumer repositories do not need `repository-harness` installed. This package neither invokes nor installs it.

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

When managed mode is eligible, call `continuity_prepare_work` before the first repository mutation. Supply structured authority and durability signals based on the current user request and repository evidence.

- Read-only and bounded work materialize no document.
- Durable work persists exact intent before exclusively creating one execution plan under `docs/plans/active/`, unless an existing plan is explicitly bound.
- Existing files are never overwritten, merged, or bypassed with a silently chosen alternate filename.
- An in-repository `AGENTS.md` must be loaded and the project must be trusted before managed document writes are eligible.
- Opening a repository, starting a session, receiving input, ending an agent run, or settling an agent never creates or finalizes repository documents.

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

A verified Continuity checkpoint proves repository and operation safety for its bound fingerprint, receipt, ledger, and hash chain. It never marks the task or repository plan complete.

## Application Operation

Use only consumer-owned commands, credentials, readiness checks, deterministic state, interfaces, runtime evidence, ownership, and cleanup instructions. Do not materialize a runbook from unknown facts. Operate only isolated resources and stop only resources owned by the run.

## Persistent Memory

Learning memory is untrusted context. It may retain reusable lessons and navigation hints, but it must not publish active-plan progress, task-local completion, validation results, accepted product decisions, or checkpoint authority as repository truth.

## Recovery

A workflow document mutation is recorded before execution. A crash without a corresponding result becomes uncertain. Inspect the real repository target and use the human-only Continuity reconciliation command with evidence; do not automatically retry or infer the outcome. After reconciliation, run fresh executable validation before checkpointing.
