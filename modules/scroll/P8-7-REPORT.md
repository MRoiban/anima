# P8-7 report

## Checkpoints

- 2026-11-10 00:13: created branch `p8-7`, ran `npm ci`, dry-ran and applied `new-capability` for `rigging.scroll` → scaffold generated, parity left planned.

## Final

Pending implementation and verification.
- 2026-11-10 00:20: implemented the base `scroll` rig constraint with x/y/both axes, clamped grid-unit offsets, per-player state, bound/animated override detection, local-axis translation and derived 0..1 percent outputs; set the runtime entry to heavy 1,024 B over rig.
- 2026-11-10 00:27: added `scrollThumb`: linked content/track targets, x/y axis following, percent-based track travel, and optional thumb resizing to `track × viewport/content` with the authored length as the minimum.
- 2026-11-10 00:35: installed scroll-owned wrappers around the input controller without editing `modules/input/**`: viewport drags and wheel/trackpad deltas queue per-player offsets, phase-1 `prepareInputs` applies them, wheel returns handled only when the clamped offset changes, and thumb dragging maps track travel back to scroll percent.
- 2026-11-10 00:44: interaction checkpoint passes `scroll rig input --no-browser` (16 files passed, 1 skipped; 3,688 tests passed, 584 skipped, 1 TODO). Added the only rig seam so queued per-player state can invalidate the rig value signature: `RigContext.invalidate()` in `modules/rig/core/api.ts` and its implementation in `modules/rig/core/solve.ts`. No `modules/input/**` changes.
- 2026-11-10 00:50: added `scroll-viewport` for missing/unmeasurable viewport bounds and regression coverage for the inherited `rig-target` diagnostic on an unknown `scrollThumb.scroll`; both assert code, pointer, message and hint. The same checkpoint verifies `<scroll>` and `<scroll-thumb>` AniML registry spellings.
