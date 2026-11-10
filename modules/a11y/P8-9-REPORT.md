# P8-9 — semantic painted extents

- 2026-11-09 11:32 UTC: read shared brief, ticket, design §6/D32, inventory and historical evidence; created `p8-9` at 59263eb7, installed dependencies, ran scaffolder dry-run and write (removed the reintroduced pending marker on the existing completed probe).
- Baseline size run measured every module, then was stopped during scene enumeration to begin implementation. Before gate values below use the shared brief's measurements of this unchanged HEAD. Final size run will complete on a frozen tree.
- 2026-11-09 11:58 UTC: implemented clips/masks (including nested source restrictions and inverted complements), trimmed pieces/caps, viewport strokes and finite three-sigma feather support. Added eight conformance probes, two fixed-host vectors and a combined paired example. Effect-stack dash support uses a pure contour reader seam; no budgets changed.
- New tests exposed and fixed the text-input refinement replacement, empty trimmed path handling, missing active-module seam exposure, fixture asset spelling and shared decompile-test support for feather. The viewport map is allocated only when the calculator is installed; base a11y-text is unchanged at 452 B. Latest incremental bounds: 2,908 B (ticket cap 2,952 B).
- Required Chromium scope, before final lifecycle/source-type polish: 4,214 passed, 2 timeout failures, 34 skipped, 5 TODO. Bell-prefix robustness (5 s) and surface ordered-paint import order (30 s) timed out. The bell compiler file rerun alone still timed out under concurrent external builds: 50 passed, 1 timeout. No deadline was changed.
- Required Firefox scope (two bounds/overlay arrival orders, all extents and settled 100→200→100 host resize): 4,219 passed, 1 existing surface timeout, 35 skipped, 5 TODO. Browser cache was cold; final verification builds it before rerunning the isolated surface suite and required scope.

## Result

Status: **done**. Required scopes, final changed scope and all size gates pass.
Branch: `p8-9`, based on `59263eb7`.
Closed row: `a11y.tree-bounds`. No assigned row remains open. The native comparator is explicitly
skipped for painted-box equality, backed by the existing P7-8 linear capture; dash and text retain
the two D32 differences. The old oracle TODO marker and placeholder scene were replaced by that
skip disposition.

### Seams outside the calculator

- `modules/contour/core/effects.ts`: pure `undashed` reader returns the contour entering the first
  dash, including preceding trims; later effects only remove paint. This reuses the actual effect
  implementation without bundling another effect walker into accessibility.
- `modules/contour/core/index.ts`: exposes that reader through the active module registry.
- `modules/a11y/core/index.ts`: tooling passes the active registry to the bounds installer inside
  its existing verbose-only branch. No additional shipped base-a11y work is installed.
- `modules/a11y/TEXT.md`: replaces the stale text-ink deferral with D32's logical-box disposition.
- `packages/markup/test/corpus.test.ts`: conformance count 619 → 627.
- `packages/markup/test/decompile.test.ts`: independently recovers feather declarations for the
  newly authored conformance source. Both test seams are marked `seam(P8-9)`.

Shared SPEC and parity edits change only the assigned contract/row and generated views.
Module wiring regeneration changed zero generated adapters; schema regeneration is unchanged.

### Verification

- `npm ci`, scaffolder dry-run/write, `node tools/modules.ts`, `npm run gen`,
  `node tools/build-animl.ts`, `node tools/parity.ts`, `node tools/build-web.ts`: pass.
- `npm run test:scope -- a11y composite paint surface conformance --browser=chromium`:
  **4,220 passed**, 35 skipped, 5 existing TODO; 47 files passed, 1 skipped.
- The same required scope with `--browser=firefox`: **4,220 passed**, 35 skipped, 5 existing TODO;
  47 files passed, 1 skipped. Final scopes use `VITEST_MAX_WORKERS=2` to limit shared-machine load.
- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **4,763 passed**, 22 existing TODO;
  52 files passed, 1 skipped. Both engines run in this scope. The final run took 43.95 s after load dropped.
- `npm run typecheck`: pass across all packages/tools. The strengthened host expected-snapshot test
  also passes the final `tsc -p packages/core/test --noEmit` check.
