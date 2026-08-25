---
name: grill-with-docs
description: "Clarify an uncertain engineering request through a focused, evidence-backed interview and preserve the resulting shared understanding in repository-authoritative documents when authorized. Invoke explicitly before implementation when intent, scope, constraints, terminology, recovery, or acceptance evidence is unclear."
license: "MIT; adapted from mattpocock/skills — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; designed for pi-continuity-work-memory managed workflow and Alpine-compatible tools"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  adapted-for: "pi-continuity-work-memory"
disable-model-invocation: true
---

# Grill With Docs

Turn unclear intent into a confirmed **Shared Understanding** before mutation.
This is an alignment workflow, not permission to implement, commit, publish, or
operate external state.

## 1. Orient Read-Only

Read applicable runtime instructions, repository `AGENTS.md` files, architecture
and decision documents, relevant code/tests/configuration, and any bound
execution plan. Inspect facts rather than asking the user to retrieve facts the
available tools can establish.

Keep this phase read-only. An unresolved material product, compatibility,
security, privacy, cost, recovery, or external-state choice leaves mutative work
authority-blocked: do not create a plan or change repository files yet.

Separate:

- **facts** — establish from authoritative artifacts or observable behavior;
- **decisions** — ask the user only when their judgment materially affects the
  requested outcome.

## 2. Build The Uncertainty Frontier

Model the request as a decision tree. The **frontier** contains only unresolved
decisions whose prerequisites are already settled. Resolve dependencies before
asking downstream questions. Look for material uncertainty in:

- the problem being addressed and the desired outcome;
- the audience or operator who benefits or is affected;
- observable outcome and user impact;
- current behavior compared with target behavior;
- in-scope and out-of-scope behavior (non-goals);
- compatibility and invariants that must remain true;
- domain terms that are vague, overloaded, or contradicted by code;
- privacy, credentials, cost, external state, or irreversible effects;
- migration, rollback, recovery, and failure behavior; and
- acceptance evidence and repository-required validation.

Keep facts pending only while read-only investigation is in progress. Keep a
decision pending only when user judgment is still required. Mark reversible
details that the engineer can choose and verify safely as non-blocking
assumptions instead of interviewing about them.

When an unresolved choice is material, recommend one default, state its impact,
and give a recovery path.

## 3. Ask, Scaled To The Decision

Choose the round size from the current frontier:

- Ask **one question at a time** when the frontier contains one unresolved
  decision, or one current decision is unusually consequential and deserves the
  user's full attention.
- Ask **two to five independent frontier questions per round** when multiple
  current decisions can be settled without knowing each other's answers.

Number questions so the user can answer compactly. For each one, restate the
current understanding, identify the missing decision, and recommend a default:

```markdown
❓ **Q1 — <decision title>**

<Current understanding, why the decision matters, and the genuine choices.>

➡️ **Recommendation:** <default and concise rationale>

**Impact:** <what this changes>
**Recovery:** <how to reverse or revisit it>
```

Wait for the answers, update the decision tree, then ask the next frontier. A
material decision is resolved when the user selects an option, changes the
requested outcome so the decision no longer applies, or accepts the
recommendation. When the user explicitly delegates the recommended default,
that decision is also resolved.

A generic request to proceed despite uncertainty does not resolve a material
choice or authorize mutation. If the user declines to resolve it, stop with a
read-only authority-blocked handoff. Explicitly recorded non-blocking
uncertainty may remain.

Continue until no material branch remains silently assumed. Do not pursue
imagined edge cases that cannot affect authority, scope, interoperability,
safety, or acceptance, and do not continue interviewing after all remaining
uncertainty is non-blocking and recorded.

## 4. Confirm Shared Understanding

Present a concise, proportional draft covering:

1. **Problem** — the pain or opportunity being addressed;
2. **Desired outcome** — what should be true when the work succeeds;
3. **Audience / operator** — who benefits, operates, or is affected;
4. **Authority and established facts** — what read-only evidence confirmed;
5. **Current behavior** compared with **target behavior**;
6. **In scope** and **out of scope (non-goals)**;
7. **Constraints and domain language**;
8. **Decision chain** — material choices and what each unlocked;
9. **Behavior and failure/recovery decisions**;
10. **Acceptance evidence**; and
11. **Remaining non-blocking assumptions / uncertainty**.

Combine or omit empty presentation sections for a simple request; do not invent
content to fill the template. Ask the user to confirm or correct the draft. A
material correction reopens that branch at Step 3 before confirmation is
presented again.

Confirmation establishes shared understanding only. It does not itself grant
mutation authority. If material uncertainty remains unresolved, the handoff may
record it, but mutative work remains authority-blocked.

## 5. Preserve The Right Paper Trail

The explicit invocation authorizes clarification only. It does not authorize
any repository mutation. Update a glossary, decision record, execution plan, or
other file only when the user's current request also explicitly asks to preserve
the outcome in repository documentation. It never implies authority for
implementation, commits, pushes, publication, deployment, or external changes.

After Shared Understanding is confirmed:

- If the request did not explicitly authorize documentation or implementation,
  return the confirmed summary and write nothing.
- If unresolved material uncertainty still leaves authority blocked, report the
  smallest missing decision and write nothing.
- Before any repository mutation, call `continuity_prepare_work` when the
  managed workflow is available and eligible.
- Bounded mutation creates no lifecycle execution plan. It may update an
  existing authoritative product document only when that documentation change
  was explicitly authorized.
- Durable mutation creates or binds exactly one execution plan. That plan owns
  task progress, task-local decisions, validation, and result.
- Update domain language only under the accepted repository convention. If
  active domain-modeling is needed, read the discovered `domain-modeling`
  skill and follow it.
- Record a lasting decision separately only when it is hard to reverse,
  surprising without context, and the result of a real trade-off.
- Repository content wins over Continuity metadata. Learning memory is context
  only, and a safe checkpoint proves repository/operation safety only.

If no accepted documentation owner exists, propose the smallest suitable target
and obtain the missing decision before creating it.

## 6. Note Process Friction Without Expanding Scope

If the interview surfaces process friction such as a missing convention, stale
documentation, unclear source of truth, or repeated manual step, do not silently
work around it. Fix process friction only when the current request separately
authorizes that exact change and target. Otherwise report a concise, non-blocking
"what was hard" follow-up without creating a file, issue, decision record, or
new tool.

## 7. Hand Off Cleanly

End with the confirmed Shared Understanding, authoritative document paths (if
any), unresolved blocking and non-blocking uncertainty, noted process friction,
and the next authorized action. If a material blocker remains, the next action
is the smallest missing decision rather than preparation or implementation.
Start implementation only when the user's request also authorized it.
