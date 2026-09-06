<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"688356c0-6b66-466f-8538-d43217ad2bd9","templateVersion":1} -->

# Execution Plan: Measured memory recall and context budgeting

Date: 2026-09-06

## Status

Ready for completion

## Outcome

Preserve Pi-native compaction, raw session retention, repository-owned task truth, operational Continuity and untrusted learning memory. Establish repeatable synthetic recall and injection-budget evidence; fix confirmed old-record recall gaps and disproportionate memory injection using the smallest coherent backward-compatible seams. Decide explicitly from evidence whether transcript retrieval is justified, without implementing a raw-history warehouse by assumption. Deliver architecture specification, reviewed implementation, reproducible before/after evidence and all scope-required gates through Grok 4.6 xhigh subagents.

## Authority And Context

- User explicitly approved the preceding recommendation and requests architecture/execution plan followed by Grok 4.6 xhigh subagent execution.
- AGENTS.md and docs/ARCHITECTURE.md own work/authority/validation; README.md owns runtime contract. This one execution plan also holds the architecture specification; SDD artifacts are operational only.
- Starting branch dev-next, HEAD 13b635d75e593a6b2742f728ebb9c37ba2f48ac6. Pre-existing dirty README.md, proof/ACCEPTANCE.md and unrelated active/completed plan edits must be preserved.
- Verified source and installed extension: MemoryStore.search ranks latest 500 visible published records; MemoryService.contextPrompt injects baselines plus <=12 records with 64000-character cap. Pi installed 0.85.1 owns native compaction and retains JSONL entries.
- No empirical real-user post-compaction retrieval failure has been supplied. Synthetic evidence must be labeled synthetic and cannot establish real-provider quality or authorize broader private-history access.

## Scope

In scope:

- One repository execution plan including architecture, contracts, measurements, decisions and completion evidence.
- Synthetic temporary-store evaluation of old-record recall, scope isolation, ranking, representative query/corpus cases and injection size across model-window sizes; no credentials or personal SQLite/transcripts.
- Evidence-backed all-visible-record lexical recall through existing MemoryStore.search/MemoryService.search API, bounded working memory/results; no dependency/schema migration unless explicitly reopened.
- Model-window-aware estimated memory-injection budget through a small policy seam and existing before_agent_start adapter; preserve authority delimiters, scoped selection, citations and graceful recall failure.
- Focused TDD/integration proof, README/architecture/acceptance updates in owned paragraphs, serial implementation and independent review, mandatory full validation and premerge gate.

Out of scope:

- Replacing Pi native compaction or editing the installed Pi/runtime/user configuration.
- Vector databases, embeddings, new runtime dependencies, raw transcript indexing/storage or additional retrieval tools without evidence and privacy/scope resolution.
- Changing memory authority, plan ownership, checkpoint rules, scope visibility, extraction schedule, provider settings, auto-continuation or governor ownership.
- Commit, push, release publication, deployment, host changes, real-user secret/store/transcript inspection, modifying unrelated plans.

## Constraints

- Use Grok 4.6 with thinking xhigh for every delegated implementer and reviewer; discover exact available model ID before dispatch. Do not silently substitute another model.
- Keep existing dev-next branch and all pre-existing changes; no stash/reset/clean/unsolicited commit. Children own only named source/test/doc paths and report artifacts; controller alone edits this plan.
- No runtime dependency, schema migration, new settings/tool API, transcript access, or security/authority expansion. Native compaction and governor behavior remain unchanged.
- Memory stays learning-only, scoped and untrusted. No active progress/completion/validation truth in memory. Non-interactive paths must avoid UI.
- Measurements are synthetic and estimated token accounting is explicitly approximate, not an exact tokenizer or hard provider context guarantee. Never log private memory/provider payloads.
- Use documented npm scripts and pinned local tools. Gates may regenerate ignored dist/.test-build and isolated install resources; preserve unrelated release archives and do not deploy.

## Approach

