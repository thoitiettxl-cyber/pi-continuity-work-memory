# Execution Plan: Managed Workflow Engine

Date: 2026-08-21

## Status

Completed

## Outcome

`pi-continuity-work-memory` ships a package-owned, repository-independent workflow engine that uses each repository's applicable `AGENTS.md` as the entry instructions, creates no repository documents merely because Pi opens a project, and materializes only the task documents required by the current work shape. Read-only and bounded work remain document-free; durable work persists exact intent before exclusively creating or binding one execution plan, recovers it branch-correctly, and closes it only through evidence-aware transitions. No consumer repository needs `repository-harness` installed.

## Authority And Context

- The user approved implementation, full validation, final commit, and push.
- `/root/code/pi-continuity-work-memory/AGENTS.md` owns repository structure, style, validation, security, and release expectations.
- `/root/code/repository-harness/docs/WORKFLOW.md` and its templates are design references only; they are not runtime dependencies or consumer requirements.
- Pi's installed `docs/extensions.md`, `docs/packages.md`, `docs/skills.md`, `docs/session-format.md`, `docs/usage.md`, and `docs/security.md` own the supported runtime APIs and trust/resource behavior.
- Existing Continuity operation receipts, Git fingerprints, and checkpoint rules remain the sole safe-boundary authority. Workflow documents and learning memory cannot self-declare validation or safety.

## Scope

In scope:

- Package-owned workflow assets and deterministic asset manifest validation.
- A managed workflow state projection and durable document binding without duplicating repository plan contents in SQLite.
- Work-shape preparation for bounded, durable, and authority-blocked mutative work.
- Lazy, observable execution-plan creation; explicit binding of existing plans; evidence-aware finalization.
- Repository mutation gate, path/root/symlink/concurrency safety, branch/fork/recovery semantics, and non-interactive compatibility.
- Work-item memory scoping aligned to explicit durable bindings.
- State/database migrations, release/install contract updates, documentation, changelog, tests, acceptance evidence, commit, and push.

Out of scope:

- Installing or invoking `repository-harness` in consumer repositories.
- Modifying consumer `AGENTS.md` files or automatically creating a repository `WORKFLOW.md`.
- Hidden provider-side task classification or repository writes from `session_start`, `input`, `agent_end`, or `agent_settled`.
- Automatically accepting product decisions, inventing runbook commands, or treating checkpoint creation as task completion.
- Arbitrary template-driven overwrite or merge of existing repository files.
- Production dependencies beyond the existing Pi peers and Node built-ins.

## Approach

1. Add package-native workflow assets with a checksum-bound manifest and release inventory coverage.
2. Introduce pure workflow policy/document types and WorkState v2 migration. Reuse the existing branch-state SQLite record plus consequential-operation ledger for pre-write document intent and uncertain recovery instead of introducing a parallel workflow table.
3. Add trusted, Git-root-confined infrastructure for asset loading, plan discovery/binding, exclusive materialization, digest checks, and recoverable identity-bound active-to-completed moves.
4. Integrate workflow lifecycle into Pi events and register read/status/prepare/bind/finalize tools plus `/continuity workflow ...` commands.
5. Gate repository mutation in managed mode until the current mutative work is prepared; keep blocks recoverable and require durable tracking before workflow writes.
6. Treat repository plans as durable truth, reduce Continuity to operational projection/binding, and prevent default work-item memory mixing.
7. Add focused unit/integration/crash/concurrency/branch/mode/install/release tests and update README, acceptance evidence, and changelog.
8. Run focused checks, `npm run validate`, `scripts/validate-premerge.sh`, release packaging checks, and final diff review before commit and push.

## Risks And Recovery

- **Accidental read-only mutation:** no event hook writes repository files; only explicit workflow mutation tools can materialize or move a document.
- **Incorrect work-shape assessment:** the model supplies structured evidence, the domain derives the shape, and ambiguity/missing authority produces no document and no mutation permission.
- **Existing-file damage:** targets are root-confined, symlink checked, queued, and created exclusively; conflicts never overwrite or silently choose another filename.
- **Crash after write before receipt:** intent is persisted before execution; unresolved results remain uncertain and require human reconciliation rather than automatic retry.
- **Parallel or multi-process duplicates:** operation intent/path claims and exclusive file creation allow at most one materialization.
- **Parallel task truth:** managed mode stores only document metadata and operational resume hints; repository documents own progress, decisions, validation lists, and results.
- **Runtime API incompatibility:** implementation uses only Pi `>=0.84.1 <0.85.0` public APIs and extends existing mode/install proofs.
- **Migration failure:** existing migration backup/checksum/transaction behavior remains fail-closed; legacy WorkState/checkpoints remain recoverable but non-authoritative for workflow completion.
- **Rollback:** revert the implementation commit. Existing consumer documents are ordinary repository files and are never deleted by package removal; prior stores remain backed up by the migration mechanism.

