# P8-6 implementation report

Status: **partial, standalone implementation ready**. Branch `p8-6`, based on `59263eb7`.
No PR, publication, benchmark change, oracle budget change or binary reading/conversion.

## Checkpoints (UTC)

- 2026-11-09 11:35: standalone runtime and first diagnostic tests implemented; initial entry 1,118 B.
- 2026-11-09 11:49: three independent conformance probes pass; the combined handle probe remains pending for P8-1.
- 2026-11-09 11:51: original local Rive captures complete: 4 probes × 5 frames; every frame max channel delta 1, zero pixels over 16.
- 2026-11-09 11:57: scoped Chromium suite passes: 4,450 pass, 3 engine-filter skips, 27 TODOs. Entries fit: posepad 766/768 B; posepad-handle 471/512 B.
- 2026-11-09 12:05: default changed scope interrupted after repeated unrelated browser timeouts under two concurrent full-scope runs; restart with two workers, no timeout or assertion changes.
- 2026-11-09 12:22: explicit posepad Firefox verification passes 3/3; all entry and aggregate size gates pass; strict oracle exits 0.
- 2026-11-09 12:37: resumed from usage-limit interruption, completed changed scope (10,360 pass / 3 fail), cleared both browser failures in isolation, and fixed the scaffolder's real-row fixture collision (4/4 final pass). Typechecks, lint and changed-file formatting pass.

## Delivered

- Lowercase `type: "posepad"` / `<posepad>`, registry-derived kebab attributes, CLI/schema support.
- Whole-duration X/Y posing, independent inversion, clamping, per-player property/value overlays,
  active-registry sampling, topmost ordering and draw invalidation. No hooks without `requires: posepad`.
- Standalone post-layout stage and the callback that chains `rigPose` when rig is declared.
- Optional heavy `posepad-handle` entry: world-pivot coordinate projection, animatable pivots,
  output snapshots, output/cycle diagnostics; missing entry has an exact-pointer import diagnostic.
  `handle` declares the optional-entry requirement; it is not a second `requires` feature. This uses
  the existing module-owned extension pattern, like layout-reflow, and never silently ignores it.
- Draggable eyes example; three completed conformance scenes; 29 core tests and 3 browser tests per engine.
- Original native references and raw measurements; no oracle manifest/threshold edits.

## Rows

Closed: **none**. All four remain planned until the orchestrator promotes the captured references
into `tests/oracle/cases.json` with its chosen existing-method budgets:
`rigging.joystick`, `animation.joystick-two-axis`, `animation.joystick-invert`,
`animation.joystick-handle`. The last also awaits the distance-gated conformance case and rig integration.

On the P8-1 rebase instruction: add `rig` to the manifest's `after`, verify the callback against
its actual solver, replace the handle conformance marker with drag + keepDistance expectations,
run posepad + rig scopes, and remeasure both entries (base currently has only 2 B headroom).
The standalone pointer drag, transformed pivot mapping, output checks and transitive target
cycle validator are already tested. No rig solver or distance behavior is claimed yet.

## Seams outside ticket files

- `packages/markup/test/corpus.test.ts`: completed conformance count 619 → 622.
- `packages/markup/test/compile.test.ts`: exhaustive spelling census includes all posepad attributes.
  Both have `seam(P8-6)` comments. Runtime core/web/markup sources are unchanged.
- `tools/new-capability.test.ts`: scratch-only synthetic pending row replaces the real handle row,
  which now has probes. The original test failed its "creates a new marker" assertion; production
  scaffolder code and real inventory rows are unchanged. Marked `seam(P8-6)`.
- Other shared changes are the permitted generated wiring/schema, own parity rows and SPEC chapter.

## Verification

- `npm ci`: pass.
- `npm run test:scope -- posepad conformance oracle --browser=chromium`: initial run 4,439 pass,
  7 failures (five fixture/assertion fixes, one missing spelling census, one shared-load timeout),
  3 skips and 27 TODOs; corrected run **4,450 pass, 0 failures, 3 skips, 27 TODOs** / 8 files.
