# P6-9a implementation report

Status: **partial**: 15 of 17 rows closed; two explicit implementation gaps remain.
Branch `t3/p6-9a-implement-ticket`, base `e2442114`; committed head is in the handoff.
Local branch commit only. No push, PR, publication, external font, proprietary binary read/conversion,
reference implementation source or proprietary documentation prose.

## Rows closed and left

Closed:

- `text.modifier-translation`
- `text.modifier-rotation`
- `text.modifier-scale`
- `text.modifier-opacity`
- `text.modifier-origin`
- `text.modifier-follow-path`
- `text.range-units`
- `text.range-falloff`
- `text.range-easing`
- `text.range-combine`
- `text.range-run`
- `text.background`
- `text.script-direction`
- `text.script-hit-testing`
- `a11y.inferred-text`

Left planned:

- `text.modifier-variation`: generated-font wght native comparison passes, but arbitrary-axis
  Canvas drawing is missing. SVG/tool outline axis support is insufficient for the complete row.
- `a11y.tree-bounds`: text layout bounds are implemented/tested; exact painted path/stroke extents
  remain missing in the platform/tooling seam outside this ticket's owned text consumer. The old
  butt-cap counterexample and native/tool automatic-leading observation remain valid.

The scripting VM portion of hit testing is **won't-do**. Its done status covers only the
owner-retained host/listener scope, with independent metric/conformance and real pointer tests.
Direction likewise retains browser ltr/rtl/auto; the native derived scripting queries remain excluded.
Inferred naming is an intentional Anima accessibility difference, now recorded in the normative
text semantic contract with two original native controls and an explicit-label control.

See [the per-case evidence](TEXT-EFFECTS-PROBES.md), [raw measurements](effects-measurements.json)
and [contour classification](effects-contour-check.json). Fourteen comparisons are accepted:
thirteen corrected original controls plus a new fitted-background regression. All references use
only the current generated test font. Geometry mappings use explicit leading, equivalent native
half-advance/subtractive origins and scene-space paths versus Anima's local strings; no runtime
geometry is changed merely to match a parameter convention.

The new native fitted-background probe exposed a real bug: shrinking text retained unscaled
background ascent/descent. The owned evaluator now scales these metrics. Independent conformance
expects [0,0,1.5,.5] for three em-wide glyphs fitted at .5, and the native raster difference drops
from max255 / 65 over-threshold pixels to max32 / two corner pixels. All other runtime source,
including the full text entry, is unchanged.

## Seams outside owned files

- `packages/markup/test/corpus.test.ts`: marked `// seam(P6-9a)` census, 569→570, for the new
  independent fitted-background conformance scene. No assertion or deadline is relaxed.
- `docs/parity/{MATRIX.md,matrix.json}`: generated views from `node tools/parity.ts`, reflecting
  only the seventeen owned rows. Inventory uses its prescribed Unicode/indent format.
- Required append-only WORKLOG checkpoints. No Now/Gotchas rewrite, PLAN completion or PR work.

No runtime file outside `modules/text-effects` is changed. No measurement tool, benchmark record,
old oracle case/limit/finding, manifest budget, dependency or licence file is changed. Existing
capabilities were already scaffolded: the dry-run showed it would recreate TODO skeletons/markers,
so this closure work completes existing probes rather than applying a new capability scaffold.

## Verification

Full command results and history are in [effects-verification/checks.json](effects-verification/checks.json).

- `node tools/oracle.ts --strict`: **302 cases / 515 samples, zero completed-case failures**,
  exit 0. Fourteen new passing samples; all 24 existing findings retained separately.
- `node tests/oracle/measure-effects.mjs`: 14 owned raw comparisons; no budget assignment in helper.
- `node tests/oracle/check-effects-contours.mjs`: 14 probes, **zero non-boundary differences**.
  Six scaled-glyph differences touch two overlapping horizontal outline boundaries; all remaining
  over-threshold differences touch original-font corners. No image alignment, masking or filtering.
- Chromium scope before fit correction: **4249 passed / 0 failed / 67 inherited TODO**.
  Corrected-runtime scope: **4256 passed / 1 failed / 67 TODO**; the failure was only the new
  AniML fixture's canonical attribute order. Corrected formatting, then complete corpus retry
  **1227/1227 passed**. All owned Chromium browser cases pass on corrected runtime sources.
