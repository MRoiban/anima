# Paint backend implementation report

STATUS: partial. All 18 rows are mapped to implementations or the existing host bridge.
Strict completion is **3/18** (geometry origin, host renderer, host factory). No parity status
was promoted. Native disagreements and pending probes remain visible, not successful cases.

| Remaining P4 row | SVG | Canvas | Completion evidence / remaining work |
| --- | --- | --- | --- |
| drawing-paint.gradient-angular | unsupported-render, reason/hint | createConicGradient | Independent browser colour samples; native oracle pending |
| drawing-paint.gradient-transform | affine matrix | transformed gradient masked by original geometry | Browser comparison; native transform capture differs (finding) |
| drawing-paint.trim-sequential | compiled path | same compiled path | Analytic subpath tests; native raster comparison exceeds fixed limit |
| drawing-paint.trim-synchronized | compiled path | same compiled path | Analytic per-subpath tests; native raster comparison exceeds fixed limit |
| drawing-paint.effect-order | compiled trim/dash stack | same compiled stack | Order-sensitive analytic expectations; native oracle pending |
| drawing-paint.shared-effects | document map expanded per use | same resolved data | Lookup/diagnostic tests; native oracle pending |
| drawing-paint.additive-strength | unsupported-render | source contribution scaled, lighter | Three deterministic animated samples and browser pixel expectations; native oracle pending |
| drawing-paint.blend-additive | unsupported-render | lighter | Browser pixel expectations; native oracle pending |
| drawing-paint.paint-blend-override | unsupported-render | effective per-paint compositor | **Deviation:** nested SVG blending disagrees in Firefox; portable SVG implementation unfinished |
| drawing-paint.fill-rule-clockwise | positive-winding trapezoids | same trapezoids | Native render matches (max 1, 0% over 16); **core hit testing still uses base rule** |
| drawing-paint.geometry-origin | contour origin compiled to path | same path | **Done:** grid origin, transform/round-trip tests, native max 1 / 0% |
| drawing-paint.asymmetric-vertex | compiled cubic | same cubic | Independent handle expectations; native finding |
| drawing-paint.detached-vertex | compiled cubic | same cubic | Independent handle expectations; native finding |
| drawing-paint.mirrored-vertex | compiled cubic | same cubic | Independent handle expectations; native finding |
| drawing-paint.rounded-vertex | quadratic cutback | same quadratic | Explicit authoring contract; native mismatch is retained as intentional difference |
| drawing-paint.straight-vertex | compiled lines | same lines | Independent expectations; native raster finding |
| host-api.factory | existing host factory | existing host factory | **Done:** renderer factory owns paths/gradients/resources; browser lifecycle checks; documented host-only oracle skip |
| host-api.renderer | existing draw bridge | existing draw bridge | **Done:** IconRenderer receives DrawFrame and owns drawing/layout/point/lifecycle; both-engine browser checks |

## Format and ownership

`paint` owns angular gradients and static six-number gradient matrices. `contour` owns the
new contour node, grid origin, static vertex authoring, trim/effect stacks and positive winding.
`mix` owns node mix strength and per-paint blend selection. New optional modules retain their
5120-byte scaffold budgets; existing budgets/tolerances/classifiers/measuring methods were not
changed. Core draw changes are types only. Markup's shared change is an explicit registry opt-in
for compound document attributes, needed to round-trip shared effect maps.

Authoring vertices/stacks/matrices are static and edited by reloading. This is not a vertex
editor or a new vertex-animation API. Legacy paint/composite paths retain their output. The
clockwise rendering field is `fill.winding`, preserving the existing base fill-rule registry;
its positive-winding contract includes self-intersections and is specified in SPEC.

## Native observations

Only locally authored RML and local `/home/jarvis/.rive/bin/rive . --commands=commands.txt`
were used for capture. No Rive source or documentation text was copied, and no `.riv` was read
or converted. Generated binary/scaffold files were deleted. Inputs and reference PNGs are
retained under `tests/oracle/drawing-paint-*/rive/`; the standard capture runner can reproduce
completed/finding cases. Algorithms are independent constructions documented in SPEC, so no
Rive runtime algorithm attribution was added to NOTICE.

Two native render cases pass max 2 / 0% over 16: geometry origin and clockwise fill. Eight new
findings are retained under the original limits (not counted as parity):

| Native finding | Max delta | Pixels over 16 | Limit (max / percent) |
| --- | ---: | ---: | --- |
| straight vertex | 153 | 0.28125% | 110 / 0.3% |
| mirrored vertex | 142 | 0.375% | 110 / 0.3% |
| asymmetric vertex | 141 | 0.357639% | 110 / 0.3% |
| detached vertex | 153 | 0.173611% | 110 / 0.3% |
| rounded vertex | 153 | 0.303819% | 110 / 0.3% |
| gradient transform | 151 | 79.529514% | 2 / 0% |
| sequential trim | 95 | 0.043403% | 2 / 0% |
| synchronized trim | 95 | 0.045139% | 2 / 0% |

The native gradient capture remained horizontal while Anima's explicit matrix produced a
vertical gradient. The cause/observation-path limitation has not been established. Vertex and
trim image differences are not silently dismissed as rasterization noise. Six further native
comparisons remain pending. Strict-oracle success certifies completed cases only; finding
measurements have exact regression tests and are printed separately.

## Verification

- `npm run test:scope -- paint composite contour mix canvas conformance oracle`: **24 files, 3379 passed, 6 TODO**, both Chromium and Firefox. TODOs are the six pending native probes, never parity passes.
- Additional CLI/API tests added after corpus collection: **5 passed** (32 new AniML/JSON probe validations, CLI schema fields and mix diagnostics).
- Cross-backend corpus: **716 image comparisons per engine, 1432 total**, zero failures. Each engine also records six explicit unsupported-SVG observations with canvas pixel expectations. These are not image-comparison passes. Worst measured comparison: Chromium max 92 / 0.206598% over 16; Firefox max 128 / 0.260417%, within each case's unchanged feature limits.
- `npm run typecheck`, `npx eslint .`, `npx prettier --check .`, `node tools/modules.ts --check`: pass.
- `node tools/build-web.ts --check`: pass, 21 browser entries. `node tools/build-animl.ts --check`: pass, 260 files.
- `node tools/oracle.ts --strict`: exit 0 for completed cases; the eight new findings are separately measured and regression-tested. The clockwise native probe includes an isolated negative-winding contour that must remain empty.
- `node tools/size.ts`: pass. Core+web **19831 B** (unchanged); markup 7706/8192; paint **4233/5120**; composite **3861/4096**; contour **3380/5120**; mix **898/5120**; canvas **4293/8192**. Full-featured 74246/102400; Rive-class 78690/256000.
- No runtime dependencies were added. No push, PR or merge was performed.

PROBLEMS: portable SVG per-paint override remains unimplemented; clockwise core hit testing needs an integration seam outside the permitted module/backend scope. Eight native disagreements and six pending probes prevent calling this 18/18 done. Existing parity statuses remain unchanged for the parent to review.
