#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
DIR="$ROOT/docs/benchmarks/runs/2026-11-10-p8/animl"
cd "$ROOT"
node packages/cli/src/main.ts sample "$DIR/reaching-arm.animl" --script "$DIR/proof.script" > "$DIR/proof.jsonl"
node packages/cli/src/main.ts sample "$DIR/reaching-arm.animl" --script "$DIR/release-60.script" > "$DIR/release-60.jsonl"
python3 "$DIR/analyze-proof.py" | tee "$DIR/metrics.txt"
