<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"1032d53f-ae9f-4b6e-a9d3-d7ba9619eac1","templateVersion":1} -->

# Execution Plan: Deliver TDD and contract-first RC6

Date: 2026-08-27

## Status

Ready for completion

## Outcome

Commit only the authorized TDD and contract-first RC6 changes, push dev-next to origin/dev-next, publish GitHub prerelease v1.0.0-rc.6 with checksum-bound assets, deploy that exact committed archive to the current user managed Pi package, and verify remote, release, installed identity, persistent-store preservation, and rollback evidence.

## Authority And Context

- The user explicitly requested commit, push, publish, and deploy, then confirmed the recommended mapping of publish to GitHub prerelease v1.0.0-rc.6 and deploy to the current user managed package.
- The exact GitHub target is thoitiettxl-cyber/pi-continuity-work-memory; dev-next is both the current and default branch, and origin/dev-next is the authorized push target.
- The local branch already contains unpushed commit 601a0a8 (docs(agents): clarify dependency and validation guidance); pushing dev-next will publish it before the new RC6 commit.
- The npm package pi-continuity-work-memory does not exist and this delivery does not authorize creating it; the repository has an existing GitHub prerelease convention.
- The completed implementation plan docs/plans/completed/adapt-tdd-contract-first.md and its executable evidence own the RC6 implementation result; this delivery plan owns subsequent commit, remote, release, and deployment receipts.

## Scope

In scope:

- Stage and commit only the prior TDD/contract-first task paths plus this delivery plan, excluding all unrelated dirty and untracked work.
- Run repository-required proof and validate the exact committed source before pushing.
- Push dev-next to origin/dev-next without force or history rewriting and verify the remote branch SHA.
- Build a sanitized RC6 archive from an isolated clean checkout of the committed implementation so unrelated dirty package-listed files cannot enter the payload.
- Publish GitHub prerelease v1.0.0-rc.6 targeting the implementation commit, attaching the verified ZIP and checksum file, then verify observed release identity and assets.
- Replace the current Git package registration only as required to deploy the exact verified RC6 archive through the repository-owned managed installer to /root/.pi/agent/packages/pi-continuity-work-memory.
- Verify installed version, exact eleven skill sources, stable managed registration, persistent-store preservation, restart requirement, and rollback backup.
- Record delivery evidence, finalize this plan, create a documentation-only delivery commit, and push the final dev-next state.

Out of scope:

- Publishing to npm, opening or merging a pull request, changing branch protection, force pushing, rewriting history, or creating another release identity.
- Committing, cleaning, reverting, stashing, packaging, or deploying unrelated worktree changes.
- Running real-provider memory proof or claiming actual model adherence beyond existing deterministic package and loader evidence.
- Restarting persistent services or altering Continuity or memory stores.

## Constraints

- Preserve RC5 archives and checksums unchanged; publish only the distinct RC6 identity.
- Use explicit path staging and inspect the cached diff before each commit.
- Package from committed source in an isolated temporary checkout; do not package the dirty primary worktree.
- Do not expose credentials, settings contents, stores, provider payloads, or tokens.
- Before deployment, state target, change, reason, impact, and recovery. Preserve persistent stores and retain the installer-created rollback backup.
- Existing Pi processes keep their loaded runtime; report restartRequired rather than attempting to hot-reload them.
- If push, release publication, registration replacement, or deployment becomes uncertain, inspect the real target and require human reconciliation before any retry.

## Approach

- Inspect Pi package-management authority, current registration, repository diff, remote release/tag state, and the exact task-owned path set.
- Stage the task-owned implementation files and this plan only; review cached name/status and diff; run pre-commit proof; create a focused Conventional Commit.
- Create an isolated clean checkout at the implementation commit, install reproducibly, run required premerge validation, build the RC6 release, and verify archive inventory and checksum.
- Push dev-next to origin/dev-next and verify the remote SHA.
- Publish and verify GitHub prerelease v1.0.0-rc.6 with the ZIP and checksum assets targeting the implementation commit.
- Inspect current user package registration, perform the narrowly required migration from Git registration, deploy the checksum-verified RC6 archive, and verify installed package/skills, storesChanged, backup, and fresh-process discovery.
- Update acceptance and this plan with observed delivery evidence; finalize the plan, run post-move validation, commit only delivery records, and push/verify final dev-next.

