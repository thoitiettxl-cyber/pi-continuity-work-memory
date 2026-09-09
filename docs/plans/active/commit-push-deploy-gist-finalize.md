<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"b7c0a002-d479-4f20-87d7-326d8a56025c","templateVersion":1} -->

# Execution Plan: Commit, push, and deploy gist discovery and same-run finalize

Date: 2026-09-09

## Status

Active

## Outcome

Commit the gist document-discovery classifier and same-run finalize duty on dev-next, fast-forward push to origin/dev-next without force, rebuild pi-continuity-work-memory@1.0.0-rc.6 from that committed tree, and deploy the archive to /root/.pi/agent/packages/pi-continuity-work-memory so a fresh Pi process loads both changes.

## Authority And Context

- User explicitly requested commit, push, and deploy of the current gist-classifier and same-run-finalize work.
- AGENTS.md and docs/ARCHITECTURE.md remain repository authority.
- Local branch is dev-next tracking origin/dev-next. Remote is https://github.com/thoitiettxl-cyber/pi-continuity-work-memory.git. Package version stays 1.0.0-rc.6.
- README deploy contract: node scripts/manage-user-install.mjs deploy --archive release/pi-continuity-work-memory-1.0.0-rc.6.zip
- Preserve unrelated dirty file docs/plans/active/commit-push-deploy-clone-classifier.md.

## Scope

In scope:

- Commit the gist classifier, same-run finalize policy, docs, tests, workflow checksums, completed plans, and this delivery plan.
- git push origin dev-next with no force.
- Rebuild the current rc.6 release ZIP from the committed tree via npm run release.
- Deploy that archive to /root/.pi/agent/packages/pi-continuity-work-memory.
- Record commit ID, remote revision, archive digest, deploy receipt, and that a fresh Pi process is required.

Out of scope:

- Do not open a pull request or GitHub release.
- Do not change the package version.
- Do not force-push, rewrite history, or publish to npm.
- Do not restart this Pi process or move Continuity/memory stores.
- Do not include leftover docs/plans/active/commit-push-deploy-clone-classifier.md.
- Do not deploy a stale pre-fix archive.

## Constraints

- Conventional Commit subject only; no sign-off or breaking footer.
- Inspect origin/dev-next before any push retry.
- Inspect the install target and installer backup before any deploy retry.
- Do not retry an uncertain push or deploy.
- Persistent stores must remain unmoved.
- A still-running Pi process keeps the old classifier and policy until the user starts a fresh process.

## Approach

- Confirm intended files and exclude the leftover clone-classifier plan.
- Commit the gist discovery and same-run finalize changes with this plan.
- Push dev-next to origin/dev-next without force.
- Observe the remote-tracking revision.
- Run npm run release to rebuild dist and the rc.6 ZIP.
- Deploy the new archive through the managed installer with a matching expected digest.
- Record commit IDs, archive identity, deploy receipt, and recovery path in this plan.
- Set Status to Ready for completion and finalize in this run.

## Risks And Recovery

- A push can succeed despite a lost response; inspect origin/dev-next before retrying.
- Deploy replaces the user-scope package runtime but does not move Continuity or memory stores. Recover by redeploying the installer-reported backup archive.
- If release or deploy fails, leave the pushed source in place and do not activate a partial package.
- The current process will not hot-load the new extension.

## Progress

- [ ] Implement the approved outcome.
- [ ] Run behavior-appropriate and repository-required proof.
- [ ] Record the verified result before finalization.

## Decisions

- No task-local decision recorded yet.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Worktree commit set excludes leftover clone-classifier plan.
- Focused typecheck, continuity and tool-classifier tests, workflow-assets tests, and git diff --check already passed for the product change.
- Observed origin/dev-next equals local HEAD after push.
- npm run release produces release/pi-continuity-work-memory-1.0.0-rc.6.zip and a matching .sha256.
- Deploy receipt reports storesChanged false and restartRequired true.

## Result

Pending implementation and executable proof.
