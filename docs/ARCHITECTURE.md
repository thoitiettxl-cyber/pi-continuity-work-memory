# Architecture, Repository Workflow, And Documentation Map

This document is the contributor-facing map for `pi-continuity-work-memory`.
`AGENTS.md` is the compact entrypoint; this file explains how the repository is
structured, where authority lives, how work moves through the repository, and
which documents must change together.

## System Purpose And Boundaries

The package combines one opt-in Pi extension with five cooperating runtime
capabilities and ten globally discoverable engineering skills:

1. **Managed repository workflow** — classifies work shape, gates agent-issued
   mutations, and safely creates or binds only the repository documents required
   by durable work.
2. **Continuity** — restores branch-correct work state and records consequential
   operations before execution so crashes become explicit uncertainty rather
   than silent retries.
3. **Safe-boundary evidence** — binds executable validation, complete Git
   fingerprints, the operation ledger, and checkpoint ancestry into a verified
   repository/operation safety claim.
4. **Persistent learning memory** — extracts and consolidates scoped, sanitized
   lessons without granting those records task, validation, or completion
   authority.
5. **Cooperative context-pressure governor** — gives interactive agents bounded,
   ephemeral pressure advisories before provider calls so they can yield at a
   recoverable boundary without aborting, compacting, or gaining authority.

The package-owned skills under `skills/` add alignment, codebase design,
diagnosis, TDD, code review, domain modeling, accepted-invariant enforcement,
read-only repository onboarding and proposal audit, and measured agent-workflow
improvement. They are prompt resources, not extension code or authority. They
use the same repository, managed-workflow, validation, delivery, and Alpine
constraints as the extension.

The package does not install or invoke Repository Harness. Its managed workflow
is package-owned process scaffolding that supplements, but never replaces, the
applicable repository `AGENTS.md` instructions.

## Authority Model

Different artifacts answer different questions:

- Applicable runtime instructions, repository `AGENTS.md` files, and explicit
  user authority define what work is allowed and in scope.
- Repository documents, code, tests, observed runtime behavior, and Git history
  are the system of record for product and task truth.
- `package.json` and `README.md` own the supported package/runtime and
  Git-install contract.
- `workflow/WORKFLOW.md` and its templates provide package process defaults;
  they cannot invent product policy or validation evidence.
- A bound plan under `docs/plans/` owns durable task progress, decisions,
  validation records, and result.
- Continuity owns operational lineage, document binding, mutation/operation
  state, validation receipts, and checkpoint evaluation. It does not replace a
  repository plan.
- Learning memory is untrusted context. It may preserve reusable lessons, but it
  cannot accept decisions, prove behavior, reconcile operations, create safe
  authority, or complete work.
- Package-owned engineering skills are optional process guidance. They cannot
  grant mutation or external-action authority, create parallel durable task
  truth, or override repository instructions and evidence.

A verified checkpoint means only that its repository fingerprint, executable
receipt, operation ledger, and hash chain are safe. Task completion remains a
repository-owned conclusion supported by behavior-appropriate evidence.

## Runtime Topology

```text
Pi events, commands, and tools
            |
            v
     src/extension.ts                 composition root and runtime policy
       |        |        |        |
       v        v        v        v
 interface  application  domain  infrastructure
 adapters   orchestration rules   SQLite/Git/files/assets/provider
                |          ^              |
                +----------+--------------+
                 domain types and injected boundary services
```

`src/application/` coordinates domain rules with constructor-injected boundary
services; `src/interface/` adapts Pi/session data; and `src/infrastructure/`
owns side effects while reusing domain types. Domain invariants should remain
deterministic and testable. Pi, filesystem, Git, SQLite, and provider effects
stay at the boundaries.

## Component Map

