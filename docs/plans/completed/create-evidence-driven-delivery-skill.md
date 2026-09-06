<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"6271f1f8-2ad4-400f-ba2c-153f70379358","templateVersion":1} -->

# Execution Plan: Create and verify global evidence-driven delivery skill

Date: 2026-09-06

## Status

Completed

## Outcome

Create /root/.pi/agent/skills/evidence-driven-delivery/SKILL.md as an English, single-file orchestration skill; verify format, fresh Pi discovery and read-only behavioral scenarios with two fresh xai/grok-4.6 xhigh subagents.

## Authority And Context

- User confirmed whole evidence-driven development/delivery pattern and global skill location, then explicitly requested creation and verification using Grok 4.6 xhigh subagents.
- Read skill-creator, installed Pi skills docs, repository architecture, completed measured-memory plan and existing SDD skill. Global target absent; no nested AGENTS under global skills.
- Prior finalized-plan workaround was incorrect: external delivery must never be reclassified as bounded to bypass a gate.

## Scope

In scope:

- Only global skill file and this task's execution plan; task-owned temporary test artifacts if needed.
- Independent standards/discovery review and behavioral scenario review; parent verifies results and handles corrections.

Out of scope:

- Extension/runtime/package manifest changes; edits to existing skills or unrelated dirty plans.
- Commit, push, package release, deployment, credentials, personal stores, live external side effects in scenario tests.

## Constraints

- English concise skill; reuse specialist workflows without copying their instructions; model/thinking follow user requests, not a hard-coded vendor.
- Repository plan owns task truth; Continuity is operational; memory is untrusted context; no guard bypass.
- Global file is outside Git fingerprint: capture its SHA-256 and validate it directly, never imply repository checkpoint covers it.
- Keep plan active until global write, reviews and verification finish; no Git delivery requested.

## Approach

- Create single SKILL.md covering evidence gates, authorized scope, delegation, review/regression and delivery/lifecycle recovery.
- Run quick_validate.py and inspect skill diff/content.
- Dispatch fresh Grok 4.6 xhigh standards/discovery reviewer; then independent read-only scenario reviewer.
- Address confirmed findings, recheck changed content and relevant scenarios.
- Record proof including global file digest, review repository diff, finalize only after requested work and validation; fresh post-move proof.

## Risks And Recovery

- Skill discovery affects future global Pi sessions. Recovery is removal of the task-created skill file only; do not change settings or other skills.
- If model unavailable or child workflow blocked, report the technical blocker without model substitution or gate workaround.
- Use dry scenarios only for push/deploy/finalization failure; do not exercise actual external operations.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.

## Decisions

- Global skill only; English single-file orchestration; no package/extension/manifest change.
- After standards review (CHANGES REQUIRED): prepare/bind before mutating baseline; SDD only when requested or its trigger matches, never default; independent intent/standards review or disclose the limit; clarification interview only when that skill is invoked; closeout is last plan mutation, then receipt-bound validation, then finalize, then post-move validation.
- Scenario review PASS on seven dry cases after those edits. Residual non-blocking: SDD trigger phrase plus “fresh workers” could still be over-read; commit skill remains file-level while EDD requires hunk-level staging.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Documented skill-creator quick_validate.py against the global skill folder.
- Fresh Pi subagent confirms discovery and reads skill; use local Pi loader if needed for deterministic diagnostic evidence.
- Representative and adversarial scenarios: evidence absent, normal authorized implementation, unauthorized delivery, early finalize gate, uncertain deploy, unavailable specialist/model, mixed dirty files.
- Parent inspect final skill, SHA-256, git diff --check and task-owned plan; no runtime gates needed for non-packaged global prompt and plan documentation.

## Result

Created `/root/.pi/agent/skills/evidence-driven-delivery/SKILL.md` (SHA-256 `a1cc6f27b39c74661448c023f6b9b7dda9836adf15afd88ac11807acb6f57b98`). Recovery: delete that file only.

Passed: skill-creator `quick_validate.py` after the review fix (`Skill is valid for Pi discovery.`); two fresh `xai/grok-4.6` xhigh subagents — standards/discovery then seven dry scenarios; both sessions listed the skill in `available_skills` before reading the file; scenario review PASS.

Failed: none in the required checks.

Deferred: no `/reload` of this parent session; no live commit/push/deploy (out of scope).

Skipped: repository `npm`/`validate` gates (non-packaged global prompt); personal stores/credentials.

Parent `git add`/`sha256sum` of the global file is outside the Git fingerprint. Unrelated dirty plans were not edited.
