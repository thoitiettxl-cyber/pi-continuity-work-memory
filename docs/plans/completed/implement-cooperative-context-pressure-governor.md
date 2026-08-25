<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"7748ec25-9f7c-4f3f-a07e-63a85d75efe8","templateVersion":1} -->

# Execution Plan: Implement cooperative context pressure governor

Date: 2026-08-25

## Status

Ready for completion

## Outcome

Implement the accepted version-1 cooperative context-pressure governor from docs/proposals/cooperative-context-pressure-governor.md, prove its pure policy and Pi extension behavior, document the shipped contract, create a focused final commit, push the current dev-next branch to origin/dev-next, package a verified release archive, and deploy it through the repository-owned managed installer to /root/.pi/agent/packages/pi-continuity-work-memory while preserving persistent stores and unrelated worktree changes.

## Authority And Context

- The user explicitly requested implementation of docs/proposals/cooperative-context-pressure-governor.md plus final commit, push, and deploy.
- docs/proposals/cooperative-context-pressure-governor.md is accepted design input but not execution authority or completion evidence.
- AGENTS.md and docs/ARCHITECTURE.md own repository boundaries, validation, delivery, and documentation coupling.
- The repository exposes one managed deployment path, scripts/manage-user-install.mjs via npm run deploy:user; deploy is therefore scoped to the current user Pi package target /root/.pi/agent/packages/pi-continuity-work-memory, not npm publication or another host.
- Current branch is dev-next with configured upstream origin/dev-next. Existing dirty plan/proposal files must be preserved and only task-owned files staged.

## Scope

In scope:

- Add a pure application-layer context-pressure policy with exact threshold, validation, hysteresis, epoch reset, bounded advisory rendering, and bounded status reporting.
- Integrate a TUI-only ephemeral context-event advisory, lifecycle resets, status key, settled /compact recommendation, and /continuity context-governor status|on|off controls without changing Continuity authority.
- Add focused policy and extension integration tests, including non-TUI isolation and forbidden side-effect assertions.
- Update README.md, docs/ARCHITECTURE.md, proof/ACCEPTANCE.md, CHANGELOG.md, and include the named accepted proposal as design history.
- Run focused, full, premerge, release, checksum/dry-run, remote-branch, managed-deployment, and installed-package verification appropriate to the change.
- Create a focused Conventional Commit, push dev-next to origin/dev-next, and deploy the fresh verified archive to the managed user package target.

Out of scope:

- Calling ctx.abort(), ctx.compact(), pi.sendMessage(), pi.sendUserMessage(), or pi.appendEntry() from governor behavior.
- Automatic continuation, custom compaction, persisted governor state or telemetry, SQLite/schema changes, personal compaction-setting changes, non-TUI activation, production dependencies, or Pi core changes.
- Publishing to npm, tagging or creating a GitHub release, opening a pull request, force pushing, rewriting history, or deploying to another user, host, or package path.
- Staging, modifying, reverting, or finalizing unrelated active/completed execution-plan changes already present in the worktree.

## Constraints

- Keep Pi support at >=0.84.1 <0.85.0 and use no API absent from 0.84.1, including session_compact_failed.
- Keep policy in src/application/context-pressure-governor.ts with no Pi runtime-type imports; keep Pi adaptation in src/extension.ts.
- Governor state is session/process-local, advisory-only, fail-open locally, and must never compromise Continuity authority.
- Non-TUI message behavior must remain unchanged apart from handler registration, and non-TUI paths must not touch ctx.ui.
- Use strict ESM TypeScript repository style, Node built-ins only, node:test coverage, and preserve unrelated dirty files.
- Commit only task-owned files. Push only after repository gates pass. Deploy only a fresh checksum-verified archive; recover by redeploying the prior trusted archive or using the installer-created backup without deleting stores.

## Approach

- Re-verify relevant Pi 0.84.1 and current-runtime docs, event/type/message conversion, compaction scheduling, and existing extension/test seams.
- Add focused red tests for pressure calculations, invalid inputs, hysteresis/reset, advisory rendering, context injection, lifecycle controls, non-TUI isolation, and forbidden calls; observe intended failures.
- Implement the pure context-pressure governor and extension adapter in small green slices while preserving existing Continuity/memory lifecycle behavior.
- Update user, architecture, acceptance, changelog, and durable-plan records; review scoped diff against the accepted proposal.
- Run focused tests and typecheck, then npm run validate, scripts/validate-premerge.sh, git diff --check, and scoped review; repair attributable failures.
- Finalize evidence in the plan, obtain receipt-bound validation/finalization as required, create the focused commit, and verify post-commit gates.
- Verify origin/dev-next state and push the committed branch without force; confirm the remote commit.
- Run npm run release, inspect archive/checksum, run managed-installer dry-run, state the exact target/impact/recovery, deploy the verified archive to /root/.pi/agent/packages/pi-continuity-work-memory, and verify installed identity/behavior with a fresh supported Pi process where available.
- Record final commit, push, artifact, deployment, restart, validation, and recovery evidence; finalize the execution plan with fresh validation and deliver a concise result.

## Risks And Recovery

- A cooperative advisory may be ignored by the model; deterministic tests prove injection but real-provider compliance must be reported as PASS, FAIL, or DEFERRED rather than inferred.
- Incorrect context-event handling could persist or duplicate advisory messages; recover by disabling /continuity context-governor off or reverting the focused commit and redeploying a prior trusted archive.
- Lifecycle reset mistakes could carry pressure across compaction/model/session boundaries; focused integration tests must cover each reset and unknown post-compaction usage.
- Push is externally visible; if a defect is found after push, recover with a new fix/revert commit rather than rewriting history.
- Deployment atomically replaces the managed package and requires a fresh Pi process; recover via the installer-generated backup or redeploy a prior trusted archive while preserving Continuity and memory stores.
- If any push or deploy outcome becomes uncertain, inspect the real target and reconcile rather than retrying automatically.