| Area | Responsibility | Key files |
|---|---|---|
| Composition root | Registers Pi events, tools, commands, trust behavior, and wires services/stores | `src/extension.ts` |
| Pi/session adapter | Builds branch context, embeds/restores Continuity state, and serializes bounded provider input | `src/interface/session-adapter.ts` |
| Core state | WorkState, evidence, operation, checkpoint, memory, and schema types | `src/domain/types.ts` |
| Canonical integrity | Stable JSON/hashes, redaction, provider-bound sanitization, and bounded strings | `src/domain/canonical.ts` |
| Managed-workflow policy | Work-shape derivation, workflow projection, document identity/path rules, and deterministic plan rendering | `src/domain/managed-workflow.ts` |
| Operation authority | Consequential-operation identity and ledger integrity | `src/domain/operation-ledger.ts` |
| Validation authority | Receipt creation and verification | `src/domain/validation-receipt.ts` |
| Checkpoint authority | Payload parsing, hash construction, and chain verification | `src/domain/checkpoint-chain.ts` |
| Continuity orchestration | Branch reconstruction, tool observation, reconciliation, validation, checkpoints, and workflow projection | `src/application/continuity-service.ts` |
| Workflow orchestration | Asset access, work preparation, plan materialization, binding, alignment, and finalization | `src/application/managed-workflow-service.ts`, `src/application/workflow-context.ts` |
| Context-pressure policy | Pure thresholds, input validation, monotonic epochs, bounded advisories, and status projection | `src/application/context-pressure-governor.ts` |
| Tool policy | Read/validation/mutation classification and simple-command parsing | `src/application/tool-classifier.ts` |
| Memory orchestration | Scope selection, two-stage extraction/consolidation, leases, fencing, and publication | `src/application/memory-service.ts`, `src/application/memory-scheduler.ts`, `src/application/memory-ports.ts` |
| Continuity persistence | Branch snapshots, operation ledger, receipts, reconciliation, and checkpoints | `src/infrastructure/continuity-store.ts` |
| Memory persistence | Records, baseline generations, pipeline runs, leases, and citation usage | `src/infrastructure/memory-store.ts` |
| SQLite integrity | Durable connection behavior, ordered migrations, backups, checksums, and schema verification | `src/infrastructure/sqlite.ts`, `src/infrastructure/sqlite-migrations.ts` |
| Repository evidence | Canonical repository identity and complete stable Git fingerprinting | `src/infrastructure/git-fingerprint.ts` |
| Managed files | Root-confined plan create/bind/finalize and crash-state recovery | `src/infrastructure/execution-plan-files.ts` |
| Package assets | Manifest-verified workflow asset loading | `src/infrastructure/workflow-assets.ts`, `workflow/` |
| Engineering skills | Pi-discovered alignment/design/diagnosis/TDD/review/domain guidance with source provenance | `skills/`, `test/skills-package.test.ts` |
| Provider boundary | Pi-backed Stage 1/Stage 2 memory provider | `src/infrastructure/pi-memory-provider.ts` |
| Store locations | Default and isolated-test paths | `src/infrastructure/paths.ts` |

## Primary Runtime Flows

### Session Startup And Recovery

1. `src/extension.ts` receives `session_start` and resolves the Continuity and
   memory store paths.
2. SQLite stores verify or migrate their schemas before becoming available.
   Existing stores that require migration receive private checksum sidecar
   backups before migration.
3. Project trust controls whether Git repository identity and repository-scoped
   behavior are available.
4. Continuity reconstructs the nearest state on the active session-tree branch;
   pending operations from an interrupted process become `uncertain`.
5. Package workflow assets are checksum-verified. Managed document services are
   enabled only for a trusted canonical Git repository.
6. Session state is embedded back into Pi as context-only recovery material;
   embedded text never grants checkpoint authority.

### Managed Repository Workflow

1. Managed mode requires a trusted repository and a loaded in-repository
   `AGENTS.md` or `AGENTS.override.md`.
2. Before the first agent-issued repository mutation,
   `continuity_prepare_work` receives structured authority and durability
   signals.
3. Domain policy derives one work shape:
   - read-only and bounded work remain document-free;
   - unresolved authority creates nothing and blocks mutation;
   - durable work persists exact intent before exclusively creating one plan
     under `docs/plans/active/`, or explicitly binds an existing plan.
4. A bound repository plan becomes durable task truth. Continuity retains only
   identity, path, template version, digest, phase, and a resume hint.
5. Repository edits win over a stored digest. Drift requires re-reading and
   explicit rebinding; recovery never restores old content or retries an
   uncertain write automatically.