- Task 1: Add reproducible synthetic characterization/evaluation fixtures through current public memory seams, report recall miss and injection-size baseline plus a conditional history-retrieval recommendation; change no production behavior.
- Controller evidence gate: record measured gaps and finalize exact small recall/budget contracts in this plan and downstream task briefs before production changes.
- Task 2: TDD fix confirmed old-record recall cutoff through full scope-filtered candidate traversal with bounded ranking memory/results and unchanged lexical ranking/tie semantics; cover old records, pending/hidden scopes, Unicode, limits and deterministic ties.
- Task 3: TDD implement model-window-aware estimated injection policy and extension wiring; keep baseline/atom space and complete authority/citation boundaries, add mode integration coverage and update relevant documentation with measurements/limitations.
- After each task run fresh independent spec-and-quality reviewer; address important findings with fresh Grok subagents. Controller verifies diffs and executable results.
- Run mandatory scripts/validate-premerge.sh (includes npm run validate), inspect final diff/untracked files, obtain fresh whole-change Grok review and bounded fix/re-review wave if needed.
- Update this plan with exact passed/failed/deferred/skipped checks, architectural decision on transcript retrieval, result and recovery steps. Finalize only with required receipt-bound validation and fresh post-move proof if gates permit.

## Risks And Recovery

- Searching more records may increase latency; measure synthetic corpora and bound retained ranking candidates. Keep old public interface and schema so reverting owned code is sufficient; do not deploy.
- Too-small memory budget can omit useful lessons; measure baseline and atom preservation, explicit omission for tiny windows, conservative documented fallback for absent/invalid model metadata.
- Pre-existing doc changes may be packaged by install proof; preserve them and report combined-worktree validation rather than asserting a pristine release. Full premerge gate does not authorize deployment.
- Subagent model or workflow availability may block dispatch. Report exact failures; do not spoof identity, bypass workflow, or create parallel plans. If child mutation is blocked stop child and resolve using supported harness only.
- Raw-history retrieval remains deferred unless evidence establishes a need and privacy/scope can be resolved. Retained transcripts are not automatically accessible through memory_search.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.
- [x] Task 1 characterization: 4/4 evaluation tests; parent re-ran focused node:test (pass 4) and npm run typecheck. Independent review Approved, 0 Critical/Important. Minors deferred (copied INSERT helpers; injection upper-bound only).
- [x] Task 2 all-visible-record lexical search (unlocked).
- [x] Task 3 model-window injection budget (unlocked; numeric policy recorded).
- [x] Task 2: iterator top-k search; parent re-ran 6 memory search tests and 4 evaluation tests. Independent review Approved, 0 Critical/Important. ⚠️ untracked evaluation file vs BASE only.
- [x] Task 3 model-window injection budget. Independent review Approved, 0 Critical/Important. Minors deferred.
## Decisions

