<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"ab95af40-d606-4a7b-8f50-503572053ce0","templateVersion":1} -->

# Execution Plan: Pi-native global engineering skills

Date: 2026-08-21

## Status

Active

## Outcome

Ship six globally discoverable Pi engineering skills from pi-continuity-work-memory—grill-with-docs, codebase-design, diagnosing-bugs, tdd, code-review, and domain-modeling—adapted for Pi 0.84.x, Alpine, repository authority, managed workflow, Continuity validation, serialized optional subagents, and safe global deployment; commit and push the verified change and deploy it through the package-owned user installer.

## Authority And Context

- The user explicitly authorized implementation in this repository, final commit, push, and global skills deployment.
- The existing package owns global installation through scripts/manage-user-install.mjs and supports Pi >=0.84.1 <0.85.0 on Node >=22.19.0 and Alpine ARM64.
- The upstream source is /root/code/skills at mattpocock/skills version 1.2.3, main SHA 5b15a47f2d7150f545fbcacbfe381787fc0230dc, licensed MIT.
- Applicable AGENTS.md, docs/ARCHITECTURE.md, workflow/WORKFLOW.md, repository validation gates, and current runtime evidence remain authoritative.

## Scope

In scope:

- Add package-owned skills/ resources for grill-with-docs, codebase-design, diagnosing-bugs, tdd, code-review, and domain-modeling with Pi-compatible frontmatter and references.
- Adapt workflow language to Pi skill loading, optional serialized subagents, Alpine shell constraints, explicit authority, managed work preparation, repository-owned durable truth, native validation, and checkpoint semantics.
- Add provenance/license documentation, package manifest and release inventory support, focused validation/tests, README, architecture, acceptance-map, and changelog updates required by the user-visible package contract.
- Run focused and full repository proof, package a verified release payload, review final diff, commit, push the current dev-next branch, deploy through the package-owned global installer, and verify observed installation state.

Out of scope:

- Modify the upstream /root/code/skills clone.
- Create a separate skills repository or publish an npm release.
- Port ask-matt, setup, triage, to-spec, to-tickets, implement, wayfinder, prototype, research, resolving-merge-conflicts, wizard, or improve-codebase-architecture.
- Change the persistent-memory malformed-JSON behavior reported earlier.
- Refactor unrelated extension, persistence, Continuity, provider, or workflow behavior.

## Constraints

- Keep production runtime dependencies empty and use no native binaries or desktop assumptions.
- Preserve Pi support >=0.84.1 <0.85.0 and Alpine ARM64 compatibility.
- Use no Codex agents/openai.yaml metadata and no nonexistent Skill tool calls.
- Global skills must defer to applicable repository instructions and explicit user authority; they must never auto-commit, push, publish, deploy, create competing durable plans, or elevate memory/checkpoints to completion authority.
- Read-only clarification and review must remain document-free; managed mutations call continuity_prepare_work before the first repository mutation when available.
- Do not expose secrets or inspect unredacted global settings; preserve unrelated files and use the package-owned atomic installer with recovery.

## Approach

- Inspect package/release/install validation ownership and current skill/package discovery assumptions.
- Design and add the six adapted skills plus bounded references and upstream provenance.
- Update package manifest, release validation/tests, README, architecture, acceptance evidence map, and changelog as required by the new shipped resources.
- Run focused skill/package checks, TypeScript/build/tests, full validation, premerge, release, artifact inspection, and installer dry-run.
- Update the execution plan with progress, decisions, validation, and result; review the complete diff and relevant untracked files.
- Create a focused Conventional Commit, push dev-next to its configured remote, deploy the verified release through scripts/manage-user-install.mjs, and verify the installed package/skills state with a recovery path.

## Risks And Recovery

