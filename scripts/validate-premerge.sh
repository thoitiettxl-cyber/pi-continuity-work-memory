#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"

bun -e 'const version = process.versions.bun || ""; const [major, minor, patch] = version.split(".").map(Number); if (major !== 1 || minor < 4 || (minor === 4 && patch < 2)) { console.error("Bun >=1.4.2 required"); process.exit(1); }'
if [ -z "${PI_VALIDATION_PI:-}" ]; then
  PI_VALIDATION_PI=$(bun scripts/pi-version.mjs --resolve)
fi
export PI_VALIDATION_PI
pi_version=$("$PI_VALIDATION_PI" --version)
bun scripts/pi-version.mjs "$pi_version" >/dev/null
bun run validate
git diff --check -- .
