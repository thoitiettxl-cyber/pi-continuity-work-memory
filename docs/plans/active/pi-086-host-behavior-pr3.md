<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"6b470307-94c9-4824-97ed-4a6c3a41cd21","templateVersion":1} -->

# Execution Plan: Pi 0.86 host-behavior on PR 3

Date: 2026-09-20

## Status

Active

## Outcome

PR #3 delivers Pi 0.86.0 host-behavior: before_agent_start injects Continuity/workflow/memory via systemPromptOptions.sections without returning systemPrompt or forceSystemPrompt; package identity 1.0.0-rc.7; peer range >=0.86.0 <0.87.0; proof artifacts match gates run on this Ubuntu/Debian host.

## Authority And Context

- User confirmed Shared Understanding then authorized implement.
- Target is Pi 0.86.0 host-behavior (option B), not contract-only and not new 0.86 features.
- Vehicle is open PR #3 (compat/pi-0.86-bun). Do not mix unpublished local 4159e44.
- Operator/proof host is Ubuntu/Debian like this machine. Alpine is not a live gate; do not remove Alpine scripts.
- User authorized commit, push, and update of existing PR #3. Merge remains unauthorized.

## Scope

In scope:

- Rewrite before_agent_start to mutate systemPromptOptions.sections and not return systemPrompt/forceSystemPrompt.
- Bump package identity to 1.0.0-rc.7 and align peer/dev pins, version gates, skills compatibility, README, AGENTS, ARCHITECTURE, CHANGELOG.
- Add focused tests for section injection and forbidden full-prompt return.
- Rewrite proof/RESULTS.json and ACCEPTANCE current rows so they match observed gates; Alpine historical/not applicable; no fake PASS.
- Run local premerge on this host with Pi 0.86.0.
- Commit the RC7 host-behavior worktree, push `compat/pi-0.86-bun`, and update existing PR #3.

Out of scope:

- Pi 0.86 features: cache_warming, /bug, modelRegistry.stream, custom provider.
- Dual-range 0.84/0.85 support.
- Forever-latest policy.
- Alpine PASS or deleting Alpine matrix/scripts.
- Real-provider memory PASS.
- Changing Bun/lockfile strategy beyond PR #3.
- Merge, force-push, or GitHub review submit.

## Constraints

- Node >=22.19.0, Bun 1.4.2, Pi >=0.86.0 <0.87.0.
- Keep prepare npm-compatible for Pi Git-install omit-dev.
- No runtime package dependencies; pinned typescript 5.9.3 stays.
- Repository files own durable progress; this plan is the work document.
- Fail-closed: do not return { systemPrompt } from before_agent_start.

## Approach

- Check out PR #3 branch without disturbing unpublished local 4159e44.
- Red: test that before_agent_start mutates sections and does not return systemPrompt.
- Green: implement section injection in src/extension.ts.
- Align package version, peers, docs, skills, CHANGELOG to 1.0.0-rc.7 / Pi 0.86.
- Rewrite RESULTS and ACCEPTANCE to match this host and deferred Alpine/provider.
- Run premerge gates on Pi 0.86.0 and record Result.

## Risks And Recovery

- Returning systemPrompt would cache-miss and replace the leading prompt on 0.86; tests must forbid it.
- Unpublished local bun commit must stay off this branch.
- If a gate fails, stop and report; do not claim PASS.
- Rollback is revert of PR #3 commits / keep >=0.84.1 <0.86.0 on another branch.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.
- [ ] Commit, push, and update PR #3.
- [ ] Set Status to Ready for completion and finalize in this run unless remaining in-scope delivery is unfinished.

## Decisions

- Section keys match inner XML names (`continuity-work-state`, `managed-repository-workflow`, `persistent-memory`); Pi 0.86 wraps `sections[name]` as an extra outer tag.
- Empty section keys are deleted. `before_agent_start` returns undefined and never sets `forceSystemPrompt`.
- Local `/usr/local/bin/node` is Bun's node shim; premerge used official Node v22.19.0 linux-arm64 on PATH plus live `pi` 0.86.0.
- Stale `node_modules` still had `@earendil-works/pi-coding-agent@0.84.1`; `bun install --frozen-lockfile` restored lockfile 0.86.0 types (`sections`).

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- bun run typecheck
- bun run test
- validate:install with live Pi 0.86.0
- validate:git-install
- validate:release
- git diff --check
- CI remains typecheck+test only
- Alpine and real-provider not gates

## Result

PASS — source-local premerge on Ubuntu 24.04.5 LTS aarch64, Node v22.19.0, Bun 1.4.2, Pi 0.86.0: typecheck; test 283/283; validate:install; validate:git-install; validate:release; git diff --check. Alpine historical/not applicable. Real-provider DEFERRED. Commit/push/PR #3 authorized this run; merge remains out of scope.