6. Finalization requires a ready, result-bearing plan and an immediately
   preceding receipt-bound validation matching the current ledger and stable
   Git fingerprint. Moving the plan to `docs/plans/completed/` is itself a new
   mutation and requires fresh validation.

Direct user `!`/`!!` commands remain explicit human actions. They are recorded
and invalidate stale evidence, but the agent preparation gate does not
reinterpret them as workflow decisions.

Read-only shell discovery is recognized from parsed argv, including narrow Git
and GitHub CLI views; output-writing, executable, credential-revealing,
ambiguous, and mutating forms remain fail-closed external operations. Streaming
steer/follow-up input preserves the current run's assessed eligibility because
Pi does not emit a second `before_agent_start` for that queued input.

### Consequential Operations And Checkpoints

1. Before a mutation, validation, or unknown external operation executes,
   Continuity records a pending claim tied to session, branch, repository, tool,
   canonical input, and pre-operation HEAD.
2. A corresponding tool result resolves the operation to `determined`; a crash
   without a result leaves it `uncertain` after recovery.
3. Equivalent retries are blocked while an operation is pending, uncertain, or
   already determined. Only the direct human reconciliation command may record
   evidence about an uncertain real-world outcome.
4. `continuity_validate` runs an allow-listed executable and seals its command,
   result, timestamps, fingerprints, ledger digest, output digest, session, and
   node identity into a validation receipt.
5. `continuity_checkpoint` verifies the receipt, stable full Git fingerprint,
   mutation state, operation ledger, parent chain, and final promotion state.
   Later repository changes make the checkpoint drifted.

`continuity_recover` restores store state only. It does not run Git, change
files, reconcile uncertainty, replay side effects, or authorize a retry.

### Cooperative Context Pressure

1. The TUI-only governor reads `ctx.getContextUsage()` during each `context`
   event and recomputes pressure from tokens and the configured model window.
2. Within one in-memory epoch, active severity and peak percentage are
   monotonic. Successful compaction, model selection, tree replacement, and
   session start reset the epoch; unknown usage does not.
3. A pressured call receives exactly one final
   `continuity-context-pressure` custom message in the outgoing message copy.
   It is hidden from transcript display, never appended to session state, and
   converts through Pi's normal custom-message boundary for that provider call.
4. Transition-only footer status and `/continuity context-governor
   status|on|off` expose session-local TUI control. A settled pressured run may
   recommend explicit `/compact`, but the extension never aborts, compacts,
   sends synthetic input, persists telemetry, or resumes work automatically.
5. Invalid usage or local policy/rendering failure fails open for that call and
   does not compromise Continuity authority. RPC, JSON, and print modes return
   without message transformation or UI access.

### Persistent Learning Memory

1. Automatic work begins only after `agent_settled`; aborted or replaced runs
   are canceled or superseded.
2. The session adapter serializes bounded ordinary evidence while removing or
   redacting images, hidden thinking, secrets, private session paths, excluded
   bash content, and opaque payloads. After the first extract, later windows
   start from a per-session cursor plus one background entry.
3. Stage 1 extracts scoped typed atoms (`preference`, `constraint`, `lesson`,
   `fact`). Stage 2 consolidates candidates into a new baseline generation.
   Exact-content duplicates in the same scope are dropped within the batch and
   transactionally at publish so concurrent sessions cannot expose duplicates.
4. Unique owner tokens, renewable leases, generation/source checks, and atomic
   publication prevent stale or crashed workers from publishing over current
   state. After warmup, automatic extract waits for three new user/assistant
   turns unless `/memory run` forces it. Cursor advancement shares the publish
   transaction with records, baselines, and the run state.
5. Visible scopes are isolated as `global-user`, `repository`, explicit/bound
   `work-item`, and `session`. There is no implicit repository-wide `default`
   work-item bucket.
6. `before_agent_start` injects published baselines plus at most 12
   query-matched atoms from `event.prompt`. Search scores the latest 500 visible
   records by token overlap, and the 64,000-character renderer reserves bounded
   space for both baselines and atoms while retaining its closing delimiter.
   Memory remains untrusted learning context.

## Persistence And Generated Data

