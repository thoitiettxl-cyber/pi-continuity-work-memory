# Acceptance evidence map

This file maps required behavior to executable evidence. A release may be called
complete only when every mandatory row has an observed `PASS`. Missing authority,
credentials, target hardware, or external proof remains `DEFERRED` rather than
being inferred from source or prior artifacts.

## Current RC5 candidate validation

`PASS (source-local, pre-delivery)` — the RC5 worktree passed
`npm run validate` on 2026-08-21: typecheck, build, 152/152 tests, isolated
two-workspace Pi 0.84.1 installation, checksum-bound workflow assets, ten exact
package skill commands, zero loader diagnostics, collision-resistant source
path verification, release static validation, and the existing Continuity,
receipt, checkpoint, reconciliation, migration, provider-sanitization,
scheduler, and multi-process integrity coverage.

Focused skill proof verifies four explicit-only workflows, model-visible
accepted-invariant encoding, first-pass read-only onboarding, independent
per-hunk proposal audit, observed-baseline/fresh-rerun improvement evidence,
managed preparation and recovery boundaries, prompt-only payload resources, and
separate pinned MIT provenance for Matt Pocock and Repository Harness sources.
The package does not install, invoke, import, or expose Repository Harness as a
Pi runtime resource.

`scripts/validate-alpine-arm64.sh` passed for RC5 on Alpine Linux 3.24.1 ARM64
with Node v24.18.1 and Pi 0.84.2, including the isolated two-workspace package
and ten-skill source-path proof. A preliminary `npm run release` produced a
sanitized 132-file report, passed exact staged installation and `unzip -t`, and
the managed-installer dry-run reported `storesChanged: false`. Final premerge,
definitive artifact identity, commit/push, and managed deployment are recorded
only after observation in the bound execution plan and installer receipt; the
payload does not self-assert its own deployment.

The extension runtime and provider protocol were not changed by the RC5
skill/package adaptation. Real-provider memory execution was not rerun and
remains historical RC2 evidence rather than current RC5 authority.

## Historical RC4 release and deployment baseline

`Completed` — immutable RC4 archive SHA-256
`83d17834af73149e426e168709731321736d7e64b72dcd1ad4e40cde43fb8b4e`
passed source, premerge, Alpine, release, installer dry-run, and managed global
deployment proof before this expansion. Its evidence remains in
`../docs/plans/completed/release-domain-modeling-refinement-rc4.md` and is not
relabeled as RC5 evidence.

## Historical RC3 release and deployment baseline

`Completed` — immutable RC3 archive SHA-256
`e64cfd5dcaac2319ec3c4ffd363c25298f61007f7dcc939cd194bf9e3086766b`
passed release, Alpine, installer dry-run, and managed global deployment proof
before this refinement. Its source, artifact, backup, and installed-skill
evidence remain in `../docs/plans/completed/pi-native-global-engineering-skills.md`
and are not relabeled as RC5 evidence.

## Historical RC2 release run status

`Completed` — source provenance, release alignment, typecheck, build,
51 behavioral/unit tests, concurrency, Pi 0.84.1 and 0.84.2 global-install
proofs, authorized modified-source real-provider proof, Alpine Linux 3.24 ARM64,
premerge/diff, exact staged install, packaging, inventory, `unzip -t`, and
artifact sanitization passed. The owner selected package version `1.0.0-rc.2`,
which remains distinct from immutable canonical `1.0.0-rc.1`.
See `RESULTS.json` and `../RECONSTRUCTION_NOTES.md`.

