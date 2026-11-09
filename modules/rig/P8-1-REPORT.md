# P8-1 implementation report

- 2026-11-09 11:40: read shared brief, design, decisions, repo memory and research; installed dependencies.
- 2026-11-09 11:40: API seam committed first as c7f8bc0c (only core/api.ts).
- Baseline bell: compile 88.162 ms; step median 9.709 µs, p95 24.381 µs; draw median 117.802 µs, p95 166.098 µs; 2,000 frames. Shared load, not performance evidence.
- Baseline size run stopped before completion to release the frozen tree; ticket baseline is 22,782 core+web, 57,781 largest scene, 107,899 app-UI, 135,579 runtime sum, 15,017 authoring, 155,805 heavy. New entries absent (0 B).

- 2026-11-09 12:15: numeric/diagnostic/API checks: 39 targeted passes; 612 unrelated cases filtered. Additional offset-parent and whole-tuple interpolation regressions added afterward.
- Chromium first scoped run: setup hook timed out at 30 s under shared load. Isolated browser rerun: all 11 three-frame SVG/canvas probes passed; standalone markup failed. Investigation identified its missing markup-animation import (the runtime returned two precise markup-animation-unavailable diagnostics).
- Required broad Chromium scope attempted: prefix-fuzz and an existing WebP oracle exceeded 5 s; the run exhausted Node's default 4 GB heap. This is a failed run, not accepted evidence. Isolated retries/final scoped retry pending.
- Native references: all 11 probes captured successfully via the local headless CLI; no binary read or retained, build folders removed. All 33 raw comparisons are in oracle-raw.json. Largest over-16 fraction 0.114583%; largest delta 96. No budget or oracle manifest edited; all markers remain pending for orchestration.
- Whole-repo typecheck passed. Lint found the API's deliberate Mat | void callback union; documenting that exception is pending the frozen size run.
- Current measured entries: rig 3,066 / 3,072 B; rig-distance 271 / 512 B; markup-rig 310 / 384 B. Core+web 22,782 B unchanged. Final six-gate run in progress.

- 2026-11-09 12:35: resumed intact tree; D38 is implemented and tested with a layout parent and the prescribed group-wrapper hint. D36 does not require a node declaration in rig.
- Resumed unit run: 20/20 passes. Fixed the dormant-limit default (unbounded until played) and preserved constraint shape feature/default metadata for downstream constraint modules.
- Root cause of prior OOM: paint's generic string interpolator looped on rig's non-path tuple encoding. A minimal moveto guard in paint fixes interoperability; a precision regression proves tuple interpolation remains unrounded. The first API contract is unchanged; api.ts only gains a lint exception documenting its intentional Mat | void return type.
- The isolated bell-prefix file passed 51/51 after the timeout; the isolated WebP oracle passed 1/1 after the timeout. These are recorded separately from the failed broad run.
- Latest entry measurements: core+web 22,782; rig 3,054; rig-distance 270; markup 7,435; markup-rig 310; paint 4,077 (was 4,060). Paint's 17 B interpolation guard is a necessary outside-ticket seam; final gate totals will reflect it.

