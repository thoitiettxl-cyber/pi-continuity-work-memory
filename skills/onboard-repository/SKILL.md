---
name: onboard-repository
description: "Inspect an unfamiliar or brownfield repository and propose evidence-backed agent-facing guidance. Use only through /skill:onboard-repository when the user explicitly asks to onboard, map, assess, or backfill repository guidance. The first pass is always read-only; exact approved documentation hunks may be applied only in a later authorized pass."
license: "MIT; adapted from repository-harness — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; first pass uses read-only repository and Git tools; Alpine-compatible"
metadata:
  source: "https://github.com/hoangnb24/repository-harness"
  source-commit: "e765792b635b4d5e3e5fc0578f82f9ca5dea2681"
  adapted-for: "pi-continuity-work-memory"
disable-model-invocation: true
---

# Onboard Repository

Build a verified map that helps a future agent work independently. The explicit
invocation authorizes inspection and proposals only; it does not authorize any
repository mutation.

## First-Pass Safety Contract

The first pass is always read-only, even in a writable worktree. Read every
applicable `AGENTS.md` or override before inspecting deeper files. Use
`continuity_workflow_status` only when workflow context helps orientation; do not call `continuity_prepare_work` during the first pass because no mutation is
authorized or required.

During the first pass:

- capture the initial repository boundary before deeper inspection;
- preserve all tracked, staged, unstaged, untracked, ignored, and managed state;
- do not install dependencies, build artifacts, start or stop services, run
  migrations, exercise cleanup, create caches, or write temporary files;
- prefer dedicated reads and searches, and issue only repository-authorized
  simple read-only commands under current shell restrictions;
- never inspect or print secret values; record safe existence, permissions, or
  redacted metadata when relevant; and
- end by comparing the observable final boundary with the initial one.

If an initial observation was missed or a runtime/ignored-state boundary cannot
be observed safely, mark it **Unknown**. The absence of a mutating command does
not prove that external state was unchanged. Do not repair, reset, stash, clean,
or erase user-owned dirt.

## Establish The Boundary

Record the Git root, full revision or fixed worktree point, branch, initial
status, applicable ignore/managed-state owners, and relevant pre-existing
changes. Baseline ignored directories or runtime resources only when the
requested path makes them material and a content-sensitive, secret-safe
observation is available.

A later observation cannot reconstruct a missed pre-state. Keep separate
results for Git state, relevant ignored or managed paths, runtime ownership,
and task-owned temporary paths. One **Unknown** remains Unknown rather than
being averaged into an overall pass.

## Classify Every Material Claim

Use these labels consistently:

- **Authoritative:** accepted instructions, product contracts, decisions, or
  maintained operational procedures say what must happen.
- **Observed:** code, configuration, tests, or repository state show current
  behavior.
- **Derived:** a direct consequence of verified implementation or protocol;
  phrase it as current behavior, not durable intent.
- **Decision required:** a normative product, safety, compatibility, recovery,
  or operational choice lacks accepted authority.
- **Unknown:** available repository evidence cannot establish the answer.

Never silently promote Observed, Derived, Decision required, or Unknown to
Authoritative. Distinguish fixed, defaulted, configurable, and generated values;
required and optional fields; logical configuration names and observed runtime
names; host and container ports; and process-wide versus request-correlated
evidence.

When broader product ambiguity blocks useful wording, report the decision and
recommend an explicit `/skill:grill-with-docs` follow-up. Do not invoke that
explicit-only workflow on the user's behalf.

## Map The Repository And Its Invariants

Inspect only the smallest surface needed for the requested onboarding path:
entry documentation, product and architecture owners, manifests/task runners,
CI configuration, focused tests, runtime configuration, and maintained
operational scripts.

Compare accepted invariants with executable checks without running or changing
a guard. Use one of these findings:

- **Enforced:** accepted authority and a mechanical check cover the same scope.
- **Partially enforced:** the check covers only part of the accepted scope.
- **Unenforced rule:** accepted authority exists but no matching check was found.
- **Check lacking authority:** a check exists but no accepted source establishes
  its policy.
- **Unknown:** available evidence cannot establish the relationship.

Keep local commands, optional hooks, checked-in CI invocation, observed CI runs,
and branch protection as separate enforcement levels.

## Trace One Static Operational Path

Prefer one maintained local happy path and trace it without executing it:

```text
prerequisites -> start -> readiness -> deterministic setup
-> real interface -> evidence/correlation -> stop and cleanup
```

First produce a resource and identifier ledger:

| Item | Kind and exact value or behavior | Classification and source |
| --- | --- | --- |

Use one row per identifier, port side, project, service, volume, state path, and
log boundary. Then produce the path table:

| Stage or branch | Interface and expected result | Writes and owner | Evidence/correlation | Cleanup | Unknowns |
| --- | --- | --- | --- | --- | --- |

Fill every cell with evidence, **N/A**, or **Unknown**. Trace default startup,
no-start modes, success cleanup, and failure after startup when they are
relevant. Absence of a cleanup call proves only that the inspected path does not
invoke it; it does not prove resources remain live. An entrypoint or sentinel
probe does not prove downstream persistence, complete schema, or aggregate
readiness without the rest of the causal chain.

## Propose The Smallest Backfill

Rank corrections to false active guidance before additive documentation. Each
proposal must include:

1. concrete agent failure prevented;
2. evidence with exact repository paths or symbols;
3. exact destination and owning section;
4. factual wording to add or replace;
5. unknowns that must not be claimed; and
6. a fresh-agent replay that would prove the guidance helped.

Give every proposed change a stable hunk ID such as `H1`. Show the exact before
and after boundary, preserving headings, markers, and surrounding owner text.
Do not put Decision required or Unknown claims into proposed wording. A proposal
is review material, not a hash, validation receipt, checkpoint, user approval,
or permission to edit.

End the first pass with the fixed point, initial/final boundary comparison,
repository and operational maps, ranked proposals, exact hunk IDs, unsupported
claims avoided, and remaining decisions. Write nothing.

## Apply Only A Later Exact Approval

A later request may authorize only the exact approved documentation hunk and
destination. It does not authorize application code, hooks, services,
databases, credentials, product policy, commit, push, or deployment.

Before applying, re-read applicable instructions and the complete destination.
If the base has drifted, invalidate the old preview and reissue it; never force
an outdated hunk onto new content. Once authority is resolved, call
`continuity_prepare_work` before the first mutation when managed workflow is
eligible. Bounded documentation normally remains plan-free; durable work uses
the one bound execution plan.

Edit only approved agent-facing documentation, run repository-required document
and link checks plus `git diff --check`, and inspect the final diff for invented
policy or unrelated changes. If an operation is pending or uncertain, do not
retry it; require human-only reconciliation and fresh validation. A safe
checkpoint proves repository/operation safety only and never proves onboarding
quality or task completion. Do not commit, push, publish, or deploy without
separate exact authority.
