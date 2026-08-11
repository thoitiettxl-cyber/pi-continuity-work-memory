# Acceptance evidence map

This file maps each required behavior to executable evidence. A release may be called complete only when every mandatory row has an actual `PASS`; missing credentials or target hardware remain `DEFERRED`.

## Current run status

`Completed` — every mandatory row now has an actual `PASS`. The original rc.1 source build recorded typecheck, build, 32/32 behavioral/unit tests, concurrency, global-install, package, premerge, and diff gates on Ubuntu x86_64. The completion run verified the extracted artifact on Alpine Linux 3.24.1 ARM64 and exercised Stage 1 plus Stage 2 with the credential-configured `openai/gpt-5.6-sol` provider/model. See `RESULTS.json`.

The completion run exposed and repaired two release-only gaps before the final PASS: Pi 0.84.1 nested OpenAI Responses calls were sending an endpoint-rejected explicit prompt-cache option, and session memory serialization omitted included `bashExecution` command/output evidence. The provider proof now seeds a real passing `npm test` run instead of an unverified `printf` assertion.

| Area | Executable evidence | Required observation |
|---|---|---|
| Global, opt-in install | `node scripts/validate-install.mjs` | User-scope `pi install`; both independent Git workspaces load `/continuity` and `/memory` without `-e`/`-l`; repository keys differ; global memory crosses; stores survive `pi remove`. |
| Continuity across session/tree | `test/continuity.test.ts`, `test/extension-mode.test.ts` | Full-state exit/resume, crash resume after pending mutation, active-branch reconstruction, fork/copy context and fresh child authority chain, checkpoint ancestry, no A→B marker leak, and embedded state before/after manual and automatic compaction. |
| Safe boundary | `test/continuity.test.ts`, `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts` | Pending/uncertain mutations block; executable validation and stable pre/post fingerprint required; direct `!`/`!!` mutations are tracked; tracking failure fails closed; drift detected; corrupt/missing/cyclic chain quarantined; copied embedded checkpoint has no authority. |
| Non-mutating recovery | `test/continuity.test.ts` | Command-runner count is unchanged by recovery; source contains an explicit store-only recovery invariant. |
| Real-provider memory | `node scripts/validate-provider.mjs` | `PASS` with `openai/gpt-5.6-sol`: actual selected provider completed Stage 1 and Stage 2, published non-empty Stage 1 records and a Stage 2 baseline, accounted usage/citation, and passed the secret scan. Missing model/credential reports `DEFERRED`. |
| Scope and authority isolation | `test/memory.test.ts` | Repo A marker and citation usage hidden from B, global visible, work/session isolated, untrusted promotion blocked, memory reset preserves Continuity. |
| Project trust | `test/git-fingerprint.test.ts`, `test/extension-mode.test.ts`, `test/memory.test.ts` | Zero Git calls when untrusted; no repo/work-item injection or promotion; RPC/JSON/print load without UI access. |
| Scheduler lifecycle | `test/scheduler.test.ts`, `test/memory.test.ts` | `agent_end` creates no worker; one settled creates one timer; invalidation cancels timer/controller; stale source is superseded. |
| Concurrency/crash | `test/concurrency.test.ts`, `test/continuity.test.ts`, `test/memory.test.ts` | Two processes retain all records without uncaught `SQLITE_BUSY`; single lease owner; crash makes mutation uncertain; building baseline invisible. |
| UX/non-interactive | `test/extension-mode.test.ts`, `node scripts/validate-install.mjs` | Namespaces/tools registered; exact short TUI `degraded`/`unavailable` labels; RPC/JSON/print never touch TUI API. |
| Alpine ARM64 matrix | `scripts/validate-alpine-arm64.sh` | `PASS` on Alpine 3.24.1 aarch64 with Node v24.18.1 and Pi 0.84.1, including the global install proof. Wrong environment reports `DEFERRED`. |
| Release artifact | `node scripts/package-release.mjs` | Sanitized independent ZIP, exact inventory, `unzip -t`, SHA-256, no stores/credentials/settings/.git/node_modules/target/logs. |

## Authority invariants

- `verified` is written only by `ContinuityService.createCheckpoint` after evidence checks.
- Embedded session entries are hard-coded to `authority: "embedded"`.
- Memory code has no reference to checkpoint insertion or validation tables.
- Recovery has no command-runner or repository-write call.
- Read paths select only `published` records and the current `baseline_heads` generation.
- Untrusted identity gates execute before Git and repository-memory paths.

## Environment-specific result policy

- Unit/integration/install/release gates: `PASS` only on zero exit status and asserted observations.
- Real provider: `PASS` only when an actual configured provider publishes Stage 1 + Stage 2 with non-zero usage; otherwise `DEFERRED` or `FAIL`.
- Alpine ARM64: `PASS` only when the script is running on Alpine 3.24 ARM64; otherwise `DEFERRED`.
