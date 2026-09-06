<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"1659ae77-deea-493d-a0ec-769bc57cc923","templateVersion":1} -->

# Execution Plan: Push discovery classifier and deploy rc.6

Date: 2026-09-06

## Status

Ready for completion

## Outcome

Push the three local `dev-next` commits to `origin/dev-next` without force, rebuild `pi-continuity-work-memory@1.0.0-rc.6` from that tree, and deploy the archive to `/root/.pi/agent/packages/pi-continuity-work-memory` so a fresh Pi process loads the session-discovery classifier.

## Authority And Context

- User explicitly requested push and deploy after the discovery-classifier commit and leftover-plan cleanup.
- Local branch `dev-next` is ahead of `origin/dev-next` by `cfe16a0` (classifier), `63612ee` and `cb9d3b6` (plan archive).
- Remote is `https://github.com/thoitiettxl-cyber/pi-continuity-work-memory.git`. Package version stays `1.0.0-rc.6`.
- README deploy contract: `node scripts/manage-user-install.mjs deploy --archive release/pi-continuity-work-memory-1.0.0-rc.6.zip`. AGENTS.md and docs/ARCHITECTURE.md remain repository authority.

## Scope

In scope:

- `git push origin dev-next` with no force.
- Rebuild the current rc.6 release ZIP from the committed tree via `npm run release`.
- Deploy that archive to `/root/.pi/agent/packages/pi-continuity-work-memory`.
- Record observed remote revision, archive digest, deploy receipt, and that a fresh Pi process is required.

Out of scope:

- Do not open a pull request or GitHub release.
- Do not change the package version.
- Do not force-push, rewrite history, or publish to npm.
- Do not restart this Pi process or move Continuity/memory stores.
- Do not deploy a stale pre-fix archive.

## Constraints

- Inspect `origin/dev-next` before any push retry.
- Inspect the install target and installer backup before any deploy retry.
- Do not retry an uncertain push or deploy.
- Persistent stores must remain unmoved.
- A still-running Pi process keeps the old classifier until the user starts a fresh process.

## Approach

- Confirm a clean worktree and the three unpublished commits.
- Push `dev-next` to `origin/dev-next`.
- Observe the remote-tracking revision.
- Run `npm run release` to rebuild dist and the rc.6 ZIP.
- Deploy the new archive through the managed installer.
- Record commit IDs, archive identity, deploy receipt, and recovery path in this plan.

## Risks And Recovery

- A push can succeed despite a lost response; inspect `origin/dev-next` before retrying.
- Deploy replaces the user-scope package runtime but does not move Continuity or memory stores. Recover by redeploying the installer-reported backup archive.
- If release or deploy fails, leave the pushed source in place and do not activate a partial package.
- The current process will not hot-load the new extension.

## Progress

- [x] Confirmed clean product tree and pushed `9653501..cb9d3b6` to `origin/dev-next`.
- [x] Ran `npm run release` and deployed the rc.6 archive to the user Pi package path.
- [x] Recorded the verified result before finalization.

## Decisions

- Push the three product commits first; record this plan in a follow-up documentation commit.
- Deploy with `--expected-sha256` matching the just-built archive.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Worktree clean before push.
- Observed `origin/dev-next` equals local HEAD after push.
- `npm run release` produces `release/pi-continuity-work-memory-1.0.0-rc.6.zip` and a matching `.sha256`.
- Deploy receipt reports the expected package path, archive digest, and restart required; stores unchanged.

## Result

Pushed `origin/dev-next` `9653501..cb9d3b6` (`cb9d3b6e0e359c495f8971432d593ce57a3424d9`). Rebuilt and deployed `pi-continuity-work-memory@1.0.0-rc.6` (`sha256:4fab33acce3e69e0efef56231e7deaf6e6ee4db84f4bcef9ae310e04c43f3adf`) to `/root/.pi/agent/packages/pi-continuity-work-memory`. Deploy receipt: `storesChanged: false`, `restartRequired: true`, backup `/root/.pi/agent/backups/pi-continuity-work-memory/2026-09-06T05-25-36-046Z-15199-fc19aa9f`. Installed classifier treats `subagent`, `mcp__*`, `git hash-object` without `-w`, `git cat-file`, and `sha256sum` as read-only. A fresh Pi process is required.