- 2026-11-09 19:22: merged p8-rigging (P8-6, P8-8, P8-9); D39 rejects zero document-rest scale on a bone or an ancestor. Corpus count is 643, matching the checked-in case files. The first API contract remains unchanged apart from its lint directive.
- Final status: partial. All eleven rows remain planned pending owner oracle budgets/manifest integration. `copyTransform` whole-tuple origin has JSON animation but lacks AniML tuple animation and tuple binding; origin bounds omit group subtrees and other non-rect/path/circle shapes. A bone under a non-container is rejected by the structural checker as `unknown-key` before `rig-bone-parent`. The solver conservatively invalidates all draw nodes after a rig local change. The rig entry is at its hard cap, so further work needs a split or byte savings.
- Final focused Chromium (`test:scope -- rig posepad conformance oracle --browser=chromium`): 11 files, 4,623 passed, 16 skipped, 34 todo. Firefox rig browser: 13 passed, 13 skipped. Full `test:scope -- changed`: 409 files passed, 12 skipped, 1 failed; 10,660 tests passed, 3 failed, 46 todo. Isolated canvas retry: 1 passed, the same 3 failed, 2,692 skipped. The merged a11y feather case emits unsupported-render for nonuniform local feather in both engines; Firefox clip has max 64 and 52 pixels over tolerance. Prior full attempt had 10,464 passes, 2 failures and 45 todo; its scaffolder and CLI failures passed isolated after the scaffold fix and browser cache rebuild, respectively (26 and 9 passes).
- `modules.ts --check`, `parity.ts --check`, `build-animl.ts --check`, lint and typecheck passed. Strict oracle exited 0 for 324 completed manifest cases; new cases remain pending. Size exited 0. Main baseline → merged result, bytes: core+web 22,782 → 22,787; largest scene 57,781 → 59,355; app-UI 107,899 → 108,101; runtime 135,579 → 137,361; authoring 15,017 → 15,360; heavy 155,805 → 161,957. Entries: rig 0 → 3,072/3,072; rig-distance 0 → 270/512; markup-rig 0 → 310/384; paint 4,060 → 4,077; markup 7,435 → 7,434. Changes include the merged P8 tickets and paint interoperability seam; the ticket's unchanged core+web/app/runtime acceptance is not met.
- Bell benchmark before → after: compile 88.162 → 66.059 ms; step median 9.709 → 9.898 µs; draw median 117.802 → 110.834 µs. Shared load: these are not evidence of the 3% guard. `tools/perf.ts` also ran; raw bell compile 7.31 ms, frame 97.9 µs, composite 63.0 µs, toolbar 98.8 µs (before final merge/D39).
- Native oracle raw comparisons: each cell is max channel delta / number of pixels over 16, at the listed time; each frame has 57,600 pixels. Full values including percentages are in `oracle-raw.json`. The owner sets budgets; no threshold or manifest changes were made.

| Probe | 0 s | 0.5 s | 1 s |
| --- | ---: | ---: | ---: |
| rigging-bone-chains | 53/22 | 53/25 | 53/20 |
| rigging-constraint-order | 53/44 | 53/44 | 53/44 |
| rigging-constraint-strength | 53/22 | 53/22 | 53/22 |
| rigging-distance-closer | 78/54 | 78/54 | 53/66 |
| rigging-distance-exact | 96/32 | 96/32 | 96/32 |
| rigging-distance-further | 53/66 | 78/54 | 78/54 |
| rigging-root-bones | 53/22 | 74/25 | 62/18 |
| rigging-rotation | 1/0 | 22/50 | 22/50 |
| rigging-scale | 1/0 | 1/0 | 1/0 |
| rigging-transform | 1/0 | 22/50 | 1/0 |
| rigging-translation | 53/22 | 53/22 | 53/22 |

- P8-1b continuation: merged origin/p8-rigging at c5115f42. The D38 diagnostic now reports `rig-bone-parent` at the bone pointer with the prescribed hint even when the parent's schema forbids `children`; the rig no-browser scope passed 3,476 tests (647 skipped). The previously reported checker-order gap is fixed.
- Remaining `copyTransform` origin limits: JSON tuple tracks work through rig's legacy tuple encoding, but AniML tuple tracks and tuple bindings do not. Origin geometry supports paths, circles and rectangle-like fields; group subtree and other shape bounds are incomplete. The merged point value support is currently owned by mesh's optional binding wrapper and is not yet wired to rig. A safe implementation needs a rig-owned optional entry and tuple markup/binding integration plus transformed subtree bounds; the measured rig entry has only 19 bytes of headroom. These are known implementation limits, not completed design behavior; `rigging.transform` remains planned.
- Final merged-tree size measurement: rig 3,053/3,072 B, rig-distance 270/512 B, markup-rig 307/384 B; core+web 22,891 B, largest scene 59,453 B, app-UI 108,210 B, runtime 137,492 B, authoring 15,354 B, heavy 168,862 B. Size exited 1 because the concurrently developed skin entry is 2,755/1,536 B; skin was not changed here. Corpus count at merge is 645 and matches case files.
