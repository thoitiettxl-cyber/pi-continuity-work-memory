<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"c5235224-3988-4aae-a1df-b7309653d42d","templateVersion":1} -->

# Execution Plan: Native query-conditioned memory recall

Date: 2026-08-25

## Status

Active

## Outcome

Learning memory extracts incrementally from new sanitized session evidence, stores typed atoms (preference/constraint/lesson/fact) without a raw L0 warehouse, and injects published baselines plus a small query-conditioned set at before_agent_start. The reviewed implementation preserves matched recall under its prompt cap, deduplicates atom publication under batch/concurrent paths, advances cursors atomically, and lets ordinary read-only shell/GitHub discovery proceed without weakening mutation tracking. Existing memory tools, scopes, authority rules, and Pi ExtensionAPI usage remain compatible.

## Authority And Context

- User confirmed Shared Understanding and authorized implementation after grill-with-docs research of TencentDB-Agent-Memory versus this package.
- Default A (native evolution) was delegated: port selected algorithms only; no MemoryCore sidecar, Proxy, Hub, Wiki, CodeGraph, embeddings, or Skill-as-asset.
- Repository authority: AGENTS.md, docs/ARCHITECTURE.md, README persistent-memory contract, proof/ACCEPTANCE.md memory rows, Pi extensions.md before_agent_start.event.prompt, and ModelRegistry.complete-only.
- Memory remains untrusted learning context and cannot become plan, validation, checkpoint, or completion authority.
- User requested a logic audit of draft PR #1, fixes for confirmed findings and basic operations incorrectly blocked by Continuity, followed by focused commit and push to the existing PR branch.

## Scope

In scope:

- Memory schema v3: kind on records (default fact) and per-session extraction cursor.
- Token-ranked search with optional FTS5 if node:sqlite provides it; no new runtime dependency.
- Query-conditioned injection from event.prompt: baselines plus top 12 atoms, 64k cap, fail-open on recall failure.
- Incremental Stage 1 source from cursor; first settled extracts; later extract only after at least 3 new user/assistant turns or /memory run.
- Exact-content dedup in the same scope before publish; cursor advances only after successful publish.
- Provider JSON gains optional kind; invalid kinds become fact; pipeline never emits global-user.
- Tests, README, ARCHITECTURE, ACCEPTANCE, and CHANGELOG updates for the new contract.
- Review fixes for prompt-budget starvation, batch/concurrent exact-content deduplication, bounded search-candidate ordering, and atomic cursor publication.
- Safe read-only classification for ordinary command discovery, Git remote inspection, bounded `find`/`rg`, and non-mutating GitHub CLI views; mutating or secret-bearing forms remain external operations.
- Preserve managed-workflow eligibility when a user steer/follow-up arrives during an already assessed agent run.

Out of scope:

- Tencent sidecar, Proxy, Hub, team/ACL, Wiki, CodeGraph, embeddings, sqlite-vec, or scene markdown files.
- Persisting a raw conversation L0 warehouse.
- New memory tools or commands; existing names stay.
- Changing checkpoint/ledger authority, managed-workflow document policy, or the ten-skill inventory beyond the scoped read-classification and steer lifecycle fixes.
- Release, deploy, merge, plan finalization, or unrelated pull-request changes.

## Constraints

- Pi peer range >=0.84.1 <0.85.0 and public ExtensionAPI only.
- Production runtime dependencies remain empty; node:sqlite only.
- Existing /memory and memory_* semantics stay; kind is additive.
- Untrusted projects still write only session memory; work-item still requires explicit binding.
- Ordered SQLite migration with private checksum backup; fail-closed on drift/future/gap.
- Keep lease, heartbeat, generation fencing, sanitization, and atomic publish.
- TDD through public MemoryService/MemoryStore/session-adapter behavior.

## Approach

