<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"333e50b5-84f5-4804-81e5-70ba46be90e0","templateVersion":1} -->

# Execution Plan: Adapt TDD regression guidance and add contract-first skill

Date: 2026-08-27

## Status

Ready for completion

## Outcome

Ship `1.0.0-rc.6` with a Pi-native prompt-only contract-first engineering skill and strengthen the existing tdd skill with regression-first and materially distinct execution-path parity guidance, with package inventory, provenance, documentation, tests, and distributable-payload validation aligned; preserve RC5 and do not commit, push, publish, release externally, deploy, or alter Continuity runtime behavior.

## Authority And Context

- The user explicitly confirmed the Shared Understanding and authorized implementation of tdd plus contract-first.
- The confirmed scope keeps contract-first model-visible with a narrow independent-consumer/provider trigger and folds selected ECC ai-regression-testing methods into the existing tdd skill.
- Reviewed ECC source checkout /root/code/ECC is at commit d8409a4b0813771235555e32e3d8046a73988bfa on main aligned with origin/main and carries the MIT license.
- Repository AGENTS.md, docs/ARCHITECTURE.md, skills/README.md, skills/UPSTREAM.md, package.json, tests, and observable validation remain authoritative.
- The worktree contains unrelated pre-existing tracked and untracked changes; they must be preserved and excluded from this task.

## Scope

In scope:

- Add skills/contract-first/SKILL.md as a concise Pi-native prompt-only adaptation.
- Strengthen skills/tdd/SKILL.md and its existing bounded references only where necessary for reproducible regression-first behavior and parity across materially distinct execution paths.
- Update the exact package skill inventory, provenance and MIT notice, user-facing skill documentation, architecture/acceptance/changelog contract, and focused package tests required by the changed distributable payload.
- Use test-first focused assertions for the new skill and TDD guidance, then run repository-required validation proportional to a package engineering-skill and release-payload change.
- Review the final diff and relevant untracked files while preserving unrelated work.

Out of scope:

- Core Continuity, managed-workflow, checkpoint, memory, provider, SQLite, classifier, browser, MCP, web-search, or x-search behavior.
- Production-readiness and every other ECC skill or pattern.
- Installing ECC, adding runtime npm dependencies, generators, native binaries, hooks, agents, commands, or detached services.
- Commit, push, publish, external release, deployment, or any unrelated cleanup.

## Constraints

- Preserve Node.js >=22.19.0, Pi >=0.84.1 <0.85.0, Alpine ARM64 compatibility, strict prompt-only skill resources, and no new runtime dependency.
- Automatic skill loading grants no mutation or external-action authority; contract-first must defer to repository contract ownership and managed preparation.
- Do not impose a universal coverage threshold, require every path, or fabricate a RED state when a bug cannot be reproduced.
- Contract-first must avoid ceremony for one atomic same-module boundary and must treat external refs/generator inputs as untrusted data with no implicit network or dependency installation.
- Keep one canonical repository execution plan for this durable task and do not duplicate task truth in Continuity or memory.
- Do not overwrite, stage, revert, or otherwise disturb pre-existing unrelated changes.

## Approach

- Record focused failing package assertions for the eleven-skill inventory, ECC provenance/license, contract-first authority and trigger boundaries, and TDD regression/path-parity behavior.
- Add the ECC license/provenance mapping and implement the concise contract-first skill plus focused TDD guidance to satisfy the assertions.
- Align package.json, skills/README.md, README.md, docs/ARCHITECTURE.md, proof/ACCEPTANCE.md, CHANGELOG.md, and release/install contract references required by the eleven-skill payload.
- Run focused tests and review attributable failures; then run typecheck/build/tests and repository package/premerge/release gates required by scope.
- Review final diff and relevant untracked files, record validation and result in the bound plan, and stop without commit, push, publish, release deployment, or external side effects.

## Risks And Recovery

- A broad trigger could inject contract ceremony into ordinary local refactors; constrain activation to independently evolving consumers/providers and explicit contract work, with a shared-type escape hatch.
- Copied ECC assumptions could reintroduce Claude hooks, Context7, generators, coverage quotas, or unsafe network behavior; adapt methods natively and assert prompt-only/authority boundaries.
- Mixed-source TDD provenance can become ambiguous; record both original Matt Pocock lineage and the exact ECC method/commit plus separate MIT notice.
- Changing the exact skill inventory can break install/release proof or collide with a global skill source; use isolated Pi discovery/source-path validation and exact manifest assertions.
- Repository gates regenerate ignored artifacts; inspect and preserve relevant pre-existing generated state, and recover by correcting only attributable files rather than reverting unrelated work.

## Progress

- [x] Add focused assertions and observe the intended RED state for inventory, skill semantics, TDD behavior, and ECC provenance.
- [x] Implement `contract-first`, regression-aware `tdd`, eleven-skill inventory, ECC provenance/license, and primary package documentation.
- [x] Complete broader proof: typecheck, build, 202/202 tests, install/Git-install, release static validation, final premerge, RC6 packaging, and isolated installer dry-run.
- [x] Record the verified result before finalization.

## Decisions

