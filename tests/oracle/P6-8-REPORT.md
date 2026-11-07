# P6-8 implementation report

Status: **partial**. Branch `t3/p6-8-ticket`, based on `0fd483b8`; final head is in the handoff.
Local commit only. No push, PR, publication, external font or proprietary binary read/conversion.

## Rows closed and left

34 rows have completed evidence: 22 original-font native comparisons and 12 evidenced
host/tool-only skips. Strict oracle passes **288 completed cases / 501 samples**, retaining all
existing findings. Successful explicit-leading comparisons do not claim automatic-leading identity.

Closed ids:

- `assets.font`
- `assets.font-formats`
- `assets.font-glyphs-all`
- `assets.font-glyphs-custom`
- `assets.font-glyphs-used`
- `assets.google-font-import`
- `assets.host-decode-font`
- `assets.replacement-scope-font`
- `data.bind-text`
- `data.host-font`
- `host-api.data-font`
- `host-api.font-fallback`
- `host-api.nested-text-run`
- `host-api.text-run`
- `text.font-assets`
- `text.font-fallback`
- `text.font-size`
- `text.horizontal-alignment`
- `text.origin`
- `text.overflow-clipped`
- `text.overflow-fit`
- `text.overflow-hidden`
- `text.overflow-visible`
- `text.paint`
- `text.paragraph-spacing`
- `text.rich-runs`
- `text.sizing-auto-height`
- `text.sizing-auto-width`
- `text.sizing-fixed`
- `text.style-reference`
- `text.tracking`
- `text.vertical-alignment`
- `text.word-break`
- `text.wrap`

13 rows remain planned:

- `data.property-text-style`: native typed text-style assignment still needs a faithful comparison.
- `text.flatten`: native outline-conversion evidence and component/live-text-reference/general-SVG flatten coverage remain incomplete (P6-4 report).
- `text.font-decoding`: browser FontFace load is tested; derived-font axes/features API and independent evidence remain incomplete.
- `text.font-metrics`: original tool reader metrics/coverage/options tested; full integrated introspection and independent native evidence remain incomplete.
- `text.opentype-features`: CSS helper maps tags, but authored text style registry does not yet accept features; actual feature rendering and native comparison remain incomplete.
- `text.variable-axes`: CSS helper maps axes, but authored text style registry does not yet accept axes; actual axis rendering/animation and native comparison remain incomplete.
- `text.run-list`: generated-font layout tested; native literal control is insufficient. textRunListSource exists and needs actual list binding/mutations.
- `text.fit-baseline`: fresh current-generated-font explicit-leading capture retains geometry differences; no tolerance assigned. See tests/oracle/TEXT-PROBES.md and text-measurements.json.
- `text.fit-layout-measure`: fresh current-generated-font explicit-leading capture retains geometry differences; no tolerance assigned. See tests/oracle/TEXT-PROBES.md and text-measurements.json.
- `text.line-spacing`: fresh current-generated-font explicit-leading capture retains geometry differences; no tolerance assigned. See tests/oracle/TEXT-PROBES.md and text-measurements.json.
- `text.overflow-ellipsis`: fresh current-generated-font explicit-leading capture retains geometry differences; no tolerance assigned. See tests/oracle/TEXT-PROBES.md and text-measurements.json.
- `text.overflow-fit-font-size`: fresh current-generated-font explicit-leading capture retains geometry differences; no tolerance assigned. See tests/oracle/TEXT-PROBES.md and text-measurements.json.
- `text.vertical-trim`: fresh current-generated-font explicit-leading capture retains geometry differences; no tolerance assigned. See tests/oracle/TEXT-PROBES.md and text-measurements.json.

See [TEXT-PROBES.md](TEXT-PROBES.md) and [raw measurements](text-measurements.json) for
mappings, exact raw differences, font hash, anti-aliasing budget derivation and native limitations.
All references were freshly captured from the current generated font. The literal run-list control
is still pending and is never counted as live list binding. TTF is natively compared; broader native
container coverage is unclaimed, with original OTF/CFF/WOFF/WOFF2 tool tests recorded separately.

## Seams outside ticket-owned files

- `modules/text/SPEC.md`: a marked P6-8 documentation seam records the existing leading contract's
  native comparison boundary; no format or layout output changed.
- `packages/markup/test/corpus.test.ts`: a marked count seam, 531 → 538, for seven newly completed
  font resource projections (the eighth replaces the existing assets-font case).
- `modules/canvas/test/web/canvas.test.ts`: a marked test-only seam installs declared local font
  assets before corpus enumeration draws text; the previous harness knew only sans-serif. All
  existing pixel classifiers and thresholds are unchanged.
- `tools/parity.ts` and `tools/parity.test.ts`: a marked seam permits individual done P6 rows while
  the phase is incomplete. The old lint required every done row to belong to a wholly finished
  phase. Finished-phase completeness and rejection of done rows in other unfinished phases remain.
- Generated parity MATRIX.md/matrix.json, regenerated by `node tools/parity.ts`.

No runtime source, manifest, budget, oracle finding or measurement tool was changed.

## Verification

Evidence is under `text-verification/`.

- `node tools/oracle.ts --strict`: **288 completed cases / 501 samples, zero failures**, exit 0;
  all 24 existing findings retained. Repeated at the end on unchanged render inputs with the same result.
- `npm run test:scope -- text fonts cli --browser=chromium`: **3315 passed / 3 failed / 530 skipped**.
  Failures: 5s prefix stress and two 30s Chromium font tests. Unchanged-limit retries: prefix
  **51/51**, affected browser files **3/3**. All 12 owned Chromium cases passed across these runs.
