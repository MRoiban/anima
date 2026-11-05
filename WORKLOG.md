# Work log

## Now
Goal: smaller, agent-native Rive (owner 2026-11-06). Order: P4a → P5 → Pc canvas → P4b–e → P3b → P6–P10. Benchmark gate after every phase.
State: p4a-paint: P4a-1 (modules, gradients, dashes) + P4a-2 (geometry) merged; P4a-3 compositing running (on old SVG hooks).
Next: merge P4a-3 → P4a-4 draw-layer refactor (MODULES §3.1, Sol xhigh) → P4a-5 benchmark (paint brief, AniML vs Rive) → PR.
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
- 2026-11-05 15:40 [claude]: merged Sol web markup module (a980e42): markup 5777/6144 B gz, core+web 14781 B (+146); npm run check green: 347 tests, Chromium+Firefox (evidence: npm run check after local dist rebuild)
- 2026-11-05 16:05 [claude]: merged Sol AUTHORING.md rewrite (8ee957f; 4/4 xml blocks compile, 6/6 diagnostics match, tested); markup hints for undeclared input/colour/glyph; markup 5804 B gz
- 2026-11-05 16:15 [claude]: launched head-to-head (3 Sol, high, worktrees from 052af3f): animl / ani / rive, 45 min timebox each
- 2026-11-05 16:45 [claude]: head-to-head merged + re-checked (AniML 7/7, .ani 7/7, Rive 4/7; switch a11y browser test added); parity row tooling.markup-authoring done (FINISHED phases P0,P1); PLAN/LOG updated
- 2026-11-05 17:05 [claude]: PR #7 merged (45d019a, CI green on 2592cae); branched m5-glyphs
- 2026-11-05 17:30 [claude]: Glyphy export -f animl/-f ani written myself (delegate cannot target another project): 11/11 glyphs byte-identical to anima new --glyphy, both forms; glyphy pytest 22 passed → DRAFT PR MRoiban/glyphy#2 (f7e483a), not to merge without owner. M5 agents running: format fix, trash, moon.
- 2026-11-05 17:50 [claude]: merged moon toggle (7d186df): 6/6, rest pixel-identical, reversal delta 0, 4 friction points (want: render --compare glyph, inputs in snapshots); sheet checked visually
- 2026-11-05 18:05 [claude]: merged trash (7d37682): 6/6, rest pixel-identical (original path at rest, split parts in motion), 7 friction points; spec §8 fmt keeps inline tracks (clarified)
- 2026-11-05 18:20 [claude]: merged format fix (3503c3b): activate may name a bool (keyboard toggles switch, Chromium+Firefox tests), anima schema a11y/transition/listener/input; core+web 14812 B (+31); npm run check 377 pass after demo rebuild; moon gets activate=dark
- 2026-11-05 18:50 [claude]: merged tooling (ff34197): inspect subpaths, render --compare (moon/trash 0 px), snapshot inputs; bbox rounding; PLAN M5/P2 ticked, P2 parity rows → P3, LOG M5
- 2026-11-05 19:40 [claude]: PR #8 merged; P3 design done myself (mockup checked at 1440/1000/390, valid/errors/scrub/dark; fixed highlighter, mask sizing, phone overflow); Player.inspect() + test (+150 B gz)
- 2026-11-05 20:30 [claude]: merged host API (d1313fe): 10/10 items, Chromium+Firefox tests, docs/WEB.md; core+web 15880 B (+918)
- 2026-11-05 21:30 [claude]: merged playground (9f6849a); compared with mockup at 1440/1000/390 + 1280x720 (found overlap, fixed in impl+mockup); parity 15 rows done, rest → P3b; npm run check 437 pass
- 2026-11-05 21:50 [claude]: PR #9 opened; playground first test hit Vitest 5 s default under full load → suite timeout 30 s; npm run check 437 pass
- 2026-11-05 22:10 [claude]: PR #9 merged (c1f1288); P4 plan: 456 rows → P4a–P4e on a module system; wrote spec/MODULES.md (design)
- 2026-11-05 23:30 [claude]: merged P4a-1 (ca2ee80): module system 5/5 hooks, paint gradients+dashes; core+web 16461 (+581), paint 2091/5120, markup 6104/6144 (near budget); found resvg ignores pathLength → PNG dashes/trims wrong (fix in P4a-2)
- 2026-11-05 23:45 [claude]: markup budget 6→8 KB (d3e19ef); launched P4a-2 geometry (shapes, corners, morph, fixed stroke, PNG pathLength fix) and P4a-3 compositing (blend, masks, clips, paints, stroke position, draw order) in parallel, separate files
- 2026-11-06 01:10 [claude]: merged P4a-2 geometry (e7f7dbd): 6/6; paint 3679/5120, core+web 16519; PNG dashes verified visually
- 2026-11-06 01:40 [claude]: owner direction recorded (PLAN, LOG, MODULES §3.1 draw layer, docs/benchmarks/agent-native.md; P1 run moved to docs/benchmarks/runs/2026-11-05-p1); P5 moved after P4a; canvas Pc after P5
- 2026-11-06 03:00 [claude]: merged P4a-3 compositing (46f2ed3) with geometry (10 conflicts resolved, artifacts regenerated): 693 tests pass; paint 7359/5120 over → split into paint + composite modules in P4a-4 with the draw layer; core+web 16697
- 2026-11-06 03:10 [claude]: launched P4a-4 (draw layer + paint/composite split; Sol xhigh; core+web target ≤16697 B) and the Rive side of the P4a benchmark (AniML side after P4a-4)
- 2026-11-06 03:30 [claude]: merged benchmark P4a Rive run (6688103): 5/6 (reduced motion host-only), 7m14s, 182 lines incl. generator; frames checked visually (mid-morph, clipped sweep); no .riv/scaffold docs committed
- 2026-11-06 05:00 [claude]: merged P4a-4 draw layer (3e2a00f): 706 tests, 0.1 SVG byte-identical, paint 3771/5120, composite 3874/4096; core+web 17175 (+478 over 16697 target) → size race
