# Text module (P6-1)

Normative extension of SPEC §4. Declare `requires: ["text"]`; text remains optional. The base core+web browser bundle
retains its bytes; optional shared seams and their measured growth are listed in REPORT.md. Lengths are grid units. Text is shaped by a registered
measurer: core never consults DOM, system fonts or platform metrics itself. Without a measurer a
layout request throws `text-measurer` at `/requires`, with an import/registration hint. Loading and
sampling text values do not require a measurer. The tool reader and generated font belong to P6-2. `registerTextMeasurer` is the public setter;
`setTextMeasurer` is a compatibility alias for its installer. Layout requests zero tracking from a
measurer and applies tracking itself once, across run boundaries.

## Authoring

A node has `type: "text"`, `id`, and `runs`. A run has `text`, optional `id`, and optional `style`.
`styles` maps names to local styles; document `textStyles` maps shared names to styles. Local styles
override shared names. An absent style uses sans-serif, size 1, weight 400, normal, tracking 0, black.
Styles contain `font`, `size` (>0), `weight` (1–1000), `style` (normal/italic), `tracking`, optional
`lineHeight` and ordinary `fill`/`stroke` paint objects. Paint extensions require their own modules.
Style sizes, weights, tracking, lineHeight and font are addressable at `node.styles.name.field`;
Numeric animation values clamp to the same size/weight/range bounds as authored styles.
Omitted local style fields and run style references retain their defaults when animated;
run strings and references are addressable at `node.runs.index.text|style` for animation and binding.

AniML uses `<text>`, `<style id="…" font="…" size="…" fill="#000"/>`, `<run id="…" text="…"
style="…"/>` and root `<text-style id="…"/>`. Attribute names derive from registry metadata:
`word-break`, `line-height`, `paragraph-spacing`, `vertical-trim-top`, `vertical-trim-bottom`,
`fit-from-baseline`, `fit-font-size-resizes-box`, `text-field`, `style-field`. Compound `styles`,
paint and run values also accept JSON attributes. Origin accepts `baseline`, `top-left` or `[x,y]`.
Browser structural authoring imports `web/markup-text` alongside the compiler; it is authoring-only.

With `data`, a run's `$path` text reads a string model property each step; a `$path` style reads a
`text-style` model property. A `text-style` property contains a shared style name (empty permits the
default style); host assignments validate membership, and `player.data.textStyle(path)` provides a
matching string handle. AniML declares `<text-style name="…" default="…"/>` inside a model; its `name`
distinguishes it from a shared style's `id`. `runs: "$items"` reads a model list; `textField` and
`styleField` default to `text` and `style`. List fields are values, so a leading dollar is literal;
only authored run strings use the binding shorthand. Empty lists produce one empty measured line.

## Layout and coordinates

`Intl.Segmenter('und')` supplies grapheme and word boundaries, across run boundaries. UTF-16 cluster
indices address the concatenated logical string. Explicit CR, LF and CRLF end paragraphs; empty and
trailing paragraphs are retained. Whitespace is preserved, including at line edges.

Greedy wrapping defaults to true. `wordBreak: normal` breaks at word boundaries and preserves an
oversize unbreakable word. `break-word` additionally splits oversized words at graphemes; `break-all`
allows any grapheme boundary. Disabling wrap still respects explicit newlines. `sizing: auto-width`
(the default unless both width and height are supplied) ignores width and measures both dimensions; `auto-height` requires width and measures
height; `fixed` requires width and height. If sizing is absent and both dimensions are present, sizing is fixed. Explicit sizing always wins. Nonnegative dimensions may be zero.

`align` is left (default), center, right, start or end; start/end currently resolve to left/right.
`valign` is top (default), middle or bottom. `origin` is top-left (default), baseline (first line's
alphabetic baseline after fitting, alignment and trimming), or normalized `[x,y]` of the reported box. Node x/y transform the local result.
Line metrics use maximum run ascent/descent. `lineHeight` on a style, then on the node, is an em
multiplier; zero/absence uses font ascent+descent+lineGap. Extra leading is split evenly.
`paragraphSpacing` adds grid units after explicit paragraph separators, never after a soft wrap.
`tracking` adds grid units between clusters, with no trailing spacing in reported width.
`verticalTrimTop` removes ascent above cap or x-height (`none|cap|x-height`); `verticalTrimBottom`
removes the descent and final leading at `baseline` (`none|baseline`).

Lines expose baseline, width, ascent, descent, height and logical clusters. Each cluster has text,
UTF-16 index, run index, x/y, advance and FontSpec. `contentWidth`/`contentHeight` report measured
content, `width`/`height` the chosen layout box, `fittedSize` the first run's resolved size, and `scale`
the rendering scale. Layout object identity is cached until runs, styles, dimensions or font revision
change; transform-only changes preserve it. `invalidateText(player)` refreshes after font replacement.

## Overflow

