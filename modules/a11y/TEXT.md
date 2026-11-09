# Text hit testing and semantic text

This extends SPEC's text/a11y contracts without adding a node or document field. All geometry
uses the active text layout and its registered measurer: the deterministic font reader in tools,
Canvas measurement in the browser. It adds no runtime dependencies or scripting VM. The optional
entries follow the browser-binding and lifecycle rationale in
[web-runtime research §2 and Lessons 5–6, 11–12](../../docs/research/rive-web-runtime.md).

## Host and core API (`text-hit`)

Import both `@anima-format/web/text` and `@anima-format/web/text-hit` (either order). The adapter
uses the active text module, without bundling it again. The following methods address a text node
in the loaded root player; unknown/non-text ids and unloaded players return `undefined`:

- `icon.textHit(id, x, y)` returns the closest caret's **grapheme ordinal**, from 0 to the full
  logical text's grapheme count. Coordinates are text-local grid units, before the node's world
  transform. Line choice minimizes vertical distance to its ascent/descent box, then horizontal
  distance to a caret. Ties prefer the first logical caret.
- `icon.textCaret(id, index)` returns `[x, y, 0, height]`, a zero-width typographic caret.
- `icon.textSelection(id, start, end)` returns `[x, y, width, height][]`, one box per selected line.
  Reversed endpoints are normalized, fractional indices truncated and indices clamped to the full
  source's grapheme count. An equal range returns the caret box. Soft-wrap boundary carets use the
  following line. Newline-only ranges have no selection area. Empty output returns the origin caret
  `[0,0,0,0]`; a genuinely empty line retains its layout metrics.

`@anima-format/core/text-hit` exports `textHit(layout, source, x, y)`,
`textSelection(layout, source, start, end = start)`, `textStops(layout, source)` and
`installTextHit(textModule)`. Source is the resolved runs concatenated in logical order. A cluster's
UTF-16 offset is translated into a grapheme ordinal using `Intl.Segmenter('und')`; no caret splits
surrogate pairs, combining sequences or a grapheme spanning two runs. Geometry uses measured
advances and ascent/descent, including origins, fitting, alignment, tracking and wrapping; it is
not an ink-outline box. Hidden/truncated source snaps to the retained caret. Hard clipping does not discard
clusters: explicit geometry queries can return boxes outside the clip, while pointer picking respects it. Ellipsis is a synthetic retained cluster; its layout source
offset follows text's existing truncation contract. Per-glyph effects and visual bidi reordering
are outside this logical-order API. Callers supply finite coordinates.

The optional adapter also supplies text outline rectangles to pointer picking. `input` listeners
can use the existing write map with the **`text-index`** numeric event field:

```xml
<listener on="down" target="label" write='{ "text-index": "selection" }'/>
```

JSON is `{ "on":"down", "target":"label", "write":{"text-index":"selection"} }`.
The existing `input-write` diagnostic rejects non-text targets and nonnumeric/read-only destination
inputs, at `/listeners/N/write/text-index`, with a message and hint. The input module transforms
world pointer coordinates through the inverse text-node matrix. Singular transforms are not picked.
Writes use the usual next-step queue and capture/consume routing. Import `text-hit` for browser
listeners; headless tools/core-all install it automatically. Core-only consumers can install it
explicitly. Other listeners and nodes keep their prior behavior.

## Inferred text and bounds (`a11y-text`)

Import `@anima-format/web/a11y-text` alongside `text` and `a11y-dom` for the overlay. It imports the
small base a11y entry; neither text nor the overlay is bundled in it. Headless core-all/CLI installs
this consumer automatically. `@anima-format/core/a11y-text` exports `installTextSemantics(runtime,
modules)` for explicit core composition. No additional `requires` feature is needed: authored text
and node a11y still declare `text` and `a11y` respectively.

An explicit semantic label, including `""`, takes precedence. Otherwise the label is the resolved
text it contains: concatenate its runs and visible descendant text nodes in structural order,
without adding separators. Hidden/disabled Solo or collapsed branches do not contribute; opacity
alone does. Text contributes through nonsemantic groups, component instances and repeated rows.
The logical text is used even when visual overflow elides it. Empty text has no inferred label.
Explicitly labelled descendant nodes still contribute their actual text to ancestors.

Unless `a11y.bounds` is authored, each text line contributes the union of its cluster advance
intervals, and from baseline minus scaled ascent to baseline plus scaled descent. This encloses
overlapping clusters under negative tracking and leaves box widths nonnegative. Empty lines have zero width and metric height. Clip rectangles intersect these
boxes. Transform **all four corners** through the full world matrix, including nested/repeated
owners, and union them in artboard coordinates. Parents use the existing visible-child union.
These are exact **layout** extents, not glyph-ink or text-stroke extents. <!-- seam(P8-9): shared painted support closes the text-ink disposition under D32. -->
The shared painted calculator applies the clip/mask contract in [SPEC.md](SPEC.md) after this
consumer; logical line boxes are its documented text-ink difference (D32).

Layout identity participates in the semantic dependency cache. Bound run/style/box changes,
host run edits and font-measurer revisions refresh inferred labels/bounds and semantic diffs.
The DOM overlay consumes this same forest, recreating its detached layer after renderer rebuilds
without stepping the player or consuming queued inputs. No geometry is guessed from CSS size.

## P6-9a native disposition

Inferred naming is an intentional Anima accessibility difference, preserving the specified
browser-oriented contract above. Two local headless controls paint `AB` + `C`, yet native text
and container labels remain empty; an explicit `Override` survives. Removing the child's semantic
annotation still leaves the parent unnamed and omits the text child. Sources, command files,
raw semantic dumps and PNGs are retained in [the native evidence](oracle/text/README.md).
Anima returns `ABC` for the unlabelled text and its container. Supplying useful accessible names
from visible text is the intended behavior; changing this to empty native labels would lose that
contract. Explicit labels, including empty strings, continue to win. The difference is covered
by independent semantic conformance and both-engine overlay tests, not a passing native-label
comparison. `a11y.inferred-text` closes with this evidenced no-equivalent-comparison disposition.

P8-9 closes `a11y.tree-bounds` with the painted calculator and its documented dash/text differences.
This optional consumer continues to supply logical line boxes. The native line-gap observation
remains unchanged and is not hidden by a tolerance.
