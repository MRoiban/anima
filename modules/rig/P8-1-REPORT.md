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