- Final Firefox scope: **3320 passed / 0 failed / 1 inherited TODO**, including effects, text and
  text semantic browser suites. The earlier before-fit Firefox scope passed3313/0.
- Focused new/core effects file: **35/35 passed**.
- Full `npm run typecheck`, changed-source ESLint, all changed-file Prettier, module wiring,
  AniML artifacts, parity views and browser artifact checks: exit 0.
- Required final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **9058 passed /
  2 failed / 79 inherited TODO**, 285 passing files / 2 failed / 13 skipped, exit1 in1050.87s.
  Both browser engines pass. Failures: module-order30000ms and contour raster-evidence5000ms
  timeouts; isolated unchanged-limit retry results are recorded below. The broad command is not green.
- `node tools/size.ts`: exit 0, all modules/scenes/six gates within unchanged limits.
- `node tools/perf.ts`: exit 0 before/final. Bell compile5.90→7.40ms, bell frame88.2→121.5µs,
  composite52.7→81.3µs, toolbar frame65.0→91.9µs / compile9.61→12.94ms. Shared host load and
  concurrent checks; these are not a controlled ≤3% non-regression result. That guard is unverified.

## Sizes (min+gzip bytes)

Only the text-effects runtime source changes; related entries are shown to make the zero-growth
constraints explicit. Both columns use the unmodified size tool. Aggregate gzip deltas do not add.

| Entry | Before | After | Budget |
|---|---:|---:|---:|
| text-effects | 3359 | 3365 | 4096 |
| markup-text-effects | 0 | 0 | 256 |
| text | 6142 | 6142 | 6144 |
| text-hit | 983 | 983 | 1024 |
| a11y-text | 448 | 448 | 576 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 21136 | 21136 | 24576 |
| largest scene (30) | 53780 | 53780 | 65536 |
| app-UI | 98604 | 98603 | 131072 |
| runtime sum | 118830 | 118829 | 163840 |
| authoring | 14649 | 14649 | 16384 |
| Rive-class | 128449 | 128449 | 256000 |

All thirty measured scenes are byte-identical to baseline. The authoring add-on also stays below
15360 B. The existing direction implementation's 150 B evidence is unchanged in wave-2's report;
this ticket adds no bidi runtime code. No cap is raised.

## Deviations, problems and verification history

The seventeen-row target is partial, because general Canvas axes and exact painted bounds are
still missing. Inferred names intentionally differ from the retained native empty-label captures;
this follows the ticket's permitted disposition and preserves the decided accessible-name behavior.
Native parameter mapping differences are documented, not turned into pixel tolerances.

Initial size measurement failed because esbuild was absent; npm ci restored tooling. Early native
comparison attempts lacked the CLI IO argument and then missed the background probe's font asset;
both were fixed before accepting comparisons. Origin-coordinate experiments identified native's
half-advance/subtractive offsets. The initial contour checker correctly rejected six scaled-glyph
AA-overlap pixels; it now requires two overlapping horizontal outline boundary segments there.
The fitted-background counterexample was a geometry failure and required the runtime correction.

An early broad changed run was stopped before the fitted-background source edit; it had two
stale-demo failures in the base web suite. Browser artifacts were rebuilt before the final frozen
run. The first after-size/perf results were superseded by the fit correction and are not the final
measurements. The later Chromium canonical-format failure is retained with its passing corpus
retry. An attempted Prettier invocation on .animl was rejected (no parser); AniML was subsequently
formatted with its own registry formatter. No inherited timeout, assertion or image budget changed.

Final isolated retries preserve the original limits: contour raster evidence **1 passed /1 failed**
(5000ms timeout,6593ms body); module-order **0 passed /1 failed** (30000ms timeout). Both timed
failures persist in isolation and remain unresolved; no load-only explanation is asserted.
Standalone underlying-output audits are recorded separately and do not turn these timed failures
into passing tests. The final broad command remains exit1; general green CI is not claimed.

Standalone audits pass: all **9 raster records equal the committed evidence**, with zero
non-edge differences; all **12 registration-order outputs have identical SHA-256**
`89b2c9ea4a8fd75cdeeb4fbe95aa8c2129b9e9e099649888bf8fb53a7de7a64f` (6557213 bytes each,
74.98s at the same two-process concurrency). See effects-verification/module-order-direct.json
and raster-direct.txt. These output checks expose no geometry/schema mismatch, but both original
timed tests remain failing. No timeout is raised, and no all-green broad rerun is claimed.
