# Pi Continuity + Work Memory

One opt-in Pi package for versions `>=0.84.1 <0.85.0`, providing a Pi extension for branch-correct work continuity, a package-owned managed repository workflow, evidence-backed safe checkpoints, and scoped persistent learning memory, plus ten global engineering skills adapted for the same authority and runtime contract.

The implementation combines clean architecture and transactional recovery, Pi compaction/session lifecycle handling, a package-owned workflow and template bundle, and a two-stage provider-backed memory pipeline. Consumer repositories do not need `repository-harness` installed, and the extension never invokes or installs it.

## Requirements

- Node.js 22.19.0 or newer
- Pi `>=0.84.1 <0.85.0`
- Built-in `node:sqlite`; no native SQLite npm addon
- Git for verified safe checkpoints
- A loaded in-repository `AGENTS.md` or `AGENTS.override.md` plus project trust for managed auto-document behavior
- `unzip`/`zipinfo` when deploying a release ZIP; `zip` only when building one from source

## Install globally, opt in explicitly

For a managed user installation, keep the development checkout separate and
deploy the verified release payload to the stable package path under Pi's agent
directory:

```sh
node scripts/manage-user-install.mjs deploy \
  --archive release/pi-continuity-work-memory-1.0.0-rc.5.zip
```

Use this command only with a trusted release: verification executes the
candidate package's `scripts/validate-install.mjs` and loads the candidate
extension in an isolated Pi agent directory. The adjacent `.sha256` file checks
artifact integrity but is not a signature or independent trust source. Supply a
digest obtained through a trusted channel with `--expected-sha256 <digest>`
when one is available.

The command verifies the checksum, ZIP structure and size limits, package
inventory, entry point, and isolated global-install proof before changing the
agent directory. It then takes compatible installer/settings locks, backs up
the current settings/runtime, atomically activates the package at
`~/.pi/agent/packages/pi-continuity-work-memory`, replaces prior user-scope
local registrations of this package, and writes one stable user-scope
registration. Persistent stores are not moved or deleted. Start a fresh Pi
process after a successful deployment.

Use `--dry-run` to perform all payload checks, including execution of the
isolated install proof, and print the migration plan without creating or
changing the Pi agent directory. An already extracted trusted release package
can be supplied with `--package /absolute/path/to/package`.

To unregister the package while retaining both the managed runtime and the
persistent stores:

```sh
node scripts/manage-user-install.mjs remove
```

Pass `--remove-runtime` only when the runtime directory should also be moved
into the timestamped rollback backup. Neither remove mode deletes the
Continuity or learning-memory stores.

Direct source-tree registration with `pi install /path/to/development/checkout`
is intended only for development: Pi records a local path reference and does
not copy the package. Do not keep a source-tree registration active at the same
time as the managed package, because both copies register the same commands and
tools. The manager changes only global user settings; remove any project-local
registration from that project's `.pi/settings.json` separately.

Default stores:

- Continuity: `~/.pi/continuity/state.sqlite`
- Learning memory: `~/.pi/work-memory/memory.sqlite`

For isolated tests, override them with `PI_CONTINUITY_HOME` and `PI_WORK_MEMORY_HOME`.

## Bundled global engineering skills

The managed package ships `skills/` as a Pi package resource. A global managed
install makes these skills available in every repository without copying them
into each workspace:

- `/skill:grill-with-docs` — explicitly clarify uncertain intent and preserve
  confirmed shared understanding in the correct repository-owned document.
- `/skill:codebase-design` — design deep modules, interfaces, seams, and
  adapters with locality and leverage.
- `/skill:diagnosing-bugs` — diagnose difficult failures from a red-capable
  feedback loop through regression proof.
- `/skill:tdd` — implement behavior test-first in focused red/green slices.
- `/skill:code-review` — perform read-only Standards and Intent/Behavior review
  from a fixed Git point.
- `/skill:domain-modeling` — sharpen domain terminology and record only lasting,
  accepted trade-off decisions.
- `/skill:encode-invariant` — encode an accepted repository rule in its native
  validator with positive and negative recurrence proof.
- `/skill:onboard-repository` — explicitly inspect an unfamiliar repository and
  propose evidence-backed agent guidance without mutating it on the first pass.
- `/skill:audit-onboarding-proposal` — independently audit exact onboarding
  documentation hunks at a fixed Git point without applying them.
- `/skill:improve-harness` — explicitly test one bounded agent-workflow
  intervention from an observed baseline through a fresh Pi rerun.

