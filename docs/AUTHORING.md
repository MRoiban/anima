# Authoring in AniML

Write `.animl`; `anima build` produces `.ani` for the runtime. Check motion from markup.
Read `anima docs markup` for syntax and `anima docs spec` for playback rules.
Use `anima docs --list` to find topics, then fetch one with `anima docs <topic>`.

## The loop

```sh
anima new bell --glyph fixtures/glyphs/bell.svg -o bell.animl
# Edit bell.animl: add ring input, swing node, timeline, states and listeners (see below).
anima validate bell.animl
anima inspect bell.animl
anima sample bell.animl -e "fire ring; advance 0; advance 0.2; snapshot swing.rotate"
anima render bell.animl -o sheet.png --sheet 8 -e "fire ring"
anima build bell.animl -o bell.ani
```

Fix validation errors first. Exit codes: 0 success, 1 diagnostics, 2 usage errors.
`--format=json` includes codes, source positions, JSON pointers and available hints.

## Start from the glyph

```sh
anima new bell --glyph fixtures/glyphs/bell.svg
anima new bell --glyphy path/to/glyphy-project -o bell.animl
```

The scaffold embeds the path byte for byte with its SHA-256. The Glyphy form also reads
its pick, grid and metadata. Keep rest transforms at identity and added parts at
`opacity="0"` or `scale="0"` to preserve the static glyph.

Split parts with `subpaths="0 1"`. Indices start at 0, in the order of `M` commands in `d`.
`anima inspect bell.animl` lists each glyph's indices and bounding boxes in grid units
(`minX minY maxX maxY`), also available with `--format=json`. A “likely hole” hint means
only that another subpath's bbox contains it; inspect the geometry before splitting.
Keep a hole and its outline together with `fill-rule="evenodd"`. Render parts separately
when their indices are unclear. `examples/bell.animl` shows the real bell split.

<!-- fragment -->
```xml
<glyph name="shape" d="M2 2L18 2L18 16L2 16ZM4 4L16 4L16 14L4 14ZM8 17L12 17L10 19Z"/>
<group id="swing" pivot="10 2.5">
  <path id="body" glyph="shape" subpaths="0 1" fill="currentColor" fill-rule="evenodd"/>
  <path id="clapper" glyph="shape" subpaths="2" pivot="10 9" fill="currentColor"/>
</group>
```

Check source parity directly, without an external comparison harness:

```sh
anima render bell.animl --compare fixtures/glyphs/bell.svg
anima render bell.animl --compare fixtures/glyphs/bell.svg --size 256 --tolerance 0 -o diff.png
```

Comparison renders both SVGs at the same square size (default 256), on transparency,
with `currentColor` set to black regardless of `--current` or `--dark`. Explicit paint
colours and slot overrides still apply. It reports differing RGBA pixels, maximum channel
difference and pass/fail; exit 1 means a channel exceeds `--tolerance` (0–255, default 0).
The optional diff PNG shows maximum channel differences as grayscale (black is identical).
Use `--at` or a script to check a later frame; `--sheet` cannot be combined with comparison.

See `docs/research/glyphy-compat.md` for the grid, outline and stroke conventions.

## Geometry and pivots

Coordinates use grid units, with y down. Children keep their parent's coordinate system;
nesting does not move the origin to the child's bounds. Positive rotation is clockwise.
Set `pivot="10 2.5"` to turn or scale about that point (default `0 0`). Nest groups to
compose motion. Enlarge `viewBox` for bleed; the layout box still uses `grid`.

Use SVG-style attribute names: `cx`, `cy`, `width`, `height`, `fill`, `fill-rule`,
`stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`.
`anima schema <type>` shows both the markup and JSON spellings.
Rects start at `x0`, `y0`; `x`, `y` translate any node. Arcs take `cx`, `cy`, `r`,
`from`, `to` and stroke paint. Caps and joins default to `round`; strokes scale with nodes.
A fill detail needs `fill`; every stroke detail needs `stroke`.

## Timelines and keyframes

Tracks target `node-id.attribute`: `dot.fill`, `bar.width`, `wave.stroke-width`,
`wave.trimEnd`. Times are seconds, angles degrees; scale and opacity have no units.

Each keyframe is `time value [ease]`. Align columns with whitespace, or use `;` inline.
The ease on a key shapes the segment to the next key. Omit ease on the last key.
Before the first key and after the last, the endpoint value holds.

