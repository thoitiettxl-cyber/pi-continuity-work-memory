# Engineering Skills Sources And Adaptation

The packaged skills are reviewed adaptations, not symlinks. No source checkout
is part of the release payload or required at runtime.

## Sources

### Matt Pocock skills

- Repository: `https://github.com/mattpocock/skills`
- Local reviewed snapshot: `/root/code/skills`
- Upstream package version: `1.2.3`
- Pinned commit: `5b15a47f2d7150f545fbcacbfe381787fc0230dc`
- License: MIT, reproduced in `UPSTREAM_LICENSE.txt`

### Repository Harness skills

- Repository: `https://github.com/hoangnb24/repository-harness`
- Local reviewed snapshot: `/root/code/repository-harness`
- Pinned commit: `e765792b635b4d5e3e5fc0578f82f9ca5dea2681`
- License: MIT, reproduced in `REPOSITORY_HARNESS_LICENSE.txt`

Repository Harness remains an independent product. This package does not install,
invoke, import, or depend on it; only the reviewed skill methods listed below
were adapted.

### Everything Claude Code (ECC)

- Repository: `https://github.com/affaan-m/ECC`
- Local reviewed snapshot: `/root/code/ECC`
- Pinned commit: `d8409a4b0813771235555e32e3d8046a73988bfa`
- License: MIT, reproduced in `ECC_LICENSE.txt`

Only the reviewed contract-first and regression-testing methods are adapted.
This package does not install or depend on ECC, its hooks, agents, commands,
scripts, MCP configuration, or runtime.

## Source Map

| Shipped skill | Reviewed source material |
|---|---|
| `grill-with-docs` | Matt Pocock `skills/engineering/grill-with-docs/SKILL.md`, `skills/productivity/grilling/SKILL.md`, and domain-modeling material below |
| `codebase-design` | Matt Pocock `skills/engineering/codebase-design/SKILL.md`, `DEEPENING.md`, `DESIGN-IT-TWICE.md` |
| `diagnosing-bugs` | Matt Pocock `skills/engineering/diagnosing-bugs/SKILL.md` and `scripts/hitl-loop.template.sh` |
| `tdd` | Matt Pocock `skills/engineering/tdd/SKILL.md`, `tests.md`, `mocking.md`; ECC `skills/ai-regression-testing/SKILL.md` regression-first and materially distinct path methods |
| `contract-first` | ECC `skills/contract-first/SKILL.md` |
| `code-review` | Matt Pocock `skills/engineering/code-review/SKILL.md` |
| `domain-modeling` | Matt Pocock `skills/engineering/domain-modeling/SKILL.md`, `CONTEXT-FORMAT.md`, `ADR-FORMAT.md` |
| `encode-invariant` | Repository Harness `.agents/skills/encode-invariant/SKILL.md` and `docs/patterns/encoding-invariants.md` |
| `onboard-repository` | Repository Harness `.agents/skills/onboard-repository/SKILL.md` and decisions `0020`, `0026`, and `0028` |
| `audit-onboarding-proposal` | Repository Harness `.agents/skills/audit-onboarding-proposal/SKILL.md` and onboarding audit method |
| `improve-harness` | Repository Harness `.agents/skills/improve-harness/SKILL.md` and `docs/templates/harness-improvement.md` |

## Shared Pi Adaptation

The adaptations preserve high-value engineering techniques while enforcing this
package's runtime and authority model:

- Companion skills are loaded from their Pi-discovered `SKILL.md` paths.
- Optional delegated tasks use one harness-provided `subagent` call per task;
  calls may run sequentially and no child orchestrates another child.
- Applicable repository instructions, explicit user authority, and managed work
  preparation precede mutation.
- Read-only clarification, onboarding, audit, and review create no lifecycle
  documents.
- Durable work uses exactly one repository execution plan; Continuity stores
  only operational binding and recovery state.
- Repository files, code, tests, runtime evidence, and Git history remain the
  system of record; learning memory is untrusted context.
- A safe checkpoint proves repository/operation safety only and never task
  completion.
- Commits, pushes, issue changes, releases, deployments, credentials, and other
  external effects require explicit target-specific authority.
- Shell guidance follows restrictive Alpine environments and never relies on a
  desktop opener, service manager, hidden command wrapper, or detached process.
- ECC adaptations remain prompt-only and omit Claude hooks, commands, agents,
  Context7, automatic dependency installation, fixed coverage quotas, and
  self-evaluation as evidence.

## Repository Harness Adaptation Boundary

The four Repository Harness-derived skills are prompt-only Pi resources. The
adaptation intentionally omits cross-harness UI metadata, Python helpers,
deterministic patch-renderer scripts, authenticated transcript formats,
evidence-capsule schemas, and Repository Harness managed-file/update semantics.
Their evidence tables support human and agent review but do not create a second
validation receipt, operation ledger, checkpoint chain, task database, or source
of repository authority.

`encode-invariant` may be model-invoked for matching enforcement requests, but
automatic loading grants no mutation authority. `onboard-repository`,
`audit-onboarding-proposal`, and `improve-harness` are explicit-only. Onboarding
stops at a read-only proposal until exact documentation wording is later
approved; its companion audit is independently read-only; workflow improvement
requires an observed baseline and a materially equivalent fresh rerun.

## Updating From Any Source

1. Record the candidate source repository, commit, and license.
2. Diff only the mapped source material against the relevant adapted copy.
3. Preserve user authority, Continuity, repository-owned truth, Alpine,
   optional-subagent, and delivery constraints.
4. Do not replace adapted files wholesale or reintroduce source-harness runtime
   assumptions.
5. Update this map and the corresponding license notice when provenance changes.
6. Run focused skill tests, full package validation, isolated global-install
   proof, release validation, and final diff review.
