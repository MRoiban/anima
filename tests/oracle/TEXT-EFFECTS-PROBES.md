# P6-9a effects and text accessibility closure

Fourteen native/generated-font render controls are accepted (the thirteen original effects
controls plus a fitted-background regression); fifteen of the seventeen ticket rows
close. `text.modifier-variation` and `a11y.tree-bounds` remain planned for the specific gaps below.
The original Anima font is the only font used. No external font, reference-runtime source,
proprietary documentation prose or binary animation was read or converted.

## Reproduction and mappings

Run `python3 tests/oracle/capture-text.py <case names>` for the fourteen cases listed below, then
`node tests/oracle/measure-effects.mjs`, `node tests/oracle/check-effects-contours.mjs` and
`node tools/oracle.ts --strict`. The capture helper records local headless sessions and deletes
all generated binary/build artifacts without opening them. It invokes only the permitted local
`~/.rive/bin/rive . --commands=commands.txt` route. The pixel helper regenerates only these owned
Anima files/raw measurements; it never assigns budgets or edits existing findings.

Both sources use 240×240, opaque white, 12 native pixels per grid unit, and the current original
`fixtures/fonts/anima-test.ttf`. Text starts at (48,48) pixels so rotated glyphs remain visible.
Anima `line-height="1"` maps to native `lineHeight="12"` at size 12; automatic native leading is
not asserted. The earlier P6-5 captures did not embed the font in the Anima side and used automatic
leading. Correcting the scene mapping resolves their baseline/range differences without any
runtime source change. Font hash: see `effects-verification/checks.json`.

- Translation is (24,36) native pixels / (2,3) grid units; rotation is π/2 / 90 degrees.
- Native rotation/scale pivots include half the horizontal advance and **subtract** authored
  origin offsets. Anima uses additive offsets from each cluster's baseline-left. For this font,
  advance is 7.2 pixels: native originX=3.6, originY=0 expresses Anima's default pivot. The origin
  control uses native (-8.4,9.6), expressing Anima's (12,-9.6) pixel baseline-left offsets.
  The paired scale is (2,3). These are different parameter conventions expressing equal geometry;
  no pixel alignment/translation is applied after capture. Anima keeps its normative convention.
- Follow-path uses the same straight baseline (0,24)→(120,24). Native targets are scene-space
  shapes, so its target is translated (48,48) with the text. Anima's string path is text-local.
  Curves remain Anima's documented fixed-chord approximation; native curved-path/shaping identity
  is not established by a straight control.
- Word range [1,2) hides `cd`; run-local range [1,2) in `last` hides only `d`. Native units are
  words/characters respectively. Anima glyphs are grapheme clusters, with independent Unicode
  and line-unit tests; the native ASCII control does not establish complex-script index identity.
- Falloff [2,3), width 2 gives weights [0,.5,1,.5,0]. The native ramps from .5→2.5→4.5;
  its character centers produce the same weights. Easing uses cubic(.42,0,1,1) on these weights.
- Combine starts with [0,4), multiplies [1,3), subtracts [2,3), retaining glyph 1 only. Anima
  `intersect` maps to native `multiply`. Additional add/max/replace and run/line scopes have
  independently authored numeric tests. Native's other combination modes are not Anima fields.
- Background is the first run's advance rectangle with red fill and zero radius. Rounded and
  negative-tracking background behavior remains independently tested under the Anima contract.
- Variation uses native axis tag 2003265652 (`wght`), value 700. It changes the original font's
  outlines. This comparison proves that axis only, not arbitrary-axis Canvas support.

These mappings follow independent scene construction and platform separation in
`docs/research/rive-format-and-graph.md` and `docs/research/rive-web-runtime.md`; they copy no
reference implementation algorithm.

## Pixel measurements and acceptance

The unmodified oracle compares raw RGBA; threshold is strictly greater than 16. There is no blur,
resampling, translation, masking, alpha correction or edge exclusion. Each new case adds four
channel levels and two pixels of headroom to its own measured maximum/count; cases with zero pixels
over 16 keep zero. The exactly equal follow-path control uses max 2, zero over.

