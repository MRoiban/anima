#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../../.." && pwd)"
npm install --prefix "$HERE" --no-package-lock
mkdir -p "$HERE/node_modules/@anima-format"
for package in core markup web; do
  ln -sfn "$ROOT/packages/$package" "$HERE/node_modules/@anima-format/$package"
done
