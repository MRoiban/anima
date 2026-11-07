# P3c-2 tooling carry-overs

Status: complete; final verification recorded below. Branch `t3/tooling-benchmark-carryovers`.
No push, PR, publication, parity promotion or runtime implementation changes.

| Row (status remains planned) | Closure evidence |
|---|---|
| `tooling.benchmark` | `bench.ts`: measured JS heap before/after, signed growth and bytes/frame; exact arithmetic and human/JSON output. JS replaces the inapplicable WASM measure by DESIGN §3. |
| `tooling.environment-doctor` | `doctor.ts`: project validity, default port availability, actual Chromium mobile/touch emulation, existing Node/browser/cache/wiring; authentication explicitly N/A. Occupied-port and invalid-project diagnostic test. |
| `tooling.project-configuration` | `project.ts`: validated exclude globs omit test libraries before reads; named scalar constants substitute only XML attributes, including imported libraries, escaped safely. Invalid scalar/name, unknown placeholder, XML entity/range and real build tests. |
| `tooling.render-presets` | Sequential repeated presets, explicit override precedence, disjoint output stems, numbered PNG sequences, WebM with real Chromium MediaRecorder, unavailable encoder fallback. Successful queue produces 2+1 PNGs; WebM has EBML header; missing executable returns code and leaves no partial file. |
| `tooling.schema-lookup` | Conjunctive animatable/bindable/inherited filters with inherited shared-property origin; editor-only explicitly N/A. `circle` filter includes x and excludes own r; ordinary lookup remains available. |
| `tooling.test-assertions` | Named/nested groups label failures; expected thrown or emitted errors consumed only on next command; mismatches/missing errors fail; unterminated groups/dangling expectations fail a completed script. Sessions allow groups across requests. Test-only source excluded from actual build. |

All six rows are closure-ready under the P3c decisions; no inventory status was changed. Native
comparison skips and rationale are in `oracle/README.md`; tooling introduces no registry/runtime
format fields and does not change Player.step, so it requires no synthetic runtime conformance vector.
Existing tooling conformance remains selected and passing in the tooling scope.

Benchmark friction: authoring contents and section lookup, spec section listing/extraction, actionable
script-target diagnostics for absent inputs or hidden/absent semantic nodes, stale accessibility and
converter/keyframe status text removed, tested tab-list selection-follows-focus recipe. No tab policy
was added to the browser runtime. The core/host boundary follows `docs/research/rive-web-runtime.md`;
measurements remain CLI-only, consistent with `docs/ARCHITECTURE.md`.

Limitations/deviations: the preset queue is sequential as explicitly decided; it does not spawn a
background service. Video capture runs in real time and its timestamps/encoded bytes are not a
conformance quantity. Heap growth includes garbage collection and can be negative. Browser/device
checks use available Chromium emulation, not physical device discovery. Existing tooling code was
extended directly: `new-capability tooling.benchmark --dry-run` inspected the scaffold, but no inert
registry or TODO oracle/conformance skeletons were added for these authoring-only extensions.

All six unchanged size gates and verification results follow.

| Size gate (min+gzip bytes) | Before | After | Delta |
|---|---:|---:|---:|
| core + web | 20,622 | 20,622 | 0 |
| largest scene (29) | 55,313 | 55,313 | 0 |
| app-UI scene | 91,158 | 91,158 | 0 |
| runtime sum | 109,971 | 109,971 | 0 |
| authoring add-on | 11,949 | 11,949 | 0 |
| heavy | 115,473 | 115,473 | 0 |

Verification: tooling scope 92 passed (4 files); focused CLI + new tests 81 passed before the
final additional imported-library test (that test passes in tooling scope). Typecheck for CLI,
ESLint on changed TypeScript, Prettier on changed supported files, module wiring, browser generation,
size and strict oracle commands all exit 0. Perf exits 0, but concurrent CPU contention means the
≤3% timing comparison is **unverified** (bell compile 7.91 ms, bell frame 162.5 µs, toolbar 98.8 µs).
No measurement tool, input, threshold or budget changed. Evidence: `verification/p3c2/`.

Final frozen `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **8,049 passed, 43 existing TODOs, 0 failed; 244 files passed, 13 skipped**, Chromium and Firefox included (615.28 s), exit 0. No rows remain open in this ticket under the decided scope. The only verification limit is the performance timing comparison under load.
