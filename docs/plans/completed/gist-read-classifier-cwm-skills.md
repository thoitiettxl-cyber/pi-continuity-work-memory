<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"cc6c34a3-2072-44fb-a562-6e28f24f8a21","templateVersion":1} -->

# Execution Plan: Gist document-read classifier and CWM skills settings

Date: 2026-09-09

## Status

Ready for completion

## Outcome

Reading gist.github.com documents is classified as discovery rather than managed-workflow mutation, and all eleven pi-continuity-work-memory skills are registered in user settings.json so other Pi sessions discover them without searching the workspace. Global ~/.pi/agent/skills remain unchanged.

## Authority And Context

- User asked to fix gist.github.com document reads blocked as mutation, then to install every pi-continuity-work-memory skill in settings.json. Global Pi-root skills already load normally and must not be copied.
- Observed Eta session 01a08581 blocked node /root/.pi/agent/skills/summarize/to-markdown.mjs with a quoted gist.github.com URL and --tmp because node is only read-only for --version/-v.
- web_search and non-interactive browser actions are already read-only. gh gist view/list are missing from GH_READ_ACTIONS. curl/wget and the summarize converter are not allowlisted.
- User settings live at /root/.pi/agent/settings.json. Paths there resolve relative to ~/.pi/agent. Package already lists packages/pi-continuity-work-memory; adding its skills/ directory to settings.skills makes CWM skills load even if package skill discovery is missed. Same real SKILL.md paths are skipped, not collided.
- grill-with-docs, onboard-repository, audit-onboarding-proposal, and improve-harness stay explicit-only via disable-model-invocation. settings.json cannot put those four into the system prompt; they remain /skill:name unless a later request changes that contract.

## Scope

In scope:

- Classify gh gist list and gh gist view as read-only GitHub discovery; keep create/edit/delete/rename and --web as external mutations.
- Classify simple curl and wget GET-to-stdout of https://gist.github.com and https://gist.githubusercontent.com URLs as read-only document fetch; reject output files, uploads, non-GET methods, credentials, and non-gist hosts.
- Classify node .../skills/summarize/to-markdown.mjs <gist-https-url> [--tmp] as read-only; keep --out, --summary, --prompt, and other node scripts as mutation.
- Add focused tool-classifier tests for the observed quoted gist URL, allowed gist reads, and fail-closed neighbors.
- Update README, CHANGELOG, and the architecture discovery sentence for gist document lookup.
- Add packages/pi-continuity-work-memory/skills to ~/.pi/agent/settings.json skills array. Do not edit global Pi-root skills or disable-model-invocation.

Out of scope:

- Do not reclassify uvx, arbitrary node scripts, curl/wget of non-gist hosts, or gist create/edit/delete.
- Do not change disable-model-invocation or copy skills into ~/.pi/agent/skills.
- Do not commit, push, release, or deploy.
- Do not edit docs/plans/active/commit-push-deploy-clone-classifier.md.
- Do not run full validate/premerge unless later delivery is requested.

## Constraints

- Fail-closed allow-list: unknown tools, uvx, credential display, output files, and GitHub writes stay external.
- Preserve unrelated worktree changes.
- Out-of-repo settings.json recovery is to remove the added skills array entry.
- A still-running Pi process will not hot-load settings.json.
- Quoted ? and # in gist URLs must remain literal data in splitSimpleCommand.

## Approach

- Add failing classifier tests for gist document reads and mutating neighbors.
- Implement gh gist list/view, gist-host curl/wget GET-to-stdout, and summarize to-markdown.mjs gist URL [--tmp] as read.
- Update README, CHANGELOG, and architecture discovery wording.
- Add CWM skills directory to user settings.json.
- Run focused typecheck and tool-classifier tests; record results in this plan.

## Risks And Recovery

- Over-broad curl/node allowlisting could hide writes or credential fetches. Recovery: gist HTTPS hosts only, stdout/tmp converter only, no --out/--summary/-u/-o.
- settings.json skills path could warn on name collision if package and settings resolve different files. Recovery: same deployed package path; Pi skips identical real paths.
- Current Pi process keeps old classifier and old settings until a fresh process.
- If settings.json edit is wrong, restore by deleting the skills array; do not revert unrelated settings.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.

## Decisions

- Gist document lookup is discovery for managed workflow: `gh gist list`/`view`, HTTPS GET-to-stdout of `gist.github.com`/`gist.githubusercontent.com`, and `node …/skills/summarize/to-markdown.mjs <gist-https-url> [--tmp]`.
- Keep gist create/delete/`--web`, curl/wget output files or non-gist hosts, summarize `--out`/`--summary`, credential headers, uvx, and other node scripts fail-closed as external mutations.
- Register CWM skills in user `settings.json` as `packages/pi-continuity-work-memory/skills` plus `enableSkillCommands: true`. Do not copy global Pi-root skills and do not change `disable-model-invocation`.
- This request does not authorize commit, push, or deploy. The live user package still serves the previous classifier until a later deploy and a fresh Pi process.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run typecheck
- npm run build:test
- node --test --test-concurrency=1 .test-build/test/tool-classifier.test.js
- git diff --check
- Inspect settings.json skills entry and that disable-model-invocation is unchanged.

## Result

Implemented in the worktree. Focused proof passed:

- `npm run typecheck` — PASS (`continuity_validate` receipt `65ddff62-e03c-4a5a-b2da-290acc795047`)
- `npm run build:test` — PASS
- `node --test --test-concurrency=1 .test-build/test/tool-classifier.test.js` — PASS (24/24)
- `git diff --check` — PASS (`continuity_validate` receipt `c0919e07-77af-4b9a-b782-0d504fe88f69`)
- User settings now include `"skills": ["packages/pi-continuity-work-memory/skills"]` and `"enableSkillCommands": true`. The four explicit-only skills still have `disable-model-invocation: true`.

Not live in this Pi process: classifier changes are source-only until an authorized deploy of the package; settings.json loads on a fresh Pi process. Unrelated dirty file `docs/plans/active/commit-push-deploy-clone-classifier.md` was left untouched.

In-scope work and focused proof are recorded. Commit, push, and deploy stayed out of scope, so this plan is ready to move to `docs/plans/completed/`.
