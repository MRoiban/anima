# P7-7 implementation report

Status: **done**; all four rows closed and final broad verification passed.
Branch: `t3/p7-7-implementation`, based on `p7` at `39ab6837`.

Closed: `data.host-artboard`, `host-api.bindable-artboards`,
`host-api.data-artboard`, `components.host-artboard-reference`. No ticket rows remain.
The four native host-assignment skips remain evidenced by the existing independently
captured probe and permitted-comparison limits in [NATIVE.md](NATIVE.md). No new
native capture or widened tolerance is claimed.

The full browser entry captures source-load resource catalogs and font faces after
all composed loaders finish. Each resource-loaded source host gets a distinct player model identity,
including hosts sharing compiled declarations. Cached asset-loader initializers
resolve the live player owner and keep scopes in a weak per-root map; they never
retain the first host. Acquired values retain the selected
lexical models and snapshots; destination players acquire their own font references
and resolved image records. Unused definitions and nested/contextual placements are
preloaded. Source reload/destroy, a destination with no authored resources, multiple
resolvers, SVG/canvas, clearing and reusing handles after faces leave the browser font
set, and final font cleanup are covered in both engines. Browser acquisition uses
`icon.component(source.player.model, name)` after `source.ready`.

External schema checks run before rebinding/replacing the child. Inherited/default,
explicit placement and property-declared model contracts use structural compatibility:
property/asset kinds, numeric bounds, enum sets, model references and list element
models. Extra destination fields/different defaults are allowed. Independent
component-owned data remains independent unless an explicit context/contract applies.
`artboard-model` supplies a code, escaped property pointer, message and repair hint;
core regressions cover inherited/explicit contracts, independent data, declared expected
models, enum/nested/list mismatches and matching named instances. The original four
conformance cases, both spellings, AniML/JSON examples and CLI/schema support pass.

## Seams and scope

Every runtime seam outside the owned module is marked `seam(P7-7)`:

- `modules/assetio/web/index.ts`: preload unused lexical components and expose exact
  per-load catalogs to player initializers; tolerate asset-free component catalogs.
- `modules/assets/core/index.ts`: weak per-player catalog bridge.
- `modules/assets/core/svg.ts`: ignore a retired image slot during retained SVG refresh.
- `modules/fonts/web/index.ts`: capture decoded font bindings/faces without retaining
  the source host/controller; preload unused lexical components.
- `modules/fonts/core/index.ts` and `modules/fonts/web/text.ts`: an optional pure typed
  controller hook selects each adopted player's font scope.
- `modules/paint/core/svg.ts`: **additional seam outside the listed ticket folders**.
  The one-condition image viewport guard is necessary when clearing a host artboard:
  retained DOM still refers to a slot whose geometry has been retired. An isolated
  browser retry reproduced the TypeError; the clear/reassign regression now passes.

Generated package adapters/exports/tables and parity views are regenerated. Inventory
changes are limited to the four rows' status/reason. Shared WORKLOG gets appended
checkpoints. No layout/text implementation, measurement tool/input, budget ceiling,
oracle finding, benchmark record, licence, publication or PR is changed.

## Verification

All commands use frozen runtime sources. Raw evidence is in `verification/p7-7/`.

- Earlier scoped regression run (before the final named/cache additions),
  `npm run test:scope -- data-artboard assets fonts components paint --browser=chromium`:
  **3,414 pass, 0 fail**, 39 files; excludes opposite-engine/non-selected cases.
- Same scope with `--browser=firefox`: **3,413 pass, 1 fail** (existing 5 s asset-pipeline
  deadline). Isolated original-limit retry:
  `npx vitest run --project browser modules/assets/test/web/pipeline.test.ts --maxWorkers=1 -t Firefox`:
  **11 pass, 0 fail**. All owned browser cases passed in the scope.
- New resource file alone, both engines: **6/6 pass**. Final full `changed` run also
  selects it, including the cached-owner and generated-font fixture regressions.
- A development broad run hit seven test deadlines and one setup deadline across
  the compiler/fonts/artboard files. A resource-only retry then exposed the real
  retired-image bug, which was fixed. The later Chromium scope passes all those files.
  No blanket load-only classification or unchanged-source full-suite pass is claimed
  for those development runs.
- `npm run typecheck`, changed runtime/test ESLint, Prettier, module wiring,
  generated schema/web/AniML and parity views: pass.
