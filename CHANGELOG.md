# Changelog

## Unreleased

### Added

- Added six package-owned, globally discoverable Pi engineering skills for intent clarification, codebase design, bug diagnosis, TDD, code review, and domain modeling, with managed-workflow authority, Alpine compatibility, upstream provenance, isolated install proof, and safe delivery constraints.
- Added four Pi-native repository-workflow skills for accepted invariant encoding, read-only brownfield onboarding, independent onboarding-proposal audit, and evidence-backed agent-harness improvement, with explicit invocation boundaries, dual-source MIT provenance, and ten-skill install/release proof.
- Added a package-owned managed repository workflow with checksum-verified guidance/templates, trust-and-`AGENTS.md` eligibility, structured work-shape preparation, document-free read-only/bounded work, intent-first exclusive execution-plan creation, recoverable binding/finalization, branch-correct recovery metadata, and explicit separation between repository completion and safe checkpoints.
- Added explicit work-document identities for work-item memory so unbound tasks no longer share an implicit repository-wide `default` work-item bucket.

### Fixed

- Classified `mcp` discovery/status/tool calls and `mcpScript` as read-only discovery so Continuity no longer treats ordinary MCP docs lookup as a managed-workflow mutation. MCP `auth-start` and `auth-complete` remain external mutations.
- Classified `web_search` and `x_search` as read-only discovery so Continuity no longer treats basic agent search as a managed-workflow mutation or retry-blocking external operation.
- Prevented automatic memory extraction from starting after an aborted assistant run.
- Ensured session replacement and shutdown cancel and await automatic and manual memory pipelines before closing SQLite stores, so canceled jobs become superseded instead of leaving stale leases.
- Strengthened `domain-modeling` with managed-workflow status and drift inspection, memory-as-leads boundaries, explicit clarification handoff, uncertain-operation recovery, receipt-aware plan finalization, and duplicate-heading regression coverage.
- Kept recoverable Continuity policy blocks fail-closed without terminating the Pi agent run, allowing the model to handle duplicate, uncertain, or unsafe-command errors without requiring a new user message.
