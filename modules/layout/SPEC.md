# Layout

`requires: ["layout"]` installs a dependency-free, single-line layout pass. Lengths are grid units.
It adds no code to the base core/web entries. This is an independently implemented subset of
[CSS Flexbox §9](https://www.w3.org/TR/css-flexbox-1/#layout-algorithm), with normalized positive
fill weights, zero fill basis, no implicit shrink, no wrapping, percentages or auto margins.
It is not an implementation of Rive's layout engine.

## Nodes and both spellings

A container is `{id, type: "layout", children: […]}` / `<layout id="…">…</layout>`.
Its properties are:

| JSON / AniML | Values and default |
| --- | --- |
| `width`, `height` | nonnegative number, `hug` (default), `fill`, `fill(w)` with finite `w > 0` |
| `direction` | `row` (default), `column`, `row-reverse`, `column-reverse` |
| `justify` | `start` (default), `center`, `end`, `space-between`, `space-around`, `space-evenly` |
| `align` | `start` (default), `center`, `end`, `stretch`, `baseline` |
| `gap` | nonnegative number or `[row, column]`; AniML `gap="row column"`; default zero |
| `padding` | nonnegative number or 1–4 physical edges; AniML whitespace list; default zero |
| `minWidth` / `min-width`, `maxWidth` / `max-width` | nonnegative bounds, default zero / unbounded |
| `minHeight` / `min-height`, `maxHeight` / `max-height` | same for height |
| `fill`, `stroke` | the ordinary registered node paint objects / flattened paint attributes |
| `corners` | nonnegative uniform rectangle radius, default zero; SVG ellipse clamping applies |

Padding and margin expand in top/right/bottom/left order, using CSS's 1–4-value expansion.
Dimensions include padding; stroke does not consume layout space. Paint is behind the children.
Root `x`, `y` keep their ordinary transform meanings. Root fill resolves against the artboard's
viewBox dimensions. There are no implicit pixel conversions.

Every direct child participates. Child JSON is `layout: {width, height, minWidth, maxWidth,
minHeight, maxHeight, alignSelf, margin, display}`. The corresponding AniML attributes are
`layout-width`, `layout-height`, `min-width`, `max-width`, `min-height`, `max-height`, `align-self`,
`margin`, `display`. `alignSelf` uses the `align` vocabulary and defaults to inheritance;
`display` is `flex` (default) or `none`. On a nested layout, its own width/height/bounds also
serve as child sizing unless the JSON child `layout` explicitly overrides them. AniML writes
bounds once on the nested container. Children may be layouts themselves.

Omitted child dimensions use intrinsic dimensions. `hug` explicitly selects them. Rectangles
contribute authored `w`/`h`, circles/arcs their diameter, paths and optional shapes their registered flattened outline bounds,
images their authored viewport (explicit hug selects declared asset dimensions, falling back to the authored viewport), text the text
module's measured box, instances their component viewBox. Images retain the assets module's
required authored viewport fields. A group without measurable geometry contributes zero.
Transforms, stroke and paint do not affect intrinsic sizing. Normalized geometry starts at the
allocated top-left; authored child `x`/`y` are replaced by layout placement, while rotation,
pivot and scale remain authored transforms. Instance viewBox minima retain the component's
existing coordinate convention.

`none` contributes no size, margin or gap and does not draw, including its descendants. It has a
zero box at the origin. `visible: false` hides drawing but still reserves layout space.

## Algorithm

Measure nested hug containers bottom-up. Sum the children's outer main sizes plus gaps; take the
largest outer cross size (baseline rows also sum the largest ascent and descent); then add padding and clamp the container's size. Resolve actual sizes
top-down, so a nested fill container receives its parent's allocated box.

Fixed and hug children are not shrunk when space is negative. Fill starts with zero basis and
shares the remaining main space proportionally by its positive weight. Clamp proposed sizes to
min/max. Sum the signed clamp violations: freeze minimum violations for a positive total,
maximum violations for a negative total, all for zero. Redistribute the remaining space among
unfrozen fill children until all are resolved. Minimum wins if animated bounds cross.

After sizing, distribute remaining space according to `justify`. Space variants add to the gap;
negative free space uses start placement for space variants, and signed offsets for center/end.
A single `space-between` child starts at the leading padding. Reverse directions reverse the
placement axis, retaining source/drawing order and physical margin sides.

Cross-axis fill consumes the available cross size minus margins, then clamps to bounds.
Stretch does so for an omitted cross dimension. Explicit fixed/hug dimensions do not stretch.
Start/center/end use the remaining cross space; in rows, baseline aligns measured text baselines
and uses the bottom edge for other participants. In columns baseline falls back to start.

## Step, caching, drawing and guards

Layout is a named stage after state resolution, bindings and clamping, before drawing. It uses
resolved properties and text measurement. It runs through the optional post-step chain, after
component stepping and earlier post-step consumers, without changing the base Player pipeline.
Each player also initializes its boxes from its initial pose during construction, independently
of whether a renderer ever draws. `step(0)` applies bindings and reflows normally.

Each container keeps its previous resolved-input signature as its dirty flag. Unchanged signatures
reuse the allocated boxes. A changed box advances that node's draw revision; it does not consume
the renderer's dirty-slot reads. Constrained text measurements receive an explicit child width or maximum width when authored. Text is measured through the optional `measureText(player,
nodeId, maxWidth?)` contract; until installed, the existing `textLayout` measured box is used.

`player.layoutBox(id)` returns a detached `{x,y,width,height}`, or undefined for nonparticipants.
Child positions are in the immediate container's space. `local()`/`world()` expose those allocated positions; layout containers have the ordinary rectangle hit outline. Root box positions are the root's `x/y`.
`player.values()` / CLI snapshots additionally expose `<id>.layoutBox.x`, `.y`, `.width`, `.height`.
These are observations, not writable binding destinations. Boxes are written into the neutral
frame's container/rect/image geometry and child transforms, including shape scaling. SVG and
canvas consume the same frame. A painted container draws its background then its child tree.

With `machine`, a guard operand `{layout: "id.width"}` (or `.x`, `.y`, `.height`) observes the
previous step's box. Before the first step it sees the initial pose box. The current step never
re-enters the machine after layout. This choice follows the update/feedback-loop pitfall in
[the state-machine research](../../docs/research/rive-animation-and-state.md).

## Bindings, timelines and diagnostics

The existing binding/timeline priority applies. Numeric addresses are container `width`, `height`,
`gap`, `padding`, `corners`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`; child equivalents
start with `layout.`. Expanded physical edge components use `.0` through `.3`; gap uses `.0/.1`.
A numeric address replaces a hug/fill mode with a fixed size (including its numeric rest); fill/hug validation runs after bindings and timeline addresses compile, so a bound or animated parent axis is definite. Omitted numeric rest defaults to zero.
Child `layout.display` supports discrete string bindings (`flex`/`none`). AniML addresses use
registered spellings, e.g. `child.layout-width` becomes `child.layout.width`. Numeric size writes
clamp to zero before layout; negative margins remain allowed. Static mode strings are not numeric
keyframe values. Other layout configuration is static in this entry.

