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
pi_version=$(pi --version)
[ "$pi_version" = "0.84.1" ]

node "$project_root/scripts/validate-install.mjs" --package "$project_root"
echo '{"status":"PASS","platform":"Alpine Linux 3.24 ARM64","node":">=22.19.0","pi":"0.84.1"}'
