# RECONSTRUCTED release-alignment and P0 source work

This workspace was created from the supplied source snapshot:

- Archive: `pi-continuity-work-memory-1.0.0-rc.1-source.zip`
- SHA-256: `4a0f565a83c11d0d83622e97447b05f995d80b581c4d828ac4ac811509bd2ab8`
- Original manifest: 43 entries, all marked `original`
- Original status: `EXACT ORIGINAL SOURCE AVAILABLE`

`SOURCE_MANIFEST.json`, `ORIGINAL_SOURCE_STATUS.txt`, and `BUILD_PROVENANCE.md`
remain historical records of that immutable input archive. They are not rewritten
to pretend that later work was present in the original snapshot.

## RECONSTRUCTED baseline alignment

The supplied source predated three repairs recorded in the canonical completed
`1.0.0-rc.1` release artifact. The following changes were reconstructed from
that artifact and its executable proof before new P0 work began:

1. `src/infrastructure/pi-memory-provider.ts`
   - RECONSTRUCTED the memory-only OpenAI Responses compatibility override that
     suppresses `supportsExplicitPromptCacheMode` on a request-model copy.
2. `src/interface/session-adapter.ts`
   - RECONSTRUCTED included/excluded `bashExecution` serialization.
3. `scripts/validate-provider.mjs`
   - RECONSTRUCTED the real `npm test` provider-proof seed and failure details.

The reconstructed runtime JavaScript for the first two repairs matched the
canonical artifact before P0 changes. Source maps were regenerated from the
reconstructed TypeScript and therefore intentionally corrected stale canonical
maps rather than copied.

## New P0 work

Subsequent edits are new implementation work, not historical source recovery:

- provider-bound structural sanitization and bounded session evidence;
- pipeline heartbeat, expired-lease recovery, orphan cleanup, owner fencing,
  and idempotent retry;
- Pi runtime support and proof for `>=0.84.1 <0.85.0` with actual-version
  reporting;
- regression tests and updated release/acceptance evidence.

No claim is made that these P0 changes existed in the supplied source archive or
the canonical `1.0.0-rc.1` release artifact.

## Authorized release identity

The owner explicitly selected `1.0.0-rc.2` for the hardened source and release
artifact. The original `1.0.0-rc.1` source manifest and build-provenance files
remain unchanged historical records, and canonical `1.0.0-rc.1` remains
immutable. No claim is made that the new release identity or P0 changes were
present in the original source snapshot.
