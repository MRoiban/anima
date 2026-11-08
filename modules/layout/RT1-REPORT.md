# RT1 review fixes

Base: `4ba61f4c` (`p8` log commit over main `c3b79b40`). Implementation branch:
`t3/fix-layout-review-findings`. Commit only; no push, PR or sub-agents.
`npm ci` installed the missing dependencies. `WORKLOG.md`, oracle thresholds,
recorded findings and benchmark records are unchanged.

## Findings and regressions

Every requested finding was confirmed. Tests were first run against the failing
implementation; the R1-3 reproduction was isolated with only the R1-1 guard in place.

| Finding | Confirmation and fix | Regression tests |
| --- | --- | --- |
| R1-1 | A rect-only layout/components/nested document threw while binding `base.step`. Guard the declining nesting-factory result. | `modules/nested/test/core/rt1.test.ts` |
| R1-2 | The allocated rect missed at (25,10); the normalized circle and stretched instance used authored coordinate spaces. Use the shared `drawWorld` helper for hit and pointer coordinate mapping, and the resolved allocation for rectangular outlines. Allocated image viewports must take precedence over the assets module's authored outline; retain module outlines for paths. | `modules/layout/test/core/rt1.test.ts`; `modules/host-fit/test/web/fit.test.ts`; `spec/conformance/layout-intrinsic-hit/` |
| R1-3 | The selected 7×8 child measured 0×0. Measure the selected child player's model; swaps remeasure and clear measures zero. | `modules/layout/test/core/rt1.test.ts`; `spec/conformance/layout-intrinsic-dynamic/` |
| R1-4 | Layout size/reflow changed bounds without changing sampled properties, leaving stale semantics, including in collected child players. Track each collected player's draw revision after resolving its frame. Recording the revision before frame resolution made the first text frame immediately invalidate the cache and exposed a modal-focus regression; the existing field test catches this and passes with the final ordering. | `modules/a11y/test/core/rt1.test.ts`; `modules/text-input/test/core/field.test.ts`; `modules/host-fit/test/web/fit.test.ts`; `spec/conformance/layout-intrinsic-hit/` |
| R1-5 | The drawn circle occupied [0,0,10,10] while semantic bounds were [45,45,10,10]. Semantic bounds use the same `drawWorld` helper as hit testing, including layout normalization and ancestor transforms. | `modules/a11y/test/core/rt1.test.ts`; `modules/host-fit/test/web/fit.test.ts`; `spec/conformance/layout-intrinsic-hit/` |
| R1-6 | Three committed assignments retained all three models; assigning an external value also extended shared compiled property `values`. Prune after stepping, retaining only current data references and queued assignments. Keep validation maps in player-local data state and remove cleared nested players. Preserve duplicate queued references across step boundaries and prune even when nesting declines. Use a monotonic per-player alias counter so a retired alias cannot select a later value. Reuse the host's existing descendant traversal to fit the byte ceiling. | Five `R1-6` tests in `modules/data-artboard/test/core/artboard.test.ts`; existing `modules/data-artboard/test/web/{artboard,resources}.test.ts` |
| R1-7 | Computed border-box dimensions were assigned as content dimensions in both renderers. Share a DOM content-box helper between fitting and canvas sizing; subtract border/padding for border-box sizing, and use the same dimensions for `layoutSize` and the SVG/canvas viewport. | `modules/host-fit/test/web/fit.test.ts` (SVG/canvas, border-box/content-box, explicit 30 s deadlines) |

The retention tests inspect the module's assignment map and current child models,
not GC timing. They also check shared-schema immutability, player isolation,
three queued choices reducing to the final choice, clear/local replacement,
duplicate deferred writes, declined nesting and invalidation of retired aliases.

The two new paired AniML/JSON conformance cases use independently specified
expectations: 7×8 → 30×30 → 0×0 intrinsic sizes; allocated pointer activation and
semantic bounds at the start, midpoint and end of a one-second linear reflow.
Existing button focus/action behavior is included in the semantic expectations.
The corpus count is updated from 609 to 611.

## Packaging and decisions

No budget is raised. `layout` includes the new optional `layout-svg` backend entry;
its existing SVG registration is measured separately. `host-fit` includes its
existing size/reset API through the optional `host-fit-size` entry. Existing full
imports retain their behavior. Manifests, generated adapters/exports/tables and
the generated browser demo were rebuilt.

The shared matrix helper lives in renderer-neutral core; DOM content measurement
lives in web. Neither core nor web gains a runtime dependency. These changes follow
the ownership/coordinate consistency concerns in
`docs/research/rive-web-runtime.md` and the update-pass cautions in
`docs/research/rive-animation-and-state.md`. No native source, CLI documentation
text or `.riv` file was used. Spec clarifications are confined to the layout and
artboard module specs and `docs/WEB.md`.

## Verification

- Required Chromium scope, with `VITEST_MAX_WORKERS=2`:
  `npm run test:scope -- layout a11y a11y-dom nested data-artboard host-fit input --browser=chromium`:
  **3,880 passed, 617 intentionally skipped, 1 existing TODO**;
  53 files passed, 1 skipped. This includes Chromium resource ownership suites.
- Touched browser suite in Firefox:
  `npx vitest run --project browser modules/host-fit/test/web/fit.test.ts -t Firefox`:
  **37 passed, 37 Chromium tests intentionally filtered**.
- Final focused regression files: **37 passed**.
- Additional host/data scope, two workers: **3,427 passed, 546 intentionally
  skipped, 11 existing TODOs**; 23 files passed, 11 skipped.
