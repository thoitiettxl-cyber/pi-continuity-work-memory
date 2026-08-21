---
name: diagnosing-bugs
description: "Diagnose difficult bugs, intermittent failures, and performance regressions with a red-capable feedback loop, minimization, falsifiable hypotheses, targeted instrumentation, and regression proof. Use when a failure is not already localized or the user explicitly asks to diagnose or debug it."
license: "MIT; adapted from mattpocock/skills — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; Alpine-compatible; uses repository-native tools and optional Eta Browser handoff"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  adapted-for: "pi-continuity-work-memory"
---

# Diagnosing Bugs

Diagnose from observable evidence. A plausible theory without a feedback loop is
not a finding.

## Safety And Authority

Read applicable repository instructions, architecture, domain terminology,
relevant decisions, and current worktree state. Redact secrets from every
command, output, trace, screenshot, and report; use `<REDACTED>` and environment
references rather than exposing credential values.

Clarification and inspection are read-only. `continuity_prepare_work` classifies
already-authorized work; it does not grant mutation authority. Create a test,
fixture, harness, log, or code change only when the user's current request
explicitly authorizes that outcome, then call `continuity_prepare_work` before
the first repository mutation when managed workflow eligibility is active.
Request separate exact authority before production instrumentation,
external-system mutation, credential use, service restart, or another
consequential operation.

Use repository-provided tools and scripts. Follow current shell restrictions,
issue one simple command per tool call when required, and never bypass a blocked
command through a wrapper or alternate quoting. Do not install dependencies as
incidental diagnosis.

## Select The Authorized Mode

- **Diagnose-only** is the default when the user asks to diagnose, debug,
  explain, reproduce, or find a root cause without also asking for a fix or
  repository changes. Use existing commands, tests, logs, and observable
  interfaces. Do not create or modify a test, fixture, harness, instrumentation,
  or production file. If a red-capable loop requires mutation, report the exact
  proposed artifact and stop for authority.
- **Fix-authorized** applies only when the current request explicitly asks to
  fix/change the behavior or add regression coverage. The authorized scope may
  then include the smallest regression test, implementation change, and local
  temporary instrumentation needed for that fix. Production or external
  instrumentation still requires separate target-specific authority.

State the selected mode before acting. Automatic skill loading never upgrades a
diagnose-only request into fix authority.

## Phase 1: Build A Red-Capable Loop

Construct the smallest unattended command or observable check that exercises
the actual failure and can distinguish broken from fixed. Prefer, in order:

1. an existing focused failing test at the highest useful seam, or a new test
   only in fix-authorized mode;
2. repository-owned integration or CLI fixture;
3. a bounded real-interface request;
4. Eta Browser observation or interaction when the rendered UI is the interface;
5. replay of a redacted captured artifact;
6. a narrow temporary harness only in fix-authorized mode;
7. seeded property/fuzz loop;
8. bisection or old/new differential loop.

For user-only login, CAPTCHA, OTP, payment, or sensitive consent, use the
available human-handoff mechanism. Do not ask the user to paste secrets into
chat and do not generate a secret-writing wizard.

A loop is ready when one already-run invocation is:

- **red-capable** for the user's exact symptom;
- deterministic, or has a measured high reproduction rate;
- fast enough for repeated use; and
- runnable by the agent without hidden manual steps.

If no loop can be built, stop and report what evidence is missing. Ask for the
smallest redacted artifact, environment access, or instrumentation authority
that would unblock it. Do not manufacture a root cause.

## Phase 2: Reproduce And Minimize

Run the loop and confirm it fails for the reported symptom, not a nearby error.
Shrink input, setup, callers, configuration, and timing one variable at a time.
Keep only load-bearing elements. Record the original and minimized signals.

## Phase 3: Rank Falsifiable Hypotheses

Generate three to five hypotheses. Each must predict an observation:

> If X is the cause, changing or measuring Y will make Z observable.

Rank by evidence, explanatory coverage, and probe cost. Show the list before
high-cost or consequential probes; proceed with the best safe probe when user
input is not required.

## Phase 4: Instrument One Prediction At A Time

Prefer debugger/REPL inspection, then targeted boundary logs. Give temporary
instrumentation a unique marker such as `[DEBUG-a4f2]`. For performance work,
measure a baseline and use profiler/query-plan evidence instead of broad logs.
Never collect more user or production data than the authorized diagnosis needs.

## Phase 5: Regression Proof And Fix (Fix-Authorized Only)

Enter this phase only when the current user request authorized a fix. In
diagnose-only mode, report the confirmed cause, evidence, impact, uncertainty,
and smallest recommended fix without changing files.

At a correct seam:

1. turn the minimized reproduction into a failing regression test;
2. observe it fail;
3. apply the smallest coherent fix;
4. observe the test pass; and
5. rerun the original Phase 1 loop.

If no correct seam exists, report that architecture finding rather than adding a
shallow test that cannot catch the real bug. The `codebase-design` skill may be
loaded for a follow-up seam decision; do not expand the bug fix into an
unauthorized refactor.

## Phase 6: Cleanup And Validate

Remove tagged instrumentation and temporary artifacts owned by this run. Run
focused proof and every repository-required gate. Use `continuity_validate` for
an allow-listed authoritative command when available. Review the final diff.

Report cause, evidence, fix, validation, limitations, and remaining risk
separately. A safe checkpoint proves repository/operation safety only. Do not
commit, push, publish, deploy, or update external systems unless the user
explicitly requested that exact action and target.