## Progress

- [x] Re-verify Pi 0.84.1 and deployed 0.84.3 context, message, mode, and compaction lifecycle surfaces.
- [x] Implement the pure pressure policy through observed red/green tests.
- [x] Integrate ephemeral TUI advisories, lifecycle resets, transition status, settled recommendation, and session-local controls.
- [x] Update README, architecture, acceptance, changelog, and proposal design history.
- [x] Complete full validation, premerge, preliminary release/dry-run, supported-runtime proof, and final scoped review.
- [x] Reconcile the observed failed red-build operation before safe finalization.
- [x] Prepare the exact task-owned commit set and checksum-bound archive for authorized delivery.
- [x] Record final source evidence and result before finalization.

## Decisions

- Classify from `tokens/contextWindow` and treat Pi's reported percentage as diagnostics-only input; conflicting reported percentages cannot affect pressure.
- Keep governor state and enablement in extension memory only. `off` preserves the current epoch so re-enabling does not erase previously observed severity.
- Non-TUI command invocations do not activate the governor or touch `ctx.ui`; this preserves the stronger mode-isolation invariant even though RPC has a separate UI protocol.
- Deduplicate footer values while re-injecting one fresh advisory on every pressured provider call.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Focused pure-policy and extension integration tests demonstrate all proposal thresholds, advisory variants, monotonic epoch behavior, TUI controls, lifecycle resets, and forbidden side effects.
- npm run typecheck, npm test, npm run validate, scripts/validate-premerge.sh, and git diff --check pass on the intended source.
- npm run release produces a sanitized, inventory-verified archive with passing unzip/checksum/install proof; managed installer dry-run passes against that exact digest.
- Remote origin/dev-next resolves to the created commit after push.
- Managed installer reports PASS, storesChanged false, restartRequired true, exact target registration, backup path, and installed package identity; a fresh supported Pi proof is run where repository tooling permits.
- Real-provider cooperative compliance smoke is recorded PASS, FAIL, or DEFERRED and never inferred from unit tests.

Observed so far:

- RED — initial `npm run build:test` failed with TS2307 because the policy module did not yet exist.
- RED — the first full `npm test` run passed existing coverage and the pure policy tests but failed the seven new extension behaviors before event integration.
- SUPERSEDED — receipt `19e0607c-94ba-4d8d-9f6e-f8e2c21ce7c8`: `npm test`, 195/195 serial tests before final robustness/review corrections.
- PASS — receipt `68d4df0c-a412-4c77-8525-f583829b7032`: current `npm run typecheck`.
- PASS — receipt `b7863aa6-2d28-48e4-8570-1a2496af8c0c`: current `npm test`, 197/197 serial tests, including explicit session-start reset and the uncapped 20%-headroom/ceil branch.
- PASS — independent Standards and Intent/Behavior reviews identified stale evidence plus missing session-start and medium-window proof; those findings were corrected, explicit-`any` fixture boundaries were removed, and the current typecheck/test rerun passed.
- PASS — receipt `b20050c8-63c7-483f-9258-dd359f9e552a`: `npm run validate`, including clean, typecheck, build, 197/197 tests, isolated Pi 0.84.1 install proof, and release static validation.
- PASS — receipt `b3089cc1-6270-4326-8a55-70ca803814e5`: `scripts/validate-premerge.sh`, including the full validation chain and `git diff --check -- .`.
- PASS — direct `git diff --check -- .` on the reviewed worktree.
- PASS — isolated install proof against deployed Pi 0.84.3 and Alpine Linux 3.24.1 ARM64 validation with Node v24.18.1.
- PASS — preliminary `npm run release` produced a sanitized independent-install RC5 archive with 136 inventory files, passing `unzip -t`, and SHA-256 `5e38603c78d3b910954d050a313f33749be59271fcfb31fe400c32dd5bafc24d`.
- PASS — managed-installer dry-run independently reverified that exact archive (157 ZIP entries, 135 inventory files, 870,504 uncompressed bytes), target `/root/.pi/agent/packages/pi-continuity-work-memory`, stable registration replacement, and `storesChanged: false`.
- PASS — the human reconciled initial failed red-build operation `call_5XiUjow2cIqgvEhMSWAx5WdR|fc_0346838273dbaf80016a8d66fae59887d0a66bc3f0a9502485` as partially applied from the observed intentional TS2307 result and later clean rebuild; Continuity now reports determined mutation state and zero unresolved operations.
- DEFERRED — definitive post-commit artifact, push, deployment, installed-runtime, and real-provider cooperative-compliance observations. The provider smoke would require a costly controlled near-window TUI run and is not inferred from deterministic injection tests.

## Result

The accepted governor is implemented as a pure application policy plus a TUI-only Pi adapter. Exact thresholds, invalid-input fail-open handling, monotonic epochs, ephemeral single-message advisories, lifecycle resets, mode isolation, session controls, bounded status, and forbidden-side-effect guarantees are covered by 197 passing serial tests and the required typecheck/build/install/release/premerge gates. Independent Standards and Intent/Behavior review findings were corrected. Pi 0.84.1 and deployed 0.84.3 install proof, Alpine 3.24.1 ARM64 proof, a sanitized checksum-bound RC5 archive, and managed-installer dry-run pass. Real-provider cooperative compliance remains explicitly deferred because forcing a controlled near-window TUI run would incur material provider cost.

The repository source is ready for the authorized focused commit, `origin/dev-next` push, and managed user-package deployment. Those subsequent external facts are owned by Git/remote and installer receipts and are not preclaimed by this pre-delivery plan result.
