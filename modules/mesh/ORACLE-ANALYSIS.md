# P8-5 mesh oracle analysis

These are the existing unmodified 240 × 240 native and CLI captures, compared with the
oracle's maximum absolute RGBA channel delta, strictly greater than 16. The classifier checks
that every input diff PNG agrees with that calculation. Coordinates are pixel centres in the
12 px/unit viewport. It uses the authored triangle vertices and their linearly interpolated
positions, finds shared triangle edges, and measures Euclidean distance to finite segments.
Outer edges take precedence where the 1 px bands meet; then internal seams; then points
inside a triangle; all others are elsewhere. Thus the four columns partition every over-16
pixel. Reproduce with `node modules/mesh/probes/classify-oracle.cjs`.

| Case | Time (s) | Internal seam ≤1 px | Outer edge ≤1 px | Interior | Elsewhere | Max delta | Over 16 / 57,600 |
|---|---:|---:|---:|---:|---:|---:|---:|
| rigging-mesh | 0 | 184 | 8 | 0 | 0 | 53 | 192 (0.3333%) |
| rigging-mesh-animation | 0 | 92 | 64 | 0 | 0 | 73 | 156 (0.2708%) |
| rigging-mesh-animation | 0.25 | 92 | 138 | 0 | 0 | 81 | 230 (0.3993%) |
| rigging-mesh-animation | 0.5 | 92 | 133 | 0 | 0 | 82 | 225 (0.3906%) |
| rigging-mesh-animation | 1 | 92 | 64 | 0 | 0 | 73 | 156 (0.2708%) |

The static triangles form two unwarped affine rectangles. A control rendering the same
source image as two undivided SVG images through resvg, against the same native PNG,
reduces max 53 / 192 over-16 pixels to max 7 / **zero** over-16 pixels
(`node modules/mesh/probes/flat-control.cjs`). This supports per-triangle clipped
rasterization and coverage/compositing as the cause of the seam differences. The animated
outer-boundary pixels additionally follow the moving diagonal silhouette; the native and
resvg renderers have different edge coverage. The CLI uses clipped SVG triangles without
Canvas's 0.5 device-pixel clip dilation: that dilation cannot explain these oracle PNGs.
The static control and spatial classification support an AA explanation for these fixtures;
they do not prove a particular rasterizer's exact subpixel algorithm.

Sampling was checked independently using the authored triangle geometry, barycentric UVs,
the original 8 × 4 texture, clamped bilinear samples at pixel centres, and samples at least
1 px from every triangle edge (`node modules/mesh/probes/sampling-control.cjs`). For the first
mesh rectangle, the control covers 3,960 pixels; animated frames cover 4,776–5,120 pixels.
Against ideal bilinear, native differs by at most 1 channel level and CLI by at most 6–9;
none of these control pixels differ by more than 16. A half-texel shift or nearest sampling
would give 1,376–1,770 or 860–1,114 over-16 pixels respectively in the CLI control. The
texture is identical byte-for-byte in both native projects and the Anima fixture (SHA-256
`339386eb3c68036b467de026a6e97bed6d9ef6e8e8b0aea81bb84c71fce12df4`). Its colours vary
only vertically, so this pixel control checks V and the interpolation convention, but cannot
independently detect a horizontal U error; the explicit UV ordering and affine mapping also
have existing core tests. Every source texel and both rendered frames are opaque: straight
and premultiplied alpha give the same result here, so this fixture cannot test translucent
texture handling. No sampling or geometry error explaining an over-16 pixel was found, and
no runtime or CLI change is justified by these observations.

For these specific captures, a proposed threshold is **16**, with max delta **70** and
max over-threshold percentage **0.40%** for `rigging-mesh`, and max delta **100** and
**0.45%** for `rigging-mesh-animation`. These leave 17–18 channel levels and about
0.05–0.067 percentage points above the observed maxima, while retaining the full-frame
comparison. They resemble the existing contour AA budgets for `path-morph` (65 / 0.40%)
and `star` (80 / 0.45%); unlike a generic image allowance, all observed over-threshold
pixels are on independently calculated seam or silhouette bands. The orchestrator owns
promotion and budgets; `tests/oracle/cases.json` remains unchanged.