- Skill name collisions could load an unintended copy; package validation and post-deploy inspection must prove one packaged source, and pi config or managed remove/redeploy can disable or roll back it.
- A global deployment changes the full managed package, not only Markdown skills; use the package-owned dry-run and atomic backup/activation path, and recover by redeploying the previous trusted archive or using manage-user-install remove with retained stores.
- Cross-harness assumptions could cause unsafe behavior; static checks and representative Pi install proof must reject Skill-tool, parallel/background, auto-commit, desktop, secret-write, and competing-plan assumptions.
- Push is externally visible; verify branch, diff, commit, remote, and authentication before pushing. A bad pushed commit can be reverted with a new focused commit rather than history rewriting.

## Progress

- [x] Implement the six adapted skills, package discovery, provenance, install/release checks, and user-facing documentation.
- [x] Complete full repository, premerge, Alpine, release, artifact-inspection, and installer dry-run proof.
- [ ] Create and push the feature commit, deploy the verified archive, and verify the installed package and six skill sources.
- [ ] Record final evidence and deployment result before finalization.

## Decisions

- Keep the six skills inside this package and expose their six directories explicitly through `pi.skills`; do not create a separate repository or runtime dependency, and do not expose root provenance Markdown to skill discovery.
- Release the changed deployable identity as `1.0.0-rc.3` so the installed artifact is distinguishable from the historical immutable RC2 payload.
- Make `grill-with-docs` explicit-only and self-contained from the upstream grilling primitive; leave the other five skills model-visible with narrow trigger descriptions.
- Treat all skill guidance as subordinate to repository authority and Continuity: clarification/review are read-only, mutations prepare work shape, one execution plan owns durable truth, and delivery/external effects remain explicit.
- Use optional subagents only as independent sequential calls with a no-subagent fallback; ship no helper executables, native dependencies, desktop opener, or Codex-specific metadata.
- Declare the six skill directories explicitly in `pi.skills` so Pi never parses root provenance/readme Markdown as a skill; isolated proof uses a private HOME and verifies every command source path.
- Treat explicit grill invocation as clarification-only, diagnosis without a requested fix as diagnose-only, and domain discussion/ADR consideration as read-only until the current user request grants the exact documentation or fix authority.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Validate every skill directory against Pi skill frontmatter/resource rules and run focused package/release inventory tests.
- Run npm run typecheck, npm run build, npm test, npm run validate, scripts/validate-premerge.sh, and git diff --check as repository gates.
- Run npm run release and inspect the generated archive inventory/checksum, then run the managed installer dry-run against that exact archive.
- After commit/push/deploy, verify remote branch/commit, managed package registration, packaged skill files, and fresh Pi discovery or the repository-owned isolated install proof; record any unavailable real-interface check as deferred rather than pass.

Observed before delivery:

- PASS — six Pi skill-validator runs accepted every shipped skill directory.
- PASS — focused package and managed-installer tests, including zero Pi loader diagnostics and clarification/diagnosis/domain authority regressions.
- PASS — `npm ci` completed with zero reported vulnerabilities.
- PASS — `npm run validate`: typecheck, build, 150/150 tests, isolated Pi 0.84.1 install/source proof, and release static validation.
- PASS — `scripts/validate-premerge.sh`, including the full validate gate and `git diff --check`.
- PASS — `scripts/validate-alpine-arm64.sh` on Alpine 3.24.1 ARM64, Node v24.18.1, Pi 0.84.2, and six skill source paths.
- PASS — definitive RC3 archive `release/pi-continuity-work-memory-1.0.0-rc.3.zip` was generated with SHA-256 `e64cfd5dcaac2319ec3c4ffd363c25298f61007f7dcc939cd194bf9e3086766b`; archive inspection found the expected skill resources, and the managed-installer dry-run revalidated the archive and reported that persistent stores would remain unchanged.
- PASS — independent read-only review findings were addressed: no inferred documentation/fix authority, no root Markdown skill diagnostics, isolated collision-resistant source proof, current acceptance ownership, and no duplicate README heading.

## Result

Pending implementation and executable proof.
