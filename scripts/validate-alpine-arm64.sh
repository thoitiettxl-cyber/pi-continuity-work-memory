#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ ! -f /etc/alpine-release ]; then
  echo '{"status":"DEFERRED","reason":"not running on Alpine Linux"}'
  exit 2
fi

case "$(cat /etc/alpine-release)" in
  3.24*) ;;
  *) echo '{"status":"DEFERRED","reason":"Alpine version is not 3.24"}'; exit 2 ;;
esac

case "$(uname -m)" in
  aarch64|arm64) ;;
  *) echo '{"status":"DEFERRED","reason":"architecture is not ARM64"}'; exit 2 ;;
esac

node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major<22 || (major===22 && minor<19)) process.exit(1)'
if [ -z "${PI_VALIDATION_PI:-}" ]; then
  PI_VALIDATION_PI=$(node "$project_root/scripts/pi-version.mjs" --resolve)
fi
export PI_VALIDATION_PI
pi_version=$("$PI_VALIDATION_PI" --version)
node "$project_root/scripts/pi-version.mjs" "$pi_version" >/dev/null

node "$project_root/scripts/validate-install.mjs" --package "$project_root"
printf '{"status":"PASS","platform":"Alpine Linux 3.24 ARM64","node":">=22.19.0","pi":"%s","piRange":">=0.84.1 <0.86.0"}\n' "$pi_version"
