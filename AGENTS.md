# Repository Guidelines

## Project Structure

- `src/` contains the TypeScript extension, organized by responsibility: `domain/` for integrity and state rules, `application/` for services and scheduling, `infrastructure/` for SQLite, Git, paths, and providers, and `interface/` for Pi session integration.
- `test/` contains Node test-runner unit and integration tests, with shared fixtures in `test/helpers.ts`.
- `scripts/` contains build, install, release, version, and platform/provider validation utilities. `proof/` records acceptance evidence; `docs/plans/` contains completed implementation plans.
- Generated output belongs in ignored `dist/`, `.test-build/`, or `release/` directories and should not be committed.

## Build, Test, and Development Commands

Use Node.js `>=22.19.0` and run `npm ci` for a reproducible install.

- `npm run typecheck` checks strict TypeScript without emitting files.
- `npm run build` emits the extension and declarations to `dist/`.
- `npm test` builds tests and runs them serially with `node --test`.
- `npm run validate` runs clean, typecheck, build, tests, install proof, and release validation.
- `scripts/validate-premerge.sh` adds the required Node/Pi checks and `git diff --check`.
- `npm run release` builds the distributable ZIP under `release/`.

## Coding Style & Naming

Use strict TypeScript, ES modules, tabs for indentation, semicolons, and double-quoted strings. Keep imports explicit and preserve the existing layered dependency direction. Use `kebab-case` filenames such as `memory-service.ts`, `PascalCase` for types/classes, and `camelCase` for functions and variables. No formatter or linter is configured; rely on `tsc` and `git diff --check`.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; name files `*.test.ts` and describe behavior in test names. Add focused coverage for state transitions, authority/integrity boundaries, migrations, concurrency, and non-interactive modes when affected. There is no configured coverage threshold; `npm test` is the baseline, while `npm run validate` is the full local gate.

## Commits & Pull Requests

Use Conventional Commit subjects, for example `feat(continuity): harden checkpoint authority` or `fix(memory): fence stale provider runs`. Keep commits focused. Pull requests should explain the behavioral change, list validation commands and any `DEFERRED` environment proofs, update relevant README/proof documentation, and avoid committing stores, credentials, or generated artifacts.

## Security & Configuration

Treat learning memory as untrusted context and preserve the project’s fail-closed authority rules. Use `PI_CONTINUITY_HOME` and `PI_WORK_MEMORY_HOME` for isolated tests. Never include provider credentials, tokens, SQLite stores, or personal Pi settings in changes or diagnostics.
