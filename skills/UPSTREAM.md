# Engineering Skills Upstream And Adaptation

## Source

- Repository: `https://github.com/mattpocock/skills`
- Local reviewed snapshot: `/root/code/skills`
- Upstream package version: `1.2.3`
- Upstream commit: `5b15a47f2d7150f545fbcacbfe381787fc0230dc`
- License: MIT, reproduced in `UPSTREAM_LICENSE.txt`

The files in this directory are adapted copies, not symlinks. The upstream
checkout is not part of the release payload and is never required at runtime.

## Source Map

| Shipped skill | Reviewed upstream material |
|---|---|
| `grill-with-docs` | `skills/engineering/grill-with-docs/SKILL.md`, `skills/productivity/grilling/SKILL.md`, and domain-modeling material below |
| `codebase-design` | `skills/engineering/codebase-design/SKILL.md`, `DEEPENING.md`, `DESIGN-IT-TWICE.md` |
| `diagnosing-bugs` | `skills/engineering/diagnosing-bugs/SKILL.md` and `scripts/hitl-loop.template.sh` |
| `tdd` | `skills/engineering/tdd/SKILL.md`, `tests.md`, `mocking.md` |
| `code-review` | `skills/engineering/code-review/SKILL.md` |
| `domain-modeling` | `skills/engineering/domain-modeling/SKILL.md`, `CONTEXT-FORMAT.md`, `ADR-FORMAT.md` |

## Pi Adaptation

The adaptation preserves the high-value engineering techniques while changing
runtime and authority assumptions:

- Companion skills are loaded by reading their Pi-discovered `SKILL.md`
  location when needed.
- Optional delegated tasks are independent and sequential; the skills never
  promise concurrent or detached execution.
- Repository authority and managed work-shape preparation precede mutation.
- Clarification and review remain document-free until material ambiguity is
  resolved.
- Durable work uses one repository execution plan; glossary and decision
  documents are written only under an accepted repository convention.
- Commits, pushes, issue changes, releases, deployments, credentials, and other
  external effects require explicit target-specific user authority.
- Shell guidance is compatible with restrictive Alpine environments and never
  relies on a desktop opener, service manager, native addon, or hidden command
  wrapper.
- Pi-specific frontmatter is used without harness-specific UI metadata.

## Updating From Upstream

1. Record the candidate upstream commit and review its license.
2. Diff only the source-map files above against this adapted copy.
3. Preserve the authority, Continuity, Alpine, optional-subagent, and delivery
   constraints in this repository.
4. Update this file when provenance or adaptation behavior changes.
5. Run the focused skill tests, complete package validation, isolated global
   install proof, release validation, and final diff review.

Never replace these files wholesale from upstream: doing so would restore
cross-harness assumptions and unsafe automatic side effects.
