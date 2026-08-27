# Pi Engineering Skills

This directory ships eleven Pi-native engineering skills with
`pi-continuity-work-memory`. A global package install makes them available in
all repositories while applicable runtime instructions, repository `AGENTS.md`
files, explicit user authority, repository documents, code, tests, and observed
behavior remain authoritative.

## Skills

- `grill-with-docs` — explicit alignment interview for unclear work, followed by
  authority-aware documentation only after material ambiguity is resolved.
- `codebase-design` — deep-module, interface, seam, adapter, locality, and
  leverage design vocabulary.
- `contract-first` — coordinate independently evolving consumers and providers
  through one authoritative, machine-checkable boundary artifact.
- `diagnosing-bugs` — feedback-loop-first diagnosis for difficult bugs and
  regressions.
- `tdd` — behavior-first red/green development at repository-approved seams.
- `code-review` — read-only Standards and Intent review from a fixed Git point.
- `domain-modeling` — repository-native domain terminology and durable decision
  documentation.
- `encode-invariant` — turn an accepted rule into the smallest repository-native
  guard with positive and negative proof plus precise enforcement reporting.
- `onboard-repository` — explicitly inspect a brownfield repository and propose
  evidence-backed agent guidance; its first pass is always read-only.
- `audit-onboarding-proposal` — independently audit exact proposed onboarding
  hunks clause by clause without applying them.
- `improve-harness` — explicitly test one bounded agent-workflow intervention
  from an observed baseline through a materially equivalent fresh rerun.

`grill-with-docs`, `onboard-repository`, `audit-onboarding-proposal`, and
`improve-harness` are explicit-only through `/skill:<name>`. The other seven may
be loaded by Pi when their descriptions match and can also be invoked directly.

## Shared Authority Contract

These skills provide process guidance, not permission or product authority.
They must:

- follow applicable repository instructions and preserve unrelated work;
- keep clarification, onboarding first passes, audits, diagnosis-only work, and
  reviews read-only;
- call `continuity_prepare_work` before the first repository mutation when the
  managed workflow is available and eligible;
- use exactly one bound execution plan for durable task truth instead of
  creating competing specs, experiment records, ticket maps, or memory state;
- use repository-native executable or observable proof;
- treat learning memory and safe checkpoints as non-completion authority; and
- commit, push, publish, deploy, or mutate external state only when the user
  explicitly requests the exact action and target.

The skills contain no executable helper, runtime dependency, native binary,
desktop-browser assumption, transcript protocol, or Repository Harness runtime
integration. See [UPSTREAM.md](UPSTREAM.md) for both source lineages, license
notices, and adaptation details.