- Task 1 synthetic evidence (labeled synthetic): old unique published record missed with 501 newer nonmatches; recent control hit; no hidden-scope leak. `contextPrompt` sat at 64000 chars / 16000 `ceil(chars/4)` proxy tokens: 0.976563 of 16384, 0.488281 of 32768, 0.125 of 128000, 0.058824 of 272000, 0.016 of 1e6. Parent timing diagnostics: 1000 records 5.361 ms, 10000 records 20.852 ms. Transcript retrieval not justified by these fixtures.
- Transcript retrieval remains deferred: the measured miss is the published-memory candidate window, not a post-compaction exact-detail failure, and no session/branch/privacy contract for raw history exists.
- Whole-branch Important: when CONTEXT_PROMPT_RECORD_RESERVE is at least sharedBudget, the first record share must be floor(sharedBudget/2) so long atoms cannot consume the entire default/mid window. Prove dual presence with a long-atom fixture at default and 32768 as well as 128000. Do not change characterBudget numbers.
- Task 3 injection policy (estimated, not a tokenizer): `ceil(chars/4)`; absolute ceiling 64000 chars / 16000 estimated tokens; invalid/missing/non-positive window falls back to 16384; token budget `min(16000, floor(effectiveWindow/8))`; character budget `min(64000, tokenBudget*4)`. Omit the entire memory block when budget is less than wrapper (preamble+footer+separators) plus 64 body characters. Pass `ctx.model?.contextWindow` into `contextPrompt` from `before_agent_start` in every mode; no new setting/tool. Keep 12-atom cap, scoped selection, full citations, Unicode-safe trim, recall-error fallback.
- Delegation model discovered locally: `xai/grok-4.6`, requested thinking `xhigh`; use it for every implementer and reviewer. No fallback model without user approval.
- Use the existing non-default `dev-next` branch. Pre-existing dirty documentation is a preservation boundary, not part of the requested implementation.
Fresh child Pi sessions do not inherit the controller Continuity binding. Children bind this existing plan with continuity_bind_work_document before writing; they must not call continuity_prepare_work, create another plan, finalize, or edit this document. Cost if wrong: a child could bind the wrong path — mitigate by naming only this relative path.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Task 1: npm run build:test then node --test --test-concurrency=1 on new evaluation test; report deterministic recall and injection sizes with timing diagnostic only; npm run typecheck.
- Task 2: explicit focused RED then GREEN against public search, plus evaluation and npm run typecheck; no strict flaky wall-clock assertions.
- Task 3: explicit focused RED then GREEN for budget/mode adapter behavior, evaluation comparison and npm run typecheck.
- Parent: npm test or required aggregate gate, scripts/validate-premerge.sh including clean/typecheck/build/tests/isolated install/Git install/release validation and git diff --check. Inspect unfamiliar gate helpers before execution.
- Review final tracked diff and task-owned untracked source/tests/plan. Record external-provider/platform tests as not run where not required; do not claim installed activation or distributable release validation beyond executed checks.

## Result

Implemented on dev-next. Search iterates all visible published records with bounded top-k. Injection uses estimated model-window budgets (fallback 16384 to 8192 chars; 32768 to 16384; 128000+ to 64000). When the 33000 record reserve is at least sharedBudget, the first record share is floor(sharedBudget/2) so long atoms cannot drop baselines at default/mid windows. Transcript retrieval remains deferred. User authorized complete, commit, push, and Debian-host deploy after this Result.

Passed: scripts/validate-premerge.sh before the half-split (clean, typecheck, build, npm test 265/265, validate:install PASS Pi 0.85.1, validate:git-install PASS, validate:release PASS, git diff --check clean). After the fix: npm run typecheck; npm test 266/266; 9/9 context-prompt tests including long-atom dual presence at default and 32768.

Failed: none in the required gates.

Deferred: real-provider memory proof not rerun; Alpine/platform proofs not applicable on this Debian GNU/Linux 13 host; Task 1/3 review minors; unused latestRecords helper.

Skipped: personal-store/transcript inspection. Unrelated dirty plans remain uncommitted.

Recovery: revert owned source/test/doc files and the completed plan move. Pre-existing unrelated dirty plans/docs were preserved.

## Architecture Specification

### Ownership and data flow

```text
Pi session JSONL --> Pi native compaction --> summary + recent conversation
Repository plan ---------------------------> durable task truth
Continuity SQLite -------------------------> branch-bound operational recovery
Sanitized settled evidence --> learning atoms/baselines --> scoped memory search
Model contextWindow --> injection budget policy ---------> bounded memory prompt
```

Only the last two lines change. Pi still owns session retention and compaction. The governor remains an ephemeral cooperative advisor. Learning records are derived, incomplete context, never raw history or authoritative task state. No provider-specific Codex/Anthropic context strategy is activated.

### Search seam

Keep `MemoryStore.search(query, selectors, limit)` and `MemoryService.search` caller contracts. Candidate eligibility is published status plus exact visible scopes, not age. Preserve Unicode word tokenization, OR-style overlap scoring, content-plus-citation matching and ties (score, usage, updated time, id). Traverse scope-filtered rows with a SQLite iterator; retain only top-k candidates (k <= 100), not all rows in JavaScript. This deliberately trades linear candidate scan time for complete lexical eligibility without schema migration or a dependency. Benchmark this trade-off before claiming scale. `list` semantics remain unchanged.

### Prompt budget seam