- `node tools/oracle.ts --strict`: exit 0, 309 cases / 524 samples, 24 retained
  findings; four evidenced host-only skips. No case threshold/finding changed.
- `node tools/perf.ts`: exit 0; bell compile 2.20 ms / prefix sweep 643 ms;
  bell/composite/toolbar frame 33.5/21.1/27.2 µs; toolbar compile 4.64 ms. These
  shared-machine timings are **not** controlled A/B evidence for the ≤3% guard.
- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **9,417 pass / 0 fail /
  54 inherited TODO**, 309 passing files plus 13 skipped; Chromium and Firefox;
  exit 0, 690.05 seconds. This is the final runtime/test source, including cached
  loader ownership, named-instance compatibility and the required generated font.

## Sizes (min+gzip B)

Baseline is this checkout before edits (`39ab6837`), not the older brief's numbers.
`node tools/size.ts`: exit 0 on final runtime source. Every entry and six gates pass.

| Entry | Before | After | Budget |
| --- | ---: | ---: | ---: |
| data-artboard, complete addition over nested | 1,014 | 2,253 | split entries below |
| data-artboard, browser resources over data-artboard-values | — | 832 | 1,024 |
| data-artboard-values over nested (new optional entry) | — | 1,421 | 1,536 |
| markup-data-artboard | 35 | 35 | 256 |
| assetio | 711 | 734 | 768 |
| assets | 1,813 | 1,822 | 1,984 |
| fonts | 1,929 | 2,008 | 2,048 |
| fonts-text | 528 | 542 | 768 |
| fonts-options | 3,400 | 3,496 | 4,096 |
| paint | 4,037 | 4,040 | 4,416 |
| paint-sampling | 1,098 | 1,100 | 1,216 |
| surface (dependent entry) | 7,652 | 7,658 | 8,192 |
| media (dependent entry) | 2,816 | 2,848 | 3,072 |
| markup | 7,341 | 7,341 | 8,192; no growth |
| markup-libraries | 2,176 | 2,176 | 2,176 |
| text | 5,578 | 5,578 | 6,144; owner cap 5,632 |

The data-artboard entry keeps its existing 1,024 B ceiling; its measurement base
changes to the separately measured values entry. The complete addition grows from
1,014 to 2,253 B; this is an explicit split, not a claimed reduction. No existing
budget is raised. All other entry measurements are unchanged.

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core+web | 21,165 | 21,165 | 24,576 |
| largest scene (30) | 53,982 | 53,982 | 65,536 |
| app-UI | 99,988 | 100,134 | 131,072 |
| runtime sum | 122,300 | 123,747 | 163,840 |
| authoring | 14,808 | 14,808 | 15,360 owner / 16,384 tool |
| Rive-class | 132,306 | 133,703 | 256,000 |

## Deviations and remaining verification

The optional values split is needed because the inherited entry had 10 B headroom;
new validation plus browser resources cannot fit there. The extra paint image guard
is the smallest fix for the reproduced resource-retirement failure. Structural model
compatibility permits different model names/defaults and documents the existing
placement-data semantics rather than remapping schemas. No other design deviation.

Native host-assignment comparison is still a permitted-path skip, not a native parity
capture. The controlled ≤3% performance comparison belongs to the orchestrator and
remains unverified on the shared machine. A late independent probe found that compatible default models could still share an
incompatible named instance and draw NaN. The first full changed run was explicitly
stopped (exit 143) before edits; named-instance validation and a positive/negative
regression were added. A second superseded changed run was stopped (exit 143) to align the new browser
fixture with `fixtures/fonts/anima-test.ttf` from `tools/test-font.ts`; the second
resolver uses an in-memory advance-width variant, never another committed font.
The final owned resource file passes 6/6 in both engines, and the final core scope
passes 1,288 tests (including 23 host regressions and the original conformance cases).
The subsequent complete run passed **9,415 tests / 0 failures / 54 inherited TODOs**,
309 files plus 13 skipped. An independent cached-loader probe then found a real
ownership error: sibling A measured 3.609375 with its private font, while B fell back
to 4.34375 and `body`. The initializer had captured the first host. It is now a host-free
factory with weak per-root scopes and live ownership lookup. Both-engine regressions
verify the initializer runs once for two destinations and that B keeps its font after
source/A cleanup. The final 6/6 resource file and final 9,417-test broad run both
pass. The earlier 9,415 pass is retained only as a checkpoint; the final run covers
the cache fix. No required implementation or verification remains. The controlled
performance guard remains explicitly unverified, as noted above.
