#!/bin/bash
out=docs/benchmarks/runs/2026-11-08-p6/search-animl-rerun
printf '\n[%s] anima' "$(date -u +%FT%TZ)" >> "$out/commands.log"
printf ' %q' "$@" >> "$out/commands.log"
printf '\n' >> "$out/commands.log"
node packages/cli/src/main.ts "$@" 2>&1 | tee -a "$out/commands.log"
result=${PIPESTATUS[0]}
printf 'exit=%s\n' "$result" >> "$out/commands.log"
exit "$result"
