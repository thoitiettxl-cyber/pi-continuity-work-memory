# Source P0 hardening from 1.0.0-rc.1 to 1.0.0-rc.2

## Outcome

Recover a reproducible editable baseline from the supplied original source,
reconstruct only the documented final release repairs, then implement and prove:

1. provider-source privacy/cost sanitization;
2. pipeline lease/crash recovery with idempotent retry; and
3. Pi runtime support for `>=0.84.1 <0.85.0`.

## Authority

- User explicitly authorized continuing source edits.
- The immutable source ZIP and `SOURCE_MANIFEST.json` own original provenance.
- The canonical extracted release artifact and final `proof/RESULTS.json` own
  the three release-only repair behaviors.
- `package.json` owns the Pi peer range.
- README privacy/crash guarantees plus the explicit P0 request own the new
  sanitization and recovery boundaries.

## Recovery

The immutable source ZIP is the recovery baseline. Product edits occur only in
`/root/code/pi-continuity-work-memory-source-1.0.0-rc.1`; the canonical release
artifact is not modified. No commit or push is authorized.

## Progress

- [x] Verify and extract source snapshot; reproduce original 32-test validation.
- [x] Reconstruct release-only OpenAI compatibility, bash evidence, and provider proof.
- [x] Add structural provider-source sanitization and positive/negative proof.
- [x] Add heartbeat, reclaim, orphan cleanup, fencing, retry, and crash proof.
- [x] Align Pi validation to `>=0.84.1 <0.85.0`; prove 0.84.1 and 0.84.2.
- [x] Complete native validation, packaging, evidence updates, two independent
      read-only reviews, finding remediation, and final diff inspection.

## Decisions

- Provider source keeps bounded ordinary text, tool metadata, project paths, and
  included bash evidence; it omits raw images, opaque signatures, hidden
  thinking, excluded bash content, secrets, personal session paths, and long
  opaque payloads.
- Source budget is 120,000 characters, retaining newest contiguous evidence.
- Pipeline lease is 120 seconds with a 30-second heartbeat and unique owner per
  attempt.
- Expired owners cannot heartbeat, stage, or publish; startup/reclaim cleanup
  removes non-active pending/building artifacts.
- Pi 0.84.1 remains the lower-bound dev dependency; supported runtime range is
  the peer contract `>=0.84.1 <0.85.0`.
- With explicit owner authorization, the hardened release identity is
  `1.0.0-rc.2`; canonical `1.0.0-rc.1` remains immutable.

## Validation evidence so far

- Full unit/integration suite: 51/51 PASS.
- Isolated install: PASS on Pi 0.84.1 and Pi 0.84.2.
- Alpine 3.24 ARM64 install proof: PASS on Pi 0.84.2.
- Authorized modified-source real-provider proof: PASS on Pi 0.84.2 with
  `cliproxy/gpt-5.6-sol`; Stage 1 published 1 record, Stage 2 published 1
  baseline, usage/citation accounting and secret hygiene passed.
- Version positive/negative proof: PASS; Pi 0.85.0 is rejected with the expected
  peer-range diagnostic.
- Exact staged install, package inventory, ZIP safety, `unzip -t`, and SHA-256:
  PASS for final `1.0.0-rc.2`. The ZIP has 74 files, 73 declared inventory
  entries plus the inventory itself, no missing/extra/hash/path errors, and
  SHA-256
  `30054e26b13de5bb922a57d90d9f03f5ed615d96c3637aad7ec71f36b136ff9b`.
- Both independent reviews' blocking privacy/retry findings were reproduced,
  fixed, and covered by regression tests; the second review's follow-up findings
  were also remediated before the final gates.
- The first authorized provider-proof attempt exposed configured extension
  discovery colliding with the explicitly loaded candidate. The proof now
  disables discovered extensions/skills/templates/context while retaining the
  explicit candidate, reports bounded redacted diagnostics, closes SQLite, and
  removes temporary proof state on all terminal paths. Regression proof, a
  simulated `DEFERRED` cleanup check, and the isolated real-provider rerun passed.

## Completion

All mandatory source, native, real-provider, supported-Pi, Alpine ARM64,
premerge/diff, and package gates passed for `1.0.0-rc.2`. No commit, push,
publication, or deployment was performed.

## Remaining risks

- CI and branch-protection enforcement are not present in this source snapshot
  and remain unverified.
