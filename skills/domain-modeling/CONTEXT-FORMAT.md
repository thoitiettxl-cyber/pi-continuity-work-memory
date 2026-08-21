# Fallback Domain Glossary Format

Use this only when the repository has accepted a glossary/context document but
provides no format of its own.

```markdown
# <Domain Or Context Name>

<One or two sentences describing the domain represented here.>

## Language

**Order**
A confirmed request by a Customer for one or more Products.
_Avoid_: transaction, purchase

**Invoice**
A request for payment issued under the Billing policy.
_Avoid_: bill, payment
```

## Rules

- Define what a concept **is**, not its implementation workflow.
- Prefer one or two sentences.
- Choose one canonical term and list misleading synonyms under `_Avoid_` only
  when the distinction helps future readers.
- Include product-specific concepts, not general programming terms.
- Group terms only when a real domain cluster exists.
- Keep file paths, code snippets, task status, validation, and architecture
  decisions elsewhere.

For multiple bounded contexts, follow the repository map. If no map exists, do
not invent one without authority. A context relationship belongs in the map or
architecture owner; the same concept should not acquire conflicting definitions
in several glossaries.
