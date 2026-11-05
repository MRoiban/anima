# Work log

## Now
Goal: P1 AniML (authoring markup) → PR from p1-animl; then M5, then Phase B (P3 playground first).
State: p1-animl 12b642d: contract + Sol compiler + decompiler/formatter merged; round-trip tests green (bell + 13 cases); 274 tests; core+web 14635 B gz.
Next: wave 2 running (Sol, worktrees from 12b642d): CLI (.animl everywhere, build incl. html, decompile, new→animl); web markup module (baseline 7032 B gz, target ≤6144); migrate conformance+README to .animl.
Next: wave 3 — rewrite docs/AUTHORING.md for markup (real diagnostics via CLI); wave 4 head-to-head (AniML vs .ani vs Rive RML), then PLAN/LOG, PR, merge, summary.
Don't: spawn non-Sol agents or >5 at once; relax browser strictness; touch .riv or Rive account commands.
Open for owner (only when publishing): npm scope/package names, licence. Name stays Anima, .ani/.animl.

## Log
- 2026-11-05 13:01 [claude]: the next nine entries were back-filled from git history; times are commit times, the 12:48–12:55 ones approximate (unverified)
- 2026-11-05 12:05 [claude]: M0 spec 0.1 + monorepo + CI → PR #1 merged (evidence: gh pr view 1, merge 1901923)
- 2026-11-05 12:18 [claude]: M1 registry/loader/diagnostics/schema/path parser → PR #2 merged (0defae8)
- 2026-11-05 12:25 [claude]: M2 player, 12 hand-computed conformance cases, bell parity 6.0e-5° → PR #3 merged (18f98ed)
- 2026-11-05 12:39 [claude]: M3 CLI + AUTHORING.md; added `interruptible` after Rive frame diff (f3/f7 Δ 11–14 → 2.8–3.5) → PR #4 merged (591d0ce)
- 2026-11-05 12:50 [claude]: M4 runtime works in Chromium (no requests but the page) but bundle 16371 B esbuild → 15222 B terser (evidence: node tools/size.ts)
- 2026-11-05 12:48 [claude]: dead end: property mangling −170 B and broke path parser table → reverted
- 2026-11-05 12:49 [claude]: ablation: semantic loader 5199 B, check.ts 838 B, pointer+hit 1271 B; no-validation build still ~12.4 KB → budget needs code shrink, not less strictness
- 2026-11-05 12:56 [sol]: size race (Sol) partial 15222 → 14950 B, plateau (t3/shrink-browser-bundle f92a45e)
- 2026-11-05 12:57 [sol]: browser tests 8/8 incl. trace replay vs anima sample → merged into m4-web (c1e45b5)
- 2026-11-05 13:00 [claude]: launched Phase A researchers r1–r4 (Sol, high); maybe-later status per user priorities
- 2026-11-05 13:10 [sol]: Phase A r4 done: 313 rows (host-api 129, platforms 65, tooling 119; 87 maybe-later, 3 wont-do), all sourced (evidence: /data/t3/scratch/anima-parity/r4.json)
- 2026-11-05 13:11 [sol]: Phase A r3 done: 281 rows (text 65, layout 59, rigging 25, scripting 97, gpu 35), validated (evidence: /data/t3/scratch/anima-parity/r3.json)
- 2026-11-05 13:11 [sol]: Phase A r1 done: 336 rows (drawing-paint 125, transforms 17, animation 40, state-machine 61, input 93) (evidence: /data/t3/scratch/anima-parity/r1.json)
- 2026-11-05 13:13 [sol]: Phase A r2 done: 345 rows (data 169, events 22, components 31, assets 50, a11y 73); all four researchers done, 1275 rows
- 2026-11-05 13:18 [claude]: Phase A synthesized: 1238 rows after 37 merges, 111 done / 958 planned / 162 maybe-later / 3 wont-do; copy check 1 overlap → PR #5 (phase-a-parity, worktree ../anima-phase-a), waiting on CI
- 2026-11-05 13:30 [opus]: size race (Opus) 15222 → 14636 B, plateau, parity-checked over 6060 docs (t3/shrink-browser-bundle-1 59713c7) → merged into m4-web
- 2026-11-05 13:35 [claude]: owner chose budget 25 KB (after lighter validation re-measured at ~13.1 KB, not 11–11.5) → strict browser stays
- 2026-11-05 14:20 [claude]: Firefox stale-clapper fix (g wrappers carry transforms, attrs never removed, mask always attached) + Firefox lane + per-frame regression test (201 frames, worst 0.019) → 130 tests green
- 2026-11-05 14:20 [claude]: GPU Firefox (Linux WebRender, GTX 1650): old 1/4 runs stale episode, fixed 0/4; macOS symptom not reproduced → fix unverified on macOS (evidence: /data/agent-workspaces/anima-ff/*-run*.json)
- 2026-11-05 14:40 [claude]: merged PR #5 (Phase A) and #6 (M4 incl. Firefox fix) → main 62cee1b
- 2026-11-05 15:00 [claude]: P1 contract on p1-animl (23839c7, d9c0063): ANIML spec, bell.animl, registry markup names, xml parser (18 tests), names.ts (4 tests); launched Sol compiler (xhigh) + decompiler/formatter (high)
- 2026-11-05 15:10 [owner]: Firefox clapper fix confirmed on macOS; name stays Anima with .ani and .animl
- 2026-11-05 14:20 [claude]: merged Sol decompiler+formatter (0deca93) into p1-animl; parser now reports out-of-range entities → markup tests 49 pass/14 skipped (evidence: npx vitest run packages/markup)
- 2026-11-05 14:35 [claude]: merged Sol compiler (d575827); round-trip tests on bell + 13 cases pass; full suite 274 pass, size 14635 B gz (evidence: npx vitest run; node tools/size.ts). Spec §8 lists 3 decompile normalisations ($schema, element-less $comment, singleton action lists).
- 2026-11-05 14:45 [claude]: launched wave 2 (3 Sol agents: CLI, web markup module, migration) from 12b642d; measured markup module baseline 7032 B gz over core+web
- 2026-11-05 15:05 [claude]: merged Sol migration (596085a): 13/13 case.animl build byte-for-byte, tools/build-animl.ts --check, corpus test; bell.animl reformatted canonically → 303 tests, 1 Firefox timing test failed once under load (2 agents running), 3/3 reruns of packages/web green (flaky, cause unverified)
- 2026-11-05 15:20 [claude]: merged Sol CLI (2a597ae): .animl in validate/inspect/sample/render/fmt/new, build (.animl + page.html), decompile, schema both spellings, docs markup → cli+markup 221 tests pass; validate of bad .animl prints bad.animl:2:40 unknown-attribute + hint
- 2026-11-05 14:34 [sol]: initial size command failed (esbuild absent) → npm ci installed local tooling; npm ci --ignore-scripts --dry-run accepts workspace dependency addition without lock edit.
- 2026-11-05 14:34 [sol]: module+compiler hook 6996 B markup → VERBOSE folding 5776 B; queued inline loading fixes upgrade-before-registration; final measured 5777 B markup / 14781 B core+web (+146) (evidence: node tools/size.ts).
- 2026-11-05 14:34 [sol]: first browser run 25 pass/5 fail: 4 inline-upgrade errors fixed via microtask; existing Firefox frame-count assertion 3 vs ≤2 (unresolved); targeted new tests then 12 pass/18 filtered; 141 unchanged markup tests pass.
- 2026-11-05 14:38 [sol]: full verification 289 pass/3 fail → new parity test incorrectly expected reduce to jump an already-running timeline; corrected with deterministic full-duration ticks; reduced-motion trace identifies Playwright mouse.click's extra pointermove as third wake, now down/up with unchanged ≤2-frame assertion.
- 2026-11-05 14:39 [sol]: final requested verify chain passed → 16 files / 292 tests, no skips (36 browser tests across Chromium+Firefox; 141 unchanged markup tests); core+web 14781 B gzip (+146/150 allowance), markup 5777/6144 B incremental.
- 2026-11-05 14:39 [sol]: browser build emits anima-icon.js + anima-markup.js → build-web --check passes; intentional stale markup artifact rejected with exit 1, restored artifact passes; no new runtime dependencies beyond workspace markup, no CLI/core/spec/docs edits, no push/PR/merge.
