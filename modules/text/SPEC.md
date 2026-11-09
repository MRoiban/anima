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
Local/shared style paint objects are authored values, not animation or binding addresses.
To bind a colour, put `fill`/`stroke` on the text node and omit the corresponding paints from
the run's style, then bind `node.fill.color`/`node.stroke.color`. To switch complete paints,
bind `node.runs.index.style` to a `text-style` property naming a shared style. An unsupported
`node.styles.name.fill|stroke` binding reports `unknown-address` at the binding with this repair hint.
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

Lines expose baseline, width, ascent, descent, height and logical clusters; a line without clusters
also exposes `x`, its aligned, origin-shifted start (where its caret is drawn). Each cluster has text,
UTF-16 index, run index, x/y, advance and FontSpec. `contentWidth`/`contentHeight` report measured
content, `width`/`height` the chosen layout box, `fittedSize` the first run's resolved size, and `scale`
the rendering scale. Layout object identity is cached until runs, styles, dimensions or font revision
change; transform-only changes preserve it. `invalidateText(player)` refreshes after font replacement.

### Layout measurement hook (P7-1)

`measureText(player, nodeId, maxWidth?)`, exported by `@anima-format/core/text`, returns
`{width, height, baseline}` in text-local grid units, using the registered text module's existing
layout and measurer (including live runs, styles and font readiness). `nodeId` is a local node id
or index; unknown and non-text nodes return undefined. `baseline` is the first visible line's
aligned baseline, or zero without a visible line. Without `maxWidth`, dimensions are the existing
layout box; with a nonnegative width constraint, auto-width becomes auto-height, other sizing is
preserved, and the authored width (when active) is capped by the constraint. The constrained box
retains fixed height, overflow, trim and origin rules. A constrained probe does not replace the
cached drawing layout or mutate the document. This is a consumer hook, not another font measurer.

## Overflow

Non-visible overflow requires fixed sizing. `visible` keeps all content. `hidden` keeps only complete
lines whose baseline+descent fits; horizontal overflow remains visible. `clipped` clips all glyphs,
including partial lines, at the box. `ellipsis` keeps complete lines and replaces the last visible
line's trailing clusters with U+2026 on horizontal or vertical truncation; a box too narrow for U+2026
shows none. An empty-height box has no visible line. `fit` scales the laid-out block uniformly down
without reflow. `fit-font-size` performs 20 bisection iterations over (0,1], remeasuring and rewrapping;
it never enlarges. A zero-width or zero-height fit box renders no lines; font-size fitting reports
`fittedSize: 0` and zero content dimensions without requesting a zero-size font. The same empty
result applies when no bisection candidate fits. Uniform fit
reports `scale: 0`. `fitFromBaseline` excludes the first baseline distance from the top from the height fitting criterion.
`fitFontSizeResizesBox` reports the reduced content dimensions in place of the original fixed box.

## Rendering and host access

The base `@anima-format/web/text` entry supplies SVG drawing, browser measurement and ordinary
layout. Hosts using `hidden`, `ellipsis`, `fit` or `fit-font-size` import
`@anima-format/web/text-overflow` before loading their document; it includes the text entry and
installs the original overflow policies on the active module, including across separately emitted
bundles. Omitting it when requesting those layouts throws `text-overflow` at `/requires` (verbose
tooling includes the import hint). `visible` and `clipped` need no overflow entry. Tooling and
`core/all` retain all policies automatically; JSON/AniML and CLI commands are unchanged.

Canvas text drawing lives in `@anima-format/web/text-canvas`, loaded automatically by
`@anima-format/web/canvas`; canvas hosts keep their existing imports. A host that directly consumes
`canvasShapes` without that renderer imports `text-canvas` explicitly. This entry does not register
text or a measurer and can arrive before or after text. SVG-only pages pay neither its drawer nor
the overflow policies they do not use. Renderer separation follows the optional-renderer rationale
in [the web-runtime research notes](../../docs/research/rive-web-runtime.md), §1; only Anima's
existing code was moved.

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
native layout comparisons; default leading remains an intentional policy difference. Larger explicit leading is compared
with a documented first-baseline translation; font-size fitting, ellipsis and trimming remain
pending geometry comparisons. No raster tolerance certifies those differences.
See [the measured native probe report](../../tests/oracle/TEXT-PROBES.md). This documents the existing
Anima contract; it does not change layout output or assert native default identity.

<!-- // seam(P6-9b): benchmark binding and CLI font diagnostic contract. -->

### Semantic reads and drawing invalidation

Reading layout or semantics may populate the layout cache. Replacing that cached layout also
invalidates drawing immediately; a semantic reader cannot consume the notification needed by SVG
or canvas. This applies to `$path` run shorthand, style references and list mutations, without
requiring an explicit `node.runs.0.text` binding. Repeated unchanged reads preserve layout identity.

CLI `sample`, `session` (including reload), `bench`, `inspect`, `validate`, `render`, `flatten` and `build` accept repeatable `--font Name=path`
overrides in addition to document font assets. Semantic sampling that needs an unregistered
family reports `font-missing`, a script-line JSON pointer, the requested family and a
`--font Name=path` hint. Structure-only commands do not install these overrides.

### Explicit leading native mapping (P6-9b)

