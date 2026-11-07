# P6-8 original-font native text probes

All references use our deterministic `fixtures/fonts/anima-test.ttf`, including U+2026 added
by P6-4. Its SHA-256 and raw measurements are in `text-measurements.json`. No external font,
proprietary document read/conversion, source implementation or CLI documentation text was used.

Reproduce the 22 completed cases with `python3 tests/oracle/capture-text.py <case names>` and
`node tools/oracle.ts --strict`. The helper invokes only `~/.rive/bin/rive . --commands=commands.txt`
in each source project, records its session, and deletes generated build/binary outputs without
opening them. The font-size endpoint uses native advance 0.501s after 0.5s because its float clock
otherwise remains before the final key; Anima samples exactly 1s. The text-binding screenshots at
labels 0/1/2 represent three settled values, not elapsed seconds: `abcd`, `WXYZ`, `abcdefgh`.

## Passing comparisons

The manifest appends 18 layout cases, live string binding (three samples), animated font size
(two additional samples), and three original-font decode/selection cases. That is **22 new cases,
26 samples**. Font format native evidence is the generated TTF; CLI unit tests separately verify
OTF/CFF, WOFF and WOFF2 decoding, including transformed metrics. Broader native container coverage
is not claimed.

All new cases use the existing raw 240×240 RGBA comparison, threshold strictly greater than 16.
There is no blur, alignment, resampling, edge exclusion or alpha correction. Explicit 1-em leading
is set in both scenes: Anima uses an em multiplier; native style `lineHeight` uses pixels, so size
12 uses lineHeight 12, and size 24 uses lineHeight 24. Wave-1's line-spacing RML incorrectly passed
2 as pixels for Anima's multiplier 2. Correcting that fixture alone does not resolve the leading
placement difference below.

Measured differences in passing samples are max channel delta 32 at 2–14 pixels (0.003473–0.024306%
of the full frame), except baseline origin and uniform fit (max 1, zero pixels over 16). Inspection
of the pixel coordinates and diff support confines these to the generated rectangular glyphs'
fractional corners: e.g. wrap differs at (7,3), (19,3), (7,9), (19,9), (5,15), (5,21), each by 32.
The reproducible `node tests/oracle/check-text-contours.mjs` check derives corners from original-font
outlines and layout positions and confirms all over-threshold pixels touch those corners in all
22 cases / 26 samples (`text-contour-check.json`). No solid interior or whole edge is displaced. Limits add four channel levels and two pixels of
headroom **per case**, using its largest measured sample; exact zero-over cases retain zero.
The largest allowed percentage is 16/576 = 0.027778%, not a shared general text allowance.
Native MSAA and resvg coverage differences are handled by the same method as README.md.

Each completed case contains the actual font asset in its Anima source, so the strict runner and CI
need neither a system font nor a `--font` override. References were recaptured with the current font;
old ellipsis/reference bytes were not reused. Existing oracle cases/limits/findings are untouched.

## Retained geometry differences and incomplete rows

These probes stay marked TODO and are **excluded** from successful comparisons. Their fresh native
captures, Anima outputs and raw metrics remain committed; no passing budget is assigned. Run
`anima render tests/oracle/<name>/case.ani --size 240 --background '#ffffff' -o /tmp/probe.png`
to reproduce them (or invoke `node packages/cli/src/main.ts render …`).

| Case | Measured max / pixels over 16 | Remaining issue |
|---|---:|---|
| text-leading-default | 255 / 106 | Native dark-pixel bounds [0,3,19,21], Anima [0,4,19,23]. The tool uses the font's 100/1000 lineGap with split leading; native automatic leading differs. Explicit leading comparisons do not claim default identity. |
| text-line-spacing | 255 / 291 | Even with native lineHeight 24 pixels, first lowercase bounds start at y=3 versus Anima y=9. Anima splits extra leading above/below; native first baseline stays at its ordinary ascent. |
| text-fit-baseline | 255 / 178 | Baseline-excluded font-size fit still selects different geometry. |
| text-fit-layout-measure | 255 / 204 | Native dark bounds [0,2,41,7], Anima [0,3,46,7]; fitted font-size selection/reported-box equivalence remains open. |
| text-overflow-fit-font-size | 255 / 204 | Same font-size fitting difference, not the passing uniform-scale fit. |
| text-overflow-ellipsis | 255 / 72 | Current U+2026 font recaptured; native [0,1,42,9], Anima [0,1,41,9]. Selection/placement differs; adding a glyph alone did not fix it. |
| text-vertical-trim | 128 / 94 | Native [0,3,27,9], Anima [0,2,27,8], including after packed native trim flags 257. Cause unresolved. |
| text-run-list | 32 / 8 | Literal native control only; native `Text.textRunListSource` exists. It needs an actual list-bound scene and mutations; this is not a no-counterpart skip. |

`data.property-text-style` still needs a faithful native typed style-property assignment comparison.
`text.flatten` retains the P6-4 report's component/live-reference/general-SVG limitations and lacks
independent native outline conversion evidence. No completion claim is made for either.

`text.variable-axes` and `text.opentype-features` still have only CSS helper mapping: text's style
registry does not accept axes/features. Actual authored rendering/animation needs implementation and
independent native evidence. `text.font-decoding` does not yet expose derived-font axes/features;
`text.font-metrics` lacks complete integrated introspection/independent evidence. Their conformance
and oracle TODOs remain. The original tool-reader tests are useful partial evidence, not closure.

## Host/tooling skips and deterministic resource probes

Each skip has a `skip.json` with its specific reason, test paths and capture evidence. Browser-only
FontFace decode, per-host catalogs and fallback callbacks cannot be supplied through native local
headless font assignment: the retained data-property probe omits font values and rejects setter
paths. These skips do not claim equivalence between browser shaping and native shaping. Existing
Chromium/Firefox tests cover visible bound font replacement, nested aliases, missing glyph fallback,
weight selection, readiness, queued writes, cleanup and invalid font diagnostics.

Named/nested host text access was attempted through the permitted native command file; `text-run`
is rejected as unknown. The CLI offers view-model data assignment, not a JS named-run handle.
Anima's actual named-run replacement, persistence and sibling isolation are independently covered
by generated-font conformance and browser tests. Live string-binding screenshots are evidence for
binding only, not a surrogate named-run API.

Build-time glyph policies and Google import receive explicit no-faithful-counterpart skips. Native
screenshots cannot prove retained unused font tables/payloads, and proprietary binary inspection is
forbidden. Own tests inspect original-font subsets and exact all-policy bytes, including nested /
bound default coverage and implicit ellipsis. Google tests mock bounded HTTP transfers; no real
network import is claimed.

Eight font conformance scenes now exercise real generated-font resources, a typed asset-ref write
from `body` to `alternate`, a bound text font and independently calculated geometry: four 600/1000
advances at size 2 give width 4.8, 1-em height 2 and baseline 1.6. They prove the deterministic
resource-id projection, **not** Node FontFace decoding. The latter remains browser evidence.

These fixture mappings follow the independent scene construction in
`docs/research/rive-format-and-graph.md` and backend comparison cautions in
`docs/research/rive-web-runtime.md`. Runtime source and existing size limits are unchanged.
