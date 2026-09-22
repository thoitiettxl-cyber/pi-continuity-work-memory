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

bun -e 'const version = process.versions.bun || ""; const [major, minor, patch] = version.split(".").map(Number); if (major !== 1 || minor < 4 || (minor === 4 && patch < 2)) process.exit(1)'
if [ -z "${PI_VALIDATION_PI:-}" ]; then
  PI_VALIDATION_PI=$(bun "$project_root/scripts/pi-version.mjs" --resolve)
fi
export PI_VALIDATION_PI
pi_version=$("$PI_VALIDATION_PI" --version)
bun "$project_root/scripts/pi-version.mjs" "$pi_version" >/dev/null

bun "$project_root/scripts/validate-install.mjs" --package "$project_root"
printf '{"status":"PASS","platform":"Alpine Linux 3.24 ARM64","bun":">=1.4.2","pi":"%s","piRange":">=0.87.0 <0.88.0"}\n' "$pi_version"