Use a pure domain policy driven by the selected model context window, connected only through before_agent_start and an optional argument on MemoryService.contextPrompt. No new setting or tool API. Keep the 64000-character absolute safety ceiling and authority preamble/footer; reserve useful room for both baseline and matched atoms. Preserve full citation identifiers and avoid splitting surrogate pairs when trimming. Invalid, missing, or non-positive window metadata uses fallback window 16384. Estimated token budget is min(16000, floor(effectiveWindow/8)); character budget is min(64000, tokenBudget*4) using ceil(chars/4) as the documented proxy. A window whose character budget is less than wrapper plus 64 body characters emits no memory block rather than a broken block. Expected budgets: missing/invalid/16384 -> 8192 chars; 32768 -> 16384 chars; 128000 and larger -> 64000 chars.

The policy will be described as estimated token budgeting, never provider-tokenizer enforcement. Tests report both character counts and the explicit estimate used. No source/provider payloads or personal-store telemetry are recorded.

### Conditional transcript retrieval

This iteration measures derived-memory retrieval. Synthetic failure to retrieve content never extracted is not evidence that raw transcript access is necessary. Add a transcript tool only after a representative task demonstrates post-compaction exact-detail failure and an explicit session/branch/privacy contract is resolved. Until then, preserve Pi's existing history and report the limitation; do not build a speculative transcript index.

### Global Constraints (verbatim delegation block)

- Work only in `/workspace/code/pi-continuity-work-memory` on `dev-next`; preserve pre-existing dirty files and unrelated plans. No commit, push, deploy, stash, reset, broad cleanup, host changes, or personal-store/transcript/credential access.
- No runtime dependencies, schema migrations, new public tools/settings, provider changes, scope expansion, or raw-history indexing. Pi native compaction, governor behavior, Continuity authority and repository-owned task truth stay unchanged.
- Learning memory remains scoped, published-only and untrusted; citations remain intact. Non-interactive paths must not access UI. Use temporary fixture stores only.
- Use `xai/grok-4.6` with thinking `xhigh`. Children never dispatch children or create/bind/finalize workflow documents. Controller owns the execution plan; reports are operational artifacts only.
A fresh child Pi session must bind this existing plan file before writing. Binding is session-local operational attachment, not a second product plan. Children still must not prepare_work, create, finalize, or edit this document.
- Follow strict repository TypeScript style and documented validation scripts. Synthetic measurements and token estimates must be labeled; do not claim real-provider quality, hard tokenizer bounds or installed activation.

## Task 1: Establish synthetic recall and injection baseline

### Objective and write ownership

Create `test/memory-context-evaluation.test.ts` only, plus your designated report. Production files and existing tests/docs are read-only. Use existing `MemoryStore`, `MemoryService`, `emptyWorkState`, and test helper seams. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `test/helpers.ts`, and relevant existing memory tests. Do not read the whole plan; this task brief owns requirements. No commit or workflow tool writes.

### Required evidence

1. Seed isolated synthetic stores with an old unique relevant published record, more than 500 newer nonmatching records, a recent relevant control, and matching records hidden by repository/work-item/session scopes. Prove current old-record miss and recent control hit through public search; assert no scope leakage. Use deterministic timestamps/IDs, not sleeps.
2. Exercise English and Vietnamese Unicode queries, content and citation matches, no-match queries and deterministic ranking. Keep the evaluation compact, use production public APIs rather than a competing search implementation.
3. Publish synthetic long baselines and query-matched atoms through existing supported fixture operations. Measure `contextPrompt` character count and `ceil(chars / 4)` proxy tokens; label the proxy as an estimate. Report fraction of 16,384, 32,768, 128,000, 272,000 and 1,000,000-token windows. Assert current preamble/footer and useful baseline/atom preservation.
4. Report search timings for 1,000 and 10,000 synthetic published records with `performance.now()` diagnostic only; do not enforce machine-dependent latency assertions. Keep fixture setup inexpensive (transactional batches if needed); close stores via test cleanup even on assertion failure. Log aggregate counts/times only, never record contents.
5. Characterization assertions may intentionally describe current deficiencies, clearly named as baseline. Task 2/3 will replace these expectations with improved contracts; do not disguise misses as successful recall.
6. Report a factual recommendation on all-record recall and adaptive injection. Explain why these fixtures do or do not establish a need for transcript retrieval; do not access personal history.

