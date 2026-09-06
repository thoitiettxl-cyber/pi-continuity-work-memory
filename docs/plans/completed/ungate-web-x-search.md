<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"2d53a0e3-c759-4ea8-b7f3-fd82764c5eeb","templateVersion":1} -->

# Execution Plan: Ungate web and X search

Date: 2026-08-24

## Status

Ready for completion

## Outcome

Commit the Continuity classifier fix that treats web_search and x_search as read-only discovery, then deploy the rebuilt release payload to the user Pi package so a reloaded session no longer blocks those tools.

## Authority And Context

- User explicitly requested commit and deploy of the search-gating fix, then will reload the session for a live test.
- AGENTS.md and docs/ARCHITECTURE.md remain repository authority.
- Existing commit 4612c2a already classified web_search in source; this work adds x_search and deploys the runtime that still lacked both.

## Scope

In scope:

- Commit only the search-gating source, tests, README, and changelog.
- Build the current release ZIP and deploy it to ~/.pi/agent/packages/pi-continuity-work-memory.
- Leave unrelated ARCHITECTURE.md and docs/proposals/ uncommitted.

Out of scope:

- Do not push, open a pull request, or change package version.
- Do not commit unrelated documentation or proposals.
- Do not deploy from the stale 21 Aug rc.5 archive.

## Constraints

- Conventional Commit subject only; no sign-off or breaking footer.
- Use the repository-owned release then manage-user-install deploy path.
- Preserve fail-closed classification for unknown tools and interactive browser actions.

## Approach

- Stage and commit the intended search-gating files.
- Run npm run release to rebuild dist and the rc.5 ZIP.
- Deploy the new archive to the user Pi package path.
- Report commit ID, deploy result, and that a fresh Pi process is required.

## Risks And Recovery

- Deploy replaces the user-scope package runtime but does not move Continuity or memory stores. Recover by redeploying the previous trusted archive.
- If release or deploy fails, leave the committed source in place and do not activate a partial package.
- A still-running Pi process will keep the old extension until the user reloads.

## Progress

- [x] Classify `web_search` and `x_search` as read-only discovery and add focused tests.
- [x] Run `npm run typecheck` and `npm test`.
- [x] Commit the intended files only.
- [x] Rebuild and deploy the user package.
- [x] Record the verified result before finalization.

## Decisions

- Leave unrelated `docs/ARCHITECTURE.md` and `docs/proposals/` uncommitted.
- Treat local user-package deploy as an authorized external side effect of this request.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run typecheck already passed.
- npm test already passed.
- npm run release must succeed before deploy.
- After deploy, the installed classifier must include web_search and x_search.

## Result

Committed `c97edd34fb12f5119557180235a4022b0af721c1`. Rebuilt and deployed `pi-continuity-work-memory@1.0.0-rc.5` (`sha256:fb9286b7ce68c4cba4909547e93487edb542f8a97db9f27e0c6e7955f1fa5b5b`) to `/root/.pi/agent/packages/pi-continuity-work-memory`. Installed classifier allowlist includes `web_search` and `x_search`. A fresh Pi process is required before a live search test.
