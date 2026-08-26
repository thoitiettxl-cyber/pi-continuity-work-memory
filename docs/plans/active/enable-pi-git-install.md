<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"82f7b5e0-7985-40dd-9eb7-0bad4381262b","templateVersion":1} -->

# Execution Plan: Enable first-class Pi Git installation

Date: 2026-08-26

## Status

Ready for completion

## Outcome

Users can install the package from its public GitHub repository with `pi install git:github.com/thoitiettxl-cyber/pi-continuity-work-memory`; the Git checkout builds the untracked `dist/` entrypoint during Pi's dependency-install lifecycle, and repository documentation plus executable install proof describe and verify the supported path.

## Authority And Context

- The user explicitly requested changing installation so everyone can use `pi install git:...`.
- Pi 0.84 package documentation and the installed package manager confirm Git installs clone the repository and, by default, run `npm install --omit=dev` when `package.json` exists; a configured `npmCommand` uses plain `install`.
- Repository instructions prohibit committing generated `dist/`, so Git installation must generate it in the managed clone.
- The current worktree contains unrelated modified and untracked files that must be preserved.

## Scope

In scope:

- Add the minimal package lifecycle/dependency support required to build `dist/` in Pi's Git clone.
- Make the public GitHub Git source the primary README installation path, while retaining the managed archive tooling as an advanced verified-release option.
- Add executable coverage for the Git-source install/build contract and align package/release acceptance checks.
- Update user-visible changelog and relevant architecture/acceptance documentation.

Out of scope:

- Committing, pushing, publishing, releasing, or deploying.
- Changing Continuity, memory, workflow, or skill runtime behavior.
- Removing the existing managed archive installer or persistent stores.
- Modifying unrelated dirty worktree files.

## Constraints

- Support Node.js >=22.19.0 and Pi >=0.84.1 <0.85.0.
- Do not commit generated `dist/`, `.test-build/`, `release/`, or package-manager stores.
- Keep Pi API packages as peer dependencies and add no runtime dependency except a concrete build-time requirement proven necessary for Pi's `npm install --omit=dev` Git lifecycle.
- Use the repository's documented verification gates and review final diff/untracked files.

## Approach

- Add a focused failing contract test or validation assertion for Git-clone installation before implementation.
- Update package lifecycle metadata and lockfile so Pi's omit-dev Git install can compile the extension.
- Update README, changelog, architecture, and acceptance evidence for the Git install path.
- Run focused proof, typecheck/tests, install/release validation as proportional, then review the final diff.

## Risks And Recovery

- A Git install without an available compiler leaves `dist/extension.js` missing; pin the build-only compiler dependency and verify from a clean source checkout with dev dependencies omitted.
- Pi Git updates clean ignored output before reinstalling dependencies; ensure the lifecycle rebuilds `dist/` on every clean install/update.
- Dependency or lifecycle changes could affect release payload installs; retain existing release checks and recover by reverting package metadata/docs changes.
- Do not claim public availability until the changed branch/ref is committed and pushed; report that external delivery remains pending.

## Progress

- [x] Added the Git-install lifecycle, pinned build-only emitter, dedicated no-check emit config, real Pi Git install/update proof, and user-facing installation contract.
- [x] Ran focused proof, full validation, and the repository premerge gate.
- [x] Ran the mandatory fresh release-artifact gate after committing the implementation; public push remains separately authorized by the user's follow-up.

## Decisions

- Keep generated `dist/` ignored and compile it during Git installation instead of committing build output.
- Pin TypeScript 5.9.3 as the only install dependency because Pi's default Git-package lifecycle omits dev dependencies; keep Pi APIs and `typebox` host-provided peers.
- Use `tsconfig.git-install.json` with `noCheck` only for install-time emission; repository typecheck and release builds continue to use the strict checked configurations.
- Exercise Pi's actual Git source parser, managed checkout, command discovery, clean/update, and rebuild paths through a temporary dumb-HTTP loopback repository rather than inferring integration from a local-path install.
- Document the default npm omit-dev behavior separately from configured `npmCommand`, which uses plain `install`.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- `node scripts/validate-git-install.mjs --real-pi-http-async` — PASS on Pi 0.84.1: real `pi install git:http://...`, managed-checkout command discovery, generated entrypoint, remote commit advance, `pi update --extensions`, stale-output cleanup, rebuild, and command reload.
- `node --test .test-build/test/git-install-package.test.js` — PASS (1/1 focused package-contract test).
- `npm --silent run validate` — PASS: strict typecheck, build, 200/200 tests, isolated two-workspace install, real Git install/update proof, and release static validation.
- `sh scripts/validate-premerge.sh` — PASS with the same 200/200 baseline plus repository premerge checks.
- `npm run release` — PASS after commit `8d1be43`: produced a sanitized 136-file independent-install ZIP, passed `unzip -t`, and emitted SHA-256 `f90da03faac718c64019d3f33fe94e20c4b9e2e750e4e5240e9144f918707fdd`.
- `continuity_checkpoint` — DEFERRED: five failed or timed-out proof attempts remain `uncertain` in the operation ledger even though later distinct proofs passed; only direct user reconciliation can clear those records.
- `continuity_finalize_work` — DEFERRED for the same unresolved operation ledger; the plan is evidence-ready but remains under `docs/plans/active/` until user reconciliation permits the managed move.
- `git diff --check` and final task-scoped diff/status review — PASS; unrelated pre-existing worktree changes remain untouched.
- `git push origin dev-next` — PASS: GitHub `refs/heads/dev-next` resolved to `d6640c8a2773397aa68d63b2e5cdc7a4179ba7bc` immediately after delivery.

## Result

Implemented, committed, and pushed first-class Pi Git installation and update support without committing generated output. Real loopback Git integration, source/premerge gates, fresh release-artifact proof, and GitHub delivery all pass. The documented command is available from the default `dev-next` branch at remote commit `d6640c8`; managed document finalization remains deferred only by the unresolved Continuity operation ledger recorded above.