### Validation

Run `npm run build:test`, then `node --test --test-concurrency=1 .test-build/test/memory-context-evaluation.test.js`, then `npm run typecheck`. Include exact commands, output summary and aggregate measurement table in report. These are characterization tests, not a production TDD slice. No broad validation or package/release scripts for this task.

### Global constraints

Use the Global Constraints supplied by the controller. Allowed writes: the single test file, ignored `.test-build` from the reviewed build script, and designated SDD report only. All measures are synthetic; no production behavior change.

## Task 2: Remove age-based lexical recall exclusion

Unlocked after Task 1. Owned files: `src/infrastructure/memory-store.ts`, `test/memory.test.ts`, `test/memory-context-evaluation.test.ts`, designated report. No other source/docs writes. Existing test "memory search scores the latest 500 records before applying usage tie-breaks" does not seed an old matching record; replace or supplement it. Add a focused public-search TDD case: one old unique relevant published record, more than 500 newer nonmatching records, recent relevant control; RED must miss the old record on current code, GREEN must recall both old and recent through MemoryService.search, still excluding hidden scopes. Iterate eligible published rows with a SQLite iterator (for example StatementSync.iterate); keep a bounded top-k of size max(1, min(limit, 100)); never .all() the corpus and never add FTS/schema/indexes. Preserve tokenization, OR overlap, content+citation scoring, and tie order (score, usageCount, updatedAt, id). list stays unchanged. search must not use latestRecords(..., 500) as its candidate set. Evaluation must require the old unique id plus recent control; keep ranking/timing tests; name the previous miss as historical baseline in the report only. Cover pending/hidden records, citation-only, Unicode, empty/no-token queries, limits, and deterministic ties in test/memory.test.ts. Report 1k/10k timings as diagnostics. No docs and no Task 3 budget work.

Implement the Search seam above after confirmed baseline miss. Use focused TDD for an old relevant record beyond 500 newer records: show RED on existing search, then GREEN. Preserve ranking/tokenization/status/scopes/results API. Iterate all eligible rows while retaining at most the normalized result limit (1..100); do not `.all()` the entire corpus or add FTS/schema. `list` unchanged. Reuse existing comparison behavior and add precise tests for pending/hidden records, content/citation, repeated/Unicode/no-token queries, limits and deterministic ties. Update evaluation expectations so the old unique record must be recalled, retain original measured baseline in report, and report current timings. Run focused tests, evaluation and typecheck. No provider access or broad gates.

## Task 3: Bound memory injection by model window and document behavior

Unlocked. Numeric policy is the Prompt budget seam. Pass selected model contextWindow from before_agent_start. Default contextPrompt(query) without metadata must use the 16384 fallback so existing tests stay coherent. Do not start this task until Task 2 is reviewed. Owned files: new src/domain/memory-context-budget.ts, src/application/memory-service.ts, src/extension.ts, new test/memory-context-budget.test.ts, test/memory-context-evaluation.test.ts, test/memory.test.ts, test/extension-mode.test.ts, and relevant paragraphs only in README.md, docs/ARCHITECTURE.md, proof/ACCEPTANCE.md; designated report. Existing unrelated doc edits must remain intact. No package/schema/governor/workflow asset changes.

Implement the Prompt budget seam through focused RED/GREEN public behavior tests. Cover model-window matrix, invalid/missing metadata, tiny budgets, complete authority delimiters, both baseline/atom presence when affordable, full citations, Unicode-safe truncation and recall-error fallback. Extension event integration must prove selected model metadata reaches policy in TUI/RPC/JSON/print without UI access outside TUI. Update characterization to before/after size evidence. Document full-visible-record scan trade-off, estimated budgeting and fallback, remaining lexical and transcript-retrieval limits, and the preserved hybrid ownership. Update acceptance map to actual tests, not self-reported PASS. Run focused tests/evaluation and typecheck; controller runs mandatory aggregate gates.
