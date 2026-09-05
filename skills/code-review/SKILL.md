---
name: code-review
description: "Review a branch, pull request, or worktree diff from a fixed Git point along separate Standards and Intent/Behavior axes. Use for code review, PR review, review since a commit or branch, or final pre-commit assessment."
license: "MIT; adapted from mattpocock/skills — see ../UPSTREAM.md"
compatibility: "Pi >=0.84.1 <0.86.0; read-only Git and repository tools; optional serialized subagents"
metadata:
  source: "https://github.com/mattpocock/skills"
  source-commit: "5b15a47f2d7150f545fbcacbfe381787fc0230dc"
  adapted-for: "pi-continuity-work-memory"
---

# Code Review

Review is read-only. Do not edit files, post comments, resolve threads, stage,
commit, push, rerun CI, or create repository documents unless the user separately
requests that exact action.

## 1. Establish The Fixed Point

Use the fixed commit, tag, branch, or merge-base supplied by the user. If absent,
derive the repository's default/base branch only when unambiguous; otherwise ask
for the smallest missing choice. Verify the ref resolves and inspect:

- three-dot diff against `HEAD` for committed branch work;
- staged, unstaged, and relevant untracked changes when reviewing the worktree;
- commits in the review range; and
- applicable repository instructions.

An empty range is a result, not a review pass.

## 2. Establish Intent And Standards

Find intent from, in order:

1. the user's current request;
2. a bound execution plan or explicitly named issue/spec;
3. references in commits or branch context; and
4. observable existing contracts and tests.

If intent is incomplete, label the limitation instead of inventing requirements.
Read repository coding standards, architecture, security guidance, decisions,
and validation ownership. Repository rules override generic heuristics.

## 3. Review Two Independent Axes

### Standards

Check documented repository rules and high-signal design smells:

- mysterious names;
- duplicated behavior;
- feature envy or message chains;
- data clumps and primitive obsession;
- repeated conditionals on the same concept;
- shotgun surgery or divergent change;
- speculative generality; and
- pass-through middle modules.

Documented violations may be hard findings. Smells are judgment calls and need
concrete maintenance or correctness impact.

### Intent And Behavior

Check:

- missing or partial requested behavior;
- behavior added outside scope;
- incorrect edge, failure, recovery, compatibility, or migration behavior;
- security/privacy boundary changes;
- tests that cannot detect the claimed behavior; and
- documentation or release-contract drift caused by the change.

Do not infer that green tests prove requirements they do not exercise.

For context isolation, optional subagents may review the two axes independently.
Use one delegated task per call and accept that calls may run sequentially. Give
each child the fixed point, exact diff command, authority sources, and a bounded
brief. If delegation is unavailable, review the axes sequentially in the main
session and state that limitation.

## 4. Verify Findings

Every finding must include:

- severity: `critical`, `high`, `medium`, or `low`;
- file and line/hunk where possible;
- violated requirement, standard, invariant, or observable contract;
- evidence and user/system impact; and
- the smallest corrective direction.

Re-read the relevant code around each candidate. Do not report speculative
findings as facts. Do not expose secrets from diffs, logs, provider payloads, or
configuration.

## 5. Report Findings First

Order by severity, then present:

1. **Standards findings**;
2. **Intent/Behavior findings**;
3. open questions or evidence limitations; and
4. concise validation observations.

If no finding survives verification, say so and list residual risks or checks
not performed. A read-only review creates no lifecycle document and no safe
checkpoint. If the user later requests fixes, classify and prepare that
mutative work before editing.