| Case suffix | Measured max | Pixels >16 | Allowed max | Allowed pixels >16 |
|---|---:|---:|---:|---:|
| modifier-translation | 32 | 4 | 36 | 6 |
| modifier-rotation | 16 | 0 | 20 | 0 |
| modifier-scale | 63 | 18 | 67 | 20 |
| modifier-opacity | 8 | 0 | 12 | 0 |
| modifier-origin | 32 | 4 | 36 | 6 |
| modifier-variation | 32 | 8 | 36 | 10 |
| modifier-follow-path | 0 | 0 | 2 | 0 |
| range-units | 32 | 2 | 36 | 4 |
| range-falloff | 32 | 2 | 36 | 4 |
| range-easing | 32 | 4 | 36 | 6 |
| range-combine | 32 | 2 | 36 | 4 |
| range-run | 32 | 2 | 36 | 4 |
| background | 32 | 4 | 36 | 6 |
| background-fit | 32 | 2 | 36 | 4 |

Every case name is prefixed `text-`. The largest allowance is 20/576 = 0.034723% of the frame.
`effects-measurements.json` retains exact counts and percentages. The independent contour check
transforms original-font corners through the public drawing matrices (including variation) and
checks every over-threshold pixel. All differences touch corners except six pixels in the scaled
glyph control: each touches two overlapping glyphs' horizontal boundary edges. Those six pixels are RGB64 in Anima versus RGB127 in native, consistent with separately
composited half-covered glyphs versus shared coverage; this raster/compositing explanation is an
inference from the retained pixels and outline positions, not a claim from native source code.
The measured AA maximum is 63. There are **zero non-boundary differences**, no shifted solid interior/edge and no
geometry allowance. The checker fails if a difference leaves this support; it does not alter the
oracle's full-frame comparison. `effects-contour-check.json` retains the classification.

All existing cases/limits/findings are preserved. Fourteen passing controls add fourteen samples.
The wght control is accepted even though the broader variation row remains incomplete.

## Fitted-background correction

A new independent fitted-background control exposed a real geometry error: cluster advances
shrank, but background ascent/descent did not. A 32.4×12 pixel text layout uniformly fits a
16.2×6 pixel box at scale .5. Before correction, the native pair measured max255 / 65 pixels over16.
Multiplying ascent/descent by layout.scale in the owned evaluator reduces it to max32 / two
corner pixels. Both backends consume this drawing output. No text layout code changes.

`spec/conformance/text-background-fit` additionally supplies independent fixed-measurer geometry:
three em-wide glyphs into a 1.5×.5 box give scale .5 and background [0,0,1.5,.5]. Its unit projection
checks the rectangle, rather than relying on the generic snapshot's empty ordinary-values object.
The existing non-fitted and negative-tracking probes are retained. This adds one real conformance
scene, with a one-line marked corpus census seam (569→570). No measurement input or cap changes.

## Evidenced skips and intentional differences

- `text.script-direction`: local Text schema has no authored direction override. The property-name
  observation is committed; no native documentation prose is copied. Browser ltr/rtl/auto and SVG
  direction attributes are independently tested in Chromium and Firefox. A Latin native render
  would not test a forced override. Derived scripting queries remain won't-do with the VM. This
  disposition closes only the owner-retained browser direction scope; existing bidi costs 150 B.
- `text.script-hit-testing`: native local commands expose neither hit/caret/selection queries nor a
  host callback for them without the excluded scripting VM. The retained host/listener contract is
  tested against metric-derived boxes, grapheme boundaries and pointer writes, in conformance and
  both engines. The scripting part is **won't-do**. Existing SKIP.md and the new skip.json state this
  boundary, rather than pretending the native rendering scene measures a hit index.
- `a11y.inferred-text`: an intentional Anima accessibility difference, specified in
  `modules/a11y/TEXT.md`. Two native controls paint ABC while leaving text/container labels empty;
  explicit `Override` survives. Anima supplies the visible resolved text, including through
  nonsemantic/nested/repeated groups, and honors explicit labels including empty strings. The
  original captures, raw semantic trees and independent before/after tests are retained. No native
  label-equivalence pass is claimed. This is an evidenced comparison skip, not a raster budget.

## Rows still planned

- `text.modifier-variation`: arbitrary axes cannot be applied by the current Canvas drawer (only
  wght maps to font weight). SVG and tool outlines support axes, but a derived-face or equivalent
  Canvas implementation with real arbitrary-axis tests is still required. The original generated
  font supplies wght only, so the passing native control cannot certify arbitrary axes.
- `a11y.tree-bounds`: exact painted path/stroke extents remain unimplemented. Text's optional
  consumer supplies layout-advance/line-metric bounds, not glyph ink/stroke outlines. Nontext
  painted bounds require the overlay/tooling seam outside this ticket's owned text parts; the
  existing butt-cap counterexample is still valid. Native automatic-leading differences remain
  visible in the old text semantic control. No approximation is promoted to exact painted bounds.