`grill-with-docs`, `onboard-repository`, `audit-onboarding-proposal`, and
`improve-harness` are explicit-only. The other six may be loaded automatically
when their Pi descriptions match, or invoked explicitly. They are process
guidance rather than authority: applicable instructions and user scope still
control work; read-only work remains document-free; mutative work prepares its
managed work shape; durable task truth stays in one execution plan; memory and
checkpoints cannot establish completion; and commits, pushes, publication,
deployment, credentials, or external state always require explicit authority.

The skills use no executable helper or runtime dependency. Their two
MIT-licensed source lineages and Pi/Alpine adaptations are documented in
`skills/UPSTREAM.md`. Do not install an unadapted copy with the same skill names,
because Pi resolves a name collision to only one discovered skill.

After deploying or updating the managed package, start a fresh Pi process. Pi's
`/reload` can rescan skills during development, but a fresh process is the
deployment proof for the extension and package resources together.

## Commands and tools

Commands:

- `/continuity status|show|workflow|workflow-mode <off|advisory|managed>`
- `/continuity workflow-bind <docs/plans/active/file.md>|workflow-reset`
- `/continuity checkpoint|recover [checkpoint-id]|operations`
- `/continuity reconcile <operation-id> <applied|not_applied|partially_applied> <evidence-note>`
- `/memory status|run|reset|remember <global-user|repository|work-item|session> <text>`

Structured tools:

- `continuity_status`
- `continuity_update`
- `continuity_workflow_status`
- `continuity_workflow_read`
- `continuity_prepare_work`
- `continuity_bind_work_document`
- `continuity_finalize_work`
- `continuity_validate`
- `continuity_checkpoint`
- `continuity_recover`
- `memory_list`
- `memory_read`
- `memory_search`
- `memory_add`

`/memory reset` resets only the memory store. It cannot delete Continuity state.

## Managed repository workflow

The release payload contains checksum-verified package assets under `workflow/`, including `WORKFLOW.md` plus execution-plan, proposed-decision, and application-runbook templates. These assets are process defaults and scaffolding; applicable repository `AGENTS.md` files, explicit user authority, repository documents, code, tests, runtime evidence, and Git history remain the system of record.

The workflow is lazy and observable:

1. `session_start`, user input, agent completion, and `agent_settled` never create or finalize repository documents.
2. A trusted Git repository must have an in-repository `AGENTS.md` or `AGENTS.override.md` loaded by Pi before managed auto-document behavior is eligible.
3. In `managed` mode, an agent calls `continuity_prepare_work` before its first repository mutation. The tool derives the work shape from structured authority and durability signals.
4. Read-only and bounded work create no lifecycle document. Ambiguous or missing authority creates nothing and keeps mutation blocked.
5. Durable work records an exact branch-bound intent, then exclusively creates one identity-bearing execution plan under `docs/plans/active/`, or explicitly binds an existing plan. Root/path/symlink checks, Pi's file-mutation queue, and exclusive creation prevent escape, lost updates, and overwrite; interrupted operations remain recoverable rather than pretending the database and filesystem form one transaction.
6. Once bound, the repository plan owns durable progress, decisions, validation, and result. Continuity stores only its path, work-item identity, template version, digest, phase, and operational resume hint.
7. Repository changes win over the stored binding. Drift requires re-reading and explicit rebinding; recovery never restores an older template, recreates a missing document, or retries an uncertain write.
8. `continuity_finalize_work` accepts only a bound active plan whose status is `Ready for completion` or `Completed`, whose Result is no longer pending, and whose immediately preceding receipt-bound executable validation still matches the pre-operation ledger and stable repository fingerprint. It moves the file to `docs/plans/completed/` without claiming task completion and requires fresh post-move validation.

The preparation gate applies to agent-issued repository tools. Direct user `!`/`!!` commands remain explicit human actions: they are operation-ledger tracked and invalidate stale evidence, but are not reinterpreted or blocked as agent workflow decisions.

Simple information discovery is not repository mutation. `web_search`, `x_search`, `mcp` discovery/status/tool calls, `mcpScript`, and explicitly non-interactive Eta Browser observation/navigation actions are classified as read-only for managed workflow gating, even though they may use the network or leave the shared browser on a results or document page. Continuity does not require `continuity_prepare_work` for those discovery tools and does not track them as retry-blocking external operations. Interactive browser actions such as clicking, typing, selecting, pressing keys, resetting the browser, or requesting human help, and MCP `auth-start`/`auth-complete`, remain external mutations and fail closed unless the current workflow state authorizes them.

