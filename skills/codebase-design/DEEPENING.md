# Deepening Modules Across Dependencies

Use this reference only after evidence identifies a shallow cluster worth
changing. Applicable repository architecture and supported test infrastructure
remain authoritative.

## Dependency Categories

### In-process

Pure computation or in-memory state. Consolidate behavior behind the chosen
interface and test it directly. No adapter is needed unless behavior genuinely
varies.

### Local substitutable

Filesystem, database, clock, or process behavior for which the repository
already supports an isolated local implementation. Use that implementation in
integration-style tests. Do not add a new dependency solely to satisfy this
pattern.

### Remote but owned

A separately deployed system owned by the same product. Define a narrow port at
the network seam only when at least production transport and a meaningful test
or alternate adapter are justified. Keep domain behavior behind the module;
keep transport details in the adapter.

### External

A third-party system outside repository control. Inject a narrow client/port at
the external seam. Tests may use a behaviorally faithful fake or mock only at
that seam; real-interface proof is still required when the product contract
depends on provider behavior.

## Seam Discipline

- Keep internal seams private to the implementation.
- Do not expose test-only controls through the production interface.
- Prefer one high-value external interface over many shallow wrappers.
- Preserve error, ordering, idempotency, concurrency, and performance contracts
  callers genuinely need to know.
- Two adapters justify variability; speculative adapters create indirection.

## Replace, Do Not Layer

When a deepened interface has behavior-appropriate tests, remove obsolete tests
of discarded shallow interfaces. Keep tests that protect distinct observable
contracts. A refactor is not complete while callers must understand both the old
and new module shapes unless an explicit expand/contract migration requires the
overlap.

Before implementation, classify work shape and recovery needs. For a wide or
durable migration, the bound execution plan owns sequencing and validation.
