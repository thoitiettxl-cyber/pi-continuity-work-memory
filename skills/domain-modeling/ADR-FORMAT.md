# Fallback Decision Record Format

Use the repository's own decision template when one exists. This fallback is
appropriate only after the repository has accepted ADR-style records and the
decision satisfies the hard-to-reverse, surprising, real-trade-off gate.

```markdown
# <Short decision title>

Status: Accepted
Date: YYYY-MM-DD

## Context

<The durable forces and decision that must be made.>

## Decision

<What was chosen and why.>

## Consequences

<Material benefits, costs, constraints, and follow-up obligations.>

## Recovery Or Supersession

<How the decision can be reversed or replaced safely.>
```

Add considered alternatives only when their rejection will matter to future
maintainers. Use repository numbering and placement; do not guess a sequence
from incomplete listings. Link the decision to authoritative product or
architecture context, not to ephemeral session state.