## Risks And Recovery

- A dirty package-listed unrelated file could contaminate an archive; prevent this with isolated committed-source packaging and compare the archive/report to the implementation commit.
- A pushed defect must be recovered with a new revert or fix commit, never force push or history rewrite.
- GitHub release publication is externally visible; if incorrect, stop and report rather than silently retagging or deleting it.
- Deployment atomically replaces the managed package and settings registration; recover with the installer backup, the preserved RC5 archive, or reinstallation of the prior Git source while retaining Continuity and memory stores.
- An interrupted registration migration could leave no active package; inspect pi list, settings metadata, installed target, and installer receipts before deciding whether any retry is safe.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.

## Decisions

- Publish means GitHub prerelease `v1.0.0-rc.6` targeting the implementation commit with exactly the verified ZIP and checksum assets; npm publication remains out of scope.
- The definitive delivery artifact is built from an isolated clean clone of commit `1140be1f474ac88d4d0ff3bc7592f56fa790649c`; its SHA-256 `8e85b9fce05be8dec0508630dc7ceac63d63f6ab6362f645e5b0b2c7ac3f399f` supersedes the earlier dirty-worktree local candidate for publication and deployment authority.
- Migration from the existing Git package used Pi's documented `pi remove` command before the package-owned archive manager established one stable managed registration; recovery remains reinstalling the Git source, restoring the installer backup, or redeploying preserved RC5.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Cached diff contains only authorized paths and git diff --cached --check passes.
- Repository typecheck, build, 202-test baseline, install/Git-install proof, release validation, and scripts/validate-premerge.sh pass for the exact implementation commit.
- The RC6 ZIP has the expected package identity, exact eleven skills, sanitized inventory, successful unzip integrity, isolated install proof, and recorded SHA-256.
- origin/dev-next resolves to the pushed implementation commit before publication and later to the final delivery-record commit.
- GitHub release v1.0.0-rc.6 is a prerelease targeting the implementation commit and exposes exactly the intended ZIP and checksum assets.
- The managed installer reports RC6, storesChanged false, restartRequired true, stable registration, and a rollback backup; installed files and fresh Pi discovery show all eleven packaged skills.
- Final repository diff check and managed-workflow post-finalize validation pass, with unrelated worktree changes still present and unstaged.

## Result

Ready for completion. Implementation commit `1140be1f474ac88d4d0ff3bc7592f56fa790649c` contains only the authorized RC6 skill, package, proof, and plan paths and was fast-forward pushed to `origin/dev-next` together with the already-authorized ancestor `601a0a8`. Primary-worktree and isolated-clean-clone premerge gates passed with 202/202 tests, strict typecheck/build, Pi 0.84.1 install and Git-install/update proof, and exactly eleven skills.

The clean commit produced the definitive 138-file sanitized archive with SHA-256 `8e85b9fce05be8dec0508630dc7ceac63d63f6ab6362f645e5b0b2c7ac3f399f`. GitHub prerelease `v1.0.0-rc.6` targets the exact implementation commit and exposes only the ZIP and checksum at `https://github.com/thoitiettxl-cyber/pi-continuity-work-memory/releases/tag/v1.0.0-rc.6`; GitHub reports the ZIP digest equal to the local trusted digest.

The managed installer deployed that archive to `/root/.pi/agent/packages/pi-continuity-work-memory`, reported `storesChanged: false` and `restartRequired: true`, created rollback backup `/root/.pi/agent/backups/pi-continuity-work-memory/2026-08-27T04-28-38-172Z-8788-75c5f0c7`, and established exactly one `packages/pi-continuity-work-memory` registration. Installed-package validation on Pi 0.84.3 loaded all eleven packaged skill sources with verified workflow assets. Historical RC5 remains unchanged; unrelated worktree changes remain unstaged. No npm publication, force push, pull request, provider run, persistent-service restart, or store mutation was performed.