Custom load diagnostics have a code, JSON pointer, explanation and corrective hint:

| Code | Pointer example | Correction |
| --- | --- | --- |
| `layout-value` | `/nodes/0/width` or `/nodes/0/padding` | nonnegative size, valid positive fill weight, valid edge list |
| `layout-bounds` | `/nodes/0/children/0/layout/minWidth` | minimum must not exceed maximum |
| `layout-fill-hug` | `/nodes/0/children/0/layout/width` | give the parent a definite size on that axis or use hug |
| `layout-outside` | `/nodes/0/layout` | put child layout properties inside a layout container |
| `layout-target` | `/machine/layers/main/states/a/on/0/guard/left/layout` | name a participating node and a box field |

The generated JSON Schema and CLI validation/inspection/sample/render use this registry and the
same player. `examples/button.animl` is the data-bound-label button: its background hugs the
measured label plus physical padding. Reflow animation is the separate P7-4 entry.

## Independent comparisons and intentional native differences

The reference probes use independently authored native layout containers and participants, with
only local headless rendering; no native engine source or binary is used. Native 3×3 alignment
maps onto our separate justify/align controls. Compare the scenes and raw capture sessions under
`tests/oracle/layout-*`; the comparison report is `ORACLES.md` in this module.

Two differences are intentional:

- `align-self` is independently honored by Anima. In the captured native CLI, authoring a child's
  `alignSelfValue=flexEnd` did not change its placement. The failed native frame is retained as
  an evidenced unavailable counterpart, rather than rewriting its position to mimic the result.
- Fill sizing uses the signed-violation, zero-basis algorithm above. The retained mixed-bound
  native probe allocates 10.5/2.5 units where Anima allocates 9/4, for 13 available units, equal
  weights, first minimum 8 and second maximum 4. We keep the specified algorithm and independent
  vectors. Fixed min/max sizing has a separate native comparison. Baseline is likewise an explicit
  extension of our independent cross-axis vocabulary; native positional-picker equivalence is not
  a claim of native baseline support.

These are semantic differences, never rasterizer tolerances. Wrapping remains outside this entry.
