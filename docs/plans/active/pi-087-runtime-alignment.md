<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"cb0f565d-3bde-4b01-87a6-bb3a1bcc744c","templateVersion":1} -->

# Execution Plan: Align extension runtime to Pi 0.87.0

Date: 2026-09-22

## Status

Active

## Outcome

The extension host contract and runtime boundaries match Pi 0.87.0 documentation: supported range is >=0.87.0 <0.88.0, provider-bound session source follows canonical model context including context_edit omissions and replacements, and deferred provider stops do not become successful memory extracts. Development, tests, and repository scripts run through Bun 1.4.2 instead of the node binary. A draft PR contains the fix.

## Authority And Context

- User requested a Pi 0.87.0 self-audit of core components, inter-process communication, runtime mechanism, and system interaction workflow, then a compliant fix, commit, push, and pull request.
- Live host pi is 0.87.0. Pi changelog and docs/extensions.md, docs/rpc.md, docs/session-format.md, and docs/packages.md are the rule sources.
- Decision: project commands and tests use Bun. Portable `node:` built-ins stay because Pi loads the extension in its own runtime and Bun implements the same specifiers. `prepare` remains `npm run build:git-install` because Pi Git-install invokes npm.
- Repository AGENTS.md currently pins Pi >=0.86.0 <0.87.0. That range is the contract to replace, not authority to keep rejecting the upgraded host.
- Decision: move the supported window to >=0.87.0 <0.88.0, matching the previous single-minor host window. Do not keep a 0.86 compatibility shim.
- TUI-only status, notify, plan browser, and context governor remain intentional product boundaries already enforced by tests. Pi allows hasUI methods in RPC, but this package must not start calling them.

## Scope

In scope:

- Update the Pi peer range, development pins, version gate, skills compatibility lines, and user-facing contract docs to >=0.87.0 <0.88.0.
- Make provider session serialization honor Pi 0.87 canonical context: prefer SessionManager.buildSessionProjection when present, and otherwise apply the latest context_edit so omitted targets are not sent and replacements replace content.
- Treat memory-provider stopReason deferred and pending as deferred failures instead of successful JSON extracts.
- Add regression tests for context_edit omission, replacement, and projection preference.
- Bump prerelease identity to 1.0.0-rc.8 and record the host-contract change in the changelog Unreleased section.
- Switch repository scripts, CI, and the test runner from the node binary to Bun. Keep Pi Git-install `prepare` on npm.
- Run repository proof with `bun test`, then commit, push, and open a draft pull request.

Out of scope:

- Dual support for Pi 0.86 and 0.87.
- Enabling RPC or print UI status, notifications, or the context governor.
- Rewriting the operation ledger, workflow gate, or tool classifier.
- Editing the historical docs/plans/active/pi-086-host-behavior-pr3.md plan.
- Publishing a release, merging the pull request, or changing KernelSU, networking, or host packages.

## Constraints

- Smallest coherent diff. Match existing TypeScript style.
- Do not claim proof that was not executed.
- Commit only the authorized files. Never force-push or skip hooks.
- continuity_prepare_work must stay bound to this plan; do not create a second lifecycle document.

## Approach

- Update package contract, version gate, changelog, and compatibility strings.
- Implement canonical context serialization and deferred provider stop handling with tests.
- Refresh bun.lock and package-lock.json for the 0.87.0 development pins.
- Typecheck and test. Run the premerge gate if the environment can finish it.
- Review the diff, commit, push a feature branch, and open a draft PR.

## Risks And Recovery

- Dropping 0.86 support is intentional and breaking for older hosts. Recovery is to revert the range only if the user rejects that decision.
- Projection-based serialization must keep leaf cursors on the raw branch so continuity custom entries do not force a resync loop. If tests show a cursor regression, keep indexing on getBranch and only change serialized content.
- Lockfile updates can be large. If install fails, stop and report the package error instead of hand-editing resolved URLs.
- Push or PR failure does not authorize force-push, credential changes, or a different remote.

## Progress

- [ ] Implement the approved outcome.
- [ ] Run behavior-appropriate and repository-required proof.
- [ ] Record the verified result before finalization.
- [ ] Set Status to Ready for completion and finalize in this run unless remaining in-scope delivery is unfinished.

## Decisions

- No task-local decision recorded yet.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- bun run typecheck
- bun run test
- scripts/validate-premerge.sh if runtime allows; otherwise report it as not run
- git diff --check

## Result

Pending implementation and executable proof.
