# Layout

`requires: ["layout"]` installs a dependency-free, single-line layout pass. Lengths are grid units.
It adds no code to the base core/web entries. This is an independently implemented subset of
[CSS Flexbox §9](https://www.w3.org/TR/css-flexbox-1/#layout-algorithm), with normalized positive
fill weights, zero fill basis, no implicit shrink, no flex-line wrapping, percentages or auto margins.
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
viewBox dimensions. A per-player `layoutSize` override replaces root dimensions through their normal min/max bounds;
without it the authored dimensions apply. Roots beneath ordinary groups follow the same rule.
The host-fit adapter supplies grid units, using one CSS pixel per unit in `fit="layout"`.

Every direct child participates. Child JSON is `layout: {width, height, minWidth, maxWidth,
minHeight, maxHeight, alignSelf, margin, display, reflow}`. The corresponding AniML attributes are
`layout-width`, `layout-height`, `min-width`, `max-width`, `min-height`, `max-height`, `align-self`,
`margin`, `display`, `reflow`. `alignSelf` uses the `align` vocabulary and defaults to inheritance;
`display` is `flex` (default) or `none`. On a nested layout, its own width/height/bounds also
serve as child sizing unless the JSON child `layout` explicitly overrides them. AniML writes
bounds once on the nested container. Children may be layouts themselves.

Omitted child dimensions use intrinsic dimensions. `hug` explicitly selects them. Rectangles
contribute authored `w`/`h`, circles/arcs their diameter, paths and optional shapes their registered flattened outline bounds,
images their authored viewport (explicit hug selects declared asset dimensions, falling back to the authored viewport), text the text
module's measured box, instances their selected child player's component viewBox (zero when cleared). Changing a dynamic selection remeasures the instance on that step. Images retain the assets module's
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
the renderer's dirty-slot reads. Constrained text measurements receive an explicit child width or maximum width when authored. Text is measured directly through `measureText(player, nodeId, maxWidth?)` from the text module;
there is no fallback adapter. After top-down width allocation, text is remeasured within its actual
width (including fill widths). Repeat measurement/allocation until the text sizes stop changing,
bounded by node count plus one passes so nested hug heights propagate to ancestors. The generated
font's 100-unit line gap is included: size 2 yields 2.2 per line. Drawing uses the same constraint
and font preparation without changing the text module's standalone measurement cache.

`player.layoutBox(id)` returns a detached `{x,y,width,height}`, or undefined for nonparticipants.
Child positions are in the immediate container's space. `local()`/`world()` expose the drawn positions (equal to targets without reflow); layout containers have the ordinary rectangle hit outline. Root box positions are the root's `x/y`.
`player.values()` / CLI snapshots additionally expose `<id>.layoutBox.x`, `.y`, `.width`, `.height`.
These are observations, not writable binding destinations. Boxes are written into the neutral
frame's container/rect/image geometry and child transforms, including shape scaling; per-corner
rectangles (`corners`) build their corner path in the allocated box. SVG and
canvas consume the same frame. Hit testing and pointer coordinate mapping use that frame’s allocated geometry and geometry-to-artboard transform, including shape normalization; semantic bounds use the same transform. Semantic caches track every collected player’s draw revision, so host size changes and reflow frames invalidate bounds even when sampled properties stay unchanged. A painted container draws its background then its child tree.

The `layout` browser entry includes its `layout-svg` backend entry; the backend registration is separately bundled to keep each entry within its byte ceiling.

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

These are semantic differences, never rasterizer tolerances. Flex-line wrapping remains outside this entry; text wrapping is supplied by the text module.

## Animated reflow (`layout-reflow`)

Load `@anima-format/web/layout-reflow` in addition to `layout` to animate boxes. Tooling installs
it automatically. With only the base layout entry, boxes snap as before; the reflow entry adds no
new `requires` feature or base core/web bytes. It also installs runtime validation of its settings.

A container's JSON `reflow` and AniML `reflow` accept a finite nonnegative duration in seconds,
or a string `"<seconds> <ease>"`, e.g. `"0.25 out"`. The default ease is `linear`; the ease vocabulary
is SPEC §5 (`linear`, `hold`, `in`, `out`, `inOut`, `cubic(...)`, `elastic(...)`), plus
`elastic-in(...)` and `elastic-in-out(...)` when the document declares `motion`. These are
weight eases, not timeline value curves. The design's illustrative `ease-out` means §5 `out`.
Duration zero explicitly disables animation. Settings are static, not binding/track destinations.

Participants override their own box with `layout: {reflow: ...}` / `reflow="..."`. Otherwise they
inherit from the nearest container declaring `reflow`, walking ancestors if needed; no declaration
means snap. A nested container's `layout.reflow` affects its own box; its container `reflow` is what
its descendants inherit. A nested container's own `reflow` also applies to its own box unless
`layout.reflow` overrides it. In AniML the nested container's `reflow` is the container setting;
JSON can additionally express the independent child override.

First allocation snaps. After the target layout has converged, each changed box starts a flight
from the box currently drawn to its new target, interpolating all four components in the immediate
container's coordinate space. At a step boundary, first advance the old flight to `player.time`,
then retarget from that exact drawn box at progress zero. Thus a write followed by `step(0)` does
not move the drawing. A write followed by `step(dt)` advances any old flight by `dt` before starting
the new flight. Subsequent steps use elapsed time / duration and the selected ease. The endpoint
is exactly the target even for `hold` or overshooting eases. Interpolated dimensions clamp at zero
so elastic undershoot never emits an invalid negative drawing size; positions may overshoot freely. Unchanged targets do not restart flights.
Reduced motion snaps active and newly changed boxes on the next step and clears the flights.
Re-enabling motion does not resume an old flight. `step().settled` stays false and `player.busy`
stays true until every flight ends; other player activity retains its ordinary settled rules.

`player.layoutBox(id)` and machine guards always observe the target box. The detached
`player.drawnLayoutBox(id)` observes the current drawn box, or undefined for a nonparticipant;
without reflow it equals the target. With the optional entry (and always in tooling), CLI snapshots / `values()` expose
`<id>.drawnLayoutBox.x`, `.y`, `.width`, `.height`. Drawing, container hit outlines, and child
`local()` / `world()` translations use drawn boxes. Text is laid out for drawing at its drawn
width; those visual line breaks do not feed back into the target calculation during a flight.

`layout-reflow` is a load diagnostic at the exact container `/reflow` or participant
`/layout/reflow` pointer for an invalid duration or ease, with a corrective hint. Registry shapes
and the module's existing AniML hook supply both spellings, schema and CLI validation. The paired
`examples/reflow.animl` / `.ani` is the data-bound label button. Conformance samples cover the start,
midpoint, nonzero-dt retarget, completion and reduced-motion snap. Both browser engines also verify
SVG/canvas drawing and scheduler completion.

The implementation is independent of native engine code. The native probe and raw pixel differences
are retained under `tests/oracle/layout-animated-reflow` and `verification/p7-4`. The local native
CLI starts a changed-size interpolation on a positive update frame, whereas Anima's `step(0)` starts
it immediately. Adding an explicit native update frame aligns the first midpoint, but the retained
mid-flight retarget samples still disagree. Anima keeps the deterministic boundary contract above;
no raster tolerance disguises this timing/geometry difference. Native parity remains pending an
accepted comparison mapping or explicit closure decision. This distinction follows the update-pass
pitfall in [the state-machine research](../../docs/research/rive-animation-and-state.md) and the
independent-renderer cautions in [the web research](../../docs/research/rive-web-runtime.md).
