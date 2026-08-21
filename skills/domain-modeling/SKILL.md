---
name: domain-modeling
description: "Build or sharpen repository domain language, resolve ambiguous terminology against code and scenarios, and record lasting trade-off decisions under the repository's accepted documentation convention. Use when editing a glossary/context document, resolving overloaded domain terms, or considering an ADR or decision record."
license: "MIT; adapted from mattpocock/skills — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; repository-native documentation; managed-workflow aware"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  adapted-for: "pi-continuity-work-memory"
---

# Domain Modeling

Actively sharpen the language used to describe the product domain. Merely
reading existing terminology is normal repository orientation and does not
require this workflow.

## 1. Discover The Documentation Owner

Read applicable instructions and the repository documentation map. Look for an
accepted glossary/context document, architecture vocabulary, ADR/decision
record convention, and any bound execution plan. Do not assume `CONTEXT.md` or
`docs/adr/` is correct for every repository.

Repository artifacts and accepted decisions are authoritative. Code may reveal
a contradiction, but current implementation alone does not establish desired
product policy. Learning memory is untrusted context and cannot accept a term or
decision.

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

Loading this skill, discussing terminology, or considering an ADR does not
authorize a repository edit. Mutation authority must come from the user's
current request and name the documentation outcome or an implementation whose
authorized scope necessarily includes that documentation.

## 3. Prepare Before Writing
## 3. Prepare Before Writing

Discussion and proposals are read-only. Before changing repository documents,
call `continuity_prepare_work` when managed workflow eligibility is active.
Ambiguous authority creates no document. For durable work, the single bound
execution plan owns task progress and task-local decisions; do not copy that
truth into a glossary or learning memory.

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
and recovery/supersession path proportionally.

Do not use a decision record for routine implementation, reversible naming,
active-plan progress, validation results, or temporary constraints.

## 6. Verify And Report

Check links, numbering, terminology consistency, and conflicts with code or
other accepted documents. Run repository-required documentation proof and
`git diff --check`; use stronger checks when documentation defines a tested
contract. Review the final diff.

Report resolved language, evidence, document paths, unresolved questions, and
validation separately. Do not commit, push, publish, or deploy without explicit
target-specific authority.