## Progress

- [x] Research reference workflow and current Pi/package APIs.
- [x] Agree authority boundaries and lazy tool-mediated auto-document behavior.
- [x] Add workflow assets and domain/state/storage model.
- [x] Implement runtime workflow services, tools, mutation gate, and recovery behavior.
- [x] Align memory scopes, package/release contract, README, proof docs, and changelog.
- [x] Add and pass focused unit/integration tests.
- [x] Pass full local, install, release, premerge, and diff validation.
- [x] Complete independent final review, record the result, and prepare this plan for the final commit/push handoff.

## Decisions

- 2026-08-21: Package-owned workflow guidance supplements repository `AGENTS.md`; it never replaces repository-specific instructions.
- 2026-08-21: "Automatic" means a visible, ledger-tracked custom tool materializes the selected document after work-shape preparation, never a background startup write.
- 2026-08-21: MVP production behavior includes execution-plan create/bind/finalize; decision and runbook templates may ship for guidance but are not auto-materialized without separate authority.
- 2026-08-21: Managed workflow is independently configurable. Existing installations migrate without silently enabling repository writes; the requested deployment profile can opt into managed mode.
- 2026-08-21: A safe checkpoint proves repository and operation safety only. Repository completion remains evidence-backed repository truth.
- 2026-08-21: Existing branch WorkState plus the operation ledger persist exact document intent before filesystem mutation and block a second prepare while unresolved. A separate SQLite workflow/task table was rejected because it would duplicate branch authority without adding recovery evidence.
- 2026-08-21: Direct user `!`/`!!` commands remain explicit human actions and are operation-ledger tracked, but the agent preparation gate does not reinterpret or block them.
- 2026-08-21: Finalization uses exclusive hard-link/unlink with deterministic recovery for same-identity two-link and destination-only crash states; conflicting content or identity remains blocked.

## Validation

Focused proof:

- Pure work-shape/state-transition tests.
- Asset manifest and deterministic rendering tests.
- Root/path/traversal/symlink/conflict/exclusive-create tests.
- Prepare/bind/finalize, mutation-gate, crash/uncertain, branch/fork/compaction tests.
- WorkState and SQLite migration tests.
- Work-item memory isolation tests.

Integration and end-to-end proof:

- Trusted repo with `AGENTS.md`: read-only and bounded work create no documents; durable work creates exactly one plan.
- Existing/conflicting plans bind or fail without overwrite.
- Untrusted, missing-context, JSON, RPC, and print modes remain non-interactive and safe.
- Global install proof requires no Harness and verifies package-owned assets in two workspaces.

Repository-required checks:

- `npm run typecheck`
- `npm test`
- `npm run validate`
- `scripts/validate-premerge.sh`
- `git diff --check`
- `npm run release` and release inventory/ZIP validation when the payload changes.

### Observed Results

Observed on 2026-08-21:

- `npm run validate`: PASS with typecheck, build, 145/145 tests, isolated Pi 0.84.1 global install, and release static validation.
- `scripts/validate-premerge.sh`: PASS, including the full validation gate and `git diff --check`.
- `PI_VALIDATION_PI=/usr/local/bin/pi npm run validate:install`: PASS on Pi 0.84.2 across two isolated AGENTS-bearing repositories.
- `npm run release --`: PASS with a sanitized 112-file inventory, isolated Pi 0.84.1 install, `unzip -t`, and SHA-256 `11228132bcd0325eee33d9650ca8950d1997e0d4f337d419430b8a0e51425ff0`.
- Three independent read-only reviews were completed; blocking receipt, drift, conflict-identity, untrusted-claim, embedded-migration, finalization-recovery, and eligibility findings were reproduced or inspected, remediated, and regression-tested. The final targeted audit reported `NO BLOCK`.

## Result

Implemented the package-owned Managed Workflow Engine without adding a runtime dependency or requiring `repository-harness` in consumer repositories. The package now supplies checksum-bound workflow guidance/templates, public-Pi-compatible prepare/read/status/bind/finalize tools, trust and AGENTS eligibility, an agent mutation gate, branch-bound intent-before-write recovery, exclusive no-overwrite plan creation, identity/digest/readiness-bound recoverable finalization, WorkState v1-to-v2 compatibility, explicit repository-vs-checkpoint authority, and work-item memory isolation without an implicit `default` bucket.

Native, supported-Pi install, premerge, packaged-release, and independent-review evidence passed as recorded above and in `proof/ACCEPTANCE.md` plus `proof/RESULTS.json`. Real-provider and Alpine-device runs were not repeated because this feature does not alter the provider transport or platform contract; their historical RC2 results remain non-authoritative for this new workflow behavior. The final commit and push are delivery actions performed after this self-referential plan record is moved to `docs/plans/completed/`; Git history and the final handback own their identifiers.