For a 12 px font with ascent+descent 12 px and explicit line height 24 px, Anima places
6 px of leading above and below every line. The native comparison keeps its first baseline
at the ordinary ascent and therefore places its text node at y=6 px. Subsequent baselines
are 24 px apart in both. This is an explicit coordinate mapping, not a claim that the native
line-height parameter has identical first-line semantics. The unshifted source and raw capture
remain in `tests/oracle/text-line-spacing/rive/`. Symmetric line boxes are intentional: they
keep top alignment and metric trimming independent of whether a line is first, and preserve
Anima's specified deterministic tool layout (see docs/research/rive-web-runtime.md). Browser
automatic leading still omits lineGap because Canvas does not expose it; use explicit leading
for matching browser/tool layout. No raster tolerance absorbs a baseline displacement.

### Authored variable axes and OpenType features (P6-13)

With `fonts` registered and declared, local and shared styles additionally accept `axes` and
`features` maps. The font module extends the same style registry used by JSON validation,
AniML and the schema. Settings, numeric axis addresses, tool shaping limits and browser/Canvas
fallbacks are normative in [the fonts option contract](../fonts/SPEC.md). Compound AniML
attributes use JSON, e.g. `axes='{"wght":650}'`; compact CSS tag-list strings are not accepted.

### P7 native geometry dispositions

These are intentional Anima semantics, not passing native pixel comparisons. They preserve
continuous grid-unit layout and the documented authoring contract. Raw native captures and
independent parameter controls are retained in `tests/oracle/p7-text-fit-controls/` and
`p7-text-geometry-controls/`; row-specific `skip.json` files describe the comparison boundary.
No raster tolerance covers these differences.

- Font-size fitting uses twenty continuous bisection steps. Eight 0.6-em advances in a
  48-pixel-equivalent box fit at size 10, within bisection precision. The native fit capture
  instead exactly matches a size-9 visible control. Anima retains the largest measured fit
  to avoid unnecessary measured slack. The resized layout
  box reports that same measured content, so layout consumers and drawing agree.
- Baseline fitting excludes the first ascent and leading above the baseline: it measures
  `contentHeight - firstBaseline + topTrim`. This lets a baseline-aligned label fit its
  descenders below the anchor. The retained native true/false controls are pixel-identical
  and shrink the full line; adopting that behavior would defeat this baseline-relative contract.
- Ellipsis is **one U+2026 grapheme**, measured in the ellipsis style. The maximal prefix of
  complete graphemes that leaves room for it is retained. The native probe exactly matches
  the separate `abc...` control; Anima's generated-font probe retains `abcde…`. The Unicode
  ellipsis permits a font-designed mark and consumes one logical grapheme rather than three
  periods. Drawing, hit testing and measured line width use the same retained clusters.
- Vertical trim translates the first baseline to cap/x-height and removes the final descent
  at baseline trim. This makes metric edges useful for aligning labels. On the retained native
  fixed-box probe both packed and explicit cap/alphabetic settings render exactly like no trim.
  Anima keeps effective metric trimming, including its reported content height.

This follows the renderer-boundary distinction in `docs/research/rive-web-runtime.md` and the
independent-scene method in `docs/research/rive-format-and-graph.md`. No native implementation
was read or copied; the controls establish observed behavior, not an inferred internal algorithm.

### Text outline conversion (P7-6)

`anima flatten` freezes the default stepped text drawing into editable paths. All root text and
all component definitions are traversed; `--node id` selects a root node and `--node component/id`
selects a definition node. Component-local styles and data defaults retain their scope. An
instance override is not baked into a shared definition: its default is frozen once for every
instance. Shorthand/list text resolves at default data values; further changes no longer edit it.
The source document is not mutated.

The replacement group retains the original id and registry-defined group properties, including
transforms, visibility, opacity, focus, accessibility, external masks and clips. Text's rectangular
overflow clip becomes a transparent rectangle source and a clipped child group (`composite`
is added when needed). Gradients, run paints, glyph transforms and installed font options pass
through the existing SVG backend and bounded outline converter. Unsupported SVG features fail
rather than losing geometry. Path/clip ids avoid every existing document/definition id.

Text-only animation/binding addresses are retained for validation and cause `font-flatten` rather
than being silently removed. Group-compatible animation addresses remain live. Editable fields
are rejected; remove `textInput` explicitly before freezing. Text that is a direct child of a
`layout` container is rejected too: the replacing group has no intrinsic size, so the measured
footprint and baseline would be lost. Diagnostics use code `font-flatten`,
empty pointer for the command-level conversion, a message identifying the unsupported operation
and a repair hint. This is a CLI operation, with no additional JSON/AniML field or runtime entry.
The generated-font path and raster regressions cover both output spellings. Native outline conversion has no permitted headless counterpart; the P7-8 acceptance and
evidenced skip below replace that pending comparison.

### Flatten acceptance and native mutation limits (P7-8)

Flatten acceptance includes a direct raster comparison: live text rendered by resvg with the
original generated font against frozen path geometry laid out with the tool measurer. The live
side does not call the outline converter. The fixture matches exactly; component/clip/effect
projections retain their independent existing tests. There is no headless native outline-convert
operation, so `tests/oracle/text-flatten/skip.json` records that observation boundary.

Native run-list and text-style mutation retries also use a different authoring route: direct
binding context at the Text node and preassigned instance style values. The former still draws
its literal run fallback; the latter exposes an empty artboard-typed value and does not apply the
style. These cannot faithfully compare the Anima mutation. Evidenced skips preserve those native
captures alongside Anima's tool/browser SVG/canvas and typed-data regressions.