```xml
<anima version="0.1" name="turn" grid="20">
  <group id="icon" pivot="10 10">
    <circle id="dot" cx="14" cy="10" r="2" fill="currentColor"/>
  </group>
  <ease name="sway" curve="cubic(0.45, 0, 0.55, 1)"/>
  <timeline name="turn" duration="1" reducedMotion="end">
    <track target="icon.rotate">
      0    0    sway
      0.5  20   sway
      1    0
    </track>
    <track target="dot.scale">0 1 hold; 0.5 1 out; 1 1.2</track>
  </timeline>
  <layer name="main" initial="turning">
    <state name="turning" play="turn"/>
  </layer>
</anima>
```

Eases: `linear`, `hold`, `in`, `out`, `inOut`, `cubic(x1, y1, x2, y2)`,
`elastic(amplitude, period)`. Name reusable curves with `<ease>`; do not shadow built-ins.
Timelines default to `loop="once"`; alternatives are `loop` and `pingpong`.
`reducedMotion="end"` jumps to the end; `skip` freezes at the start; `play` runs normally.
Animate literal hex colours; colour slots and `currentColor` are for host theming.

## States inputs and listeners

Declare every input: `bool`, `number` (optional `min`, `max`) or `trigger`.
Listeners write inputs; transitions read them:

<!-- fragment -->
```xml
<bool name="hover"/>
<bool name="down"/>
<trigger name="ring" buffer="0.3"/>
<group id="icon" pivot="10 10"/>
<a11y role="button" label="Ring" activate="ring" held="down"/>
<layer name="main" initial="rest">
  <state name="rest"><on when="hover and !down" to="over" blend="0.18"/></state>
  <state name="over">
    <pose icon.scale="1.05"/>
    <on when="!hover" to="rest" blend="0.22"/>
    <on when="ring" to="over" blend="0.09" interruptible="false"/>
  </state>
</layer>
<listener on="click" fire="ring"/>
<listener on="enter" set="hover=true"/>
<listener on="down" set="down=true"/>
<listener on="leave" set="hover=false down=false"/>
<listener on="up" set="down=false"/>
```

Use `play="timeline-name"` and `@end` for one-shot motion. A state without `play` is a
pose; without `<pose>` it writes nothing. Later layers win on shared properties;
inspect reports overlaps. Empty poses return to values below that layer.

Conditions accept `hover`, `!down`, `level > 0.5`, `@after(0.3)` and `@end`, joined with
`and`. For “or”, write separate transitions. `@end` needs a `once` timeline.
Use `fire` for triggers, `set="a=true b=false"` for declared bools or numbers,
and `toggle` for bools. A listener's optional `target` names a node; otherwise it hits
`<hit>` or the viewBox. For example, `<hit circle="10 10 10.8"/>` sets a hit disc.
Triggers normally expire after one step. `buffer` keeps an unconsumed trigger pending.
`interruptible="false"` lets a crossfade finish before another transition can run.
Keyboard activation uses `a11y`: `activate` names a trigger to fire or a bool to toggle, and `held` names a bool.

## Checking the motion

```sh
anima render examples/bell.animl -o rest.png
anima render examples/bell.animl -o sheet.png --sheet 8 -e "fire ring"
anima render examples/bell.animl -o reduced.png -e "motion reduce; fire ring; advance 0"
```

Scripts accept `advance <seconds> [in <steps>]`, `set <input> <value>`, `fire <input>`,
`toggle <input>`, `pointer move|down|up|click <x> <y>`, `pointer leave`,
`motion reduce|full` and `snapshot [addresses]`. Pointer coordinates use grid units.
Input writes queue until a step; `advance 0` processes them without advancing time.
Snapshots report values, states, events and `settled`. Select bool/number inputs alongside
animated addresses with `snapshot dark knob.x`; input values appear under their names.
They reflect applied values, so step first to process queued writes. Triggers have no
persistent value. Without a list, snapshots still contain only animated addresses.
Check that one-shots settle.

Sheets start at the end of the script and sample until settled, or for `--over <seconds>`.
Use `--dark` and `--color accent=#e08a6d` to check themes. Check rest parity, pivots,
clipping and the final pose. Rendered geometry catches errors that valid numbers cannot.

## Common mistakes

Save each bad input below under its marked filename. Run `anima validate <filename>`.

**Misspelled attribute. Use `rotate`.**

<!-- invalid: typo.animl -->
```text
<anima version="0.1" name="demo" grid="20">
<circle id="dot" cx="10" cy="10" r="2" fill="currentColor" roate="5"/>
</anima>
```

