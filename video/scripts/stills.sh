#!/usr/bin/env bash
# Render key-frame stills for visual review: scripts/stills.sh <CompositionId> <frame>...
set -euo pipefail
cd "$(dirname "$0")/.."
id="$1"; shift
mkdir -p out/stills
for f in "$@"; do
  npx remotion still src/index.ts "$id" "out/stills/$id-$f.png" --frame="$f" >/dev/null 2>&1 || echo "failed: $id @ $f"
done