New WorkState defaults to `managed`; state migrated from schema v1 defaults to `advisory` so an upgrade never silently enables repository writes. Use `/continuity workflow-mode managed` once to opt an upgraded work item into enforcement. `off` keeps only Continuity/Memory behavior, while `advisory` supplies guidance without mutation gating or automatic materialization.

Package removal never deletes consumer documents. Existing plans are ordinary repository files and are not rewritten when workflow templates are upgraded.

## Safe-boundary authority

A checkpoint becomes `verified` only when all of these hold:

1. No mutation result is pending or uncertain.
2. Every operation on the active branch is determined or explicitly reconciled by the user.
3. An allow-listed executable validation succeeded after the latest mutation and operation-ledger state.
4. The complete validation receipt, including command, exit code, timestamps, mutation sequence, pre/post fingerprints, ledger digest, output digest, session/node identity, and issuer, validates against its receipt digest.
5. The repository fingerprint was identical before and after that validation.
6. A provisional checkpoint is inserted, then a final stable fingerprint still matches before promotion to `verified`.
7. The promotion transaction revalidates the parent hash-chain, checkpoint column projections, validation receipt, mutation state, and operation-ledger digest.

A verified checkpoint means only that repository and operation safety evidence is valid for the captured fingerprint. It never marks a managed execution plan, product outcome, or work item complete; repository documents and behavior-appropriate proof retain that authority.

The fingerprint covers HEAD, branch, porcelain-v2 status, staged binary diff, worktree binary diff, and content hashes for every untracked file. Two consecutive captures must match. Repository changes after checkpoint yield `drifted`. Corrupt payloads, missing parents, or cycles are quarantined.

Validation receipts persist a conservative command summary plus a digest of the complete parsed executable/argv. Arbitrary argument text is represented only by short one-way digests, so passwords or tokens embedded in test selectors are not copied into SQLite, embedded state, checkpoints, or later migration backups.

Session-embedded state always has `authority: embedded`. It can restore context after compaction, fork, clone, or copy, but never grants safe authority in the copied session. Text written by a model cannot set a checkpoint status.

RC2 checkpoint payloads remain available for state-only recovery after database migration, but report `authority: legacy` because their validation rows were not receipt-bound when created. A fresh validation creates a payload-v2 checkpoint and starts a new `GENESIS` authority chain rather than retroactively upgrading old evidence.

`/continuity recover` is deliberately store-only. It never runs Git, checks out or resets, writes repository files, applies patches, stashes, commits, pushes, publishes, deploys, or replays uncertain side effects.

## Branch and crash behavior

Continuity snapshots are attached to Pi session-tree nodes and mirrored transactionally in SQLite. Reconstruction selects only snapshots on the active branch. Forked/cloned sessions inherit embedded context, get a separate lineage identity, and must validate a new checkpoint for authority.

A mutation is persisted as `pending` before execution. If Pi or the machine stops before the corresponding tool result, resume converts that operation to `uncertain`. Uncertainty is derived from the active-branch operation ledger and cannot be cleared by an unrelated later mutation.

Unknown and non-read-only tools are treated conservatively as external operations. Their stable operation key binds repository identity, tool identity, a canonical simple-command argv digest (or canonical structured input digest), and the pre-operation Git HEAD. Equivalent quoting therefore cannot mint a second claim, and changing agent-controlled work metadata cannot bypass one. Agent-issued shell commands containing compound operators, redirection, substitution, expansion, or multiple lines fail closed and must be split into simple commands. An agent retry is blocked while an equivalent operation is pending, uncertain, or already determined. The user can reconcile an uncertain operation only through the direct `/continuity reconcile ...` command after inspecting the real target. Reconciliation records are append-only, secret-redacted, digest-bound, invalidate older validation, and require fresh executable proof before a checkpoint. No agent-callable tool can self-declare reconciliation.

SQLite uses WAL, `busy_timeout`, immediate transactions, retry handling, revisioned branch snapshots, ordered schema migrations, migration checksums, semantic schema checksums, integrity checks, job leases, and generation checks.

## Persistent-store upgrades

Continuity and learning-memory databases use ordered database schema migrations independently from the embedded session-state schema. Opening an RC2 schema-v1 store with this runtime:

1. verifies the claimed v1 tables, columns, and indexes before adoption;
2. creates a private `backups/` sibling directory;
3. writes a consistent `VACUUM INTO` backup plus SHA-256 sidecar with mode `0600`;
4. applies contiguous checksum-bound migrations inside an immediate transaction;
5. records migration history and a canonical `sqlite_schema` checksum; and
6. runs SQLite integrity and foreign-key checks before the store becomes available.

