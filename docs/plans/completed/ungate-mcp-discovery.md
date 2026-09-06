<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"3a235032-a85a-4f6b-b23d-df607b99c64c","templateVersion":1} -->

# Execution Plan: Ungate MCP discovery and deploy

Date: 2026-08-24

## Status

Ready for completion

## Outcome

Commit the Continuity classifier fix that treats MCP discovery and mcpScript as read-only, rebuild the rc.5 release ZIP from that commit, and deploy it to the user Pi package so a fresh process no longer blocks ordinary MCP calls.

## Authority And Context

- User explicitly requested commit and deploy of the MCP ungate.
- AGENTS.md and docs/ARCHITECTURE.md remain repository authority.
- Leave unrelated dirty ARCHITECTURE.md, leftover ungate-web-x-search plan edits, and docs/proposals/ uncommitted.

## Scope

In scope:

- Commit only the MCP classifier, tests, README, changelog, and this execution plan.
- Rebuild the current rc.5 release ZIP from the committed tree.
- Deploy the new archive to ~/.pi/agent/packages/pi-continuity-work-memory.

Out of scope:

- Do not push, open a pull request, or change the package version.
- Do not commit unrelated documentation, leftover plans, or proposals.
- Do not deploy a stale pre-fix rc.5 archive.

## Constraints

- Conventional Commit subject only; no sign-off or breaking footer.
- Use the repository-owned release then manage-user-install deploy path.
- Preserve fail-closed classification for unknown tools, interactive browser actions, and MCP auth-start/auth-complete.

## Approach

- Create and bind this execution plan.
- Stage and commit the intended MCP-ungate files plus this plan.
- Run npm run release to rebuild dist and the rc.5 ZIP.
- Deploy the new archive to the user Pi package path.
- Record commit ID, deploy result, and that a fresh Pi process is required.

## Risks And Recovery

- Deploy replaces the user-scope package runtime but does not move Continuity or memory stores. Recover by redeploying the previous trusted archive.
- If release or deploy fails, leave the committed source in place and do not activate a partial package.
- A still-running Pi process will keep the old extension until the user starts a fresh process.

## Progress

- [x] Create and bind this execution plan.
- [x] Stage and commit the intended MCP-ungate files plus this plan.
- [x] Run npm run release to rebuild dist and the rc.5 ZIP.
- [x] Deploy the new archive to the user Pi package path.
- [x] Record the verified result before finalization.

## Decisions

- Leave unrelated `docs/ARCHITECTURE.md`, leftover `ungate-web-x-search` plan edits, and `docs/proposals/` uncommitted.
- Treat local user-package deploy as an authorized external side effect of this request.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run typecheck and npm test already passed on the classifier change.
- npm run release must succeed before deploy.
- After deploy, the installed classifier must treat mcp discovery and mcpScript as read-only.

## Result

Committed `d26c11f7ee1bbab570a79572d846a2b53c3f9ba8`. Rebuilt and deployed `pi-continuity-work-memory@1.0.0-rc.5` (`sha256:2839186a487d975e69fde70d16625a338c15b17a19cb123b00816576a4ced6a7`) to `/root/.pi/agent/packages/pi-continuity-work-memory`. Installed classifier treats `mcp` discovery/`mcpScript` as read-only and keeps `auth-start`/`auth-complete` as mutation. A fresh Pi process is required before a live MCP test.
