# Test Doubles At Real Seams

Use a test double only where behavior genuinely varies across a system seam:

- third-party APIs;
- owned remote systems;
- time and randomness;
- process, filesystem, or network effects; and
- databases when an isolated real/local implementation is unavailable or the
  test scope does not require it.

Prefer a repository-supported test database, temporary filesystem, fake clock,
or in-memory adapter over a broad mock framework. Do not add a dependency only
to create mocks.

A good boundary interface is narrow and operation-specific:

```typescript
interface PaymentPort {
	charge(request: ChargeRequest): Promise<ChargeResult>;
}
```

A generic fetcher pushes protocol branching into every test and weakens the
seam. Inject boundary dependencies rather than constructing hidden clients
inside core behavior.

Do not mock:

- private methods;
- internal classes or modules solely to observe call counts;
- values the test can create directly; or
- behavior owned entirely by the module under test.

A fake must preserve the contract relevant to the test, including material
errors, ordering, idempotency, and concurrency. Passing against a fake does not
prove a live provider contract; run authorized real-interface validation when
that distinction matters.