- Add failing tests for token-ranked search, kind default, query-conditioned contextPrompt, incremental skip/threshold, cursor publish, and v2-to-v3 migration.
- Implement schema v3 and ranked search in MemoryStore.
- Implement MemoryService recall, threshold, incremental cursor, and dedup.
- Extend session-adapter memorySource with after-entry incremental windows.
- Wire before_agent_start event.prompt and /memory run force extract in extension.ts.
- Teach PiMemoryProvider to emit and accept kind.
- Update README, ARCHITECTURE, ACCEPTANCE, and CHANGELOG Unreleased.
- Run focused tests then typecheck and npm test; report passed/failed/skipped separately.
- Add regression tests for every confirmed review finding and for read-only versus mutating GitHub/shell forms.
- Run full repository validation and the premerge gate before the authorized commit and push.

## Risks And Recovery

- Existing memory.sqlite files need v3 migration: private VACUUM backup, transactional apply, rollback on verify failure.
- If FTS5 is unavailable, token ranking remains the supported search path.
- Recall must fail-open to baselines so a search bug cannot block the agent.
- Compaction may remove the cursor entry id: missing cursor falls back to a full bounded resync when the full source hash changed.
- Old tests expecting dump-40 or substring-only search must be updated to the confirmed contract, not weakened.
- Read-only command recognition must remain token/argv based and narrowly allow-listed; GitHub mutations, credential display, executable `find`/`rg` hooks, and output-file forms stay fail-closed.
- Cursor advancement must share the publication transaction so a cursor-write failure cannot report failure after exposing a published generation.

## Progress

- [x] Implement the initially approved memory outcome.
- [x] Reproduce and fix confirmed PR logic findings with regression coverage.
- [x] Fix basic read-only shell/GitHub classification and steer lifecycle gating without opening mutation bypasses.
- [x] Run focused and full validation; review the final scoped diff and pass the premerge gate.
- [ ] Commit and push only the authorized PR files while preserving unrelated dirty plans.

## Decisions

- Search ranks unique token overlap over the latest 500 visible records. FTS5 is optional later; token ranking is the supported path.
- Incremental windows keep one previous entry as background so Stage 1 has scene continuity without a raw L0 store.
- Automatic extract uses first-run warmup, then three new user/assistant turns. `/memory run` sets `force: true`.
- Missing cursor entries resync and extract when the remaining source hash changed.
- `skipped` is a non-persisted pipeline result and does not write a `pipeline_runs` row.
- Prompt rendering reserves bounded capacity for both baselines and matched atoms and always retains its closing authority delimiter.
- Search candidate selection uses the documented latest 500 visible records before token scoring; usage remains a ranking tie-break, not a pre-filter.
- Exact-content deduplication occurs within an extract batch and again transactionally at publish so concurrent sessions cannot expose duplicates.
- Streaming steer/follow-up input preserves the current run's already assessed repository eligibility; idle input still requires fresh `before_agent_start` assessment.
- Ambiguous Git option abbreviations, HTTP method-override/GraphQL API forms, and unknown future streaming modes stay fail-closed.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- New and existing memory tests pass, including scope isolation, lease, crash-invisible building baselines, reset independence, and provider sanitization.
- sqlite-migrations tests prove RC2/v2 memory stores migrate to v3 without losing published records; legacy kind is fact.
- npm run typecheck and npm test.
- Review the final diff for unrelated edits and secret leakage.
- `test/tool-classifier.test.ts` and `test/managed-workflow-extension.test.ts` prove ordinary read-only GitHub/shell discovery stays unblocked while mutating, executable, output-writing, and credential-revealing forms remain external.
- `npm run validate`, `scripts/validate-premerge.sh`, staged diff review, push verification, and PR-head verification.

## Result

The reviewed candidate passes the focused memory/classifier/extension/Continuity suite (84/84), `npm run typecheck`, the full source-local suite (178/178), `npm run validate` including isolated install and release-payload proof, `scripts/validate-premerge.sh`, and `git diff --check`. No surviving Standards or Intent/Behavior finding remained in the final scoped review. Real-provider memory proof was not rerun because provider runtime paths did not change and remains explicitly historical/deferred. The focused commit and push to draft PR #1 are the remaining delivery actions; plan finalization, release, deploy, merge, and unrelated dirty files remain out of scope.
