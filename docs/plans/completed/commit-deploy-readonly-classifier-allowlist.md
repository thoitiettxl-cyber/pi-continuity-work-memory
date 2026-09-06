<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"ffebd390-9e9c-4e5a-a316-d1c020d60a3c","templateVersion":1} -->

# Execution Plan: Commit and deploy read-only classifier allowlist

Date: 2026-08-25

## Status

Active

## Outcome

Commit the classifier expansion for cat, ldd, pi --version/-v, and gh label list, rebuild pi-continuity-work-memory@1.0.0-rc.5, and deploy that archive to the user Pi package so a fresh process can use the updated read-only discovery rules.

## Authority And Context

- User explicitly requested commit and deploy of the classifier update and will reload afterwards.
- AGENTS.md and docs/ARCHITECTURE.md remain repository authority.
- Leave unrelated dirty and untracked docs/plans files uncommitted.

## Scope

In scope:

- Commit only CHANGELOG.md, README.md, src/application/tool-classifier.ts, and test/tool-classifier.test.ts.
- Rebuild the current 1.0.0-rc.5 release ZIP from the committed tree.
- Deploy the new archive to /root/.pi/agent/packages/pi-continuity-work-memory.

Out of scope:

- Do not push, open a pull request, or change the package version.
- Do not commit unrelated plan files.
- Do not deploy a stale pre-fix archive.

## Constraints

- Conventional Commit subject only; no sign-off or breaking footer.
- Use npm run release then manage-user-install deploy --archive.
- Keep unquoted operators and mutating pi/gh label forms fail-closed.

## Approach

- Stage and commit the four classifier files.
- Run npm run release to rebuild dist and the rc.5 ZIP.
- Deploy the new archive to the user Pi package path.
- Record commit ID, archive digest, and that a fresh Pi process is required.

## Risks And Recovery

- Deploy replaces the user-scope package runtime but does not move Continuity or memory stores. Recover by redeploying the previous trusted archive.
- If release or deploy fails, leave the committed source in place and do not activate a partial package.
- A still-running Pi process keeps the old extension until the user starts a fresh process.

## Progress

- [ ] Implement the approved outcome.
- [ ] Run behavior-appropriate and repository-required proof.
- [ ] Record the verified result before finalization.

## Decisions

- No task-local decision recorded yet.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run typecheck and npm test already passed on the classifier change.
- npm run release must succeed before deploy.
- After deploy, the installed classifier must treat cat, ldd, pi --version/-v, and gh label list as read-only.

## Result

Pending implementation and executable proof.