- Initial prefix-test timeout: 5,231 ms in the scoped run. Isolated whole compiler file:
  **51/51 pass**, file duration 2.83 s; no timeout change.
- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **10,360 pass, 3 fail, 39 TODOs**;
  400 files pass, 3 fail, 12 skip. The earlier default-worker run was interrupted under severe load.
  The three failed files were then isolated:
  - Asset pipeline: initial isolated run 21/24 pass, 3 Firefox 5 s timeouts; final Firefox-only
    run **12/12 pass** (12 Chromium tests filtered). Chromium's 12 had passed the initial isolation.
  - Component paint: **12/12 pass** in isolation after one Firefox 5 s timeout in the broad run.
  - Capability scaffolder: deterministic test-fixture collision with the now-existing handle probe,
    corrected with a scratch-only phase-neutral synthetic row; final isolation **4/4 pass**.
  No browser timeout/expectation or runtime code was changed. The complete broad suite was not rerun
  after this test-only fixture correction; individual reruns clear its observed failures.
- Posepad Firefox-only: **3/3 pass**, 3 Chromium tests filtered; both SVG and canvas pointer drags pass.
- Core and core-test typechecks: pass. Web-test typecheck: initial two test-only casts corrected; pass.
- `node tools/modules.ts --check`, `node tools/parity.ts --check`: pass.
- `node tools/build-animl.ts --check`: 682 sources checked, pending markers explicitly reported.
- `npm run lint`, changed-file Prettier check and `git diff --check`: pass.
- CLI `schema posepad`, `validate look.ani` and pointer-drag `sample`: pass; final values
  `look.valueX=1`, `look.valueY=-1`, `pupils.x=1.5`, `pupils.y=-1.5`.
- `python3 modules/posepad/capture-oracles.py`, then `node modules/posepad/measure-oracles.ts`:
  **20/20 frames measured**, max 1, over-16 count 0. See `RAW-METRICS.json`.
  All four oracle markers are intentionally retained for orchestrator budget selection.
- `node tools/perf.ts`: exit 0, shared load only: bell compile 24.86 ms; prefix sweep 5,648 ms;
  step+draw bell 306.6 µs, composite 128.2 µs, toolbar 206.1 µs; toolbar compile 26.23 ms.
  These are not perf evidence and do not establish the ≤3% guard; no benchmark records changed.

## Sizes

Independent entry measurements, frozen tree, production bundles: absent → **766 B** (`posepad`,
768 B budget); absent → **471 B** (`posepad-handle`, over posepad, 512 B budget).
`node tools/size.ts`: **exit 0**, every entry within its budget. All six gates (B min+gzip):

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core + web | 22,782 | 22,782 | 24,576 |
| largest scene | 57,781 | 57,781 | 65,536 |
| app-UI | 107,899 | 107,899 | 131,072 |
| runtime sum | 135,579 | 135,579 | 163,840 |
| authoring | 15,017 | 15,017 | 15,872 P8 cap / 16,384 owner |
| Rive-class | 155,805 | 156,939 | 256,000 |

`node tools/oracle.ts --strict`: **exit 0**, 324 existing completed cases / 540 requested samples;
existing findings remain reported separately. The 20 new raw frames remain pending, not parity passes.

## Decided deviations

- Orchestrator renamed the designed `posePad` / `<pose-pad>` to `posepad` / `<posepad>`;
  node element names equal their JSON type, avoiding shared markup growth or a new alias seam.
- Orchestrator approved splitting handles into an optional heavy entry, `over: posepad`, 512 B.
  Base stays at its original 768 B ceiling. Strict validation was preserved in production.
- Additional diagnostics `posepad-handle` and `posepad-box` define invalid handles/missing boxes.
  State-pose writes to handle outputs and writes affecting the pad frame are also rejected to
  keep the promised output-only and bounded-stage semantics coherent.

## Problems / handoff

P8-1 has not been rebased or integrated: awaiting the orchestrator's instruction, as requested.
Native frames need orchestrator-owned oracle promotion; the broad run had two isolated-cleared
browser timeouts and the corrected scaffolder fixture collision. No phase-completion, full parity, ≤3% perf, or distance-gated handle claim is made.
