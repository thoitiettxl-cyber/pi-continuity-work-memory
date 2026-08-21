<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"ac8eb045-0243-4d52-a1c6-1824c48b547f","templateVersion":1} -->

# Execution Plan: Pi-native repository workflow skills

Date: 2026-08-21

## Status

Active

## Outcome

Ship encode-invariant, onboard-repository, audit-onboarding-proposal, and improve-harness as globally discoverable Pi-native package skills, fully integrated with authority, Continuity, validation, release, commit, push, and managed user deployment.

## Authority And Context

- The user explicitly selected proposed priorities 1, 2, 3, and 4 and authorized complete implementation, final commit, push, and deployment.
- The accepted proposal calls for Pi-native adaptation rather than verbatim Repository Harness/Codex integration: encode-invariant first; explicit-only read-only onboarding; companion independent onboarding audit; explicit-only evidence-backed workflow improvement.
- Repository artifacts, current Pi documentation, package support contract, tests, and observable validation remain authoritative.

## Scope

In scope:

- Add four package-owned Pi skills: encode-invariant, onboard-repository, audit-onboarding-proposal, and improve-harness.
- Adapt the source methods for Pi 0.84.x, Alpine shell constraints, managed Continuity, repository-owned truth, and explicit external-action authority.
- Add bounded references where needed, provenance and MIT license attribution, manifest/discovery/install/release validation, README/architecture/acceptance/changelog updates, and focused regression coverage.
- Run focused and full repository validation, premerge, release packaging, artifact/install proof, review, commit, push the current authorized branch, deploy via scripts/manage-user-install.mjs, and verify fresh installed discovery.

Out of scope:

- Install, invoke, or add a runtime dependency on repository-harness.
- Copy Codex agents/openai.yaml metadata or transcript-specific evidence-capsule machinery verbatim.
- Add Python/native helper requirements or production runtime dependencies unless executable evidence proves they are necessary; default to prompt/reference-only Pi skills.
- Change unrelated Continuity, memory, provider, SQLite, or extension behavior.
- Publish an npm package, open a pull request, alter branch protection, or deploy any target other than the package-owned global user installation.

## Constraints

- Preserve Node.js >=22.19.0, Pi >=0.84.1 <0.85.0, Alpine ARM64 compatibility, strict ESM TypeScript, and empty runtime dependencies.
- Keep all four new skills subordinate to user authority and repository instructions; read-only workflows create no lifecycle documents, and mutations call continuity_prepare_work when eligible.
- Use exactly one bound execution plan for durable task truth; memory and checkpoints cannot establish task completion.
- Make onboarding, onboarding audit, and workflow improvement explicit-only; allow encode-invariant to match relevant requests without inventing policy.
- Preserve unrelated work and secrets; commit only intended files and deploy only after executable validation and release artifact proof pass.

## Approach

- Inspect current worktree, branch, release contract, skill tests, source provenance, and relevant Repository Harness decisions/tests.
- Design the four Pi-native skills and optional references with clear triggers, authority gates, failure/recovery behavior, and no cross-harness assumptions.
- Update package inventory, tests, documentation, provenance/license, acceptance evidence, changelog, and release identity coherently.
- Run focused skill/discovery tests, typecheck/build/tests, full validate, premerge, release packaging, archive/install proof, and final diff review; fix all attributable failures.
- Record plan result and validation, commit with a focused Conventional Commit, push the authorized branch, deploy the verified archive through the package installer, and verify installed package version plus all ten skill source paths.

## Risks And Recovery

- Skill name collisions can shadow package resources; isolated two-workspace and post-deploy source-path proof must verify exact packaged sources. Roll back by redeploying the prior trusted archive or removing the managed registration while preserving stores.
- Poorly adapted onboarding/audit guidance could create a parallel authority protocol; keep evidence as review support only and explicitly subordinate it to repository truth and Continuity safety semantics.
- Push and deployment are externally visible; stop before either if validation, branch/remote identity, release integrity, or credentials cannot be verified. Recover pushed defects with a new revert/fix commit, not history rewriting.
- Managed deployment changes the package runtime and resources atomically; rely on installer dry-run/backup and report the generated rollback path.

