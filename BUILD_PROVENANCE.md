# Build provenance

## Package

- Package: `pi-continuity-work-memory`
- Version: `1.0.0-rc.1`
- Snapshot classification: exact original editable baseline source available
- Reconstructed source files: none
- Known missing baseline files: none
- `PACKAGE_INVENTORY.json`: not present in the editable source workspace; it was generated only inside the binary-release staging directory and is therefore not included as baseline source.

## Environment recorded for the validated release build

The following values are retained in the release evidence and command output from the build session:

- Node.js: `v24.14.0`
- npm: `11.9.0`
- Pi: `0.84.1`
- TypeScript: `5.9.3`
- Operating system: `Ubuntu 24.04.3 LTS`
- Architecture: `x86_64`
- SQLite implementation: built-in `node:sqlite`

The source-snapshot export itself was performed later under Node.js `v24.19.0`, npm `11.9.0`, and `Linux 6.18.35 x86_64 GNU/Linux`. No baseline source file was modified during export.

## Commands known to have been executed

Dependency-install command used to initially populate `node_modules`: `Unknown`.

Known build, test, validation, installation-proof, and packaging commands:

```sh
npm run typecheck
npm run build
npm test
npm run validate
scripts/validate-premerge.sh
git diff --check -- .
node scripts/validate-install.mjs
node scripts/validate-provider.mjs
scripts/validate-alpine-arm64.sh
npm run release
node scripts/validate-install.mjs --package /tmp/pi-continuity-final-proof.QmqIH0/pi-continuity-work-memory
unzip -tq release/pi-continuity-work-memory-1.0.0-rc.1.zip
sha256sum release/pi-continuity-work-memory-1.0.0-rc.1.zip
```

The `/tmp/...` path above was an ephemeral independently extracted package used for the final installation proof. It contained no credentials or user stores.

## Real-provider proof

- Successful real-provider model/provider: `None`
- Result: `DEFERRED`
- Reason: no credential-configured Pi provider/model was supplied.
- Diagnostic provider checked: `openai-codex`
- Credential status: not configured
- Credentials included in this archive: none

## Git provenance

- Source workspace is inside a Git repository: yes
- Branch: `master`
- Commit ID: `Unknown` / unavailable because the repository has no commits (`HEAD` is unborn)
- Source files were present as intent-to-add working-tree files.

## File provenance interpretation

Every editable source, test, configuration, script, proof, README, license, and lockfile in this archive was copied byte-for-byte from the workspace used for the final `1.0.0-rc.1` build. None was reconstructed from `dist/` or conversation text.

`BUILD_PROVENANCE.md` and `ORIGINAL_SOURCE_STATUS.txt` were created as first-generation metadata specifically required for this source export. Their manifest provenance is `original`; they are not reconstructed source files.

`test/canonical.test.ts` contains deterministic, non-working strings shaped like API keys, cookies, tokens, and a private-key block. They are synthetic redaction-test fixtures, not credentials. A credential-pattern scan found no other matching values.
