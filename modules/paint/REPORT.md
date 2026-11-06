# P4e-5 paint findings and SVG gaps

Implementation and root-cause work is complete with the permitted rasterisation findings.
**Strict count: 10/18, up from 3/18; eight original pixel comparisons still fail.** Those eight
have numerical rasterisation evidence below; they are not relabelled strict passes. No parity
status fields, budgets, timeouts or oracle tolerances were changed. P4e as a phase remains open.

## Restoration and changes

- `c849aae`: merged the saved `dbdcabe` WIP, preserving both WORKLOG sides.
- The finishing commit corrects rounded geometry, fractional additive rounding and diagnostic
  pointers; verifies clockwise hits and portable per-paint SVG; finishes native captures and
  numerical evidence; removes scratch files. See the branch log for its SHA.
- Restored `tools/oracle.ts` byte-for-byte to `21b8a20`. The WIP had added a Canvas branch there.
  Canvas-only native probes instead live in `modules/canvas/test/web/native-paint.test.ts`, using
  the **same original comparator, original inputs and max 2 / 0% thresholds**. They run in both
  Chromium and Firefox. The shared SVG-only runner has three explicit backend skip notes; none
  silently becomes a successful SVG comparison. Angular remains a failed Canvas comparison.

## Capability results

| Capability | Root cause and result |
| --- | --- |
| angular gradient | Native screenshot uses periodic ramp filtering at the seam; full evidence below. Canvas implements the specified conic gradient; portable SVG refusal retained. |
| gradient transform | Native `transformRotation`/`transformX` fields were ignored by this local renderer: flagged and untransformed PNGs are identical. The WIP's independently transformed endpoint reference passes max 1 / 0%. No new change to that input/reference during this resume. |
| sequential trim | Native commands exactly equal Anima; remaining difference is stroke rasterisation. |
| synchronized trim | Native commands exactly equal Anima; remaining difference is stroke rasterisation. |
| effect order | Both trim→dash and dash→trim produce the native stroke regions. Native emits an extra overlapping dash fragment; rendering the observed union in resvg is byte-identical to Anima. Fixed native comparison passes max 95 / 0.173611% under its original 110 / 0.3% limits. |
| shared effects | Both uses start from their own input path. Observed native paths rasterize identically in resvg. Native comparison passes max 95 / 0.045139% under original 110 / 0.3%. |
| additive blend | Canvas `lighter` matches native **max 0 / 0%**, both engines. Portable SVG refusal retained. |
| additive strength | Original bug scaled the source contribution. Correct result is S + D(1−Sa(1−a)). WIP's two draws also caused double 8-bit rounding (blue 79 instead of 80 at strength 0.5); fractional strength now evaluates once in premultiplied space. Native 128/255 comparison **max 1 / 0%**, both engines. |
| per-paint blend | Firefox isolated descendant blends below transformed groups. Blend wrappers now enclose inner world-transform wrappers; node opacity/masks retain isolation. Native SVG comparison **max 1 / 0%**. Ten regression variants pass both browsers, covering transforms, reflection, opacity, masks, clips, outside strokes, gradients, ordered paints, contours and animation. |
| clockwise fill | Added module fill-containment hook. Positive local winding, implicit closure, holes, intersections, reflections, stroke and padding are tested; conformance now clicks negative, positive and hole regions. Native rendering **max 1 / 0%**. |
| geometry origin | Existing origin subtraction is correct; native **max 1 / 0%**, preserved. |
| straight vertex | Native commands exactly match; stroke rasterisation finding below. |
| mirrored vertex | Native controls exactly match; stroke rasterisation finding below. |
| asymmetric vertex | Native controls exactly match; stroke rasterisation finding below. |
| detached vertex | Native controls exactly match; stroke rasterisation finding below. |
| rounded vertex | Real geometry bug: quadratic corners differed from native controls. Now uses one shared cutback and natural-rounding cubic controls. Original probe controls match within 0.0001 px; auxiliary acute/right/obtuse control probes pass. Attribution and MIT license in root NOTICE. Residual difference is stroke rasterisation. |
| host renderer | Existing renderer bridge/lifecycle tests remain green; host-only native skip retained. |
| host factory | Existing custom factory/resource/lifecycle tests remain green; host-only native skip retained. |

