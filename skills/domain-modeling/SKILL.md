---
name: domain-modeling
description: "Build or sharpen repository domain language, resolve overloaded terms against code and scenarios, and document accepted reusable definitions or lasting trade-offs. Use when actively changing a glossary/context model or deciding whether an accepted trade-off warrants a repository-native decision record."
license: "MIT; adapted from mattpocock/skills — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.86.0; repository-native documentation; managed-workflow aware"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  adapted-for: "pi-continuity-work-memory"
---

# Domain Modeling

Actively sharpen the language used to describe the product domain. Merely
reading existing terminology is normal repository orientation and does not
require this workflow.

## 1. Discover Authority And Operational State

Read applicable instructions and the repository documentation map. Look for an
accepted glossary/context document, architecture vocabulary, ADR/decision
record convention, and any bound execution plan. Do not assume `CONTEXT.md` or
`docs/adr/` is correct for every repository.

When Continuity tools are available, call `continuity_workflow_status` before
work that may write. Inspect managed-workflow eligibility, the current binding,
document drift, and recovery state; use `continuity_status` when unresolved
operation safety matters. These status checks are read-only. Do not call
`continuity_prepare_work` merely because the skill loaded or a term is being
discussed.

Repository artifacts and accepted decisions are authoritative. Code may reveal
a contradiction, but current implementation alone does not establish desired
product policy. Memory can provide untrusted leads: optionally use
`memory_search` to find prior terminology or navigation hints, then corroborate
every useful result against repository-owned evidence. Memory may help locate
authority; it cannot accept a term or decision or become a parallel glossary.

If no documentation convention exists, keep discussion read-only and propose
the smallest target. Creating a new convention requires resolved authority.

## 2. Challenge Language Against Evidence

Surface:

- one word used for several concepts;
- several words used for one concept;
- a definition contradicted by behavior or accepted documentation;
- implementation names leaking into product language; and
- relationships whose edge cases are undefined.

Propose a precise canonical term and explain the alternatives it replaces.
Stress-test the definition with concrete scenarios, including failure and
boundary cases. Ask the user only when the choice materially affects product
meaning; provide a recommended default and recovery path.

If uncertainty extends beyond terminology into product outcome, scope, privacy,
compatibility, or external state, pause domain-document mutation and recommend
that the user explicitly invoke `/skill:grill-with-docs`. Do not invoke that
explicit-only workflow on the user's behalf. Resume domain modeling after the
broader Shared Understanding is confirmed.

Loading this skill, discussing terminology, or considering an ADR does not
authorize a repository edit. Mutation authority must come from the user's
current request and name the documentation outcome or an implementation whose
authorized scope necessarily includes that documentation.

## 3. Prepare Before Writing

Discussion and proposals are read-only. Before changing repository documents,
call `continuity_prepare_work` when managed workflow eligibility is active.
Unresolved material authority must be reported as ambiguous, which creates no
document and keeps mutation blocked.

If active durable work is already bound, update that execution plan instead of
creating another one. If `continuity_workflow_status` reports drift, re-read the
repository document because repository content wins; use
`continuity_bind_work_document` only to rebind the verified existing execution
plan, never to bind a glossary or decision record.

Keep document ownership distinct and link owners instead of duplicating them:

- a glossary owns reusable domain truth;
- a decision record owns a lasting accepted trade-off and its rationale; and
- an execution plan owns task-local progress, task-local decisions, validation,
  and result.

Do not copy active-plan truth into a glossary, decision record, Continuity
fields, or learning memory.

## 4. Update Domain Language

Update the repository's existing glossary/context owner when a reusable term is
resolved. Follow [CONTEXT-FORMAT.md](CONTEXT-FORMAT.md) only as a fallback when
the repository already accepts that shape.

A domain definition should state what the concept is and how it differs from
nearby concepts. Keep implementation paths, class names, rollout status, and
task checklists out of the glossary.

When multiple contexts exist, update the narrowest owning context and describe
cross-context relationships in the repository's map rather than duplicating a
term in several places.

## 5. Record Lasting Decisions Sparingly

Create or update a repository-native decision record only when all are true:

1. changing the decision later is materially costly;
2. a future maintainer would be surprised without the rationale; and
3. genuine alternatives were evaluated and traded off.

Use the repository template and location. Read [ADR-FORMAT.md](ADR-FORMAT.md)
only when the repository has adopted ADRs but provides no stronger template.
Record context, decision, rationale, alternatives worth retaining, consequences,
and recovery/supersession path proportionally. A durable execution plan should
link to the accepted record rather than repeat its rationale.

Do not use a decision record for routine implementation, reversible naming,
active-plan progress, validation results, or temporary constraints.

## 6. Recover Interrupted Document Work

If `continuity_status` reports a pending or uncertain document operation,
inspect the actual repository target and do not retry the write or infer its
outcome.
`continuity_recover` restores operational context only; it does not restore,
rewrite, or retry repository files. Report the operation identifier and
observed file evidence, then ask the user to perform the human-only
reconciliation. Run fresh validation after reconciliation before relying on
the document state.

## 7. Verify And Report

Check links, numbering, terminology consistency, and conflicts with code or
other accepted documents. Run repository-required documentation proof and
`git diff --check`; use stronger checks when documentation defines a tested
contract. Review the final diff.

For bounded documentation work, ordinary repository proof is sufficient. When
an authorized durable task is ready to close, use `continuity_validate` for an
allow-listed executable receipt, then `continuity_finalize_work` only after the
plan itself records a ready status and non-pending result. The plan move is a new
mutation and requires fresh post-move validation. Use `continuity_checkpoint`
only when a safe repository/operation boundary is needed; a checkpoint is never
completion evidence.

Report resolved language, evidence, document paths, unresolved questions, and
validation separately. Do not commit, push, publish, deploy, or mutate external
state without explicit target-specific authority.