| Area | Executable evidence | Required observation | Current result |
|---|---|---|---|
| Sealed validation receipts | `test/continuity.test.ts`, `src/domain/validation-receipt.ts` | Every authority-relevant evidence field and full executable/argv digest is receipt-bound; persisted display text cannot retain arbitrary secret-bearing arguments; evidence or checkpoint projection tamper quarantines authority. | PASS in current source-local run |
| Consequential operation ledger | `test/continuity.test.ts`, `test/continuity-agent-loop.test.ts`, `test/tool-classifier.test.ts`, `src/domain/operation-ledger.ts` | External operations are claimed atomically across processes, equivalent simple argv quoting deduplicates, compound shell constructs fail closed, blocked operations do not execute or terminate the agent run, results cannot cross sessions/branches, crashes become uncertain, recovery does not infer outcomes, reconciliation is human-only and digest-bound, and unresolved operations block checkpoints. | PASS in current source-local run |
| Managed repository workflow | `test/managed-workflow*.test.ts`, `test/workflow-context.test.ts`, `test/workflow-assets.test.ts`, `test/execution-plan-files.test.ts`, `src/domain/managed-workflow.ts`, `src/application/managed-workflow-service.ts` | Package assets are checksum/inventory bound; no Harness install is required; trust plus an in-repository AGENTS context gates managed behavior; read-only/bounded/ambiguous work creates no document; durable work persists intent before exclusive creation, binds one identity-bearing plan, blocks unprepared mutation, survives branch/session recovery, rejects path/symlink/conflict/overwrite, recovers interrupted same-identity finalization, and requires pre/post-finalization proof without elevating checkpoint or memory to completion authority. | PASS in current source-local run |
| Global engineering skills | `test/skills-package.test.ts`, `node scripts/validate-install.mjs`, `scripts/validate-release.mjs`, `scripts/manage-user-install.mjs` | The Pi manifest exposes exactly ten prompt-only skill directories; Pi loads each with zero diagnostics and no adjacent duplicate headings; four workflows are explicit-only; intent clarification scales one-versus-bounded frontier questions, treats generic proceed-with-uncertainty language as non-authority, and keeps process-friction fixes separately authorized; diagnosis and automatic invariant loading cannot gain mutation authority; onboarding remains read-only before exact later approval; onboarding audit is independent, per-hunk, and read-only; harness improvement requires an observed baseline and exercised fresh rerun; domain modeling preserves Continuity recovery/finalization boundaries; both pinned MIT source lineages ship; isolated workspaces load commands from package paths rather than a colliding global source; no cross-harness runtime, helper executable, concurrent/background, desktop, auto-delivery, competing-plan, memory-completion, or checkpoint-completion assumption remains. | PASS in current RC5 source-local, supported-Pi, Alpine, and preliminary package-candidate validation; final deployment is plan/receipt-owned |
| Ordered SQLite migrations | `test/sqlite-migrations.test.ts`, `src/infrastructure/sqlite-migrations.ts` | Literal RC2 continuity/memory stores migrate without data loss after exact schema verification and private checksum backup; gaps, future versions, history/checksum/schema drift, malformed v1, failed apply, and concurrent open fail closed or converge safely. | PASS in current source-local run |
| Source provenance and release alignment | `SOURCE_MANIFEST.json`, `RECONSTRUCTION_NOTES.md`, `test/release-alignment.test.ts` | Original archive hashes remain historical; reconstructed OpenAI compatibility, included/excluded bash evidence, and real npm-test provider seed match the documented canonical repairs without claiming they existed in the supplied source. | PASS |
| Global, opt-in install | `node scripts/validate-install.mjs` | User-scope `pi install`; two independent Git workspaces with AGENTS entrypoints load `/continuity` and `/memory` without `-e`/`-l`; checksum-bound workflow assets are present and Pi RPC accepts the installed workflow status command; repository keys differ; global memory crosses; stores survive remove; report actual Pi version/range. | PASS on Pi 0.84.1 and 0.84.2 |
| Continuity across session/tree | `test/continuity.test.ts`, `test/extension-mode.test.ts` | Full-state exit/resume, crash resume after pending mutation, active-branch reconstruction, fork/copy context and fresh child authority chain, checkpoint ancestry, no A→B marker leak, and embedded state before/after manual/automatic compaction. | PASS |
| Safe boundary | `test/continuity.test.ts`, `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts` | Pending/uncertain mutations block; executable validation and stable pre/post fingerprint required; direct `!`/`!!` mutations tracked; tracking failure fails closed; drift and corrupt/missing/cyclic chains detected; copied embedded checkpoint has no authority. | PASS |
| Non-mutating recovery | `test/continuity.test.ts` | Recovery executes no repository command and changes only stored work state. | PASS |
| Provider-bound source privacy/cost | `test/canonical.test.ts`, `test/provider-source-sanitization.test.ts` | Stage 1 source, metadata, Stage 2 records, citations, and previous baselines retain bounded ordinary evidence but exclude/redact raw image data, contiguous/wrapped/parameterized base64, long opaque payloads, secrets, hidden thinking, opaque signatures, default/custom session paths, and excluded bash content. Total provider DTOs remain bounded. | PASS |
| Real-provider memory | `node scripts/validate-provider.mjs` | An explicitly authorized configured provider completes Stage 1 and Stage 2 for the modified source, publishes non-empty records/baseline, accounts usage/citation, passes secret scan, isolates the explicit candidate from configured discovery, and removes temporary proof state on terminal paths. Prior canonical-artifact provider evidence is not reused. | HISTORICAL RC2 PASS on Pi 0.84.2 with `cliproxy/gpt-5.6-sol`: provider runtime is unchanged; this proof was not rerun and is not current RC5 authority |
| Scope and authority isolation | `test/memory.test.ts` | Repo A marker and citation usage hidden from B, global visible, explicit/bound work and session isolated, unbound tasks receive no implicit `default` work-item bucket, untrusted promotion blocked, memory reset preserves Continuity. | PASS |
| Query-conditioned learning memory | `test/memory.test.ts`, `test/provider-source-sanitization.test.ts`, `test/sqlite-migrations.test.ts` | Token search does not require a contiguous substring; injection uses the current prompt instead of dumping visible records; kinds default to `fact`; incremental extract skips below the turn threshold unless forced; exact-content duplicates stay unpublished; RC2/v2 stores migrate to schema v3 with `kind=fact`. | PASS in current source-local tests |
| Project trust | `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts`, `test/memory.test.ts` | Zero Git calls when untrusted; no repo/work-item injection or promotion; RPC/JSON/print load without UI access. | PASS |
| Scheduler lifecycle | `test/scheduler.test.ts`, `test/memory.test.ts` | `agent_end` creates no worker; one settled event creates one eligible run; invalidation cancels timer/controller; stale source is superseded. | PASS |
| Pipeline lease/crash recovery | `test/pipeline-recovery.test.ts`, `test/memory.test.ts`, `test/concurrency.test.ts` | Unique attempt owner; heartbeat covers both provider stages; lease time is sampled after transaction lock; expired owners cannot heartbeat/stage/publish; startup/reclaim removes only non-active pending/building artifacts; stale finish cannot delete replacement work; prior published head survives; failure, expiry, and supersession retry idempotently; two processes surface no uncaught `SQLITE_BUSY`. | PASS |
| UX/non-interactive | `test/extension-mode.test.ts`, `node scripts/validate-install.mjs` | Namespaces/tools registered; exact short TUI labels; RPC/JSON/print never touch TUI APIs. | PASS |
| Pi support matrix | `test/pi-version.test.ts`, `scripts/pi-version.mjs`, `scripts/validate-premerge.sh`, `scripts/validate-release.mjs` | Runtime range is `>=0.84.1 <0.85.0`; lower bound 0.84.1 and current 0.84.2 pass; 0.85.0 fails with actionable range diagnostic; reports show actual version. | PASS |
| Alpine ARM64 matrix | `scripts/validate-alpine-arm64.sh` | Alpine 3.24, ARM64, Node >=22.19.0, supported Pi binary, and exact global-install proof. Wrong environment reports `DEFERRED`. | PASS on Alpine 3.24.1 aarch64, Pi 0.84.2 |
| Release artifact | `node scripts/package-release.mjs` | Payload comes from `package.json.files`; checksum-bound workflow assets are included; exact staged payload installs; sanitized independent ZIP has exact inventory, `unzip -t`, SHA-256, and no stores/credentials/settings/.git/node_modules/target/logs. | PASS in current source-local package run |

