# BF-1 — B1, B4, B5

Branch: `t3/nested-binding-library-import-fixes`, base `efb624bd`. Local commit only; no push/PR.
Downstream inspected only with `git show f1373fd:<path>`; no downstream modifications.

## B1 — reproduced and fixed

Small scene: `modules/data/test/fixtures/bf1/theme.animl` plus `theme-library.animl`.
The library's non-global Theme model supplies top, control and nested digit fills. On the clean
base, array and hex writes, inside/outside `batch`, updated the top fill while both children
retained `#123456`; a document click write had the same failure. Evidence:
`verification/bf1/reproduction-before.txt`.

Cause: `data.bindData` shared only global-model named instances or an explicit placement binding.
Context-free component definitions inherited declarations but constructed detached instance copies.
Grandchildren were constructed before their parent was rebound. Separate browser bundles also
require shared inheritance metadata; a private WeakSet in separate emitted bundles did not work.

Fix: `modules/components/core/index.ts` records inherited data on the compiled model and preserves
it when forking; `modules/data/core/compile.ts` shares inherited named instances and rebinds
context-free descendants after the parent. Lists keeps ownership of its existing context traversal,
avoiding duplicate recursive visits. Components also compare shared data around child stepping:
a descendant document write keeps ancestors unsettled until they sample the new value on the
following step, preserving parent-before-child order and automatic browser wake-up. Explicit child contexts retain local defaults; root players
remain independent.

Regressions: `modules/data/test/core/bf1.test.ts` covers host batches/non-batches, document actions,
explicit local child contexts,
lists integration and independent roots. `modules/data/test/web/bf1.test.ts` verifies actual retained
SVG fills in separately emitted Chromium/Firefox bundles, including selected component roots.
`spec/conformance/components-inherited-data/` records independent expected step snapshots.

## B4 — hex report refuted; invalid channel validation tightened

The same small scene proves `#rgb`, `#rrggbb`, `#rrggbbaa` already normalize on the next step.
Malformed hex/non-colours already throw `DataError` with `data-type`, pointer, message and hint.
This is recorded on the clean base, not inferred from the changed implementation. Batched writes
commit on the next step; they do not synchronously change the rendered attributes.

A related bad-value gap did reproduce: fractional RGBA channels were accepted and could format
as invalid hex. `modules/data/core/storage.ts` now requires integer bytes in [0,255]. Tests cover
all three hex forms, invalid strings, null, wrong-length arrays, fractions, NaN, Infinity and
out-of-range bytes; the browser suite checks the host error code/path and scheduled SVG updates.
No replacement colour API or runtime dependency was added.

## B5 — reproduced and fixed

Small scenes: `modules/markup-libraries/test/markup/bf1-names.test.ts` and
`spec/conformance/components-library-lookup/`. The clean theme scene compiled to
`import-2-digit` / `import-3-control`, establishing the report.

Scheme: imported components retain their original name when globally unique; collisions use the
full import alias chain (`ui:switch`, `other:switch`, `ui:basic:switch`). Local exact keys retain
priority for compatibility. `meta.componentNames` preserves qualified aliases alongside existing
metadata/comments. Core `componentNames(doc, name)` returns matching canonical keys. Web root
selection, CLI rendering, core references and host component-property writes share the resolver.
Existing generated keys work unchanged; after recompilation a generated suffix resolves when
unique. Ambiguous originals produce `ambiguous-component` and verbose qualified alternatives.

Fix files: `modules/markup-libraries/markup/reuse.ts` defers cloning until names are finalized;
`modules/components/core/names.ts` owns lookup; component/nested registry and markup code permit
qualified definition keys/references; padded AniML instance identifiers retain their existing
trimming; `modules/host-edit/web/index.ts`, `modules/host/core/api.ts`
and `packages/cli/src/cli.ts` use the shared lookup. Repeat references preserve quoted strings
rather than being mistaken for model/component maps. The schema and two existing library scenes
were regenerated; alias metadata survives decompile/compile. AniML, SPEC and AUTHORING document
lookup, precedence and diagnostics.

Regressions cover unique originals, two imports, local collisions, nested aliases, ambiguous
names, legacy keys, metadata validation/comments, repeated components, JSON round trips, core
references, host writes, CLI selected-root rendering and Chromium/Firefox selected-root loading.
The lookup conformance case records qualified and legacy alias step output.

## Measurements

The before measurement uses a clean `git archive efb624bd` with isolated package aliases;
no source was edited during that baseline run. Measurement tools, oracle inputs, thresholds and
module budgets are unchanged. An earlier live-source measurement was superseded; it is not used.

| Gate (min+gzip bytes) | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 20,622 | 20,622 | 24,576 |
| largest scene (30) | 52,122 | 52,363 | 65,536 |
| app-UI scene | 85,154 | 85,454 | 131,072 |
| runtime sum | 104,285 | 104,688 | 163,840 |
| authoring add-on | 14,544 | 14,795 | 16,384 |
| Rive-class (heavy) | 109,904 | 110,276 | 256,000 |

All six gates passed.

Touched modules and affected authoring entries (incremental min+gzip):

| Entry | Before | After | Budget |
|---|---:|---:|---:|
| markup | 8,007 | 8,012 | 8,192 |
| markup-libraries | 1,925 | 2,159 | 2,176 |
| markup-components | 766 | 777 | 896 |
| markup-hooks | 4,123 | 4,132 | 4,544 |
| components | 3,137 | 3,352 | 3,456 |
| data | 6,375 | 6,436 | 7,040 |
| host | 3,570 | 3,732 | 3,968 |
| host-edit | 3,663 | 3,797 | 4,032 |
| nested | 4,582 | 4,588 | 5,056 |

All module budgets passed; no ceilings or budgets changed.

## Verification

- Final `VITEST_MAX_WORKERS=1 npm run test:scope -- changed`: **8,157 passed / 40 existing TODO**;
  **251 files passed / 13 skipped**, exit 0. Chromium and Firefox suites included.
- New core context/colour tests: 18 passed; metadata/name tests: 11 passed; two new conformance cases
  passed. Both selected-root browser load orders and inherited/padded-name compatibility pass.
- Full TypeScript check and final affected markup/test typechecks, changed-source ESLint, wiring,
  545 AniML artifact checks and 41 browser-entry builds passed.
- Frozen strict oracle: 266 cases / 475 samples passed, exit 0; 24 existing findings/intentional
  differences retained separately. No new Rive capture or native equivalence claim.
- All six size gates and every module budget passed. Before/after outputs are retained unchanged.
- Performance command passed. Concurrent load inflated timings (bell 122.8µs, composite 78.5µs,
  toolbar 107.9µs; compile bell7.01ms/toolbar12.76ms). Comparative ≤3% non-regression is unverified;
  these are not an A/B result.
- Earlier parallel browser timeouts were superseded by the passing serial run. Four host-edit
  assertions now expect inherited `happy`; the explicit child-model regression preserves local data.
  Two lean-markup padded-name regressions were fixed by restoring identifier trimming.

Evidence is under `verification/bf1/`. Initial cold-browser hook and one prefix-fuzz timeout,
intermediate over-budget authoring variants and the private-WeakSet browser failure were resolved;
original suite limits and measurement budgets were retained.

Design follows the explicit storage identity and deterministic sampling guidance in
`docs/research/rive-animation-and-state.md` (§C–D); explicit names and actionable failures follow
its warning against silent no-ops. Lexical import expansion follows
`docs/research/rive-format-and-graph.md` (§6). No Rive source/docs text was copied and no `.riv`
was read or converted. Text/fonts/CLI font files were untouched.
