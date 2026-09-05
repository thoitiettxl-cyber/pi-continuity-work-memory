# Acceptance evidence map

This file maps required behavior to executable evidence. A release may be called
complete only when every mandatory row has an observed `PASS`. Missing authority,
credentials, target hardware, or external proof remains `DEFERRED` rather than
being inferred from source or prior artifacts.

## Current Git-install refinement

`PASS (source-local, pre-delivery)` — `npm run validate` and
`scripts/validate-premerge.sh` passed with 200/200 tests. Both gates include a
clean temporary loopback Git source with no generated `dist/`, Pi's real Git
install command and default `npm install --omit=dev` lifecycle, the pinned
TypeScript install-time emitter, managed-checkout command discovery, and a Git
update that cleans stale output and rebuilds `dist/extension.js` on Pi 0.84.1.
Fresh `npm run release` packaging after commit `8d1be43` also passed with a
sanitized 136-file independent-install ZIP, successful `unzip -t`, and SHA-256
`f90da03faac718c64019d3f33fe94e20c4b9e2e750e4e5240e9144f918707fdd`.
`git push origin dev-next` then delivered the implementation and release-proof
commits; GitHub `refs/heads/dev-next` resolved to full commit
`d6640c8a2773397aa68d63b2e5cdc7a4179ba7bc`. The documented unpinned Git command
is therefore available from the repository's default branch.

## Current RC6 release and deployment

`PASS (committed, published, and deployed)` — implementation commit
`1140be1f474ac88d4d0ff3bc7592f56fa790649c` passed the repository premerge
gate both in the primary worktree and in an isolated clean clone: 202/202 serial
tests, strict typecheck/build, isolated Pi 0.84.1 install and Git install/update
proof, exactly eleven loadable skill paths, and release static validation. The
commit was fast-forward pushed to `origin/dev-next` without force.

The clean committed source produced the definitive sanitized 138-file RC6 ZIP
with SHA-256 `8e85b9fce05be8dec0508630dc7ceac63d63f6ab6362f645e5b0b2c7ac3f399f`,
exact inventory, staged install, `unzip -t`, and isolated managed-installer
dry-run proof. GitHub prerelease `v1.0.0-rc.6` targets that exact commit and
publishes only the ZIP and checksum assets at
`https://github.com/thoitiettxl-cyber/pi-continuity-work-memory/releases/tag/v1.0.0-rc.6`.

The checksum-pinned archive was deployed through the package-owned manager to
`/root/.pi/agent/packages/pi-continuity-work-memory`. The receipt reports
`storesChanged: false`, `restartRequired: true`, one stable
`packages/pi-continuity-work-memory` registration, and rollback backup
`/root/.pi/agent/backups/pi-continuity-work-memory/2026-08-27T04-28-38-172Z-8788-75c5f0c7`.
Installed-package validation on fresh Pi 0.84.3 loaded all eleven skill sources
and verified the workflow payload.

Focused prompt-contract proof covers the independent consumer/provider trigger,
same-change escape hatch, one authoritative artifact, compatibility and
untrusted-input boundaries, actual serialization, reproducible regression-first
behavior, and materially distinct execution-path parity without coverage
quotas. Matt Pocock, Repository Harness, and ECC retain separate pinned MIT
attribution; no ECC runtime, hook, command, agent, generator, MCP configuration,
or dependency was added. Actual model retrieval/adherence and real-provider
memory execution remain `DEFERRED` rather than inferred from package discovery
or deployment. Historical RC5 artifacts remain unchanged.

## Historical RC5 candidate validation

`PASS (source-local, pre-delivery)` — the RC5 worktree passed
`npm run validate` and `scripts/validate-premerge.sh` on 2026-08-25: typecheck,
build, 197/197 tests, `git diff --check`, isolated two-workspace Pi 0.84.1
installation, checksum-bound workflow assets, ten exact package skill commands,
zero loader diagnostics, collision-resistant source
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
with Node v24.18.1 and Pi 0.84.3, including the isolated two-workspace package
and ten-skill source-path proof. A preliminary `npm run release` produced a
sanitized 136-file report, passed exact staged installation and `unzip -t`, and
the managed-installer dry-run reported `storesChanged: false`. Definitive
artifact identity, commit/push, and managed deployment are reported only after
observation from Git, the remote ref, and installer receipts; the
payload does not self-assert its own deployment.