## Progress

- [x] Implement the four Pi-native skills, ten-skill package contract, dual-source provenance, RC5 identity, tests, and user-facing documentation.
- [x] Run focused skill proof, `npm run validate`, Alpine ARM64 proof, preliminary release packaging, and managed-installer dry-run.
- [ ] Run final premerge proof, generate and reverify the definitive artifact, and complete final diff review.
- [ ] Commit and push `dev-next`, deploy the verified RC5 archive, verify fresh installed discovery, and record the final result before finalization.

## Decisions

- Release the changed payload as `1.0.0-rc.5` so RC4 remains immutable historical evidence.
- Ship all four adaptations as Markdown-only Pi skills with no helper executable, runtime dependency, Codex metadata, transcript parser, or evidence-capsule protocol.
- Keep `encode-invariant` model-visible; make `onboard-repository`, `audit-onboarding-proposal`, and `improve-harness` explicit-only alongside the existing explicit-only `grill-with-docs`.
- Use the existing managed execution plan as the only durable experiment record; `improve-harness` must not introduce a competing template or task store.
- Attribute the four adaptations to `repository-harness` commit `e765792b635b4d5e3e5fc0578f82f9ca5dea2681` and ship its MIT notice separately from the existing Matt Pocock provenance.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

Required evidence:

- Pi skill loader accepts all ten declared skill paths with zero diagnostics and explicit-only flags are correct.
- Focused package tests cover inventory, provenance, authority, Continuity boundaries, companion references, and cross-harness exclusions.
- npm run typecheck, npm run build, npm test, npm run validate, scripts/validate-premerge.sh, git diff --check, and npm run release pass as required.
- The generated archive passes exact staged install, inventory, sanitization, checksum, unzip, and managed-installer dry-run proof.
- After push/deploy, the remote branch points at the new commit and a fresh supported Pi process discovers all ten skills from the deployed package paths.

Observed candidate evidence:

- PASS — focused skill package proof: 7/7 tests after an observed five-failure red state caused by the four missing skills/license; Pi loaded all ten paths with zero diagnostics and the semantic authority/recovery assertions passed.
- PASS — `npm run validate`, receipt `0bd8fdfe-4508-4c0d-b6a1-2a533d59bde2`: typecheck, build, 152/152 tests, isolated Pi 0.84.1 two-workspace installation with ten exact skill source paths, and release static validation.
- PASS — `scripts/validate-alpine-arm64.sh`: Alpine 3.24.1 aarch64, Node v24.18.1, Pi 0.84.2, two isolated workspaces, ten exact skill source paths, and preserved stores.
- PASS — preliminary `npm run release`: sanitized 132-file RC5 report, exact staged installation, `unzip -t`, and SHA-256 `23b7bd9b23fec3063f2d09c5a4f828024d7e04a306b637e141a5662c543d4810`.
- PASS — preliminary managed-installer dry-run reverified that archive, targeted `/root/.pi/agent/packages/pi-continuity-work-memory`, and reported `storesChanged: false`.
- PASS — independent fixed-point review found no architecture, authority, provenance, inventory, or cross-harness defect; its three focused findings are being resolved before premerge.
- FAIL — first `scripts/validate-premerge.sh` attempt reached 151/152 tests; the new fresh-rerun assertion was line-wrap-sensitive (`improvement claim`) while the skill behavior and all other gates passed. The assertion was corrected to accept Markdown whitespace and requires a fresh full run at a new Git fixed point.

Pending: final premerge, definitive artifact/dry-run, commit, remote push, managed deployment, installed-file identity, and fresh Pi 0.84.2 discovery.

## Result

Implementation and candidate validation are complete. Final delivery and post-delivery verification remain pending.
