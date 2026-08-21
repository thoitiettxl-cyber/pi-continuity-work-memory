# Pi Engineering Skills

This directory ships six Pi-native engineering skills with
`pi-continuity-work-memory`. A global package install makes them available in
all repositories while applicable runtime instructions, repository
`AGENTS.md` files, explicit user authority, repository documents, code, tests,
and observed behavior remain authoritative.

## Skills

- `grill-with-docs` — explicit alignment interview for unclear work, followed by
  authority-aware documentation only after material ambiguity is resolved.
- `codebase-design` — deep-module, interface, seam, adapter, locality, and
  leverage design vocabulary.
- `diagnosing-bugs` — feedback-loop-first diagnosis for difficult bugs and
  regressions.
- `tdd` — behavior-first red/green development at repository-approved seams.
- `code-review` — read-only Standards and Intent review from a fixed Git point.
- `domain-modeling` — repository-native domain terminology and durable decision
  documentation.

`grill-with-docs` is user-invoked through `/skill:grill-with-docs`. The other
skills may be loaded by Pi when their descriptions match and can also be invoked
through `/skill:<name>`.

## Shared Authority Contract

These skills provide process guidance, not permission or product authority.
They must:

- follow the applicable repository instructions and preserve unrelated work;
- keep clarification, research, and review read-only;
- call `continuity_prepare_work` before the first repository mutation when the
  managed workflow is available and eligible;
- use exactly one bound execution plan for durable task truth instead of
  creating competing specs, ticket maps, or memory records;
- use repository-native executable or observable proof;
- treat learning memory and safe checkpoints as non-completion authority; and
- commit, push, publish, deploy, or mutate external state only when the user
  explicitly requests the exact action and target.

The skills contain no executable helper, runtime dependency, native binary, or
desktop-browser assumption. See [UPSTREAM.md](UPSTREAM.md) for provenance and
adaptation details.
