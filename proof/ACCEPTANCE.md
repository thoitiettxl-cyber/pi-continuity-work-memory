# Acceptance evidence map

This file maps required behavior to executable evidence. A release may be called
complete only when every mandatory row has an observed `PASS`. Missing authority,
credentials, target hardware, or external proof remains `DEFERRED` rather than
being inferred from source or prior artifacts.

## Current development validation

`PASS (source-local)` — the P0 authority-hardening worktree passed
`npm run validate` and `scripts/validate-premerge.sh` on 2026-08-15. The run
included typecheck, build, 104/104 tests, the isolated two-workspace Pi 0.84.1
install proof, release static validation, and `git diff --check`. It specifically
proved receipt tamper detection, provisional checkpoint promotion, crash and
cross-session operation fencing, reconciliation integrity, exact RC2 schema
adoption, backup/rollback, migration checksum/future-version guards, and
multi-process migration convergence.

Real-provider, Alpine-device, and packaged-release execution were not rerun for
this source-local change. Their rows below remain historical RC2 release
evidence and are not authority for this changed worktree.

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
| Consequential operation ledger | `test/continuity.test.ts`, `test/tool-classifier.test.ts`, `src/domain/operation-ledger.ts` | External operations are claimed atomically across processes, equivalent simple argv quoting deduplicates, compound shell constructs fail closed, results cannot cross sessions/branches, crashes become uncertain, reconciliation is human-only and digest-bound, and unresolved operations block checkpoints. | PASS in current source-local run |
| Ordered SQLite migrations | `test/sqlite-migrations.test.ts`, `src/infrastructure/sqlite-migrations.ts` | Literal RC2 continuity/memory stores migrate without data loss after exact schema verification and private checksum backup; gaps, future versions, history/checksum/schema drift, malformed v1, failed apply, and concurrent open fail closed or converge safely. | PASS in current source-local run |
| Source provenance and release alignment | `SOURCE_MANIFEST.json`, `RECONSTRUCTION_NOTES.md`, `test/release-alignment.test.ts` | Original archive hashes remain historical; reconstructed OpenAI compatibility, included/excluded bash evidence, and real npm-test provider seed match the documented canonical repairs without claiming they existed in the supplied source. | PASS |
| Global, opt-in install | `node scripts/validate-install.mjs` | User-scope `pi install`; two independent Git workspaces load `/continuity` and `/memory` without `-e`/`-l`; repository keys differ; global memory crosses; stores survive remove; report actual Pi version/range. | PASS on Pi 0.84.1 and 0.84.2 |
| Continuity across session/tree | `test/continuity.test.ts`, `test/extension-mode.test.ts` | Full-state exit/resume, crash resume after pending mutation, active-branch reconstruction, fork/copy context and fresh child authority chain, checkpoint ancestry, no A→B marker leak, and embedded state before/after manual/automatic compaction. | PASS |
| Safe boundary | `test/continuity.test.ts`, `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts` | Pending/uncertain mutations block; executable validation and stable pre/post fingerprint required; direct `!`/`!!` mutations tracked; tracking failure fails closed; drift and corrupt/missing/cyclic chains detected; copied embedded checkpoint has no authority. | PASS |
| Non-mutating recovery | `test/continuity.test.ts` | Recovery executes no repository command and changes only stored work state. | PASS |
| Provider-bound source privacy/cost | `test/canonical.test.ts`, `test/provider-source-sanitization.test.ts` | Stage 1 source, metadata, Stage 2 records, citations, and previous baselines retain bounded ordinary evidence but exclude/redact raw image data, contiguous/wrapped/parameterized base64, long opaque payloads, secrets, hidden thinking, opaque signatures, default/custom session paths, and excluded bash content. Total provider DTOs remain bounded. | PASS |
| Real-provider memory | `node scripts/validate-provider.mjs` | An explicitly authorized configured provider completes Stage 1 and Stage 2 for the modified source, publishes non-empty records/baseline, accounts usage/citation, passes secret scan, isolates the explicit candidate from configured discovery, and removes temporary proof state on terminal paths. Prior canonical-artifact provider evidence is not reused. | PASS on Pi 0.84.2 with `cliproxy/gpt-5.6-sol`: 1 record, 1 baseline, usage/citation accounted, temporary-state cleanup observed |
| Scope and authority isolation | `test/memory.test.ts` | Repo A marker and citation usage hidden from B, global visible, work/session isolated, untrusted promotion blocked, memory reset preserves Continuity. | PASS |
| Project trust | `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts`, `test/memory.test.ts` | Zero Git calls when untrusted; no repo/work-item injection or promotion; RPC/JSON/print load without UI access. | PASS |
| Scheduler lifecycle | `test/scheduler.test.ts`, `test/memory.test.ts` | `agent_end` creates no worker; one settled event creates one eligible run; invalidation cancels timer/controller; stale source is superseded. | PASS |
| Pipeline lease/crash recovery | `test/pipeline-recovery.test.ts`, `test/memory.test.ts`, `test/concurrency.test.ts` | Unique attempt owner; heartbeat covers both provider stages; lease time is sampled after transaction lock; expired owners cannot heartbeat/stage/publish; startup/reclaim removes only non-active pending/building artifacts; stale finish cannot delete replacement work; prior published head survives; failure, expiry, and supersession retry idempotently; two processes surface no uncaught `SQLITE_BUSY`. | PASS |
| UX/non-interactive | `test/extension-mode.test.ts`, `node scripts/validate-install.mjs` | Namespaces/tools registered; exact short TUI labels; RPC/JSON/print never touch TUI APIs. | PASS |
| Pi support matrix | `test/pi-version.test.ts`, `scripts/pi-version.mjs`, `scripts/validate-premerge.sh`, `scripts/validate-release.mjs` | Runtime range is `>=0.84.1 <0.85.0`; lower bound 0.84.1 and current 0.84.2 pass; 0.85.0 fails with actionable range diagnostic; reports show actual version. | PASS |
| Alpine ARM64 matrix | `scripts/validate-alpine-arm64.sh` | Alpine 3.24, ARM64, Node >=22.19.0, supported Pi binary, and exact global-install proof. Wrong environment reports `DEFERRED`. | PASS on Alpine 3.24.1 aarch64, Pi 0.84.2 |
| Release artifact | `node scripts/package-release.mjs` | Payload comes from `package.json.files`; exact staged payload installs; sanitized independent ZIP has exact inventory, `unzip -t`, SHA-256, and no stores/credentials/settings/.git/node_modules/target/logs. | PASS |

## Authority and reliability invariants

- `verified` is written only by `ContinuityService.createCheckpoint` after a
  provisional insert, final stable repository fingerprint, and transactional
  revalidation of evidence, parent chain, mutation state, and operation ledger.
- Embedded session entries are hard-coded to `authority: "embedded"`.
- Learning memory cannot write validation/checkpoint authority.
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

- Local validation: `npm run validate`, `scripts/validate-premerge.sh`, the
  authorized modified-source real-provider proof, Pi 0.84.2 install/Alpine
  proof, and `npm run release` were observed passing.
- Optional hooks: none installed or required.
- CI invocation: none present in the supplied source snapshot.
- Branch protection: unverified; no external repository policy was changed.