## Authority and reliability invariants

- `verified` is written only by `ContinuityService.createCheckpoint` after a
  provisional insert, final stable repository fingerprint, and transactional
  revalidation of evidence, parent chain, mutation state, and operation ledger.
- Embedded session entries are hard-coded to `authority: "embedded"`.
- Learning memory cannot write validation/checkpoint authority.
- Managed workflow templates are checksum-bound scaffolding only. Repository AGENTS instructions and repository documents remain authoritative; read-only/bounded work materializes nothing.
- Workflow document intent is persisted in branch WorkState before file creation; unresolved managed operations block another materialization, and recovery never overwrites repository content.
- A plan move is identity/digest checked and recovers same-identity two-link or destination-only crash states; the resulting mutation always requires fresh validation.
- Safe checkpoint authority is explicitly separate from repository work-document completion.
- Recovery has no command-runner or repository-write call.
- Read paths select only `published` records and current published baseline heads.
- Provider-bound DTOs are sanitized at structural serialization and again at the
  `MemoryService` boundary; legacy Stage 2 content is sanitized before reuse.
- Pipeline ownership is per attempt. Lease expiry, owner, generation, and source
  hash fence stage/publish operations.
- Startup recovery and reclaim delete only `pending` records and `building`
  baselines not owned by an active unexpired run; published records and baseline
  heads are preserved.
- `published` is the only terminal source status. Deferred, failed, expired, and
  superseded runs may retry after old non-published artifacts are cleaned.

## Environment-specific result policy

- Unit/integration/install/release gates: `PASS` only on zero exit status and
  asserted observations.
- Version support: `PASS` only when the actual binary satisfies
  `>=0.84.1 <0.85.0`; unsupported or malformed versions fail with the range.
- Real provider: `PASS` only after an explicitly authorized configured provider
  publishes Stage 1 and Stage 2 with non-zero usage; otherwise `DEFERRED` or
  `FAIL`.
- Alpine ARM64: `PASS` only on Alpine 3.24 ARM64 with a supported Pi binary;
  otherwise `DEFERRED`.
- Artifact integrity: `PASS` only after exact staged install, inventory match,
  secret/path scan, `unzip -t`, and SHA-256 generation.

## Enforcement levels

- Local validation: current RC5 `npm run validate`, Pi 0.84.2 install/Alpine
  proof, preliminary `npm run release`, and managed-installer dry-run passed;
  final premerge and delivery evidence remains bound to the execution plan.
- Optional hooks: none installed or required.
- CI invocation: none present in the supplied source snapshot.
- Branch protection: unverified; no external repository policy was changed.
