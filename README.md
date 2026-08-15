# Pi Continuity + Work Memory

One opt-in Pi extension for versions `>=0.84.1 <0.85.0`, providing branch-correct work continuity, evidence-backed safe checkpoints, and scoped persistent learning memory.

The implementation combines three design inputs: Harness-style clean architecture and transactional recovery, Pi compaction/session lifecycle handling, and a two-stage provider-backed memory pipeline. Harness itself is neither a runtime dependency nor part of the package payload.

## Requirements

- Node.js 22.19.0 or newer
- Pi `>=0.84.1 <0.85.0`
- Built-in `node:sqlite`; no native SQLite npm addon
- Git for verified safe checkpoints
- `zip` and `unzip` only when building the release ZIP from source

## Install globally, opt in explicitly

Extract the release ZIP, then install its package directory at user scope:

```sh
pi install /absolute/path/to/pi-continuity-work-memory
```

Pi's default `install` scope is user/global, so the extension loads in every workspace without `-e` or `-l`. Installing the package is the opt-in action. Removing it does not delete either persistent store.

```sh
pi remove /absolute/path/to/pi-continuity-work-memory
```

Default stores:

- Continuity: `~/.pi/continuity/state.sqlite`
- Learning memory: `~/.pi/work-memory/memory.sqlite`

For isolated tests, override them with `PI_CONTINUITY_HOME` and `PI_WORK_MEMORY_HOME`.

## Commands and tools

Commands:

- `/continuity status|show|checkpoint|recover [checkpoint-id]`
- `/memory status|run|reset|remember <global-user|repository|work-item|session> <text>`

Structured tools:

- `continuity_status`
- `continuity_update`
- `continuity_validate`
- `continuity_checkpoint`
- `continuity_recover`
- `memory_list`
- `memory_read`
- `memory_search`
- `memory_add`

`/memory reset` resets only the memory store. It cannot delete Continuity state.

## Safe-boundary authority

A checkpoint becomes `verified` only when all of these hold:

1. No mutation result is pending or uncertain.
2. An allow-listed executable validation succeeded after the latest mutation.
3. The repository fingerprint was identical before and after that validation.
4. A second stable fingerprint still matches at checkpoint creation.
5. The complete parent hash-chain validates.

The fingerprint covers HEAD, branch, porcelain-v2 status, staged binary diff, worktree binary diff, and content hashes for every untracked file. Two consecutive captures must match. Repository changes after checkpoint yield `drifted`. Corrupt payloads, missing parents, or cycles are quarantined.

Session-embedded state always has `authority: embedded`. It can restore context after compaction, fork, clone, or copy, but never grants safe authority in the copied session. Text written by a model cannot set a checkpoint status.

`/continuity recover` is deliberately store-only. It never runs Git, checks out or resets, writes repository files, applies patches, stashes, commits, pushes, publishes, deploys, or replays uncertain side effects.

## Branch and crash behavior

Continuity snapshots are attached to Pi session-tree nodes and mirrored transactionally in SQLite. Reconstruction selects only snapshots on the active branch. Forked/cloned sessions inherit embedded context, get a separate lineage identity, and must validate a new checkpoint for authority.

A mutation is persisted as `pending` before execution. If Pi or the machine stops before the corresponding tool result, resume converts it to `mutationUncertain=true`. SQLite uses WAL, `busy_timeout`, immediate transactions, retry handling, revisioned branch snapshots, job leases, and generation checks.

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
- `work-item`: keyed by repository plus work item.
- `session`: keyed by Pi session file identity.

Learning memory is untrusted context. It cannot mark validation passed, complete work, create a safe checkpoint, or change Continuity authority.

## Project trust

When `ctx.isProjectTrusted()` is false, the extension:

- runs no Git command;
- reads no dynamic project configuration;
- injects no repository/work-item memory;
- writes only session-scoped extracted memory;
- cannot create safe checkpoints;
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