<!-- diagnostics: typo.animl -->
```text
typo.animl:2:60 error unknown-attribute <circle> takes no "roate" attribute
  hint: did you mean "rotate"?
typo.animl: 1 error
```

**Fill detail without paint. Add `fill="currentColor"`.**

<!-- invalid: paint.animl -->
```text
<anima version="0.1" name="demo" grid="20">
<circle id="dot" cx="10" cy="10" r="2" fill-rule="evenodd"/>
</anima>
```

<!-- diagnostics: paint.animl -->
```text
paint.animl:2:51 error paint-attribute "fill-rule" needs "fill"
  hint: add fill="…"
paint.animl: 1 error
```

**Incomplete keyframe. Supply both time and value.**

<!-- invalid: keyframe.animl -->
```text
<anima version="0.1" name="demo" grid="20">
<group id="icon"/>
<timeline name="turn" duration="1"><track target="icon.rotate">0</track></timeline>
</anima>
```

<!-- diagnostics: keyframe.animl -->
```text
keyframe.animl:3:64 error bad-keyframe expected time value [ease]
keyframe.animl: 1 error
```

**Unknown track target. Use an existing node id.**

<!-- invalid: target.animl -->
```text
<anima version="0.1" name="demo" grid="20">
<group id="icon"/>
<timeline name="turn" duration="1"><track target="ghost.rotate">0 0; 1 20</track></timeline>
</anima>
```

<!-- diagnostics: target.animl -->
```text
target.animl:3:51 error unknown-address no node "ghost"
target.animl: 1 error
```

**Undeclared condition input. Add `<bool name="hover"/>`.**

<!-- invalid: input.animl -->
```text
<anima version="0.1" name="demo" grid="20">
<group id="icon"/>
<layer name="main" initial="idle"><state name="idle"><on when="hover" to="active"/></state><state name="active"/></layer>
</anima>
```

<!-- diagnostics: input.animl -->
```text
input.animl:3:64 error unknown-input no input "hover"
  hint: declare it: <bool name="…"/>, <number name="…"/> or <trigger name="…"/>
input.animl: 1 error
```

**Trigger in `set`. Use `fire="ring"`.**

<!-- invalid: trigger.animl -->
```text
<anima version="0.1" name="demo" grid="20">
<group id="icon"/>
<trigger name="ring"/>
<listener on="click" set="ring=true"/>
</anima>
```

<!-- diagnostics: trigger.animl -->
```text
trigger.animl:4:27 error input-type "set" needs a bool or number input; "ring" is trigger
trigger.animl: 1 error
```

**Forgotten pivot.** This is valid. Save as `pivot.animl`:

```xml
<anima version="0.1" name="pivot" grid="20">
  <circle id="dot" cx="10" cy="4" r="2" rotate="90" fill="currentColor"/>
</anima>
```

Run `anima inspect pivot.animl`: its node line is `dot (circle)`, with no pivot.
Run `anima render pivot.animl -o pivot.svg`: the centre turns to `-4 10`, outside the box.
Add `pivot="10 4"` to keep the centre fixed. Validation cannot infer the intended hinge.

## Formatting

`anima fmt icon.animl` prints formatted markup. Use `--write` to edit the file or `--check`
to check it. Formatting aligns keyframe columns and keeps comments, element order and named
eases. It does not reorder layers. Run validation again after edits.

## Markup in HTML

Wrap AniML in a script so HTML does not interpret its node tags:

```html
<anima-icon>
  <script type="application/vnd.anima+xml">
    <anima version="0.1" name="dot" grid="20">
      <circle id="dot" cx="10" cy="10" r="2" fill="currentColor"/>
    </anima>
  </script>
</anima-icon>
```

Run `anima build page.html -o page.built.html`. It replaces AniML scripts inside
`<anima-icon>` with compiled `application/vnd.anima+json` scripts. Load the regular
`@anima-format/web` runtime on that page.
To compile markup in the browser instead (prototypes, playgrounds), also import
`@anima-format/web/markup` (about 6 KB more). Without it, an icon holding AniML reports a
`markup-unavailable` error. Pages that ship built `.ani` never need it.

## Hand-written ani

Hand-written `.ani` JSON is still valid. It is the runtime format that `anima build`
produces. `validate`, `inspect`, `sample`, `render` and `fmt` accept it too.
Follow `anima docs spec` and the JSON spellings in `anima schema`.
Use `anima decompile icon.ani -o icon.animl` to move authoring to markup.

## Paint module

