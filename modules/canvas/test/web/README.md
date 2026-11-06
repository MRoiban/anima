# SVG ↔ Canvas browser conformance

`npm run test:scope -- canvas` runs Chromium and Firefox. The corpus is discovered from every
unmarked `spec/conformance/*/case.ani`, `spec/draw-conformance/*/case.ani`, and `examples/*.ani`.
Every existing script snapshot is rendered (replaying the exact script prefix); documents without
a script render at rest and examples additionally sample their authored timeline midpoint times.
Nonvisual documents are omitted. Both renderers use the same document, player, viewBox, CSS colour,
240×240 viewport, and white page background. An isolated host prevents SVG blending with the page
outside the renderer (Canvas necessarily isolates its contents). Neither backend is rasterized
through the other. SVG is retained DOM; Canvas uses Path2D and Canvas2D directly.

For each pixel we take the greatest absolute RGBA channel delta, then report the frame maximum
and the share of pixels **strictly over 16**, without blur, cropping edges, translation, resampling
or colour correction. Limits were set before the first run and must not be widened on a failure:

| Feature | Maximum channel delta | Share over 16 |
| --- | ---: | ---: |
| Flat axis-aligned shapes, solid colours, gradients/blends in interiors | 2 | 0% |
| Curved/path/rounded/dashed geometry, trims, curved clips and masks | 128 | 0.5% |
| Gaussian feather falloff | 128 | 0.5% |

The classifier selects the feature class from the source document. A failure remains a finding;
raw SVG, Canvas and grayscale-difference PNGs plus per-case metrics are retained in `artifacts/`
(ignored). The committed `RESULTS.md` records a verification run, including any failures.
Do not add a special-case allowance for an individual failing scene.

Host tests exercise DPR overrides (1, 1.5, 2, 3), backing resize without player advancement,
unchanged-frame suppression, diagnostics and renderer switching. Automatic browser DPR changes
are observed with a resolution media query; CSS sizing uses ResizeObserver. Pointer routing stays
in the host and core, with the canvas viewport inverse replacing SVG's CTM only for coordinates.

Canvas needs DOM Path2D and a real CanvasRenderingContext2D, absent in Node 24. Per-frame cost is
therefore measured here: bell, step + draw, 600 × 1/60 s frames, ring every 90 frames, one warm-up
and median of three timed runs. This includes raster submission and offscreen composition but not
presentation/vsync. The same probe now measures SVG too: the host's retained-attribute diff and
composite ordering consume the draw frame, with the same step clock, warm-up and timed runs.
Scheduling, host events/a11y and presentation/vsync are excluded from both. SVG submits DOM
attributes while Canvas submits raster commands; these are CPU submission costs, not a comparison
of completed GPU work. `tools/perf.ts` retains its existing Node measurements unchanged.

The separation and comparison cautions follow
[the repository's web research](../../../../docs/research/rive-web-runtime.md#lessons-for-anima).
No Rive implementation, commands or binary files are used.
