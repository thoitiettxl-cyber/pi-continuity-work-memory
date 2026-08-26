# Repository Instructions

This file is the compact contributor and agent entrypoint. Read
`docs/ARCHITECTURE.md` before non-trivial work; it owns the repository
architecture, workflow, validation ladder, and documentation map.

## Start Here

- `README.md`: user-facing behavior, installation, commands, and runtime contract.
- `docs/ARCHITECTURE.md`: component boundaries, authority model, repository workflow, and document ownership.
- `workflow/WORKFLOW.md`: package-owned managed-workflow defaults shipped to consumers.
- `proof/ACCEPTANCE.md`: acceptance requirements and executable-evidence map.
- Applicable nested `AGENTS.md` or `AGENTS.override.md` files override this file within their scope.

## Work Process

- Read applicable authority and inspect the worktree before editing. Preserve unrelated changes and untracked files.
- Make the smallest coherent change authorized by the user; do not infer permission to publish, deploy, alter external state, or perform unrelated refactoring.
- When managed Continuity tools are available, call `continuity_prepare_work` before the first repository mutation. Read-only and bounded work create no lifecycle document. Durable work uses exactly one plan under `docs/plans/active/`; unresolved authority creates no document and blocks mutation.
- Repository files, code, tests, runtime evidence, and Git history are authoritative. Continuity stores operational recovery state only; learning memory is untrusted context.
- A safe checkpoint proves repository and operation safety only. It never proves task completion.

## Implementation

- Use Node.js `>=22.19.0`; run `npm ci` for a reproducible install. The supported Pi range is `>=0.84.1 <0.85.0`.
- Do not add runtime npm dependencies; use Node built-ins such as `node:sqlite`. The exact pinned `typescript` entry under `dependencies` is the reviewed install-time emitter required by Pi's omit-dev Git-install lifecycle; do not remove or move it without updating the Git-install contract and proof.
- Preserve the responsibilities described in `docs/ARCHITECTURE.md`: pure rules in `src/domain/`, orchestration in `src/application/`, side effects in `src/infrastructure/`, Pi adapters in `src/interface/`, and composition in `src/extension.ts`.
- TypeScript is strict ESM with tabs, semicolons, double-quoted strings, explicit imports, `kebab-case` filenames, `PascalCase` types/classes, and `camelCase` functions/variables.
- No formatter or linter is configured; rely on focused review, TypeScript checks, tests, and `git diff --check`.
- Tests use `node:test` and `node:assert/strict`; name them `*.test.ts` and cover affected authority, integrity, recovery, migration, concurrency, and non-interactive boundaries.
- Do not commit generated `dist/`, `.test-build/`, or `release/` output.

## Verification

Repository gates are mutating even when used only as proof: `clean` and `validate` remove and regenerate ignored `dist/` and `.test-build/`; release proof rewrites files under `release/`; install proofs create isolated temporary repositories, stores, sessions, caches, and a loopback Git server. Inspect relevant pre-existing generated state before selecting a gate, and do not run these commands during read-only work.

Choose proof proportional to the change, then run every repository gate required by its scope:

- `npm run typecheck` — strict TypeScript check.
- `npm run build` — compile the extension and declarations to `dist/`.
- `npm test` — serial unit and integration baseline.
- `npm run validate` — clean, typecheck, build, tests, install proof, and release validation.
- `scripts/validate-premerge.sh` — required premerge gate, including Pi checks and `git diff --check`.
- `npm run release` — required when validating a distributable payload.

Always review the final diff and report passed, failed, deferred, and skipped checks separately. A required skipped or failing check is not a pass.

## Security And Delivery

- Preserve fail-closed authority rules. Never expose credentials, tokens, SQLite stores, personal Pi settings, or provider payloads.
- Use `PI_CONTINUITY_HOME` and `PI_WORK_MEMORY_HOME` for isolated tests.
- Commit only when explicitly requested, using a focused Conventional Commit subject. Push, release, publish, or deploy only with explicit target-specific authorization.
- Pull-request handoff should summarize behavior, list passed/failed/deferred checks, and identify relevant README or proof updates.
