<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"d88f640b-737a-4dfb-a6e2-8f3bdce9fe6c","templateVersion":1} -->

# Execution Plan: Deliver active memory reasoning fix

Date: 2026-08-25

## Status

Active

## Outcome

Commit and push the active-model/session-thinking memory fix, then deploy a fresh verified archive to the managed Pi user package while preserving unrelated work and persistent stores.

## Authority And Context

- User explicitly requested commit, push, and deploy.
- Current branch is dev-next; origin is thoitiettxl-cyber/pi-continuity-work-memory.
- README.md and scripts/manage-user-install.mjs own managed archive deployment.

## Scope

In scope:

- README.md, src/infrastructure/pi-memory-provider.ts, test/release-alignment.test.ts, and this plan.
- Focused commits, normal push of dev-next, release archive, dry-run, managed user deployment, installed verification.

Out of scope:

- All other dirty files, npm publication, tags, GitHub releases/PRs, force push, Pi restart, persistent-store mutation, real provider call.

## Constraints

- Preserve unrelated tracked/untracked changes.
- Use repository validation/release/installer paths.
- Do not expose secrets.
- Existing Pi process needs restart.

## Approach

- Inspect exact diff and branch divergence.
- Validate, stage scoped files, commit, push and verify remote.
- Build fresh release archive and checksum; dry-run installer.
- Deploy exact archive and verify receipt/installed implementation.
- Record delivery evidence, validate and finalize plan.

## Risks And Recovery

- Normal push includes any existing local commit ahead of origin; inspect exact range and report it.
- Deployment replaces the managed runtime; recover via installer backup or prior trusted archive without deleting stores.
- Inspect actual remote/target before retrying any uncertain operation.

## Progress

- [ ] Implement the approved outcome.
- [ ] Run behavior-appropriate and repository-required proof.
- [ ] Record the verified result before finalization.

## Decisions

- No task-local decision recorded yet.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run validate and scripts/validate-premerge.sh pass.
- git diff --check passes.
- npm run release and installer dry-run pass.
- origin/dev-next matches pushed commit.
- Installer reports storesChanged false and installed source contains active thinking-level clamping.

## Result

Pending implementation and executable proof.
