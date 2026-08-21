---
name: improve-harness
description: "Improve one bounded agent-facing guidance, tool, runbook, or validation behavior from an observed baseline and verify it with a materially equivalent fresh Pi rerun. Use only through /skill:improve-harness when the user explicitly authorizes that experiment. Do not use for ordinary product work, speculative cleanup, one unexplained agent mistake, or automatic post-task reflection."
license: "MIT; adapted from repository-harness — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.85.0; managed-workflow aware; fresh-session rerun required for an improvement claim"
metadata:
  source: "https://github.com/hoangnb24/repository-harness"
  source-commit: "e765792b635b4d5e3e5fc0578f82f9ca5dea2681"
  adapted-for: "pi-continuity-work-memory"
disable-model-invocation: true
---

# Improve Harness

Improve one bounded future-agent behavior without turning every difficult task
into permanent process. Here **harness** means the repository-owned guidance,
skills, tools, runbooks, validation, and environment boundaries an agent uses;
it does not mean installing or depending on another product.

## Confirm Exact Authority

This skill is explicit-only. Invocation authorizes analysis of the named
experiment, but mutation requires the current request to identify the
agent-facing outcome and target owner. A blank or exploratory invocation remains
read-only and may produce only an experiment proposal.

Do not use this workflow for ordinary product changes, generic refactoring,
automatic post-task reflection, or one unexplained agent mistake. It never
implicitly authorizes product policy, weaker validation, credentials, external
systems, global installation, commit, push, release, or deployment.

## Require An Observed Baseline

Start from an observed baseline, not a preferred process theory. Record:

- representative task and accepted outcome;
- concrete friction or failure and its evidence;
- human steering, relay, retry, or recovery required;
- worker/model, repository revision, tools, authority, relevant external state,
  and stop conditions; and
- proof produced plus known limitations.

Confirm that the friction is reusable enough to justify a maintained
intervention. If no observed trajectory exists, or evidence cannot distinguish a
worker mistake from a systematic gap, stop with a falsifiable experiment
proposal and do not edit files.

## Use One Durable Repository Plan

An authorized baseline-to-intervention-to-rerun experiment normally spans
meaningful dependencies and recovery boundaries. Inspect
`continuity_workflow_status`, then call `continuity_prepare_work` before the
first mutation when managed mode is eligible. Supply the actual durability,
recovery, and external-side-effect signals.

Use exactly one bound execution plan as durable truth. Do not create a separate
harness template, task database, memory record, or parallel checklist. Keep
these task-local sections in that plan: Representative Job, Baseline, Earliest
Gap, Hypothesis, Intervention, Native Validation, Fresh Rerun, Decision, and
Result. Repository content wins over Continuity metadata.

## Locate The Earliest Gap And Owner

Trace the failure upstream to the first boundary that could have prevented or
exposed it:

- **Context:** knowledge was absent, stale, overloaded, or not retrieved.
- **Capability:** discovery, invocation, interpretation, repair, or real-system
  verification failed.
- **Domain owner:** no canonical type, API, state machine, or source owned the
  invariant.
- **Authority:** permission, approval, policy, or recovery was unclear.
- **Proof:** checks established a proxy rather than the accepted outcome.
- **Environment:** an external prerequisite was unavailable or unstable.

Assign the correction to the consumer repository, this package, an external
environment, or a human decision. Do not copy consumer-specific commands or
policy into generic package guidance. Prefer fixing the earliest correct owner
instead of adding more downstream instructions.

## State And Apply One Intervention

Before editing, record this hypothesis in the bound plan:

```text
If <smallest change> is added at <owner>, then a fresh agent will
<observable change> on <representative task>, because <mechanism>.
Evidence that would weaken this:
Maintenance owner and removal condition:
```

Make one smallest coherent intervention. Prefer an existing documentation owner,
clear route, actionable diagnostic, repository-native tool, domain API, or
claim-matched proof over a new framework. Keep unknown product policy unknown.
Run focused repository-native validation for the changed boundary, then every
required gate. Native validation proves the artifact behaves as checked; it
does not by itself prove the harness improved.

## Require A Fresh Pi Rerun

Use a fresh Pi agent or session with a materially equivalent representative
task, worker capability, authority, tools, starting revision/state, and relevant
external conditions. If the harness-provided `subagent` tool is appropriate,
use one independent delegated task; calls may be sequential, and no child may
orchestrate another child. Never launch nested Pi through a shell command.

Record separately whether the intervention was **available**, **retrieved or
invoked**, and **relevant**, then compare accepted outcome, proof, human
intervention, retries, authority behavior, recovery, and maintenance cost. A
rerun that never exercised the intervention cannot support an improvement
claim.

If a fresh Pi rerun is unavailable or not authorized, preserve a frozen rerun
brief in the bound plan, set `Decision: Pending fresh rerun`, and stop. Do not
substitute the authoring session, static review, a checkpoint, or prior memory
for independent evidence.

## Keep, Revise, Or Remove

Choose one plan decision:

- **Keep** when the rerun exercised the intervention and materially improved the
  bounded task enough to justify maintenance.
- **Revise** when the owner is correct but retrieval, interface, or mechanism
  remains ineffective.
- **Remove** when the intervention adds noise, duplicates a better owner, or
  fails to improve the representative task.
- **Pending fresh rerun** when equivalent rerun evidence is unavailable.

A revision or removal is a new mutation and requires fresh native validation.
Record the decision, evidence, owner, maintenance cost, and removal condition.

If `continuity_status` reports a pending or uncertain operation, inspect the
real target and do not retry it. `continuity_recover` restores context only;
resolution requires human-only reconciliation and fresh executable validation.
When the plan has a non-pending decision and result, use `continuity_validate`
for the repository's authoritative command, then call
`continuity_finalize_work` only when the plan is ready. The move is a new
mutation and requires fresh post-move validation.

## Report Honestly

Return the representative baseline, earliest gap and owner, hypothesis,
intervention, changed files, native validation, fresh-rerun comparison, final
decision, and remaining authority or risk. A safe checkpoint proves
repository/operation safety only; it never proves the intervention improved the
agent or completed the task. Do not commit, push, publish, release, deploy, or
change external state without explicit target-specific authority.
