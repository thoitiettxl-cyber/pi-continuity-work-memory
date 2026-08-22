<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"5d206065-1f79-4f44-b20b-15fa9e24d7ef","templateVersion":1} -->

# Execution Plan: Web Search Classification Fix

Date: 2026-08-22

## Status

Active

## Outcome

Prevent simple Pi/Eta web information retrieval from being treated as repository mutation by Continuity, while preserving fail-closed handling for interactive or sensitive browser actions.

## Authority And Context

- Người dùng xác định vấn đề: tra cứu thông tin bằng `web_search` là thao tác cơ bản và không nên kích hoạt managed workflow/mutation context trừ khi nó phục vụ workflow xác minh hoặc mutation riêng.
- Code hiện tại phân loại mọi non-bash tool không nằm trong read allowlist thành `mutation`, nên `web_search` và các thao tác đọc Eta Browser bị coi là external mutation.

## Scope

In scope:

- Classify `web_search` as read-only discovery for Continuity gating and mutation tracking.
- Classify non-interactive Eta Browser read/navigation/observation actions as read-only for Continuity gating.
- Keep interactive Eta Browser actions fail-closed as mutation/external operations.
- Add focused tests and minimal documentation for the policy.

Out of scope:

- Do not change Eta Browser tool implementation or DuckDuckGo behavior.
- Do not relax login, CAPTCHA, consent, payment, form submission, or other user-only/browser-interactive boundaries.
- Do not change checkpoint, validation, or durable plan finalization authority.

## Constraints

- Preserve fail-closed classification for unknown tools and unknown Eta Browser actions.
- Preserve repository mutation gating for write/edit/apply_patch and mutative shell commands.
- Treat search/document lookup as read/discovery, not as repository mutation.

## Approach

- Update `src/application/tool-classifier.ts` with an explicit read/discovery allowlist for `web_search` and non-interactive `eta_browser_use` actions.
- Add tests in `test/tool-classifier.test.ts` for read classification and fail-closed interactive browser actions.
- Update user-facing/runtime documentation describing simple web search as read/discovery rather than repository mutation.

## Risks And Recovery

- Risk: over-broad read classification could hide consequential browser actions. Recovery: only allowlist explicit non-interactive actions and test interactive actions remain mutation/external.
- Risk: documentation overstates browser side-effect absence. Recovery: describe this as read/discovery for repository workflow, not as no browser state change.

## Progress

- [x] Implement classifier policy.
- [x] Add focused tests.
- [x] Update documentation.
- [x] Run focused proof and record result.

## Decisions

- `web_search` is read-only discovery for managed workflow classification: it may use network/browser state, but it is not repository mutation and should not force `continuity_prepare_work` for simple document lookup.
- Eta Browser actions are allowlisted narrowly: non-interactive observation/navigation/read actions are read-only for workflow gating; interactive, reset, help, unknown, or malformed actions remain external mutations.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- `npm run build:test`
- `node --test --test-concurrency=1 .test-build/test/tool-classifier.test.js`
- `npm run typecheck`

## Result

Implemented. Focused proof passed:

- `npm run build:test`
- `node --test --test-concurrency=1 .test-build/test/tool-classifier.test.js`
- `npm run typecheck`
- `git diff --check`