Add `requires="paint"` to use gradients and dashed strokes. Browser pages also import
`@anima-format/web/paint` (or load `anima-paint.js`); authoring tools register modules automatically.
A page without paint refuses the document with `unknown-feature`. See `examples/paint.animl` for
animated stop colours, coordinates and dash offset.

```xml
<anima version="0.1" name="paint-demo" grid="20" requires="paint">
  <circle id="disc" cx="10" cy="10" r="8" stroke="#000" stroke-dasharray="10% 5%">
    <linearGradient x1="2" y1="2" x2="18" y2="18">
      <stop offset="0" stop-color="#ff000080"/>
      <stop offset="1" stop-color="#00f"/>
    </linearGradient>
  </circle>
</anima>
```

Use `paint="stroke"` on a gradient child for a gradient stroke. Animate `disc.fill.x2`,
`disc.fill.stops.0.color`, `disc.fill.stops.0.position` or `disc.stroke-dashoffset`. Animated colours
must be hex literals; unanimated stops may use colour slots. Dash numbers are grid units; percentages
are fractions of the full path length, with offset expressed as a fraction (0.1 = 10%). A partial
trim overrides dashes. Round caps extend each dash by half the stroke width on both ends,
which can hide short gaps; use `stroke-linecap="butt"` for short dashes.
Validate and render the `.animl` directly as usual.

### Optional compositing

Add `requires="composite"` for blend modes, masks, clips, multiple paints, paint visibility,
stroke position or sibling draw order. Browser pages import `@anima-format/web/composite`
(or load `anima-composite.js`). When also using gradients, dashes, shapes, corners, morphs
or fixed strokes, declare `requires="paint composite"` and import both browser modules.
Neither module implies the other. See `examples/composite.animl`, SPEC's `composite` chapter
and ANIML's composite forms. The base runtime continues to refuse unavailable features.

### Pose morphs and group clips

With `requires="paint"`, a pose can write `pathId.d` directly to a path string. Blend between
poses with `<on blend="…">`. Rest, pose and track paths must have the same expanded commands,
including case and repetition count; `morph-mismatch` points to the incompatible value.
`anima schema pose` describes the address map; `anima schema state` shows the containing state.

With `requires="composite"`, put `<clip source="outline"/>` inside a group to clip all its
children to that painted node's outline. `rule` defaults to `nonzero`; use `rule="evenodd"`
for holes. Source transforms apply, but its paint, visibility and opacity do not affect the clip.

```xml
<anima version="0.1" name="pose-clip" grid="20" requires="paint composite">
  <rect id="outline" x0="0" y0="0" width="10" height="20" fill="#000" visible="false"/>
  <group id="icon">
    <clip source="outline"/>
    <path id="line" d="M2 2L18 18" stroke="#000"/>
  </group>
  <bool name="done"/>
  <layer name="main" initial="rest">
    <state name="rest">
      <pose line.d="M2 2L18 18"/>
      <on when="done" to="done" blend="0.3"/>
    </state>
    <state name="done"><pose line.d="M2 18L18 2"/></state>
  </layer>
  <listener on="click" toggle="done"/>
</anima>
```

## Reusing markup

Keep shared interaction wiring in a library, then import it from each icon. The bell, moon and
trash examples import `examples/lib/ui.animl` and use `<apply template="ui:press"/>`; their compiled
`.ani` files stay byte-identical. That template sets the common `hover` and `down` inputs. Each
icon retains its own animation layers, timing and accessibility behavior.

A library starts with `<library name="ui">`. Put a template inside it, for example
`<template name="press" params="hover=hover down=down">`, whose listener attributes use
`set="{hover}=true"` and `set="{down}=false"`. At the document root, add
`<import src="lib/ui.animl" as="ui"/>`. Override defaults on an application, for example
`<apply template="ui:press" hover="over" down="held"/>`, after declaring those inputs.

Templates can contain nodes, timelines, layers or listeners; apply them where those elements
are allowed. Parameters substitute attribute values and text, including keyframes. Required
parameters have no default (`params="target scale=0.92"`). Missing, extra and unused parameters,
unknown imported names, cycles and recursive applications produce diagnostics showing the
library's source position and the application/import site. Libraries also share colours, glyphs
and named eases through `ui:name` references. Components await the components module.

`anima build` and `validate` resolve imports relative to each importing file. The playground
resolves them inside the project directory; the browser markup module fetches them relative
to the document URL. API hosts supply `compile(source, {file, resolve})`, or `compileAsync` with
an asynchronous resolver. Formatting preserves reusable source forms. Decompiling `.ani` gives
the expanded markup: imports and templates cannot be recovered.