| Data | Default location or owner | Authority |
|---|---|---|
| Continuity SQLite store | `~/.pi/continuity/state.sqlite` | Operational lineage and safety evidence |
| Learning-memory SQLite store | `~/.pi/work-memory/memory.sqlite` | Untrusted learning context |
| Context governor state | Extension-process memory only | Ephemeral sequencing advisory; no task or safety authority |
| Embedded Continuity state | Pi session JSONL custom entries | Context-only recovery |
| Active durable work | `docs/plans/active/<slug>.md`, created lazily | Repository task truth |
| Completed durable work | `docs/plans/completed/<slug>.md` | Historical repository task record |
| Workflow defaults | `workflow/WORKFLOW.md` and `workflow/templates/` | Package process scaffolding |
| Engineering skills | `skills/<name>/SKILL.md` and bounded references | Optional process guidance; never product or completion authority |
| Workflow asset integrity | `workflow/manifest.json` | Package asset inventory/checksums |
| Acceptance evidence map | `proof/ACCEPTANCE.md` | Required observations and evidence locations |
| Recorded release results | `proof/RESULTS.json` | Historical observed results, not a substitute for rerunning checks |
| Build/test/release output | `dist/`, `.test-build/`, `release/` | Generated and ignored; never commit |

Use `PI_CONTINUITY_HOME` and `PI_WORK_MEMORY_HOME` for isolated tests. Never add
stores, WAL/SHM files, credentials, personal settings, or generated payloads to
Git.

## Repository Workflow

### 1. Orient

- Read `AGENTS.md`, this document, and the task-relevant source-of-truth files.
- Inspect the current worktree and preserve unrelated changes.
- Confirm whether the request is read-only, mutative, externally consequential,
  or authority-blocked.

### 2. Prepare By Work Shape

| Shape | Repository document | Rule |
|---|---|---|
| Read-only | None | Inspect only what the answer requires |
| Bounded mutation | None | Use ephemeral planning and finish coherently in one run |
| Durable mutation | Exactly one active execution plan | Create or bind it before other mutation and keep it current |
| Authority-blocked | None | Ask for the smallest material missing decision; do not mutate |

When managed Continuity is available, the observable
`continuity_prepare_work` call establishes this shape before mutation. Merely
opening the repository or starting/ending an agent run creates no document.

### 3. Implement

- Make the smallest coherent authorized change.
- Keep pure integrity/state rules in `src/domain/` and side effects at the
  infrastructure/runtime boundaries.
- Preserve strict ESM TypeScript style and the existing support contract:
  Node.js `>=22.19.0`, Pi `>=0.84.1 <0.85.0`, no production runtime
  dependencies, and only the pinned TypeScript install-time emitter required to
  generate ignored `dist/` output in Pi's default omit-dev Git clone.
- Add focused tests whenever behavior, authority, recovery, migration,
  concurrency, trust, or non-interactive handling changes.

### 4. Validate

Choose executable or observable proof that matches the behavior. Plans,
checklists, prose, memory, and checkpoints are not behavior proof by themselves.

| Change scope | Minimum focused proof | Broader gate when applicable |
|---|---|---|
| Documentation only | Inspect links/paths and run `git diff --check` | Run a stronger gate if documentation changes a tested contract |
| Pure domain/application behavior | Targeted tests plus `npm run typecheck` | `npm test` |
| Runtime, persistence, trust, recovery, or provider boundary | Relevant integration tests | `npm run validate` |
| Premerge candidate | Focused proof already green | `scripts/validate-premerge.sh` |
| Git or release payload/install contract | Clean Git-install proof plus full validation | `npm run validate:git-install`, `npm run release`, and artifact/install inspection |
| Provider or platform claim | Repository script using the real authorized environment | Report unavailable prerequisites as `DEFERRED`, never `PASS` |

Always review the final diff and relevant untracked files. Report passed, failed,
deferred, and skipped checks separately.

### 5. Complete And Deliver

- Update a durable plan's progress, validation, and result in the plan itself.
- Do not treat moving a plan, updating Continuity, writing memory, or creating a
  checkpoint as completion evidence.
- Commit only when explicitly requested, using a focused Conventional Commit
  subject. Push, publish, release, or deploy only with explicit target-specific
  authority.

