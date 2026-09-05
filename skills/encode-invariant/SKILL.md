---
name: encode-invariant
description: "Convert an accepted repository architecture, reliability, security, or quality rule into the smallest repository-native mechanical guard, with allowed and forbidden proof and precise enforcement reporting. Use when asked to enforce a documented invariant, prevent an accepted violation from recurring, add a structural policy check, or turn an accepted rule into validation. Do not use to infer policy from code, tests, defaults, or convention."
license: "MIT; adapted from repository-harness — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.86.0; repository-native validation; Alpine-compatible tools"
metadata:
  source: "https://github.com/hoangnb24/repository-harness"
  source-commit: "e765792b635b4d5e3e5fc0578f82f9ca5dea2681"
  adapted-for: "pi-continuity-work-memory"
---

# Encode Invariant

Turn an accepted repository rule into a focused mechanical guard without making
the guard a new source of policy.

## Establish Authority

Read applicable instructions, architecture and decision owners, the current
worktree, and the repository's native validation entrypoints. Automatic skill loading does not authorize a repository mutation. Proceed only when the current
request asks for enforcement and an accepted repository source states the rule.

Code patterns, tests, defaults, and conventions do not establish normative
policy. An existing check without accepted authority is a mismatch to report,
not authority to expand. Before editing, restate:

| Field | Required content |
| --- | --- |
| Authority | Accepted source and exact rule |
| Scope | Files, modules, configuration, or runtime objects covered |
| Allowed | At least one conforming case |
| Forbidden | The precise structure or behavior to reject |
| Exceptions | Only exceptions accepted by the same authority |
| Diagnostic | Violating item, broken rule, authority pointer, and compliant next action |

If authority is missing, conflicting, or broad enough to permit materially
different boundaries, stop read-only and request the smallest decision. Do not
encode adjacent preferences merely because the same validator could inspect
them.

## Prepare The Authorized Change

Use `continuity_workflow_status` to inspect managed-workflow eligibility and any
bound execution plan. After authority is resolved and before the first
repository mutation, call `continuity_prepare_work` when managed mode is
eligible. Supply the real durability and recovery signals; bounded work remains
document-free, while durable work uses the one bound repository execution plan.
Never create a separate invariant checklist as durable task truth.

If `continuity_status` reports a pending or uncertain operation, inspect the
actual target and do not retry it. `continuity_recover` restores context only;
resolution requires human-only reconciliation followed by fresh validation.

## Design The Smallest Native Guard

Reuse the repository's existing test, build, task, lint, scan, policy, or
validation owner. Choose the lowest deterministic layer that sees the complete
accepted scope. Prefer an existing rule mechanism over a parallel framework,
new service, dependency, or generated source of truth.

The failure must be actionable. It should identify the violating item, explain
the accepted rule, cite its owning document, and state one compliant next
step. Keep the diagnostic stable enough for focused negative proof without
binding tests to unrelated presentation details.

Do not install hooks, select a CI provider, alter merge policy, or mutate branch
protection as an incidental part of implementing a local guard. Those are
separate externally consequential outcomes requiring exact authority.

## Prove Both Directions

Run proof through the repository-native owner:

- **Positive proof:** a known allowed case passes. This detects a guard that
  rejects valid behavior or scans the wrong scope.
- **Negative proof:** a targeted forbidden case fails for the intended rule and
  exposes the intended diagnostic or rule identifier.

Use a repository-owned fixture or a narrow recoverable test mutation for the
negative case. Never leave a deliberate violation in product files, and never
discard unrelated work while restoring the fixture. A green repository without
an exercised forbidden case does not prove recurrence detection.

Run focused proof first, then every repository-required gate. Use
`continuity_validate` for an allow-listed authoritative command when available,
and review the final diff and relevant untracked files.

## Report Enforcement Precisely

Report each level independently:

- **Local validation:** owning command, whether it ran, and its observed result.
- **Optional hook:** convenience entrypoint discovered or absent; never claim it
  is installed or required without evidence.
- **CI:** checked-in invocation discovered or absent, plus current run status
  only when observed.
- **Branch protection:** required-check or merge-blocking state verified
  externally, or unverified.

Source presence is not execution. A checked-in CI job is not proof that it ran;
a green run is not proof that branch protection requires it.

## Hand Back Safely

Report the accepted authority, encoded scope, validation owner, actionable
diagnostic, positive and negative results, four enforcement levels, and any
remaining exception or authority gap. A safe checkpoint proves
repository/operation safety only; a checkpoint never establishes policy or task
completion. Do not commit, push, publish, deploy, or change external enforcement
unless the user explicitly requested that exact action and target.