- Keep `contract-first` model-visible with a narrow independent-consumer/provider trigger; an atomic same-module boundary uses its existing shared type instead.
- Fold ECC regression methods into `tdd` rather than adding an overlapping AI-regression skill: reproduce the bug first, test only materially distinct paths, and reject fabricated RED states and fixed coverage quotas.
- Preserve mixed TDD provenance explicitly: Matt Pocock remains the primary TDD source and ECC commit `d8409a4b0813771235555e32e3d8046a73988bfa` owns the added regression/path-parity method.
- Add no generator, hook, command, agent, MCP configuration, dependency, runtime behavior, commit, push, publish, or deployment.
- The user authorized the recommended `1.0.0-rc.6` package identity for local release proof so the historical RC5 ZIP/checksum remain untouched; this does not authorize commit, push, publish, or deployment.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Blockers

- None. The user selected the recommended `1.0.0-rc.6` identity for local
  packaging, resolving the RC5 overwrite risk.

## Validation

- Focused red/green execution of the compiled skills-package test, covering exact eleven-skill discovery, contract-first semantics, TDD regression/path parity, and ECC provenance/license.
- npm run typecheck, npm run build, npm test, and npm run validate as required by repository instructions.
- scripts/validate-premerge.sh and git diff --check for a premerge-quality package change.
- npm run release plus archive/inventory/install validation because the distributable skill payload changes; this produces local proof only and does not publish or deploy.
- Final diff/status review separating passed, failed, deferred, and skipped evidence; model retrieval/adherence claims remain deferred unless a fresh representative Pi run actually exercises the skill.

Observed focused evidence:

- RED — `node --test .test-build/test/skills-package.test.js`: 4/10 passed and 6/10 failed for the intended missing eleven-skill manifest, `contract-first`, TDD regression guidance, and ECC license/provenance.
- INTERMEDIATE — the first green candidate reached 9/10; the only failure was a Markdown line-wrap-sensitive assertion for `independent proof`, corrected to accept whitespace without weakening the skill contract.
- GREEN — `node --test --test-concurrency=1 --test-reporter=spec .test-build/test/skills-package.test.js`: 10/10 passed, including zero Pi loader diagnostics and all new semantic/provenance assertions.
- PASS — `npm run typecheck` and `npm run build` completed successfully.
- PASS — `npm test`: 202/202 serial tests passed.
- PASS — `npm run validate`: 202/202 tests plus isolated Pi 0.84.1 install with `skillsLoaded: 11`, clean Git-install/update proof, and release static validation with `skills: 11`.
- PASS — `scripts/validate-premerge.sh`: repeated full validation and completed `git diff --check` successfully.
- PRELIMINARY PASS — `node scripts/package-release.mjs` produced the local RC6 candidate with 138 files, exact staged install, `unzip -t`, sanitization, and SHA-256 `eb563c90e84d5b6ca6ad98697d2f9c5c4f60f28231c705db7195a2671f0dc383`; definitive `npm run release` remains after acceptance alignment.
- PASS — after final provenance-document alignment, `node --test --test-concurrency=1 --test-reporter=tap .test-build/test/skills-package.test.js` passed 10/10 focused tests.
- PASS — final `bash -e scripts/validate-premerge.sh` passed on RC6 with 202/202 tests, strict typecheck/build, `skillsLoaded: 11`, clean Git-install/update proof, release static validation with `skills: 11`, and `git diff --check`.
- PASS — final `npm --silent run release` produced `release/pi-continuity-work-memory-1.0.0-rc.6.zip`: 138 files, exact inventory/staged install, sanitization, `unzip -t`, and SHA-256 `4c79e32bc5e871cac2a5267bc1f890df1cef31f084da824288162d8e3f7932ea`.
- PASS — `diff -qr dist release/stage/pi-continuity-work-memory/dist` found no post-premerge difference from the staged runtime.
- FAIL-CLOSED — installer dry-run against the real user agent directory exited 1 because the existing `git:github.com/thoitiettxl-cyber/pi-continuity-work-memory` registration is intentionally non-local and cannot be replaced automatically; no user settings/runtime changed.
- PASS — installer dry-run against the supported isolated `--agent-dir /tmp/pi-continuity-rc6-dry-run-333e50b5` verified RC6, 160 ZIP entries, 137 inventory files, `storesChanged: false`, and left the target path absent.
- DEFERRED — actual model retrieval/adherence was not inferred from discovery tests; provider execution, external release, publication, deployment, commit, and push were not requested or performed.

## Result

Ready for completion. `pi-continuity-work-memory@1.0.0-rc.6` now exposes exactly eleven prompt-only skills, adds the Pi-native `contract-first` workflow, strengthens `tdd` with reproducible regression-first and materially distinct path evidence, and ships separate pinned ECC MIT provenance without adding runtime dependencies or changing Continuity behavior. Full source, install, Git-install, premerge, release, staged-runtime parity, and isolated archive-installer proof passed. The final local RC6 archive SHA-256 is `4c79e32bc5e871cac2a5267bc1f890df1cef31f084da824288162d8e3f7932ea`; historical RC5 remains present at SHA-256 `f90da03faac718c64019d3f33fe94e20c4b9e2e750e4e5240e9144f918707fdd`. No commit, push, publication, deployment, provider run, or real user-agent mutation occurred.