## Change-Coupling Guide

| If changing… | Inspect or update together | Required proof emphasis |
|---|---|---|
| Continuity/checkpoint authority | Domain receipt/chain/ledger rules, `continuity-service`, store schema, README, acceptance map | Positive and tamper/forbidden cases; stable fingerprint and chain behavior |
| Managed workflow behavior | Workflow assets/manifest, domain policy, workflow service/context, file service, extension tools, README | Read-only/bounded no-write cases, authority blocks, create/bind/finalize, crash and path safety |
| Memory scopes or provider pipeline | Session serialization, memory service/ports/scheduler, provider, memory store, README | Scope isolation, sanitization, lease/fencing, stale-worker and crash recovery |
| SQLite schema | Ordered migrations, exact legacy schema verification, stores, fixtures, proof docs | Backup/checksum, rollback, drift/future/gap rejection, concurrent open |
| Pi API integration | `src/extension.ts`, session adapter, context-pressure policy, mode tests, install proof, peer range | Public API behavior on supported Pi versions, ephemeral context injection, compaction lifecycle, and non-interactive modes |
| Package, Git install, or release payload | Package lifecycle/dependencies, `package.json.files`, Git/release/install scripts, workflow manifest, README, proof docs | Real Pi Git install/update through a clean loopback source, default omit-dev build/load, exact archive inventory, isolated install, sanitization, `unzip -t`, checksum |
| Package engineering skills | Skill frontmatter/references, `package.json` Pi manifest, install/release proof, README, provenance/license | Exact discovery set, command registration in two workspaces, no cross-harness/unsafe side effects, license and payload inventory |
| Historical source provenance | `SOURCE_MANIFEST.json`, `BUILD_PROVENANCE.md`, `ORIGINAL_SOURCE_STATUS.txt`, `RECONSTRUCTION_NOTES.md` | Preserve immutable historical claims; never rewrite later work into the original snapshot |

## Documentation Map

| Document | Audience and ownership |
|---|---|
| `AGENTS.md` | Compact repository instructions and contributor entrypoint |
| `docs/ARCHITECTURE.md` | Architecture, repository workflow, validation ladder, and documentation map |
| `docs/proposals/*.md` | Exploratory or accepted design history; implementation status does not make proposals active plans, runtime contracts, validation, or completion evidence |
| `README.md` | User-facing package behavior, installation, commands, security boundaries, and support contract |
| `workflow/WORKFLOW.md` | Package-owned managed-workflow process defaults shipped to consumer repositories |
| `workflow/templates/*.md` | Deterministic process scaffolding; templates do not establish product facts |
| `workflow/manifest.json` | Sorted checksum inventory for package workflow assets |
| `skills/README.md`, `skills/UPSTREAM.md` | Shipped skill inventory, shared authority contract, source provenance, and adaptation/update process |
| `skills/*/SKILL.md` | Pi-discovered engineering workflows and bounded optional references |
| `docs/plans/active/*.md` | Lazily created authoritative records for current durable work |
| `docs/plans/completed/*.md` | Completed durable-work history and task-local decisions/results |
| `proof/ACCEPTANCE.md` | Acceptance criteria, executable evidence map, and PASS/DEFERRED policy |
| `proof/RESULTS.json` | Structured historical release/proof observations |
| `CHANGELOG.md` | Concise user-visible unreleased changes |
| `RECONSTRUCTION_NOTES.md` | Boundary between recovered historical source and later implementation |
| `SOURCE_MANIFEST.json` | Immutable original-source inventory and hashes |
| `BUILD_PROVENANCE.md` | Original build/source provenance |
| `ORIGINAL_SOURCE_STATUS.txt` | Original source-availability statement |
| `package.json` | Package identity, support range, Pi entrypoint, Git-install lifecycle, payload inventory, and scripts |
| `test/*.test.ts` | Executable behavioral and invariant documentation |
| `scripts/` | Repository-owned validation, install, deployment, version, provider, platform, and release entrypoints |

When documents disagree, inspect the artifact that owns the disputed claim and
verify behavior against current code, tests, runtime evidence, and Git state.
Do not use an old plan, release result, checkpoint, or memory record to override
current repository truth.
