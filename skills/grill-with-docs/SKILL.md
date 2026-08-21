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
security, privacy, cost, recovery, or external-state choice means authority is
ambiguous: do not create a plan or change repository files yet.

Separate:

- **facts** — establish from authoritative artifacts or observable behavior;
- **decisions** — ask the user only when their judgment materially affects the
  requested outcome.

## 2. Build The Uncertainty Frontier

Model the request as a decision tree. The **frontier** contains only questions
whose prerequisites are already settled. Look for material uncertainty in:

- observable outcome and user impact;
- in-scope and out-of-scope behavior;
- compatibility and invariants that must remain true;
- domain terms that are vague, overloaded, or contradicted by code;
- privacy, credentials, cost, external state, or irreversible effects;
- migration, rollback, recovery, and failure behavior; and
- acceptance evidence and repository-required validation.

Do not ask about routine implementation details the engineer or agent can choose
and verify safely. When an unresolved choice is material, recommend one default,
state its impact, and give a recovery path.

## 3. Ask In Bounded Rounds

Ask two to five independent frontier questions per round. Number them so the
user can answer compactly:

```markdown
❓ **Q1 — <decision title>**

<Why the decision matters and the genuine choices.>

➡️ **Recommendation:** <default and concise rationale>

**Impact:** <what this changes>
**Recovery:** <how to reverse or revisit it>
```

Wait for the answers, update the decision tree, then ask the next frontier.
Continue until no material branch remains silently assumed. Do not pursue
imagined edge cases that cannot affect authority, scope, interoperability,
safety, or acceptance.

## 4. Confirm Shared Understanding

Present a concise draft with:

1. outcome;
2. authority and established facts;
3. in scope;
4. out of scope;
5. constraints and domain language;
6. behavior and failure/recovery decisions;
7. acceptance evidence; and
8. remaining non-blocking assumptions.

Ask the user to confirm or correct this draft. Do not act on it before material
corrections are resolved.

## 5. Preserve The Right Paper Trail

The explicit invocation authorizes clarification only. It does not authorize
any repository mutation. Update a glossary, decision record, execution plan, or
other file only when the user's current request also explicitly asks to preserve
the outcome in repository documentation. It never implies authority for
implementation, commits, pushes, publication, deployment, or external changes.

After Shared Understanding is confirmed:

- If the request did not explicitly authorize documentation or implementation,
  return the confirmed summary and write nothing.
- Before any repository mutation, call `continuity_prepare_work` when the
  managed workflow is available and eligible.
- Bounded mutation remains document-free unless an existing authoritative
  product document genuinely needs the agreed update.
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

## 6. Hand Off Cleanly

End with the confirmed Shared Understanding, authoritative document paths (if
any), unresolved non-blocking assumptions, and the next authorized action. Start
implementation only when the user's request also authorized it.
