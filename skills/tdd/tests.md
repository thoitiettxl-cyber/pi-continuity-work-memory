# Behavior Tests

## Strong Tests

A strong test describes a capability through the same interface a caller uses:

```typescript
test("a valid cart can be checked out", async () => {
	const result = await checkout(validCart, approvedPayment);
	assert.equal(result.status, "confirmed");
});
```

It has:

- an observable behavior in the name;
- an independent expected result;
- setup containing only behaviorally relevant facts;
- assertions through the public interface; and
- a failure that points to the requested contract.

## Implementation-Coupled Tests

Avoid tests whose contract is an internal call:

```typescript
test("checkout calls payment.process", async () => {
	await checkout(cart, payment);
	assert.equal(payment.processCalls, 1);
});
```

This test may fail after a harmless refactor while checkout behavior remains
correct. A boundary fake may record externally meaningful requests, but do not
mock collaboration between implementation details merely because it is easy.

## Tautological Tests

Expected values must not repeat the implementation algorithm:

```typescript
// Weak: the expectation repeats the same sum.
const expected = items.reduce((total, item) => total + item.price, 0);
assert.equal(calculateTotal(items), expected);

// Strong: the expected value is an independently worked example.
assert.equal(calculateTotal([{ price: 10 }, { price: 5 }]), 15);
```

## Verification Through The Interface

Prefer retrieving created state through supported behavior rather than querying
private storage directly. Direct database assertions are appropriate only when
the database schema or migration is itself the public contract under test.