The learning-memory provider pipeline is unchanged, but the extension now adds
one ephemeral advisory to pressured TUI provider context. Deterministic policy
and extension integration proof is current. A real-provider governor compliance
smoke would require a costly controlled near-window run, so it is `DEFERRED`
rather than inferred; memory execution remains historical RC2 evidence.

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
| Consequential operation ledger | `test/continuity.test.ts`, `test/continuity-agent-loop.test.ts`, `test/tool-classifier.test.ts`, `src/domain/operation-ledger.ts` | External operations are claimed atomically across processes; tokenized ordinary shell/Git/GitHub discovery remains read-only while output-writing, executable, credential-revealing, mutating, and ambiguous forms fail closed; equivalent simple argv quoting deduplicates; blocked operations do not execute or terminate the run; results cannot cross sessions/branches; crashes become uncertain; recovery does not infer outcomes; reconciliation is human-only and digest-bound; unresolved operations block checkpoints. | PASS in current source-local run |
| Managed repository workflow | `test/managed-workflow*.test.ts`, `test/workflow-context.test.ts`, `test/workflow-assets.test.ts`, `test/execution-plan-files.test.ts`, `src/domain/managed-workflow.ts`, `src/application/managed-workflow-service.ts` | Package assets are checksum/inventory bound; no Harness install is required; trust plus an in-repository AGENTS context gates managed behavior; read-only/bounded/ambiguous work creates no document; durable work persists intent before exclusive creation, binds one identity-bearing plan, blocks unprepared mutation, survives branch/session recovery, preserves assessed eligibility across active-run steer/follow-up input, rejects path/symlink/conflict/overwrite, recovers interrupted same-identity finalization, and requires pre/post-finalization proof without elevating checkpoint or memory to completion authority. | PASS in current source-local run |
| Global engineering skills | `test/skills-package.test.ts`, `node scripts/validate-install.mjs`, `scripts/validate-release.mjs`, `scripts/manage-user-install.mjs` | The Pi manifest exposes exactly eleven prompt-only skill directories; Pi loads each with zero diagnostics and no adjacent duplicate headings; four workflows are explicit-only; contract-first activates only for independently evolving consumers/providers, uses one authoritative artifact, validates actual serialized behavior, avoids same-change ceremony, and cannot gain mutation/dependency/network authority; TDD requires reproducible regression-first proof without fabricated RED states or coverage quotas and checks materially distinct execution paths; intent clarification, diagnosis, invariant encoding, onboarding/audit, harness improvement, domain modeling, three pinned MIT source lineages, isolated source paths, and cross-harness/unsafe-side-effect exclusions retain their established boundaries. | PASS in current RC6 focused, exact-commit premerge, GitHub prerelease, managed deployment, installed-package, and fresh Pi 0.84.3 proof; actual model retrieval/adherence remains DEFERRED |
| Ordered SQLite migrations | `test/sqlite-migrations.test.ts`, `src/infrastructure/sqlite-migrations.ts` | Literal RC2 continuity/memory stores migrate without data loss after exact schema verification and private checksum backup; gaps, future versions, history/checksum/schema drift, malformed v1, failed apply, and concurrent open fail closed or converge safely. | PASS in current source-local run |
| Source provenance and release alignment | `SOURCE_MANIFEST.json`, `RECONSTRUCTION_NOTES.md`, `test/release-alignment.test.ts` | Original archive hashes remain historical; reconstructed OpenAI compatibility, included/excluded bash evidence, and real npm-test provider seed match the documented canonical repairs without claiming they existed in the supplied source. | PASS |
| Global, opt-in install | `node scripts/validate-git-install.mjs`, `node scripts/validate-install.mjs` | A clean loopback Git source starts without generated `dist/`; Pi's real Git install and default omit-dev npm lifecycle create a managed checkout and emit the entrypoint from pinned build-only tooling; commands load from that checkout; a new remote commit plus `pi update --extensions` cleans stale output, advances the checkout, regenerates the entrypoint, and reloads commands. Existing two-workspace payload proof still verifies checksum-bound workflow assets, repository/global memory isolation, store retention, and actual Pi version/range. | PASS for real Git install/update plus managed-checkout Pi 0.84.1 load; existing archive/source payload proof also passed on Pi 0.84.3 |
| Continuity across session/tree | `test/continuity.test.ts`, `test/extension-mode.test.ts` | Full-state exit/resume, crash resume after pending mutation, active-branch reconstruction, fork/copy context and fresh child authority chain, checkpoint ancestry, no A→B marker leak, and embedded state before/after manual/automatic compaction. | PASS |
| Safe boundary | `test/continuity.test.ts`, `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts` | Pending/uncertain mutations block; executable validation and stable pre/post fingerprint required; direct `!`/`!!` mutations tracked; tracking failure fails closed; drift and corrupt/missing/cyclic chains detected; copied embedded checkpoint has no authority. | PASS |
| Non-mutating recovery | `test/continuity.test.ts` | Recovery executes no repository command and changes only stored work state. | PASS |
| Provider-bound source privacy/cost | `test/canonical.test.ts`, `test/provider-source-sanitization.test.ts` | Stage 1 source, metadata, Stage 2 records, citations, and previous baselines retain bounded ordinary evidence but exclude/redact raw image data, contiguous/wrapped/parameterized base64, long opaque payloads, secrets, hidden thinking, opaque signatures, default/custom session paths, and excluded bash content. Total provider DTOs remain bounded. | PASS |
| Real-provider memory | `node scripts/validate-provider.mjs` | An explicitly authorized configured provider completes Stage 1 and Stage 2 for the modified source, publishes non-empty records/baseline, accounts usage/citation, passes secret scan, isolates the explicit candidate from configured discovery, and removes temporary proof state on terminal paths. Prior canonical-artifact provider evidence is not reused. | HISTORICAL RC2 PASS on Pi 0.84.2 with `cliproxy/gpt-5.6-sol`: provider runtime is unchanged; this proof was not rerun and is not current RC6 authority |
| Scope and authority isolation | `test/memory.test.ts` | Repo A marker and citation usage hidden from B, global visible, explicit/bound work and session isolated, unbound tasks receive no implicit `default` work-item bucket, untrusted promotion blocked, memory reset preserves Continuity. | PASS |
| Query-conditioned learning memory | `test/memory.test.ts`, `test/managed-workflow-extension.test.ts`, `test/provider-source-sanitization.test.ts`, `test/sqlite-migrations.test.ts` | `before_agent_start` conditions recall on the current prompt; search scores the latest 500 visible candidates and does not require a contiguous substring; capped rendering preserves baselines, matched atoms (including citation-tail matches), and the closing authority delimiter; kinds default to `fact`; incremental extract skips below threshold unless forced; batch and concurrently staged exact-content duplicates stay singular; cursor-write failure rolls back publication; RC2 stores traverse to schema v3 with legacy `kind=fact`. | PASS in current source-local tests |
| Project trust | `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts`, `test/memory.test.ts` | Zero Git calls when untrusted; no repo/work-item injection or promotion; RPC/JSON/print load without UI access. | PASS |
| Scheduler lifecycle | `test/scheduler.test.ts`, `test/memory.test.ts` | `agent_end` creates no worker; one settled event creates one eligible run; invalidation cancels timer/controller; stale source is superseded. | PASS |
| Pipeline lease/crash recovery | `test/pipeline-recovery.test.ts`, `test/memory.test.ts`, `test/concurrency.test.ts` | Unique attempt owner; heartbeat covers both provider stages; lease time is sampled after transaction lock; expired owners cannot heartbeat/stage/publish; startup/reclaim removes only non-active pending/building artifacts; stale finish cannot delete replacement work; prior published head survives; failure, expiry, and supersession retry idempotently; two processes surface no uncaught `SQLITE_BUSY`. | PASS |
| Cooperative context pressure | `test/context-pressure-governor.test.ts`, `test/context-pressure-extension.test.ts`, `src/application/context-pressure-governor.ts`, `src/extension.ts` | Exact inclusive headroom thresholds, invalid-input fail-open behavior, recomputed percentage, monotonic epoch severity, bounded authority-limited advisory variants, one ephemeral final custom message per pressured provider call, no input mutation or session entry, transition-only TUI status, settled `/compact` recommendation, explicit session-local controls, and reset on successful compaction/model/tree/session lifecycle. Governor paths never abort, compact, send synthetic input, persist state, or alter non-TUI messages/UI. | PASS in focused policy/extension tests and current serial source-local suite; release/deployment evidence remains external-receipt-owned |
| Session-objective prompt policy | `test/canonical.test.ts`, `test/continuity.test.ts`, `src/domain/canonical.ts`, `src/application/continuity-service.ts` | `escapeXmlText` encodes `&` then `<` then `>`; `contextSummary` escapes dynamic interpolations, wraps a non-empty-after-trim goal once, and emits exactly one prompt-only policy kind (`bound-active`, `bound-completed`, `bound-unaligned`, or `goal-only`) without Goal tools, auto-continuation, or completion authority. | PASS in current source-local tests; provider compliance remains DEFERRED |
| UX/non-interactive | `test/extension-mode.test.ts`, `test/context-pressure-extension.test.ts`, `node scripts/validate-install.mjs` | Namespaces/tools registered; exact short Continuity and context-pressure TUI labels; RPC/JSON/print never touch TUI APIs or receive governor context transformation. | PASS |
| Execution plan browser | `test/plan-browser-files.test.ts`, `test/plan-browser-command.test.ts`, `test/plan-browser-ui.test.ts`, `src/interface/plan-browser.ts`, `src/infrastructure/execution-plan-files.ts` | Trusted idle TUI `/continuity plans [query]` lists bounded active/completed Markdown without creating directories; rejects symlink/nonregular/oversized/invalid files; re-reads identity/digest before drafting; Work/Refine append editor text without submit/bind/status change; completed plans cannot Work; RPC/JSON/print, untrusted, busy, and session/tree replacement stay inert. Live overlay chrome is component-tested, not a live-terminal recording. | PASS in current source-local tests plus observed isolated Pi 0.84.1 install, omit-dev Git-install load, release packaging, and premerge (`git diff --check`). Live TUI overlay remains unrecorded. |
| Pi support matrix | `test/pi-version.test.ts`, `scripts/pi-version.mjs`, `scripts/validate-premerge.sh`, `scripts/validate-release.mjs` | Runtime range is `>=0.84.1 <0.86.0`; lower bound 0.84.1 and live 0.85.x pass; 0.86.0 fails with actionable range diagnostic; install/premerge/provider proofs skip nested `node_modules/.bin/pi` and check the live host (PATH/`PI_VALIDATION_PI`); reports show the actual host version. | PASS on live Pi 0.85.1 |
| Alpine ARM64 matrix | `scripts/validate-alpine-arm64.sh` | Alpine 3.24, ARM64, Node >=22.19.0, supported Pi binary, and exact global-install proof. Wrong environment reports `DEFERRED`. | PASS on Alpine 3.24.1 aarch64, Pi 0.84.3 |
| Release artifact | `node scripts/package-release.mjs` | Payload comes from `package.json.files`; checksum-bound workflow assets are included; exact staged payload installs; sanitized independent ZIP has exact inventory, `unzip -t`, SHA-256, and no stores/credentials/settings/.git/node_modules/target/logs. | PASS for the definitive clean-commit RC6 archive: 138 files, exact staged install, `unzip -t` PASS, SHA-256 `8e85b9fce05be8dec0508630dc7ceac63d63f6ab6362f645e5b0b2c7ac3f399f`, GitHub prerelease publication, and checksum-pinned managed deployment |

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
  `>=0.84.1 <0.86.0`; unsupported or malformed versions fail with the range.
- Real provider: `PASS` only after an explicitly authorized configured provider
  publishes Stage 1 and Stage 2 with non-zero usage; otherwise `DEFERRED` or
  `FAIL`.
- Alpine ARM64: `PASS` only on Alpine 3.24 ARM64 with a supported Pi binary;
  otherwise `DEFERRED`.
- Artifact integrity: `PASS` only after exact staged install, inventory match,
  secret/path scan, `unzip -t`, and SHA-256 generation.

## Enforcement levels

- Local validation: current RC5 `npm run validate`, premerge, Pi 0.84.1 and
  0.84.3 install proof, Alpine ARM64 proof, preliminary `npm run release`, and
  managed-installer dry-run passed; definitive delivery evidence remains bound
  to the execution plan and external receipts.
- Optional hooks: none installed or required.
- CI invocation: none present in the supplied source snapshot.
- Branch protection: unverified; no external repository policy was changed.
