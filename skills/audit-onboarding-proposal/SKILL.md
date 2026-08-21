---
name: audit-onboarding-proposal
description: "Independently audit exact proposed onboarding documentation hunks against a pinned repository revision. Use only through /skill:audit-onboarding-proposal with explicit hunk IDs and destinations. This workflow is read-only, returns hunk-level evidence dispositions, and never applies the proposal."
license: "MIT; adapted from repository-harness — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; independent read-only repository and Git inspection; Alpine-compatible"
metadata:
  source: "https://github.com/hoangnb24/repository-harness"
  source-commit: "e765792b635b4d5e3e5fc0578f82f9ca5dea2681"
  adapted-for: "pi-continuity-work-memory"
disable-model-invocation: true
---

# Audit Onboarding Proposal

Independently verify proposed agent-facing documentation before it is applied.
This skill is read-only. It never edits files, applies a hunk, grants approval,
or expands the producer's authority.

## Require An Independent Fixed Point

Use an independent fresh reviewer that did not produce the onboarding proposal.
A fresh Pi session is preferred. When an independent `subagent` call is
available, delegate one bounded audit task and provide only the fixed point,
exact requested hunks, and source authorities. Never launch a nested agent from
a shell command. If reviewer independence cannot be established, disclose that
limit and do not return a `SUPPORTED` disposition.

Treat the repository at the tested revision as the source of truth. Treat the
producer report, citations, self-score, prior audit narrative, Continuity text,
and learning memory only as claims or navigation leads. Corroborate every
material clause from repository-owned authority and evidence.

Do not edit, checkout, reset, stash, clean, install, build, start services, run
migrations, create temporary state, or operate the application. Do not call `continuity_prepare_work`; a read-only audit creates no plan or checkpoint.

## Require Exact Inputs

For every requested audit, require:

1. repository/worktree and pinned revision or explicitly fixed stable worktree;
2. exact hunk IDs requested by the user;
3. destination and complete before/after boundary for each hunk;
4. the producer's clause-level citations and evidence classifications; and
5. applicable repository instructions and documentation ownership.

Do not infer a missing hunk set, destination, base revision, or replacement
boundary. A missing input yields `UNSUPPORTED` for the affected hunk. If the
repository or destination drifts during the audit, stop and require a fresh
audit rather than restoring or rewriting the target.

## Reconstruct Claims From Primary Evidence

Read only the sources needed to decide the requested hunks. Split each changed
sentence into atomic subject-condition-effect claims. Verify exact constants,
defaults, optionality, guards, fallback order, failure propagation, cleanup,
and downstream effects through the complete causal chain needed by the wording.

A source that proves an entrypoint does not automatically prove persistence,
provider calls, runtime ownership, logs, or cleanup. Code and configuration may
prove current behavior but do not establish a new normative instruction. Reject
proposed policy without accepted authority even when the implementation already
resembles it.

## Complete The Per-Hunk Worksheet

Produce one row per hunk; every cell is mandatory:

| Hunk | Destination and exact boundary | Structural comparison | Atomic changed clauses | Complete source chain | Conditions preserved | Preliminary disposition |
| --- | --- | --- | --- | --- | --- | --- |

`Structural comparison` must account for headings, markers, unchanged boundary
text, and the exact before/after replacement. `Conditions preserved` must name
relevant branches, guards, fallback, optionality, and failure order, or explain
why none exists. Confidence cannot fill an omitted cell.

## Run A Separate Counterexample Pass

After the preliminary worksheet, try to disprove each candidate disposition in
this order:

1. missing or extra heading, marker, context line, or destination boundary;
2. a conjunction whose clauses have different evidence;
3. conditional behavior stated as unconditional;
4. optional, defaulted, or configurable values stated as universal;
5. an entrypoint cited without its downstream causal effect;
6. absence of a cleanup call promoted to runtime liveness or obligation;
7. temporal wording such as `before`, `after`, `complete`, or `finally` that
   disagrees with control-flow order; and
8. a sentinel or partial probe promoted to aggregate schema, configuration, or
   readiness completeness.

Record `Counterexample found: none` or the exact counterexample for every hunk.
An unverified atomic clause, incomplete boundary, missing worksheet cell, or
omitted counterexample result fails closed.

## Issue Hunk-Level Dispositions

Use exactly one disposition per requested hunk:

- `SUPPORTED` — the exact displayed wording and boundary are evidence-backed at
  the fixed point.
- `SPLIT_OR_REISSUE` — some atomic clauses can be supported only after the
  producer separates or corrects the hunk.
- `UNSUPPORTED` — authority, evidence, fixed-point identity, boundary, or a
  required condition is missing or contradicted.

`SUPPORTED` means only that the wording survived this read-only evidence audit.
It does not constitute user approval, mutation authority, validation of the
consumer application, or task completion. Never approve a bundle merely because
most sentences are correct.

## Report And Stop

Return the tested fixed point, independence status, evidence limitations, the
completed worksheet, each counterexample result, and one disposition per hunk.
Do not apply or commit anything. A safe checkpoint proves repository/operation
safety only; it cannot replace independent evidence or authorize a proposal.