The 10 strict capabilities are geometry origin, clockwise fill, gradient transform, effect order,
shared effects, per-paint blend, additive blend/strength and the two existing host bridge rows.
The original count also included those two host rows; they are not new native pixel comparisons.

## Every remaining pixel finding

The original images and comparison remain unchanged. These numbers are **not** filtered scores.
Percentages count pixels whose maximum RGBA channel difference exceeds the original threshold 16.

| Finding | Max delta | Pixels over 16 | Percent | Fixed maximum / percent |
| --- | ---: | ---: | ---: | --- |
| straight vertex | 153 | 162 | 0.281250% | 110 / 0.3% |
| mirrored vertex | 142 | 216 | 0.375000% | 110 / 0.3% |
| asymmetric vertex | 141 | 206 | 0.357639% | 110 / 0.3% |
| detached vertex | 153 | 100 | 0.173611% | 110 / 0.3% |
| rounded vertex after fix | 153 | 160 | 0.277778% | 110 / 0.3% |
| sequential trim | 95 | 25 | 0.043403% | 2 / 0% |
| synchronized trim | 95 | 26 | 0.045139% | 2 / 0% |
| angular gradient | 50 | 136 | 0.236111% | 2 / 0% |

Path evidence: identity native scripted path effects dump the commands **after** native effects.
Six paths/controls match exactly at 12 px/unit; rounded controls match within float32/serialized
precision. `probes/raster.ts` renders those independent native commands in resvg: max **0** for
all except detached, which has max **12**, zero pixels over 16, despite exactly equal mathematical
controls (different coordinate/transform representations in resvg). Every native difference over
2 in all nine path/effect probes is confined to the one-pixel stroke fringe; fully interior and
exterior pixels above 2: **zero**. This separates geometric errors from rasterisation without
changing the original oracle. Tests recompute `probes/raster.json` and check observed controls.

Angular evidence: all **156** pixels differing above 2 are on row 0; other rows have max 2 and
zero pixels above 2. Inference from the pixels: the native rasterizer bilinearly samples a periodic
**512-texel** colour ramp. That model predicts **every channel within 2**, with zero channels over
2; 128/256/1024 models instead reach max 57/38/38. An independent black-to-white holdout also
matches within 2 with zero channels over 2. Changing the authored native gradient centre from
(0,0) to (120,120) produces a byte-identical PNG, confirming a separate local CLI/renderer field
limitation; the resume does not assert native centre/ray-field parity. These are auxiliary probes,
not replacements for the fixed original image. See `probes/angular.json`, `angular-finding.json`
and the recomputing evidence test. Canvas is not modified to reproduce native texture filtering.

## SVG decisions

Per-paint ordinary blend modes have a faithful SVG implementation. Retained DOM and static
serialization share it; the module runs after surface/composite/contour. Moving transforms inside
blend groups avoids Firefox's accidental isolation while preserving authored opacity/masks.

Additive remains `unsupported-render`: `plus-lighter` gives the correct [160,128,128] in both
browsers, but resvg silently gives [128,64,32]. Explicit backdrop arithmetic through `feImage`
works in resvg/Chromium but gives [128,64,32] in Firefox. `BackgroundImage` arithmetic also fails.
No portable faithful supported-engine form was established. Errors point to the authored node
mix or paint object, with a code, message and Canvas hint; nested ordered paint pointers are tested.

Angular remains `unsupported-render`: SVG has no native conic paint primitive. Finite 64/256/1024
wedge probes produce max 62/72/101 and 9.15%/34.98%/97.15% over 16 in Chromium; Firefox shows the
same seams. No wedge approximation or static raster embedding is shipped. See `probes/svg.json`.

## Verification

