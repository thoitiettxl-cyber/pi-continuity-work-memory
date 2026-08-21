---
name: codebase-design
description: "Design or improve module interfaces and seams for depth, locality, leverage, testability, and AI navigability. Use when shaping an interface, locating a seam, evaluating adapters, reviewing architectural coupling, or comparing module designs."
license: "MIT; adapted from mattpocock/skills — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; no runtime dependencies or desktop assumptions"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  adapted-for: "pi-continuity-work-memory"
---

# Codebase Design

Design **deep modules**: substantial behavior behind a small, stable interface
at a clean seam. Applicable repository architecture and domain language remain
authoritative; use this vocabulary to reason, not to rename established concepts
without authority.

## Vocabulary

- **Module**: anything with an interface and implementation, from a function to
  a package or vertical slice.
- **Interface**: everything a caller must know: operations, invariants, ordering,
  errors, configuration, and material performance behavior.
- **Implementation**: behavior hidden inside the module.
- **Depth**: leverage obtained per unit of interface callers must learn.
- **Seam**: a location where behavior can vary without editing the caller.
- **Adapter**: a concrete implementation occupying a seam.
- **Leverage**: capability gained by callers from one stable interface.
- **Locality**: change, knowledge, bugs, and verification concentrated in one
  place instead of scattered through callers.

When repository vocabulary uses terms such as component, service, API, or
boundary, preserve it and explain the mapping rather than forcing a rename.

## Evaluation

Ask:

1. What observable behavior should callers obtain?
2. What facts must callers currently know, and which can the module hide?
3. Does understanding or changing one concept require visiting many files?
4. Do callers and tests cross the same public seam?
5. What actually varies across the seam?
6. Would deleting the module remove complexity, or spread it across callers?

The last question is the **deletion test**. A useful module concentrates
complexity; a pass-through merely relocates syntax.

## Principles

- Depth belongs to the interface, not line count.
- The interface is the preferred test surface.
- Accept dependencies at a justified seam instead of constructing hidden
  external state inside core logic.
- Return observable results where practical; isolate side effects at repository
  boundaries.
- One production adapter alone is not evidence for a seam. A second real
  variation, often a repository-approved test adapter, makes it concrete.
- Do not introduce dependency injection, ports, mocks, or abstractions for
  hypothetical future variation.
- Preserve existing architecture decisions unless current evidence justifies
  explicitly reopening them.

Read [DEEPENING.md](DEEPENING.md) when consolidating shallow modules around
I/O dependencies. Read [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md) only when the
user asks to compare materially different interfaces or the interface choice is
architecture-defining.

## Deliverable

For design-only work, remain read-only and report:

- current module/interface and evidence;
- candidate seam;
- behavior hidden behind it;
- dependency/adapters strategy;
- locality and leverage gained;
- deliberate trade-offs and rejected alternatives; and
- acceptance evidence for a future change.

If implementation is requested, follow applicable authority and call
`continuity_prepare_work` before the first repository mutation when managed
workflow eligibility is active. Do not create a competing plan, commit, or
external action unless explicitly authorized.