- Owned Firefox four-file run: **10 passed / 2 failed / 12 opposite-engine tests filtered**.
  Both failures were 30s text timeouts. Isolated unchanged-limit text-file retry: **4/4 passed**;
  all 12 owned Firefox cases have passed. The initial failed run remains recorded.
- New independent font resource checks: **8/8 passed**. Focused parity/font/corpus verification:
  **1171/1171 passed** across three files.
- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **6308 passed / 5 failed / 40 skipped /
  53 TODO**, 270 passing files / six failed files / 13 skipped files, exit 1 in 950.02s. Seven
  errors comprised five test failures and two setup failures: canvas font alias collection,
  Firefox base-web 30s bundle hook, stale demo cache, Firefox overlay/nested 5s timeouts,
  scaffolder 60s and module-order 30s. This broad command did **not** exit green.
- Browser build restored the missing cold cache; standalone demo retry **2/2 passed** (both engines).
- Full typecheck, final browser-test typecheck, changed-TS ESLint, module wiring, AniML artifact
  checks, parity views, browser artifacts and changed-file Prettier checks: exit 0. Corpus count
  is 538 real conformance scenes; eight font projections include seven newly activated scenes.
- `node tools/size.ts`: exit 0 before/after; every module, all 30 scenes and all six gates pass.
- `node tools/perf.ts`: exit 0 before/after. Bell compile 7.81→7.02ms; bell frame136.6→122.3µs;
  composite92.5→77.9µs; toolbar frame99.3→82.3µs / compile11.98→13.11ms. Shared-host load;
  controlled ≤3% non-regression remains unverified.

Final file retries:

- Canvas complete corpus: **2390/2390 passed**, Chromium and Firefox, unchanged classifiers/limits;
  source fix is only the declared-font installer in its collection harness.
- Overlay first isolated file retry: **43 passed / 1 Firefox 5s timeout**. Final overlay+nested
  serial file retry after the broad run: **54/54 passed**, both engines, original limits.
- Complete base-web file retry: **80/80 passed**, both engines, including the original cold
  Firefox hook and standalone cache assertion.
- First serial tool-file retry: **3 passed / 2 timeouts**, scaffolder 60s and module-order30s.
  Final single-file retries after the broad/browser runs: module-order **1/1 passed** (22.46s
  file), scaffolder **4/4 passed** (42.20s file), at original limits. Both failed retries remain
  retained. Every failed file in the broad run has now passed on final sources; the broad command
  itself remains exit 1 and was not rerun in full after the canvas test-harness fix.
- `node tests/oracle/check-text-contours.mjs`: **22 cases / 26 samples**, every over-threshold pixel
  touches a generated-font glyph corner; zero non-corner differences. This additionally checks
  contour confinement of the accepted anti-aliasing budgets.

## Sizes (min+gzip bytes)

Runtime source is unchanged. Both columns come from the unmodified `node tools/size.ts`.

| Relevant entry | Before | After | Budget |
|---|---:|---:|---:|
| text | 6142 | 6142 | 6144 |
| text-host | 355 | 355 | 1024 |
| markup-text | 529 | 529 | 1024 |
| fonts | 1807 | 1807 | 2048 |
| fonts-text | 532 | 532 | 768 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 21136 | 21136 | 24576 |
| largest scene (30) | 53201 | 53201 | 65536 |
| app-UI | 94697 | 94697 | 131072 |
| runtime sum | 114121 | 114121 | 163840 |
| authoring | 15226 | 15226 | 16384 |
| Rive-class | 119760 | 119760 | 256000 |

Authoring also stays under the design's 15360 B cap. No byte cap was raised.

## Design deviations

The 47-row closure target is only partially delivered. Existing spec layout choices and missing
text-style fields leave 13 rows open, with fresh retained geometry evidence rather than accepted
tolerances. Explicit 1-em leading is the documented native mapping for completed cases. This is
consistent with the design's explicit-leading browser/tool contract, and does not resolve automatic
leading. Eight font conformance cases test deterministic ids/layout; browser-only decode/fallback
is independently tested in both engines. No Node FontFace decoding claim is made.

## Problems and verification history

- First native wrap control loaded the original font. A new default-leading project initially
  failed only because frames/ did not exist; creating it allowed capture. Native lineHeight is
  pixels, fixing the old RML multiplier error. Correct units do not fix first-baseline leading.
- Initial font projection used an unsupported inline `$face` family string, then the explicit
  binding used the wrong `source` attribute. Both failed clearly; the final source uses
  `<bind target="label.styles.s.font" value="$face"/>`, and all eight independent checks pass.
- The first font-size native advance omitted the required seconds suffix; capture rejected it.
  It was corrected to 0.5s / 0.501s and all three native/tool samples pass.
- Named-run native commands are rejected, as recorded in the skip evidence. This is a local CLI
  observation limit, not a claim that the native runtime lacks named-run APIs.
- Shared-host performance timings do not establish the design's controlled ≤3% guard.

- The first broad run exposed a real canvas corpus collection error (`font-missing body`) after
  real font scenes replaced the placeholders. The test-only per-document font installer fixes
  collection; the isolated corpus rerun retains every existing pixel limit.

- Final unit tool retries pass after the earlier failed isolated attempt. Broad/isolated failures
  are preserved with their passing results; no timeout, assertion, raster budget or measurement
  guard was increased. The final complete changed command was not repeated after a test-only
  harness fix, so no full-suite-green claim is made.

- The contour helper first failed JS ESLint on ten missing Node globals; explicit node:url and
  node:console imports corrected it. Final helper lint and all 26 contour checks pass.