Non-visible overflow requires fixed sizing. `visible` keeps all content. `hidden` keeps only complete
lines whose baseline+descent fits; horizontal overflow remains visible. `clipped` clips all glyphs,
including partial lines, at the box. `ellipsis` keeps complete lines and replaces the last visible
line's trailing clusters with U+2026 on horizontal or vertical truncation; a box too narrow for U+2026
shows none. An empty-height box has no visible line. `fit` scales the laid-out block uniformly down
without reflow. `fit-font-size` performs 20 bisection iterations over (0,1], remeasuring and rewrapping;
it never enlarges. A zero-width or zero-height fit box renders no lines; font-size fitting reports
`fittedSize: 0` and zero content dimensions without requesting a zero-size font. Uniform fit
reports `scale: 0`. `fitFromBaseline` excludes the first baseline distance from the top from the height fitting criterion.
`fitFontSizeResizesBox` reports the reduced content dimensions in place of the original fixed box.

## Rendering and host access

SVG uses `<text>` per line and `<tspan>` per run fragment, with escaped text content; solid/slot,
linear and radial paints are resolved through paint's gradient helpers. Angular SVG paint retains
paint's unsupported-render diagnostic. Canvas draws runs with fillText/strokeText and the same
coordinates, brushes and clip. Browser measurement uses cumulative Canvas prefix widths, preserves
kerning, and caches up to 512 font/string pairs. Font loading clears measurement/layout caches.
SVG and canvas use geometricPrecision and normal kerning. Canvas prefix measurement also sets textRendering="geometricPrecision": Chromium's default rounding changes AV widths (23 vs 22 px at size 20 in the generated font). Explicit lineHeight is needed for identical browser/tool line leading: Canvas does not expose OpenType lineGap, so automatic browser leading omits it. This retained difference is tested and recorded, never absorbed by widening the 0.5%-of-font-size position tolerance. Metrics are measured at 1000 px and converted back to grid units to avoid integer-pixel ascent/descent rounding at icon sizes; advances still use the authored size. FontBoundingBox metrics fall back to actualBoundingBox metrics; cap and x-height use H and x.
The browser retains text roots; changed layouts replace only their generated contents.

The optional `web/text-host` entry augments `web/text` with named run access; text display and
data binding do not load it. Core clients may import `core/text-host` (also re-exported by core/text).
`textRun(player, nodePath, runIdOrIndex, replacement?)` reads or replaces a run. Component paths use
slash/dot instance separators. Replacements are player-local overrides, survive step, and invalidate
layout without modifying authored data. `<anima-icon>.textRun(...)` exposes the same API and redraws.
It returns undefined for unknown targets. This ticket does not implement bidi, hit testing or effects.

## Diagnostics and verification limits

Registry diagnostics (`type`, `range`, `enum`, `unknown-key`, `missing-key`, `undeclared-feature`)
identify invalid fields with JSON pointers. Semantic `text-box` points at sizing/overflow; `text-style`
points at an unknown run style; `text-source` identifies missing/incompatible data sources;
`text-paint` identifies invalid style paint colors. Semantic errors include corrective hints.
Tests assert codes, pointers and messages; schema diagnostics supply existing hints where available.

Conformance uses the unchanged P6-2 tool reader and original generated font. The small fixed-advance
measurer remains confined to unit tests. Expectations are calculated from fixture metrics, not layout
output. Twenty-five independently authored native render captures exist, with unresolved raw
comparisons retained in verification/native-comparison.json; native data/host interaction evidence
and completed oracle integration remain open. No raster finding or tolerance is suppressed. The architectural
choice of one shared registry and a separate backend follows docs/research/rive-format-and-graph.md
and docs/research/rive-web-runtime.md; no external implementation or proprietary text was copied.

## Font resource integration (P6-4)

Browser scenes combining fonts and text import `web/fonts-text` in addition to `web/text` (the former includes `web/fonts`). The optional fonts hook resolves each style with the host controller's cssFont, waits for ready(spec, actualRunText) before any measurement, and includes both model and root font revisions in its layout/readiness keys. While awaiting readiness the text node draws an empty layout; readiness redraws without advancing the player or consuming queued host input, including on paused hosts. Font asset preload remains part of anima:load; CSS-family text readiness may complete immediately after it. The bridge has no text runtime import, and all DOM work stays in fonts/web. Without the bridge, text retains the CSS-family-only measurer.

<!-- // seam(P6-8): record the measured native leading boundary beside the existing measurer contract. -->

### Native comparison boundary (P6-8)

Anima deliberately uses the tool font's lineGap for automatic leading and splits extra leading
above and below each baseline. Native automatic leading and first-line extra-leading placement
are not equivalent for the original test font. The Anima policy preserves deterministic OpenType
metrics and symmetric authored line boxes. Matching explicit 1-em leading is used for completed
native layout comparisons; default leading, larger leading, font-size fitting, ellipsis and trimming
remain separately pending geometry comparisons. No raster tolerance certifies those differences.
See [the measured native probe report](../../tests/oracle/TEXT-PROBES.md). This documents the existing
Anima contract; it does not change layout output or assert native default identity.
