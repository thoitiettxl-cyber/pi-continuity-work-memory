<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"253f762a-3944-469f-ab0a-10afd15f8ac3","templateVersion":1} -->

# Execution Plan: Release and deploy domain-modeling refinement RC4

Date: 2026-08-21

## Status

Active

## Outcome

Release the validated domain-modeling Continuity integration refinement as pi-continuity-work-memory 1.0.0-rc.4, commit and push it to dev-next, deploy the checksum-pinned package through the managed global installer, and verify that fresh Pi processes discover the refined package skill while persistent stores remain unchanged.

## Authority And Context

- The user explicitly confirmed the recommendation to version this refinement as 1.0.0-rc.4, commit it, push it, and deploy it globally through the package-owned managed installer.
- The current source-only refinement already changes skills/domain-modeling/SKILL.md, test/skills-package.test.ts, CHANGELOG.md, and proof/ACCEPTANCE.md and has passed 151/151 tests plus the complete premerge gate.
- The previous global deployment is immutable RC3 evidence and must not be overwritten or relabeled as RC4 evidence.
- Repository AGENTS.md, docs/ARCHITECTURE.md, workflow/WORKFLOW.md, package release scripts, and observed executable evidence remain authoritative.

## Scope

In scope:

- Bump package and lockfile identity from 1.0.0-rc.3 to 1.0.0-rc.4.
- Align README install examples and proof documents with the new RC4 release/deployment state without rewriting historical RC2 or RC3 evidence.
- Run focused skill validation, full repository validation, premerge, release packaging, archive inspection, and managed-installer dry-run.
- Create a focused commit, push dev-next to origin, deploy the checksum-pinned RC4 archive to /root/.pi/agent/packages/pi-continuity-work-memory, and verify registration, installed files, source paths, and fresh Pi discovery.
- Record final evidence and recovery information in this execution plan, finalize it through managed workflow, validate after the move, and push the completion commit.

Out of scope:

- Publish an npm release, create a GitHub pull request, tag a release, or alter branch protection.
- Change extension runtime, persistence schema, memory provider behavior, or any skill other than domain-modeling and shared package validation/documentation required by this release.
- Delete or reset Continuity or memory stores.
- Overwrite or relabel the existing RC3 archive as RC4.

## Constraints

- Keep production runtime dependencies empty and preserve Node >=22.19.0, Pi >=0.84.1 <0.85.0, and Alpine ARM64 compatibility.
- Use the package-owned release and managed installer workflows; do not edit the installed runtime directly.
- Do not expose global settings, credentials, provider payloads, or persistent store contents.
- Persistent stores must remain unchanged; deployment must create a rollback backup and report restartRequired accurately.
- Preserve unrelated work and use focused Conventional Commit subjects.

## Approach

- Inspect version-bearing and proof files and update RC4 identity consistently.
- Run focused skill/package checks and full source validation after all repository edits.
- Generate the definitive RC4 archive, record its SHA-256, inspect its inventory, and run managed-installer dry-run against that exact artifact.
- Review final diff and relevant untracked/generated files.
- Stage and create the feature/release commit, then push dev-next and verify the remote SHA.
- Deploy the exact checksum-pinned RC4 archive through scripts/manage-user-install.mjs and verify storesChanged is false and a rollback backup exists.
- Run the installed package validation from a fresh Pi 0.84.2 process and verify all six skill source paths resolve from the managed package.
- Update this plan with observed commit, artifact, deployment, validation, restart, and recovery evidence.
- Run receipt-bound validation, finalize the plan to docs/plans/completed, perform fresh post-move validation, commit and push the plan finalization, and verify a clean aligned branch.

## Risks And Recovery

- A version mismatch could make source, archive, and installed runtime ambiguous; validate all manifests, docs, archive inventory, and installed package identity before claiming delivery.
- A global deployment replaces the whole managed package; recover by redeploying the previous trusted RC3 archive or using the installer-created rollback backup, while preserving stores.
- A skill-name collision could shadow the package copy; verify command source paths from an isolated fresh Pi process and inspect the current managed registration.
- Push and deployment are externally visible; verify branch, remote, checksum, dry-run, and backup before each irreversible boundary, and use a new revert commit rather than rewriting Git history if correction is needed.

## Progress

- [x] Implement the refined skill, regression coverage, RC4 package identity, and release/proof documentation.
- [x] Run focused, full, premerge, Alpine, release, archive-inspection, and managed-installer dry-run proof.
- [ ] Commit and push the RC4 source, deploy the checksum-pinned archive, and verify the installed package from fresh Pi.
- [ ] Record the verified delivery result before finalization.

## Decisions

- Use `1.0.0-rc.4` as a new immutable payload identity; retain RC3 and its completed plan as historical evidence rather than overwriting or relabeling it.
- Keep the definitive artifact SHA-256 and managed deployment receipt in this execution plan and generated release report, not inside the archive's own proof payload.
- Treat the refinement as skill/process-only: the provider runtime is unchanged, so historical RC2 real-provider evidence remains history and is not rerun or promoted to RC4 authority.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Pi standalone validator accepts skills/domain-modeling with no diagnostics.
- npm run validate passes typecheck, build, all tests, isolated Pi 0.84.1 install/source proof, and release static validation.
- scripts/validate-premerge.sh and git diff --check pass on the final release source.
- npm run release produces a sanitized independent RC4 archive whose checksum and inventory pass inspection.
- The managed installer dry-run passes against the exact RC4 archive with stores unchanged.
- After deployment, pi list reports the stable package registration, installed package.json reports 1.0.0-rc.4 and exactly six skill paths, and the installed validate-install script passes on fresh Pi 0.84.2.
- git ls-remote confirms both pushed commits on origin/dev-next and the final worktree is clean and aligned.

Observed before delivery:

- PASS — Pi standalone validation accepted `skills/domain-modeling`; Pi package loading reports zero diagnostics for all six manifest skills.
- PASS — RC4 `npm run validate` and `scripts/validate-premerge.sh`: typecheck, build, 151/151 tests, isolated Pi 0.84.1 install/source proof, release static validation, and `git diff --check`.
- PASS — `scripts/validate-alpine-arm64.sh` on Alpine Linux 3.24.1 ARM64, Node v24.18.1, and Pi 0.84.2, including six exact package skill source paths.
- PASS — definitive `release/pi-continuity-work-memory-1.0.0-rc.4.zip` packaging: 127 files, sanitized independent payload, exact staged install, six skill files, and `unzip -t`; SHA-256 `83d17834af73149e426e168709731321736d7e64b72dcd1ad4e40cde43fb8b4e`.
- PASS — managed-installer dry-run reverified the exact checksum-pinned RC4 archive, targeted `/root/.pi/agent/packages/pi-continuity-work-memory`, and reported `storesChanged: false`.
- PASS — GitHub CLI authentication and repository resolution observed `thoitiettxl-cyber/pi-continuity-work-memory` with default branch `dev-next`; no GitHub state beyond the authorized upcoming branch push was changed.

## Result

Pending implementation and executable proof.