- `npm run lint`: pass. Changed-file `npx prettier --check --ignore-unknown`: pass.
- `node tools/modules.ts --check`, `node tools/build-animl.ts --check`,
  `node tools/parity.ts --check`, `node tools/build-web.ts --check`: pass; 686 AniML sources,
  75 browser entries, 1,238 parity rows.
- CLI `validate modules/a11y/examples/painted-extents.animl` and `schema a11y`: pass.
- `node tools/size.ts`: **exit 0**, every entry and all six gates pass; ticket-specific bounds cap
  2,952 B also passes. No budget, threshold or measurement input was raised.
- `node tools/oracle.ts --strict`: **exit 0**, 324 completed cases / 540 passing samples. The 24
  pre-existing finding cases (29 samples, 27 nonmatching) remain separate and unchanged; no finding
  or oracle budget was edited. The new semantic rectangle disposition is a skip, not native pixel
  parity. Final strict run also removes the former pending/skip overlap.
- `node tools/perf.ts`: exit 0. Under shared load: bell compile 19.93 ms, 9,040 prefixes 3,981 ms;
  bell/composite frames 196.3/84.8 µs; toolbar frame 97.5 µs, compile 13.97 ms. These are raw shared-load
  observations, **not** evidence for the ≤3% guard; integration measurements belong to the orchestrator.

### Sizes (min+gzip bytes)

Per-entry before values come from the local baseline run; aggregate before values are the shared
brief's measurements of the unchanged starting HEAD. That baseline run was stopped after entry
measurements, during scene enumeration. The final run completed on frozen runtime sources.

| Entry | Before | After | Limit |
| --- | ---: | ---: | ---: |
| a11y-bounds | 1,416 | 2,917 | 2,952 ticket / 4,096 manifest |
| a11y | 2,368 | 2,351 | 2,496 |
| a11y-text | 452 | 452 | 576 |
| contour | 3,458 | 3,535 | 3,840 |

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core + web | 22,782 | 22,782 | 24,576 |
| largest scene | 57,781 | 59,241 | 65,536 |
| app-UI scene | 107,899 | 107,899 | 131,072 |
| runtime sum | 135,579 | 137,109 | 163,840 |
| authoring add-on | 15,017 | 15,017 | 16,384 owner / 15,872 P8 |
| Rive-class | 155,805 | 157,353 | 256,000 |

### Design clarifications and problems

No feature-scope deviation. Inverted masks retain the target AABB because a complement paints
outside its source. Feather uses the specified outer three-sigma geometric extent (inner feather
stays within original alpha), including the offset; the spec now defines the finite accessibility
rectangle despite the Gaussian's infinite mathematical tail. Headless viewport defaults remain one
pixel per grid unit; both host scales have full semantic `expected.jsonl` snapshots, and browser
conformance checks actual hosts and overlay rectangles. No new public host API was added.

Resolved verification problems: compiler-prefix and surface browser timeouts under load passed
isolated reruns (51 compiler tests; all 4 surface tests across both engines), then both full required
scopes passed. The first changed scope had 4,761 passes, an obsolete oracle TODO/skip overlap and a
contour raster timeout. The marker/scaffold were removed; raster evidence passed alone (2 tests).
The serial full changed run later had 4,762 passes and the same raster timeout (5.295 s against
5 s); its unit-only rerun had 4,756 passes and that timeout (6.099 s). After machine load dropped,
the final complete changed scope passed all 4,763 tests. No timeout or assertion tolerance was
changed. No unresolved runtime problem is known.

The combined module example initially bundled font/text companion entries at 66,044 B, above the
65,536 B scene ceiling. Its text/font section was removed; text keeps its dedicated conformance
and both-engine browser cases. The final geometric example measures **44,037 B** using the same
bundle/minifier/gzip and feature-to-entry ownership selection as tools/size.ts. The canonical
six-gate values above are unchanged (the tool enumerates root examples and benchmark scenes).

- 2026-11-09 12:34 UTC: resumed after the usage limit; confirmed preserved source and verification
  state, reduced the example to its geometric cases, rebuilt/validated its AniML/ANI pair, measured
  its feature bundle at 44,037 B, and reran the complete changed scope → 4,763 passed, 22 TODO,
  exit 0. Earlier timeout runs and their isolated reruns are retained above.
