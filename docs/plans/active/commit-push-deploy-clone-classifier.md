<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"4263ecdb-15a3-4bd9-bfae-b5088a58962b","templateVersion":1} -->

# Execution Plan: Commit, push, and deploy clone discovery classifier

Date: 2026-09-07

## Status

Active

## Outcome

Commit the ordinary-clone read-only classifier on dev-next, fast-forward push to origin/dev-next without force, rebuild pi-continuity-work-memory@1.0.0-rc.6 from that committed tree, and deploy the archive to /root/.pi/agent/packages/pi-continuity-work-memory so a fresh Pi process loads the clone discovery rules.

## Authority And Context

- User explicitly requested commit, push, and deploy of the clone classifier change.
- AGENTS.md and docs/ARCHITECTURE.md remain repository authority.
- Local branch dev-next is ahead of origin/dev-next by 2770b28 plus uncommitted clone-classifier files.
- Remote is https://github.com/thoitiettxl-cyber/pi-continuity-work-memory.git. Package version stays 1.0.0-rc.6.
- README deploy contract: node scripts/manage-user-install.mjs deploy --archive release/pi-continuity-work-memory-1.0.0-rc.6.zip

## Scope

In scope:

- Commit CHANGELOG.md, README.md, docs/ARCHITECTURE.md, src/application/tool-classifier.ts, test/managed-workflow-extension.test.ts, test/tool-classifier.test.ts, and this plan.
- git push origin dev-next with no force.
- Rebuild the current rc.6 release ZIP from the committed tree via npm run release.
- Deploy that archive to /root/.pi/agent/packages/pi-continuity-work-memory.
- Record commit ID, remote revision, archive digest, deploy receipt, and that a fresh Pi process is required.

Out of scope:

- Do not open a pull request or GitHub release.
- Do not change the package version.
- Do not force-push, rewrite history, or publish to npm.
- Do not restart this Pi process or move Continuity/memory stores.
- Do not deploy a stale pre-fix archive.

## Constraints

- Conventional Commit subject only; no sign-off or breaking footer.
- Inspect origin/dev-next before any push retry.
- Inspect the install target and installer backup before any deploy retry.
- Do not retry an uncertain push or deploy.
- Persistent stores must remain unmoved.
- A still-running Pi process keeps the old classifier until the user starts a fresh process.

## Approach

- Confirm the intended files and commit the clone classifier with this plan.
- Push dev-next to origin/dev-next without force.
- Observe the remote-tracking revision.
- Run npm run release to rebuild dist and the rc.6 ZIP.
- Deploy the new archive through the managed installer with a matching expected digest.
- Record commit IDs, archive identity, deploy receipt, and recovery path in this plan.

## Risks And Recovery

- A push can succeed despite a lost response; inspect origin/dev-next before retrying.
- Deploy replaces the user-scope package runtime but does not move Continuity or memory stores. Recover by redeploying the installer-reported backup archive.
- If release or deploy fails, leave the pushed source in place and do not activate a partial package.
- The current process will not hot-load the new extension.

## Progress

- [ ] Commit the clone classifier files and this plan.
- [ ] Push `dev-next` to `origin/dev-next` without force.
- [ ] Rebuild and deploy the rc.6 archive to the user Pi package path.
- [ ] Record the verified result before finalization.

## Decisions

- Include this plan in the product commit; record push/deploy receipts in a follow-up documentation commit.
- Treat local user-package deploy as an authorized external side effect of this request.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Worktree contains only the intended classifier and plan files before commit.
- npm test already passed 268/268 and npm run typecheck passed on the classifier change.
- Observed origin/dev-next equals local HEAD after push.
- npm run release produces release/pi-continuity-work-memory-1.0.0-rc.6.zip and a matching .sha256.
- Deploy receipt reports storesChanged false and restartRequired true.

## Result

Pending implementation and executable proof.
