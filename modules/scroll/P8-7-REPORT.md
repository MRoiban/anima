# P8-7 report

## Checkpoints

- 2026-11-10 00:13: created branch `p8-7`, ran `npm ci`, dry-ran and applied `new-capability` for `rigging.scroll` → scaffold generated, parity left planned.

## Final

- 2026-11-10 00:20: implemented the base `scroll` rig constraint with x/y/both axes, clamped grid-unit offsets, per-player state, bound/animated override detection, local-axis translation and derived 0..1 percent outputs; set the runtime entry to heavy 1,024 B over rig.
- 2026-11-10 00:27: added `scrollThumb`: linked content/track targets, x/y axis following, percent-based track travel, and optional thumb resizing to `track × viewport/content` with the authored length as the minimum.
- 2026-11-10 00:35: installed scroll-owned wrappers around the input controller without editing `modules/input/**`: viewport drags and wheel/trackpad deltas queue per-player offsets, phase-1 `prepareInputs` applies them, wheel returns handled only when the clamped offset changes, and thumb dragging maps track travel back to scroll percent.
- 2026-11-10 00:44: interaction checkpoint passes `scroll rig input --no-browser` (16 files passed, 1 skipped; 3,688 tests passed, 584 skipped, 1 TODO). Added the only rig seam so queued per-player state can invalidate the rig value signature: `RigContext.invalidate()` in `modules/rig/core/api.ts` and its implementation in `modules/rig/core/solve.ts`. No `modules/input/**` changes.
- 2026-11-10 00:50: added `scroll-viewport` for missing/unmeasurable viewport bounds and regression coverage for the inherited `rig-target` diagnostic on an unknown `scrollThumb.scroll`; both assert code, pointer, message and hint. The same checkpoint verifies `<scroll>` and `<scroll-thumb>` AniML registry spellings.
- 2026-11-10 01:02: replaced the rigging-scroll TODO with deterministic drag, wheel, clamping, bind override, percent, resized thumb and thumb-drag evidence; all seven snapshots settle immediately. Updated the corpus count to 654 from the exact case.ani count.
- 2026-11-10 01:10: added renderer-independent browser interaction coverage. Chromium passes wheel prevention at movement/end-range and queued drag. Firefox first hit the 30 s setup timeout under shared load before tests; rerun with a 120 s setup hook passed the same 1,442 tests with 660 skips.
- 2026-11-10 01:08: authored the independent rect-only native scroll oracle and drove the bound native offset with 0/-120/-240 px host data, matching Anima 0/10/20 grid units at 12 px/unit without input. Raw comparisons at frames 0/0.5/1 are max 1 with 0/57,600 pixels over 16 in every frame; edge 0, interior 0. No oracle budget set.
- 2026-11-10 02:07: final Firefox scroll scope passed: 7 files, 3,412 passed, 660 skipped. The required Chromium scope completed 24/26 files with 4,886 passed, 66 skipped, 22 TODO and two unrelated 5 s shared-load timeouts (`bell.animl` prefix robustness and `rigging-ik`); each failed test passed immediately when rerun alone (1/1 each).
- 2026-11-10 02:12: `node tools/size.ts` exited 0. `scroll` is -610 B incremental against its 1,024 B budget, `input` remains 6,786 B, `rig` is 3,067/3,072 B, and core+web remains 22,803/24,576 B. Against the merged P8 baseline recorded in `WORKLOG.md`, the six gates are: core+web 22,803 → 22,803; largest scene 59,373 → 59,373; app-UI 108,121 → 108,140; runtime sum 137,408 → 137,424; authoring 15,358 → 15,358; Rive-class heavy 168,769 → 171,027. The rig entry was 3,069 B before the compact invalidation seam and is 3,067 B after it; input stays 6,786 B.
- 2026-11-10 02:13: `npm run lint`, `npm run typecheck`, `npm run format:check`, `node tools/modules.ts --check`, `node tools/build-animl.ts --check`, `node tools/parity.ts --check`, `node tools/build-web.ts --check`, `node tools/oracle.ts --strict`, and `git diff --check` all passed. Strict oracle correctly leaves `rigging-scroll` pending because ticket agents must not choose oracle budgets.
- 2026-11-10 02:26: shared-brief `npm run test:scope -- changed` completed with 421 passed files, 12 skipped files, 7 failed files; 10,897 tests passed, 34 TODO, 12 failed. None of the failures are in P8-7-owned code: five are shared-load timeouts, four are existing `rigging-skin` canvas diagnostics, one is the existing `new-capability` validation-order assertion, plus its timeout and one CLI timeout. All failing files are unchanged from `origin/p8-rigging` (`git diff --quiet ...` exit 0).

### Native oracle raw evidence

Rect-only native capture, keyed/bound so no input is required:

| Frame | Native offset | Anima offset | Raw max | Pixels >16 | Edge >16 | Interior >16 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 px | 0 grid | 1 | 0 / 57,600 | 0 | 0 |
| 0.5 | -120 px | 10 grid | 1 | 0 / 57,600 | 0 | 0 |
| 1 | -240 px | 20 grid | 1 | 0 / 57,600 | 0 | 0 |

No budget or threshold input was changed. `tests/oracle/rigging-scroll/todo.json` remains pending for the orchestrator to choose the canonical anti-aliasing budget and add `rigging-scroll` to `tests/oracle/cases.json`.

### Seams outside ticket ownership

- `modules/rig/core/api.ts`: `// seam(P8-7)` adds a compact rig-context invalidation hook for queued per-player scroll state.
- `modules/rig/core/solve.ts`: implements that invalidation hook and uses equivalent compact matrix/change checks to keep `rig` within its 3,072 B budget.
- `packages/markup/test/decompile.test.ts`: `// seam(P8-7)` teaches structural recovery about registered `<scroll>` and `<scroll-thumb>` rig children.
- No `modules/input/**`, `modules/layout/**`, or `modules/skin/**` files were changed.

### Closure state

Implementation, conformance, browser behavior, examples, SPEC, diagnostics, native capture and verification are complete. `rigging.scroll` remains `planned` only because the shared brief reserves canonical oracle budget selection and `cases.json` promotion for the orchestrator; closing the parity row before that would violate its definition of done.