- Shared-core/components/canvas/data/host scope initially found the real modal-focus
  cache interaction described under R1-4; after fixing it, the scope passed
  **5,558 tests**. A later recheck after the image regression was added passed
  **5,557 tests** and hit only the existing 5 s Bell-prefix fuzz deadlines in two
  files. Each file was rerun individually: `packages/core/test/examples.test.ts`
  **17 passed** and `packages/markup/test/compile.test.ts` **51 passed**.
- The first broad Chromium attempt, while the cache build and other heavy jobs
  ran concurrently, had 7 failed files (5 test timeouts and 3 hook timeouts),
  3,832 passing tests, 650 skips and 1 TODO. The initial Firefox run hit its
  60 s setup deadline. Fresh-cache serial/bounded reruns above passed. No timeout
  thresholds were changed.
- Type checking and lint of changed TypeScript files: passed.
- Module wiring, size, strict oracle and final formatting: results below.

Timings were collected under shared machine load. They are not performance evidence;
no ≤3% performance claim is made.

## Final gates and entry sizes

All values are minified+gzip bytes. Both optional entries are included by their existing full imports.

| Entry | Before | After | Budget |
| --- | ---: | ---: | ---: |
| `core+web` | 21165 | 21266 | 24576 |
| `canvas` | 5711 | 5814 | 5888 |
| `components` | 3393 | 3406 | 3456 |
| `markup-components` | 763 | 760 | 896 |
| `host-fit` | 733 | 658 | 768 |
| `host-fit-size` | new | 242 | 512 |
| `input` | 6743 | 6652 | 7104 |
| `data` | 6504 | 6531 | 7040 |
| `host` | 3691 | 3713 | 3968 |
| `a11y` | 2352 | 2349 | 2496 |
| `a11y-text` | 450 | 452 | 576 |
| `a11y-bounds` | 1407 | 1409 | 4096 |
| `markup-a11y` | 1039 | 1046 | 1088 |
| `a11y-actions` | 1070 | 1069 | 1216 |
| `a11y-dom` | 2147 | 2148 | 2176 |
| `nested` | 4559 | 4564 | 5056 |
| `data-artboard` | 835 | 835 | 1024 |
| `data-artboard-values` | 1425 | 1524 | 1536 |
| `markup-data-artboard` | 37 | 36 | 256 |
| `layout` | 4084 | 4056 | 4096 |
| `layout-svg` | new | 71 | 256 |
| `layout-reflow` | 900 | 885 | 1024 |
| `markup-layout` | 83 | 83 | 512 |
| `host-values` | 1237 | 1236 | 1344 |
| `markup-libraries` | 2174 | 2173 | 2176 |

`layout` is now measured over `layout-svg`; `host-fit` over `host-fit-size`. Their budgets are unchanged.

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core+web | 21165 | 21266 | 24576 |
| largest scene (30) | 55444 | 55604 | 65536 |
| app-UI | 104592 | 104868 | 131072 |
| runtime sum | 130133 | 130496 | 163840 |
| authoring add-on | 14899 | 14892 | 16384 |
| Rive-class/heavy | 148870 | 149253 | 256000 |

- `node tools/size.ts`: passed; no entry or aggregate ceiling exceeded.
- `node tools/modules.ts --check` and `node tools/build-web.ts --check`: passed.
- `node tools/oracle.ts --strict`: passed, **324 normative cases / 540 frames / 0 failing frames**. The 24 recorded finding entries and their metrics are unchanged.
- Changed-file `npx prettier --check`: passed. Staged whitespace is checked before committing.

## Changed files

43 files:

- `docs/WEB.md`
- `examples/web/index.html`
- `modules/a11y/core/runtime.ts`
- `modules/a11y/test/core/rt1.test.ts`
- `modules/canvas/web/renderer.ts`
- `modules/components/core/index.ts`
- `modules/data-artboard/SPEC.md`
- `modules/data-artboard/core/index.ts`
- `modules/data-artboard/test/core/artboard.test.ts`
- `modules/data/core/storage.ts`
- `modules/host-fit/manifest.ts`
- `modules/host-fit/test/web/fit.test.ts`
- `modules/host-fit/web/index.ts`
- `modules/host-fit/web/size.ts`
- `modules/host/core/api.ts`
- `modules/host/core/index.ts`
- `modules/input/core/runtime.ts`
- `modules/layout/RT1-REPORT.md`
- `modules/layout/SPEC.md`
- `modules/layout/core/index.ts`
- `modules/layout/manifest.ts`
- `modules/layout/test/core/rt1.test.ts`
- `modules/layout/web/index.ts`
- `modules/layout/web/svg.ts`
- `modules/nested/core/index.ts`
- `modules/nested/test/core/rt1.test.ts`
- `packages/core/src/draw.ts`
- `packages/core/src/player.ts`
- `packages/markup/test/corpus.test.ts`
- `packages/web/package.json`
- `packages/web/src/all-modules.ts`
- `packages/web/src/content-box.ts`
- `packages/web/src/host-fit-size.ts`
- `packages/web/src/layout-svg.ts`
- `spec/conformance/layout-intrinsic-dynamic/case.ani`
- `spec/conformance/layout-intrinsic-dynamic/case.animl`
- `spec/conformance/layout-intrinsic-dynamic/expected.jsonl`
- `spec/conformance/layout-intrinsic-dynamic/script.txt`
- `spec/conformance/layout-intrinsic-hit/case.ani`
- `spec/conformance/layout-intrinsic-hit/case.animl`
- `spec/conformance/layout-intrinsic-hit/expected.jsonl`
- `spec/conformance/layout-intrinsic-hit/script.txt`
- `tools/modules.generated.ts`

## Unresolved work

No disputed or unresolved requested finding. Existing unrelated skips, TODOs and
recorded oracle findings remain unchanged. No performance benchmark was requested
or modified. Final formatting and the commit are recorded by git; no further implementation work remains.
