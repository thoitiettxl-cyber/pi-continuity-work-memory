# Changelog

## Unreleased

### Added

- Added `/continuity plans [query]`, a trusted TUI-only browser for existing execution plans that fuzzy-searches active/completed Markdown, shows read-only detail, and appends Work/Refine editor drafts without submitting, binding, or changing plan status.

- Added an eleventh prompt-only global engineering skill, `contract-first`, for one authoritative consumer/provider boundary artifact with compatibility, untrusted-input, runtime-serialization, and managed-authority safeguards; strengthened `tdd` with reproducible regression-first proof and parity checks across materially distinct execution paths.

- Added first-class GitHub installation through `pi install git:github.com/thoitiettxl-cyber/pi-continuity-work-memory`, with a pinned install-time TypeScript emitter, clean omit-dev Git-clone proof, and isolated Pi load verification while keeping generated `dist/` out of Git.
- Added a TUI-only cooperative context-pressure governor with deterministic headroom thresholds, monotonic per-epoch severity, ephemeral authority-limited provider advisories, lifecycle resets, session-local `/continuity context-governor` controls, and an explicit `/compact` recommendation without aborting or invoking compaction.
- Evolved in-process learning memory to typed atoms, incremental cursor extract, and query-conditioned recall: token-ranked `memory_search`, `before_agent_start` injection of baselines plus at most 12 prompt-matched records, first-run warmup then a three-turn automatic threshold, `/memory run` force extract, exact-content dedup, and a fail-closed memory schema v3 migration. No sidecar, embeddings, or raw conversation warehouse.
- Added six package-owned, globally discoverable Pi engineering skills for intent clarification, codebase design, bug diagnosis, TDD, code review, and domain modeling, with managed-workflow authority, Alpine compatibility, upstream provenance, isolated install proof, and safe delivery constraints.
- Added four Pi-native repository-workflow skills for accepted invariant encoding, read-only brownfield onboarding, independent onboarding-proposal audit, and evidence-backed agent-harness improvement, with explicit invocation boundaries, dual-source MIT provenance, and ten-skill install/release proof.
- Added a package-owned managed repository workflow with checksum-verified guidance/templates, trust-and-`AGENTS.md` eligibility, structured work-shape preparation, document-free read-only/bounded work, intent-first exclusive execution-plan creation, recoverable binding/finalization, branch-correct recovery metadata, and explicit separation between repository completion and safe checkpoints.
- Added explicit work-document identities for work-item memory so unbound tasks no longer share an implicit repository-wide `default` work-item bucket.

### Changed

- Advanced the package prerelease identity to `1.0.0-rc.6` for the eleven-skill payload, preserving the historical RC5 archive identity.

### Fixed

- Hardened query-conditioned memory after PR review: matched atoms retain a reserved prompt budget and closing delimiter, search scores the latest 500 candidates before usage tie-breaks, batch/concurrent exact-content duplicates are removed, and cursor advancement is atomic with publication.
- Classified ordinary tokenized shell, Git, and read-only GitHub CLI discovery without reopening mutating/output-writing/executable/credential forms; steering and follow-up input no longer erase managed-workflow eligibility for the active run.
- Classified `cat`, `ldd`, `pi --version`/`-v`, and `gh label list` as read-only discovery, and kept quoted `gh api --jq` filters with brackets read-only, without reopening unquoted operators or mutating GitHub label/Pi command forms.

- Classified `mcp` discovery/status/tool calls and `mcpScript` as read-only discovery so Continuity no longer treats ordinary MCP docs lookup as a managed-workflow mutation. MCP `auth-start` and `auth-complete` remain external mutations.
- Classified `web_search` and `x_search` as read-only discovery so Continuity no longer treats basic agent search as a managed-workflow mutation or retry-blocking external operation.
- Refined the explicit-only `grill-with-docs` intake with dependency-aware adaptive questioning, proportional Shared Understanding correction loops, and fail-closed handling of material uncertainty and out-of-scope process friction.
- Prevented automatic memory extraction from starting after an aborted assistant run.
- Ensured session replacement and shutdown cancel and await automatic and manual memory pipelines before closing SQLite stores, so canceled jobs become superseded instead of leaving stale leases.
- Strengthened `domain-modeling` with managed-workflow status and drift inspection, memory-as-leads boundaries, explicit clarification handoff, uncertain-operation recovery, receipt-aware plan finalization, and duplicate-heading regression coverage.
- Kept recoverable Continuity policy blocks fail-closed without terminating the Pi agent run, allowing the model to handle duplicate, uncertain, or unsafe-command errors without requiring a new user message.