A failed migration rolls back the transaction and retains the pre-migration backup. A database newer than the runtime, an unknown migration checksum, a malformed claimed legacy schema, or schema drift fails closed. Stop older Pi processes before first opening a persistent store with the upgraded runtime; an RC2 process does not understand the v2 database schema.

The managed workflow uses WorkState schema v2 inside the existing branch-state/checkpoint JSON and reuses the consequential-operation ledger for durable document intent. Supported WorkState v1 rows and embedded entries migrate to schema v2 with workflow mode `advisory`; unsupported future WorkState versions fail closed. No extra task database or parallel plan table is introduced.

## Persistent memory

Automatic memory work starts only from `agent_settled`, never `agent_end`. Session/tree replacement cancels timers and provider controllers. A source hash and lifecycle generation prevent an old worker from publishing over a new session state.

The provider pipeline is:

1. Stage 1 extracts scoped, redacted candidate memories.
2. Stage 2 consolidates candidates into a published baseline.
3. Pending records and building baselines become visible in one transaction.

Before Stage 1, session evidence is structurally sanitized and bounded. Ordinary
text, tool metadata, project paths, and included bash command/result evidence
remain available. Raw image bytes, long base64/opaque payloads, secret fields,
opaque signatures, hidden thinking content, personal Pi session paths, and
`bashExecution` entries marked `excludeFromContext` are omitted or redacted.
Each serialized entry is bounded, and the complete provider source is capped at
120,000 characters while retaining the newest contiguous evidence.

Each pipeline attempt receives a unique owner token and a renewable lease. The
default 120-second lease is heartbeated every 30 seconds across both provider
stages. Expired owners cannot heartbeat, stage, or publish. Store startup and
atomic reclaim mark expired runs failed, remove non-active pending/building
artifacts, and permit an idempotent retry without exposing partial results.
Stale workers are owner-fenced and cannot delete a replacement worker's data.

Crash-interrupted consolidation leaves the previous published head readable. Memory citations use `[memory:UUID]` and increment usage counts. Provider token/cost usage is stored per run. No API key or OAuth token is stored.

Scopes are independent:

- `global-user`: shared across repositories; only an explicit user command can create it.
- `repository`: keyed by canonical repository identity.
- `work-item`: keyed by repository plus an explicit work item or bound repository work-document identity; the implicit `default` bucket is not injected or extracted.
- `session`: keyed by Pi session file identity.

Learning memory is untrusted context. It cannot mark validation passed, complete work, accept a product decision, create a safe checkpoint, or change Continuity authority. Active-plan progress and task-local completion are not published as repository truth.

## Project trust

When `ctx.isProjectTrusted()` is false, the extension:

- runs no Git command;
- reads no dynamic project configuration;
- injects no repository/work-item memory;
- writes only session-scoped extracted memory;
- cannot create safe checkpoints;
- disables the extension-owned create, bind, and finalize workflow operations; project trust is not a sandbox and does not prevent ordinary built-in tools from acting under separate user/model authority;
- still loads safely in TUI, RPC, JSON, and print modes.

Only TUI mode calls status/notification APIs. RPC, JSON, and print modes do not open dialogs or call TUI APIs.

## Validation

```sh
npm ci
npm run validate
scripts/validate-premerge.sh
git diff --check
```

Additional executable proofs:

```sh
# Validate an explicit supported Pi binary and report its actual version
PI_VALIDATION_PI=/absolute/path/to/pi node scripts/validate-install.mjs

# Requires Alpine Linux 3.24 ARM64, Node >=22.19.0, and Pi >=0.84.1 <0.85.0
PI_VALIDATION_PI=/absolute/path/to/pi scripts/validate-alpine-arm64.sh

# Requires a credential-configured Pi directory and the actual target model
PI_PROVIDER_PROOF_AGENT_DIR=/path/to/pi-agent \
PI_PROVIDER_PROOF_MODEL=provider/model \
node scripts/validate-provider.mjs
```

The lockfile pins Pi 0.84.1 as the lower-bound development dependency. Set
`PI_VALIDATION_PI` (or `PI_PROVIDER_PROOF_PI` for provider proof) to exercise a
different installed binary within the peer range. Proofs that reach a Pi binary
report both its actual version and the supported range; environment checks that
cannot reach Pi report `DEFERRED` with their missing prerequisite.

Missing platform or provider credentials produce `DEFERRED`, never `PASS`. See `proof/ACCEPTANCE.md` for the evidence map.
