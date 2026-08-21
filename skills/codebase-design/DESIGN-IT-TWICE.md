# Design It Twice

Use this workflow when an interface decision is architecture-defining or the
user explicitly requests alternatives. It is read-only until a design is chosen
and implementation is authorized.

## 1. Frame The Decision

State:

- observable behavior the module must provide;
- constraints and invariants every design must preserve;
- candidate seam and dependency category;
- existing callers and repository conventions; and
- acceptance evidence.

Use a small illustrative type sketch only when it clarifies constraints. Do not
present the sketch as a selected design.

## 2. Produce Independent Designs

Produce at least three materially different interfaces. If an optional
`subagent` tool is available, delegate one complete design per call. Calls are
independent and may execute sequentially; never claim concurrency or ask one
child to orchestrate others. If delegation is unavailable, develop the designs
one at a time and label the reduced context isolation.

Useful design constraints:

1. minimize the interface to one to three entry points;
2. optimize the common caller and safe defaults;
3. maximize controlled extensibility without speculative hooks; and
4. when justified, place a port at a real remote/external seam.

Each design must include:

- operations, parameters, results, invariants, ordering, and errors;
- one caller example;
- behavior hidden behind the seam;
- dependency/adapters strategy; and
- where leverage is high and where the interface remains costly.

## 3. Compare And Recommend

Present each design clearly, then compare:

- depth and interface learning cost;
- locality of future change and diagnosis;
- seam placement and adapter evidence;
- compatibility and migration cost;
- testability through observable behavior; and
- reversibility and failure recovery.

Recommend one design or an explicit hybrid. Surface genuine decisions to the
user with a default and recovery path. Do not implement until authority is
resolved and managed work preparation has occurred when required.