| Command | Result |
| --- | --- |
| `node tools/oracle.ts --strict` | exit 0; **126 cases / 320 frames**, no strict failures. Seven paint findings remain in the shared runner; angular is retained in the Canvas suite. |
| `node modules/paint/probes/canvas.ts` | both engines: additive 0 / 0%, strength 1 / 0%; angular finding 50 / 0.236111%. |
| `npm run test:scope -- paint contour mix canvas composite conformance oracle` | **3436 passed**, 28 files, Chromium + Firefox included, no pending tests. |
| `npm run test:scope -- mix --no-browser` after diagnostic pointer fix | **530 passed**, 4 files; 235 unrelated conformance tests filtered. |
| contour evidence rerun after holdout additions | **39 passed**, 5 files. |
| native Canvas browser suite | **6 passed**; four strict comparisons and two exact retained angular findings. |
| `node tools/size.ts` | all module and aggregate budgets pass; table below. |
| `npm run test:scope -- core --no-browser` | **893 passed**, 90 files, after regenerating the stale schema with `npm run gen`. |
| `node tools/perf.ts` | three main/branch pairs; no observed per-frame regression; noisy timings below. |
| `npm run typecheck`, `npx eslint .`, `npx prettier --check .` | all exit 0. |
| `node tools/modules.ts --check` | 0 stale files. |
| `node tools/build-web.ts --check` / `node tools/build-animl.ts --check` | both exit 0; 21 browser entries and 260 AniML sources. |

Final min+gzip bytes: core+web **19,865** vs main **19,831** (+34). Paint **4,229/5,120**,
contour **3,735/5,120**, mix **1,656/5,120**, canvas **4,494/8,192**. Other modules: markup
7,706/8,192; markup-libraries 1,779/2,048; markup-components/paint/surface each 351/2,048;
markup-bind 121/2,048; composite 3,872/4,096; bind 1,878/2,048; assets 1,501/2,048;
surface 7,754/8,192; components 4,071/4,096; focus 3,801/4,096; input 6,182/8,192;
motion 6,070/8,192; events 3,614/4,096; machine 5,882/8,192.
Full-featured page **75,294 B (75.3 KB)** vs main **69,666 B (69.7 KB)**, +5,628 B;
Rive-class total **79,973 B** vs 73,803 B. No ceiling increased.

Performance: main was measured from an isolated `git archive main` with its own dependencies,
using the unchanged tool, sequentially interleaved with the branch. Machine contention was high;
these establish no observed regression, not a claimed speedup. Medians of the three reports:

| Workload | Main | Branch |
| --- | ---: | ---: |
| bell step + draw | 63.8 µs | 52.2 µs |
| composite step + draw | 37.7 µs | 35.5 µs |
| toolbar step + draw | 44.1 µs | 41.7 µs |
| bell compile | 4.33 ms | 4.50 ms |
| 9040 prefixes | 1088 ms | 824 ms |
| toolbar compile | 7.31 ms | 5.29 ms |

Raw main→branch frame pairs (bell/composite/toolbar µs): 61.7/32.1/32.9 →
36.0/22.8/29.6; 142.6/74.8/88.3 → 82.0/56.2/52.9; 63.8/37.7/44.1 → 52.2/35.5/41.7.
Fractional additive software compositing incurs readback only on documents using that feature.

## Failures, limits and provenance

- Initial scoped launch failed because this fresh worktree had no node_modules; `npm ci` fixed it.
- First restored scope: 3421 passed / 5 failed. Three failures exposed the WIP's unsupported
  SVG-only oracle dispatch; two exposed blue-channel double rounding. Corrected as above.
- Broader core verification found the committed schema stale after module reordering (892 pass / one fail); `npm run gen` regenerated it, then all 893 passed.
- Initial ESLint found six WIP/new test hygiene errors; fixed without changing assertions.
- Prettier initially found two generated browser metrics artifacts; formatted after the suite.
- **18/18 strict pixel parity was not achieved.** The eight original failed comparisons above
  remain visibly failed and are accepted only as documented rasterisation findings, as allowed
  by the task. Canvas-only PNG output through the SVG-only CLI is still unsupported.
- No runtime dependencies added. No data/bind/components implementation edits, oracle tool edits,
  threshold changes, inventory promotion, push, PR or merge into another branch.
- Only local Rive commands were used; no binary was read or converted. No CLI documentation or
  source text is copied. Natural-rounding mathematics follows the MIT runtime and is attributed
  in SPEC and NOTICE. Existing architecture/registry/renderer choices follow
  `docs/research/rive-format-and-graph.md` and `docs/research/rive-web-runtime.md`.
