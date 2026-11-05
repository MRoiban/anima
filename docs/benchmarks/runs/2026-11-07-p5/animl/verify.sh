#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
p=docs/benchmarks/runs/2026-11-07-p5/animl
anima() { node packages/cli/src/main.ts "$@"; }
anima validate "$p/toolbar.animl"
anima inspect "$p/toolbar.animl" > "$p/inspect.txt"
anima build "$p/toolbar.animl" -o "$p/toolbar.ani"
anima validate "$p/toolbar.ani"
anima sample "$p/toolbar.ani" -s "$p/press.script" > "$p/press.jsonl"
anima sample "$p/toolbar.ani" -s "$p/badge.script" > "$p/badge.jsonl"
anima render "$p/toolbar.ani" -o "$p/rest.png" --size 864 --background '#ffffff'
anima render "$p/toolbar.ani" -o "$p/pop.png" --size 864 --background '#ffffff' --at 0.125 -e 'set trash 2; set unread 4; advance 0'
anima render "$p/toolbar.ani" -o "$p/cleared.png" --size 864 --background '#ffffff' -e 'pointer click 12 12; advance 0'
anima render "$p/toolbar.ani" -o "$p/pop-sheet.png" --size 432 --sheet 3 --over 0.25 --background '#ffffff' -e 'set trash 2; set unread 4; advance 0'
python "$p/assert-evidence.py"
