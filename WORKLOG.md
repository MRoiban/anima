# Work log

## Now
Goal: finish M4 (bell in browser, core+web ≤ 12 KB gz), then AniML + Phase A parity inventory, then M5, then Phase B.
State: M0–M3 merged to main (PRs #1–#4). Branch m4-web: <anima-icon> runtime + demo + 8 browser tests green; bundle 15222 B gz (budget 12288).
Next: pick the size-race winner (Opus racer pending; Sol racer t3/shrink-browser-bundle reached 14950 B), merge, open M4 PR.
Next: Phase A research running (r1–r4 → /data/t3/scratch/anima-parity/); then write docs/parity/ on a branch from main.
Next: AniML from main after M4 merges; draft spec/ANIML.md + examples/bell.animl exist uncommitted in the main checkout.
Don't: relax the 12 KB budget or strictness without the user; mangle property names (breaks string-keyed tables, −170 B only).
Don't: spawn non-Sol sub-agents (user rule), > 5 at once; touch .riv files or Rive account commands (publish/push/pull).

## Log
- 2026-11-05 11:05 [claude]: M0 spec 0.1 + monorepo + CI → PR #1 merged (evidence: gh pr view 1, merge 1901923)
- 2026-11-05 11:40 [claude]: M1 registry/loader/diagnostics/schema/path parser → PR #2 merged (0defae8)
- 2026-11-05 12:10 [claude]: M2 player, 12 hand-computed conformance cases, bell parity 6.0e-5° → PR #3 merged (18f98ed)
- 2026-11-05 12:45 [claude]: M3 CLI + AUTHORING.md; added `interruptible` after Rive frame diff (f3/f7 Δ 11–14 → 2.8–3.5) → PR #4 merged (591d0ce)
- 2026-11-05 13:30 [claude]: M4 runtime works in Chromium (no requests but the page) but bundle 16371 B esbuild → 15222 B terser (evidence: node tools/size.ts)
- 2026-11-05 13:40 [claude]: dead end: property mangling −170 B and broke path parser table → reverted
- 2026-11-05 14:00 [claude]: ablation: semantic loader 5199 B, check.ts 838 B, pointer+hit 1271 B; no-validation build still ~12.4 KB → budget needs code shrink, not less strictness
- 2026-11-05 14:50 [sol]: size race (Sol) partial 15222 → 14950 B, plateau (t3/shrink-browser-bundle f92a45e)
- 2026-11-05 14:55 [sol]: browser tests 8/8 incl. trace replay vs anima sample → merged into m4-web (c1e45b5)
- 2026-11-05 15:10 [claude]: launched Phase A researchers r1–r4 (Sol, high); maybe-later status per user priorities
