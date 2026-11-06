# Pc implementation verification

**Pc is incomplete. Full check is red.** All numeric comparison limits remain unchanged.

The required default-concurrency `npm run check` finished with **1413 passed / 14 failed**:
12 pixel findings below; the corpus census expected 41 rather than the new 44 cases (fixed and
scoped verification passed); the previously documented Chromium standalone-demo test exceeded its
unchanged 15 s timeout. The demo subsequently passed alone in both engines. A later canvas+web
scope reproduced the 12 pixel findings and demo timeout, plus an idle-test race; draining pending
paint notifications before the unchanged 200 ms idle interval fixed that race in targeted checks.
No green full check is claimed, and the full suite was not repeated after these scoped fixes.

Final verification: typecheck, ESLint, Prettier, module generation, all size budgets, browser
artifacts (14 entries) and AniML artifacts (60 documents) pass. Core/conformance/oracle/markup scope:
**184/184**. Canvas host tests: **14/14** across both engines; isolated demo/colour/interaction
recheck: **8/8**. No TODO probes or test skips are used to hide canvas findings. Vitest's reported
skips on targeted runs are name-filter exclusions, not source-level skips.

Final min+gzip sizes (unchanged measuring method): canvas **4114/8192 B**, core+web **17963 B**
against **17789 B** before Pc (**+174 B**, only the renderer hook; no core source edits),
SVG full-featured total **44537 B**, Rive-class total **48570/256000 B** (47.4/250 KiB).
All pre-existing module budgets pass without an increase.

The final browser-only bell cost is **394.0 µs/frame Chromium / 438.3 µs/frame Firefox** (step +
draw, 600 frames, median of 3 after warm-up). Under full-suite contention, before the single-paint
opacity optimization, the same probe observed 1044.8 / 1313.3 µs; these are not a speedup claim.
Node's unchanged perf workload: bell compile 2.29 ms / 9040 prefixes 686 ms; bell/composite/toolbar
step+draw 43.7 / 28.1 / 32.6 µs; toolbar compile 4.37 ms. Previous logged P5/D3 scratch numbers were
2.03 ms / 792 ms, 34.6 / 22.9 / 27.0 µs and 2.93 ms respectively, from another session/load.
No Node Canvas line is added: Node 24 lacks DOM Path2D and Canvas2D; browser measurement is required.

Fully rendered feature groups (21): Path2D paths; primitives/parametric shapes; solid colours;
CSS slots/currentColor; linear gradients; radial gradients; stroke width/cap/join; grid dashes;
fixed strokes; transforms; visibility; isolated opacity; clips; alpha/inverted-alpha masks;
luminance/inverted-luminance masks; blend modes; images; image patterns/modulation;
components/instances; n-slice; knockouts.

Partial groups (3): trims (partial fixed-stroke trims decline); local feather (nonuniform/sheared
local transforms decline); world feather (nonuniform viewport scaling declines). These report
`unsupported-render`; world feather **does** support nonuniform node transforms.
Thus 21/24 groups are implemented across their declared transform modes; 3/24 have explicit limits.
This count describes implemented paths, not passed pixel parity; findings below take precedence.

Host operations are not static Rive image capabilities; the three generated oracle directories
carry explicit no-faithful-counterpart notes. No Rive command was run.

## Cross-backend findings

59 visual documents, 169 authored frames per engine; **326/338 comparisons within limits**.
Every frame's maximum and raw over-threshold pixel count/share is committed in `measurements.json`
(from the required full run); the subsequent canvas+web scope reproduced all 12 raster findings.
Both backends render at 240×240, threshold strictly >16. Raw failure PNGs remain in ignored
`artifacts/`; rerun `npm run test:scope -- canvas` to regenerate.

| Engine | Within / frames | Worst channel delta | Worst share over 16 |
| --- | ---: | ---: | ---: |
| Chromium | 160 / 169 | 255 | 0.934028% |
| Firefox | 166 / 169 | 254 | 0.649306% |

| Engine | Finding | Frame indexes | Max | Share over 16 |
| --- | --- | --- | ---: | ---: |
| Chromium | `examples/paint.ani` | 0 | 172 | 0.934028% |
| Chromium | `examples/paint.ani` | 1 | 172 | 0.918403% |
| Chromium | `spec/conformance/paint-mask-inverted-luminance/case.ani` | 0 | 254 | 0.631944% |
| Chromium | `spec/conformance/paint-mask-inverted-luminance/case.ani` | 1 | 254 | 0.631944% |
| Chromium | `spec/conformance/paint-mask-inverted-luminance/case.ani` | 2 | 254 | 0.631944% |
| Chromium | `spec/conformance/bind-over-state/case.ani` | 1 | 255 | 0.276042% |
| Chromium | `spec/conformance/bind-over-state/case.ani` | 2 | 255 | 0.527778% |
| Chromium | `spec/conformance/bind-number/case.ani` | 1 | 255 | 0.385417% |
| Chromium | `spec/conformance/assets-image/case.ani` | 1 | 129 | 0.520833% |
| Firefox | `spec/conformance/paint-mask-inverted-luminance/case.ani` | 0 | 254 | 0.649306% |
| Firefox | `spec/conformance/paint-mask-inverted-luminance/case.ani` | 1 | 254 | 0.649306% |
| Firefox | `spec/conformance/paint-mask-inverted-luminance/case.ani` | 2 | 254 | 0.649306% |

Chromium normalized circle dashes/trims differ from Canvas grid-length dashes. An investigative
browser probe measured `getTotalLength()` = 49.941574 for an SVG r=8 circle, versus 2πr = 50.265482;
normalization is a suspected contributor, not a proven complete explanation. Canvas retains core
length semantics. Inverted-luminance mask edges are visibly aliased in the existing SVG filter
output, whereas Canvas coverage is smooth. The image-frame difference also remains open.
Fixing the default SVG backend or broadening a raster tolerance is not smuggled into this task.

An additional fractional image-modulation probe observed a 128→129 red-channel Canvas readback in
Firefox at alpha 128 (byte premultiplication); the exact primary-channel modulation/alpha test
passes. No raster limit was widened. The initial rounded-corner classifier omission was corrected
to use the predeclared curved-geometry class; neither numeric class limit changed.

No Rive command/source/binary was used. The module has no runtime dependencies. SVG remains the
default. Actual implementation branch: `t3/canvas-renderer-backend` (owner integration branch:
`pc-canvas`). No push, PR or merge. Host/backend parity rows remain planned because Pc is unfinished.