## Bindings

Use `requires="bind"` when a value should follow an input continuously. This ring follows
`progress` on the next frame with no timeline or transition:

```xml
<anima version="0.1" name="progress" grid="20" requires="bind">
  <number name="progress" default="0" min="0" max="1"/>
  <circle id="ring" cx="10" cy="10" r="8" stroke="#d97757" trimEnd="0"/>
  <bind target="ring.trimEnd" value="progress"/>
</anima>
```

Bindings override state and timeline writes, then clamp to the property's range. Expressions
accept arithmetic and `min`, `max`, `clamp`, `mix`; bool inputs work directly for visibility or
as 0/1 in arithmetic. Use `mix(#000, #fff, progress)` for colour. `bind-type` means the expression
and target disagree; `unknown-input` means an input needs declaring; `bind-syntax` names malformed
expressions. `anima inspect` lists bound addresses, `anima schema bind` describes the form, and
`anima sample --script` includes resolved values. Browser hosts import `@anima-format/web/bind`.
See `examples/progress.animl`; general view-model data binding remains for P4e.
## Images and assets

Import both `@anima-format/web/paint` and `@anima-format/web/assets` for image documents.
Declare an asset, then place it in a box (see `examples/photo.animl`, an original generated PNG):

```xml
<anima version="0.1" name="photo" grid="24" requires="paint assets">
  <asset name="photo" type="image" src="photo.png"/>
  <image id="photo" asset="photo" x0="2" y0="2" width="20" height="20" fit="contain"/>
</anima>
```

`contain` preserves the full image; `cover` fills and crops; `fill` stretches. `none`,
`scale-down`, `fit-width`, and `fit-height` use intrinsic size. Set `align="top-left"` (or
center/edge/corner names) to position it, and `sampling="nearest"` for pixel art. The box clips
overflow. Asset `width`/`height` override decoded intrinsic dimensions when needed.

Paths resolve relative to the document URL in the browser and source file in the CLI.
`anima build photo.animl --embed -o photo.ani` embeds local files as data URIs; only assets
change. `anima render photo.animl -o photo.png` reads local images directly.
For hosted assets, assign `icon.assets = (name, info) => urlOrBlob` before loading; promises
work too. Await `icon.ready` on initial load, or listen for `anima:load` on reload. Failed
loads emit `anima:error`. Embedded images make no network request. Font/audio/blob declarations
are accepted now; their playback/text modules follow later.


## Components

Use a template for repeated markup and a component when each placement needs its own inputs and
state. Declare components at the document level or in an imported library; place them with
`<instance>`. A component's coordinates stay local: translate/scale the instance to place it.

```xml
<anima version="0.1" name="badges" grid="20" requires="components bind">
  <number name="unread" default="3"/>
  <component name="badge" grid="8">
    <number name="count" min="0" max="8"/>
    <circle id="dot" cx="4" cy="4" r="1" fill="#e44"/>
    <bind target="dot.r" value="count"/>
    <listener on="click" emit="selected"/>
  </component>
  <instance id="left" component="badge" count="{unread}"/>
  <instance id="right" component="badge" x="10" count="2"/>
  <listener on="left.selected" set="unread=0 right.count=0"/>
</anima>
```

`count="{unread}"` evaluates against parent inputs every step. Literal initializers apply once;
listener actions can subsequently write `right.count`, and `fire="right.pop"` addresses a trigger.
For a continuous explicit binding use `<bind target="right.count" value="unread * 2"/>`.
Explicit bound/animated addresses override inline expressions. Do not use a node attribute name
such as `x` as a component input name (`reserved-input-name` at the declaration); use names such
as `pos-x`, `count` or `enabled`. Installed module node keys are reserved too.

Child events bubble as `left.selected`. Parent listeners and transitions see them on the next
step (including `advance 0`); the player stays awake for that step. Paused children keep their
state; invisible settled children sleep. Recursive definitions are `component-cycle`; depth >8
or >256 expanded instances is `limit-exceeded`. Unknown components/inputs are errors with their
source location, not silent no-ops.

Run `anima inspect examples/toolbar.animl` to see instance layers. With `anima sample`, select
`left/count` or `left/dot.r`; snapshot state keys are scoped too (`left/interaction`).
`examples/toolbar.animl` combines three Glyphy icons using the same imported press template and
an unread badge. Browser hosts import `@anima-format/web/components` and, when expressions are
used, `@anima-format/web/bind`, alongside the base runtime.
