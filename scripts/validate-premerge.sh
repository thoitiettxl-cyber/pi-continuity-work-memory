#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"

node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major<22 || (major===22 && minor<19)) { console.error("Node >=22.19.0 required"); process.exit(1) }'
if [ -z "${PI_VALIDATION_PI:-}" ]; then
  PI_VALIDATION_PI=$(node scripts/pi-version.mjs --resolve)
fi
export PI_VALIDATION_PI
pi_version=$("$PI_VALIDATION_PI" --version)
node scripts/pi-version.mjs "$pi_version" >/dev/null
npm run validate
git diff --check -- .
