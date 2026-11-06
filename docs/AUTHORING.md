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

A script's first `advance` also enters the initial states. A `set` before it is already in place when
they resolve, so transitions that react to the change never run (the document starts in the end
state). To see a reaction to an input change, `advance 0` first, then `set`, then advance.

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
trigger.animl:4:27 error input-type "set" needs a bool or number or string or color input; "ring" is trigger
  hint: use fire for a trigger
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
and named eases through `ui:name` references. Libraries can also share components and their model definitions.

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
See `examples/progress.animl`; see the data section below for view-model bindings.
## Images and assets

Import both `@anima-format/web/paint` and `@anima-format/web/assets` for image documents.
Declare an asset, then place it in a box (see `examples/photo.animl`, an original generated PNG):

```xml
<anima version="0.1" name="photo" grid="24" requires="paint assets">
  <asset name="photo" type="image" src="photo.png"/>
  <image id="photo" asset="photo" x0="2" y0="2" width="20" height="20" fit="contain"/>
</anima>
```

`contain` preserves the full image; `cover` fills and crops; `fill` and `resize` stretch. `none`,
`scale-down`, `fit-width`, and `fit-height` use intrinsic size. Set `align="top-left"` (or
center/edge/corner names) to position it, and `sampling="nearest"` for pixel art. The box clips
overflow. Asset `width`/`height` override decoded intrinsic dimensions when needed.

Paths resolve relative to the document URL in the browser and source file in the CLI.
`anima build photo.animl --embed -o photo.ani` embeds local files as data URIs; only assets
change. `anima render photo.animl -o photo.png` reads local images directly.
For hosted assets, assign `icon.assets = (name, info) => urlOrBlob` before loading; promises
work too. Await `icon.ready` on initial load, or listen for `anima:load` on reload. Failed
loads emit `anima:error`. Embedded images make no network request. `icon.assetPolicy` defaults to `'local'`: same-origin URLs and data URIs. Set it to `'any'`
for a CDN, or supply a resolver to authorize a replacement explicitly. The resolver receives
`type`, `source`, optional `size`/`mime`, and detached `metadata` in `info`.

Import `@anima-format/web/paint-sampling` (includes paint) for SVG wrapping; canvas supports it directly.
Sampling can tile outside the fitted rectangle. `wrap="repeat"` repeats it; `wrap="mirror"`
reflects alternate tiles. SVG repeat requires `sampling="nearest"`; use canvas for bilinear repeat. `wrap-x` and `wrap-y` override one axis. Clamp edge extension is still incomplete: the current
runtime preserves transparent fitted margins. The three clamp parity rows remain open. For example:

```xml
<anima version="0.1" name="tiles" grid="24" requires="paint assets">
  <asset name="photo" type="image" src="photo.png" width="8" height="4"/>
  <image id="photo" asset="photo" x0="0" y0="0" width="24" height="24"
    fit="none" align="top-left" sampling="nearest" wrap="mirror" wrap-y="repeat"/>
</anima>
```

Build options go on the declaration: `encode="png|jpeg|webp" quality="0.8"` re-encodes and embeds
pixels. Quality is [0,1]; PNG ignores it. PNG encoding runs in-process; JPEG/WebP encoding and
WebP decoding need the cached headless Chromium (`CHROMIUM_PATH` overrides its executable).
Missing Chromium reports `build-encoder-unavailable`. Build checks signatures against extensions
and MIME, and writes inspected `size`, `mime` and audio `duration`. Audio validation inspects
headers; playback still requires a browser decoder. `export="false"` leaves a declaration for
the host resolver and excludes its bytes from build inspection, encoding and embedding. Embedded
source payloads become `src="anima:NAME"` placeholders that require the resolver.

Import `@anima-format/web/media` to read audio/blob bytes: `await icon.asset('bytes')` yields an
ArrayBuffer, cached per asset/load. Treat cached bytes as read-only; pass a copy (`bytes.slice(0)`)
to `AudioContext.decodeAudioData`, which takes ownership of its input. Images/fonts return source URLs. Events owns activated audio
playback; import `@anima-format/web/events` and `@anima-format/web/assets`, then use a clip:

```xml
<anima version="0.1" name="clip" grid="24" requires="assets events">
  <asset name="tone" type="audio" src="tone.wav" start="0.2" end="0.9"/>
  <circle id="button" cx="12" cy="12" r="10" fill="#d97757"/>
  <event-def name="play" audio="tone" volume="0.5"/>
  <listener on="click" target="button" emit="play"/>
</anima>
```

`start`/`end` are seconds within the source. Events before user activation are dropped; they do
not queue or load audio. Fonts remain declarations until text support arrives.

`anima import art.svg -o art.animl` handles vector geometry, groups, paints, user-space gradients
and representable transforms. `anima import animation.json -o animation.animl` imports the Lottie
shape subset (groups, paths, paints, transforms, keyframes/easing and stroke trims). Every unsupported
feature reports `import-unsupported` with a source path; review the warnings before using a lossy
import. Original hand-made importer inputs and compiled examples are covered by the asset CLI tests.


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


Load `@anima-format/web/nested` alongside components for explicit instance clocks, fitting,
outputs and component-valued selections. In this complete example, `$t` controls the child's
animation time in seconds, `fps` floors it to a 12 Hz clock, and `fit` maps the child viewBox into
`size`. Fitting also transforms pointer hits. Cover does not add a clip; add one explicitly when
needed.

```xml
<anima version="0.1" name="nested-controls" grid="30" requires="components nested data bind">
  <model name="Controls">
    <number name="t" default="0.5"/>
    <component name="card" default="row"/>
  </model>
  <component name="row" grid="10">
    <number name="count" default="3"/>
    <circle id="dot" cx="5" cy="5" r="1" fill="#d97757"/>
    <output name="done" value="count > 0"/>
    <timeline name="grow" duration="1">
      <track target="dot.r">0 1; 1 4</track>
    </timeline>
    <layer name="main" initial="growing">
      <state name="growing" play="grow"/>
    </layer>
  </component>
  <instance id="clocked" component="row" time="$t" fps="12" size="20 10" fit="contain" align="right"/>
  <instance id="selected" component="$card" x="20"/>
  <circle id="indicator" cx="2" cy="15" r="1" fill="#000"/>
  <bind target="indicator.opacity" value="clocked.outputs.done"/>
</anima>
```

The source and compiled document are [controls.animl](../modules/nested/examples/controls.animl)
and [controls.ani](../modules/nested/examples/controls.ani). `clocked.outputs.done` is read-only;
write `clocked.count` instead. A parent evaluates before its children, so a child change reaches
parent bindings on the next step. Output snapshots use `clocked/outputs.done`. Backward scrubbing
resamples the current child state; it does not undo transitions. A component property holds a
declared name or empty string. Changing `$card` rebuilds `selected`; an unchanged name keeps its
state. Empty selection hides and stops that placement. Typed `component("row")` guard literals
are still pending shared parser integration.

Libraries may expose only selected declarations with `<library name="cards" exports="row Score">`.
An import can select a subset: `<import src="lib/cards.animl" as="cards" select="row"/>`.
Private dependencies remain available inside the library. Put `<model name="Score">…</model>` in
the library and use `data="Score"` on its component; references are renamed consistently when
compiled. [cards.animl](../examples/lib/cards.animl) and the three `components-library-*`
conformance examples show the expanded documents.

For local vendoring, retain the upstream path as import metadata:
`<import src="vendor/cards.animl" source="../shared/cards.animl" as="cards"/>`.
Run `anima library update icon.animl --check` to check staleness, then
`anima library update icon.animl` to refresh it. The command reads local files only, preflights
all sources before writing, and never contacts a service. Building continues to read the vendored
`src`, so library updates are explicit and reviewable.

Choose `renderer="canvas"` on the HTML host after importing `@anima-format/web/canvas` when a scene
needs world-space feathering or a raster surface for future scene features. Keep SVG for ordinary
icons, automatic CSS recolouring and visible overflow. The document and AniML do not change, and
all required paint/asset/component modules still load explicitly. Canvas follows CSS size and DPR;
call `invalidate()` when changing an idle canvas's colour slots. Consult the canvas comparison report
for raster differences and unsupported feature diagnostics before choosing it for a scene.

## Timeline control

Use `requires="motion bind"` for input-controlled timeline clocks. A state such as
`<state name="idle" play="turn" time="phase * 1.2"/>` scrubs a 1.2-second timeline from `phase`.
Quantize stays on the timeline, so the same sampling grid applies to ticking and scrubbing.
An input-controlled clock sleeps until its input changes.

For hover reversal, define one peek timeline, play it in a forward state and in a `speed="-1"`
state, and put `sync="true"` on both transitions. The target starts at the current clock,
including an enter during reverse. It keeps the usual interruptible-fade behaviour.

To stop a ticking loop cleanly, put `exitNext="step" sync="true"` on its stop transition.
Target a state playing the same timeline with `hold="true"` to keep the stopping angle.
Use `exitNext="loop"` to finish the turn instead. A target with a `time` expression also holds
that captured angle until the expression value changes, letting a phase input take over later.
Reduced-motion entry policy still takes precedence. See `anima docs motion` for timing details
and `modules/motion/examples/sync.animl` plus its sample scripts for a complete button.

`anima docs --list` includes every module chapter; `anima docs bind` explains expressions.

## Interaction examples

`anima docs input`, `anima docs focus` and `anima docs machine` include their complete
contracts inline and list module examples with built JSON siblings:

- `modules/input/examples/drag-slider.animl`: parent-space writes with a preserved grab offset.
- `modules/focus/examples/traversal.animl`: ordered focus, Tab and arrow traversal.
- `modules/machine/examples/blend-pulse.animl`: continuous blend plus restart on every increase.

`write='{"x":"level"}'` means event field x → input level; writes are values,
not arithmetic expressions. Use exact DOM keys such as `ArrowRight`, event `key-down`,
and `modifiers="shift+control"` for that exact held set.

Sample snapshots accept AniML spelling (`ring.trimEnd`) as well as JSON spelling
(`ring.stroke.trimEnd`), and always print JSON spelling. This applies to complete and
selected snapshots in either source format.

## Counting clicks with expressions

Declare `requires="bind events"`, a number `count`, and a trigger `pulse`. Then use
`<listener on="click" set="count=count+1" fire="pulse"/>`. No state ladder or host increment is
needed. A transition can use `when="pulse and count > 0 and mod(count, 5) == 0"` to select a
milestone state; keep the ordinary pulse transition after it. `floor(x)` and `mod(a,b)` use the
same evaluator as property bindings. Spaces around subtraction avoid hyphenated input names.

Sets within one action read one pre-action snapshot; separate actions see prior writes. Numbers
clamp to their input bounds. Machine state `entry`/`exit` and transition `actions` JSON attributes
accept the same actions. Emit `shared` on pulse entry and define its fields with
`<event-def name="shared" payload='{"count":{"type":"number","value":"{count}"},"channel":{"type":"string","value":"button"}}'/>`.
Fields resolve at the end of the step. Run `anima schema listener`, `anima schema state` or `anima schema transition` to inspect
the forms. See `modules/events/examples/share.animl` and its sample scripts for a complete share
button, including milestones past ten and an audio request verified through browser tests.

## Data: view models, `$` paths and converters

Declare `requires="data bind"` for view models and bindings, adding `convert` for named
converters. A model declares types; an instance stores values. This complete document declares
every supported property type. `type` on an `asset-ref` is the asset kind, not a model name.
Empty asset references need no asset declaration; nonempty references must name a declared asset
of the same kind (`image`, `font` or `blob`, with `requires="assets"`).

```xml
<anima version="0.1" name="data-types" grid="20" requires="data bind">
  <model name="Team"><string name="title" default="Blue"/></model>
  <model name="Player" global="true">
    <number name="score" default="0" min="0" max="100"/>
    <string name="name" default="Ada"/>
    <bool name="online" default="true"/>
    <color name="tint" default="#d97757"/>
    <trigger name="levelUp"/>
    <enum name="mood" values="calm happy angry" default="calm"/>
    <list name="items" of="Team"/>
    <model-ref name="team" model="Team"/>
    <asset-ref name="avatar" type="image"/>
  </model>
  <instance name="main" model="Player" default="true">
    <set path="score" value="12"/>
    <set path="team" value="blue"/>
  </instance>
  <instance name="other" model="Player"><set path="name" value="Grace"/></instance>
  <instance name="blue" model="Team"/>
  <circle id="dot" cx="10" cy="10" r="2" fill="#000"/>
  <bind target="dot.x" value="$score / 10"/>
  <bind target="dot.fill" value="$tint"/>
</anima>
```

`$score` resolves in the default instance; `$main:score` explicitly selects `main`.
`$team.title` walks a model reference. The default instance is the one flagged `default="true"`
(at most one), otherwise the first authored instance. With no instances the runtime constructs
`default` from the first model. Root `data='{"model":"Player"}'` explicitly selects a default
model. Instance `<set path="score">` initializes a property by its bare name; it is not a listener
action. Compound initializers use JSON in `value`. A named reference preserves identity.
`global="true"` shares matching named instances through a component tree; independent root players
still have independent storage. A component can declare `data="Player"` and its placement can use
`data="main"` to share the parent's instance; components without `data` inherit their parent when `lists` is declared; components with a public model keep local storage unless explicitly supplied a context.

Use `$` paths wherever an input name is accepted: conditions, binding expressions, listener and
state/transition actions, event fields and component input expressions. Strings/enums compare with
double-quoted literals; numbers accept arithmetic. Triggers use `fire`, never a stored default.
This document demonstrates conditions, `set`, `fire`, `copy`, event fields and a component input:

```xml
<anima version="0.1" name="data-actions" grid="20" requires="data bind events components">
  <model name="Score">
    <number name="score"/><number name="saved"/>
    <bool name="online" default="true"/><trigger name="pulse"/>
  </model>
  <instance name="main" model="Score" default="true"/>
  <circle id="dot" cx="10" cy="10" r="2" fill="#000"/>
  <component name="badge" grid="4">
    <number name="count"/>
    <circle id="pip" cx="2" cy="2" r="1" fill="#000"/>
    <bind target="pip.x" value="count"/>
  </component>
  <instance id="badge" component="badge" count="{$main:score}"/>
  <layer name="status" initial="idle">
    <state name="idle"><on when="$pulse and $online and $score > 0" to="done"/></state>
    <state name="done"><pose dot.x="2"/></state>
  </layer>
  <listener on="click" set="$score=$score+1" fire="$pulse" emit="scored"/>
  <listener on="change:$score" copy="$score -> $saved"/>
  <event-def name="scored" payload='{"score":{"type":"number","value":"{$score}"}}'/>
</anima>
```

Event fields resolve at the end of the step. `change:$score` compares final values after the step;
multiple writes coalesce. Its actions queue for the **next** step, including `advance 0`; they never
re-enter the current step. Change listeners observe every source, including host writes, bindings
and state actions firing triggers. This intentionally differs from the native internal-trigger
observation in `tests/oracle/input-data-listener/internal-trigger-difference/finding.json`.
Host API subscriptions also run after the step; callback writes wait for the next step.

A list of N items can drive N explicitly authored nodes without the lists module. The Lists section
below shows automatic repetition and item contexts. Here three model instances drive three nodes; `$items.2.title` selects the third
item and `$items.length` is a read-only number. `data-label` declares a custom string property;
`properties` JSON declares typed number/bool/string/color/enum/trigger properties when needed.
Custom channels use `node.properties.name`; strings/enums are discrete, hold-only channels.

```xml
<anima version="0.1" name="data-list" grid="20" requires="data bind">
  <model name="Item"><string name="title"/><number name="score"/></model>
  <model name="Board"><list name="items" of="Item"/></model>
  <instance name="main" model="Board" default="true">
    <set path="items" value='[{"title":"Ada","score":2},{"title":"Grace","score":4},{"title":"Lin","score":6}]'/>
  </instance>
  <circle id="a" cx="4" cy="10" r="1" fill="#000" data-label=""/>
  <circle id="b" cx="10" cy="10" r="1" fill="#000" data-label=""/>
  <circle id="c" cx="16" cy="10" r="1" fill="#000" data-label=""/>
  <bind target="a.r" value="$items.0.score"/>
  <bind target="b.r" value="$items.1.score"/>
  <bind target="c.r" value="$items.2.score"/>
  <bind target="a.properties.label" value="$items.0.title"/>
  <bind target="b.properties.label" value="$items.1.title"/>
  <bind target="c.properties.label" value="$items.2.title"/>
  <bind target="c.x" value="$items.length"/>
</anima>
```

Add `derive` for computed scalar properties. `value` is a bind expression, with optional
`convert` (requires `convert`). Inside a model `$score` means that instance's score;
`$main:players.0.score` remains absolute. Each list item gets its own computed values.
Number, string, bool, color and enum properties can be computed. Their `$` paths work in
conditions, bindings, event fields, selected sample snapshots and host handles.
They initialize on load and recompute in the data binding pass, before visual bindings.
Conditions earlier in the step see the previous resolved computed value. Host subscriptions
observe the final value after the step. Computed dependencies must be acyclic.

This scoreboard exposes `$players.0.label` as `1,250 pts`, `$players.1.label` as `980 pts`,
and `$players.2.label` as `40 pts`. Updating a score updates its label on the next step.
The three comparison bindings choose exactly one leader, with earlier players winning ties.

```xml
<anima version="0.1" name="derived-scoreboard" grid="20" requires="data bind derive convert">
  <model name="Player">
    <string name="name"/>
    <number name="score" min="0" max="2000"/>
    <string name="label" value="$score" convert="points"/>
    <bool name="milestone" value="$score >= 1500"/>
  </model>
  <model name="Board"><list name="players" of="Player"/></model>
  <instance name="main" model="Board" default="true">
    <set path="players" value='[{"name":"Ada","score":1250},{"name":"Lin","score":980},{"name":"Sam","score":40}]'/>
  </instance>
  <converter name="grouped" type="number-format" decimals="0" grouping="true"/>
  <converter name="suffix" type="template" text="{0} pts"/>
  <converter-group name="points" chain="grouped suffix"/>
  <circle id="a" cx="4" cy="10" r="1" fill="#000" data-label=""/>
  <circle id="b" cx="10" cy="10" r="1" fill="#000" data-label=""/>
  <circle id="c" cx="16" cy="10" r="1" fill="#000" data-label=""/>
  <bind target="a.properties.label" value="$players.0.label"/>
  <bind target="b.properties.label" value="$players.1.label"/>
  <bind target="c.properties.label" value="$players.2.label"/>
  <bind target="a.x" value="$players.0.score >= $players.1.score and $players.0.score >= $players.2.score"/>
  <bind target="b.x" value="$players.1.score > $players.0.score and $players.1.score >= $players.2.score"/>
  <bind target="c.x" value="$players.2.score > $players.0.score and $players.2.score > $players.1.score"/>
</anima>
```

Computed properties are read-only: `set`, `copy`, reverse binding modes and instance
initializers fail with `read-only-path`. Host `.set()` throws the same code; write `score`
instead. For example `icon.data.string('players.0.label').value` reads the label and
`.on('change', callback)` observes it after a step. Load `/derive` beside `/data` and `/bind`,
plus `/convert` when formatting. See `anima docs derive` and `modules/derive/examples/scoreboard.animl`.

Bind expressions also accept `<`, `<=`, `>`, `>=`, `==`, `!=`, `and`, `or`, `not`.
In XML attributes escape `<` as `&lt;`. Precedence, strongest first: unary `+ -`,
`* /`, `+ -`, comparisons, `not`, `and`, `or`; parentheses override it.
Comparisons require matching types; ordering requires numbers, equality accepts strings/enums
and booleans. Logic requires booleans and short-circuits. Results are bool; number targets
receive 0 or 1. The same grammar applies to `set` actions and computed expressions.

Bindings default to `mode="to-target"`: sample the source after state/timeline resolution and
write the target. `to-source` writes the target's underlying animated/rest value into the source.
`two-way` tracks both sides; simultaneous changes use `prefer="source"` (default) or `target`.
The initial evaluation counts both as changed. Reverse modes require a direct writable scalar
path, not arithmetic or list length. `once` computes once and holds the result. Reverse writes
apply in authored order after all bindings sample their snapshot; there is no binding iteration.

```xml
<anima version="0.1" name="data-modes" grid="20" requires="data bind">
  <model name="Controls">
    <number name="forward" default="2"/><number name="reverse"/>
    <number name="both"/><number name="initial" default="3"/>
  </model>
  <circle id="dot" cx="10" cy="10" r="1" fill="#000"/>
  <bind target="dot.x" value="$forward" mode="to-target"/>
  <bind target="dot.y" value="$reverse" mode="to-source"/>
  <bind target="dot.r" value="$both" mode="two-way" prefer="target"/>
  <bind target="dot.rotate" value="$initial" mode="once"/>
</anima>
```

`convert="name"` selects a declared converter or group. Groups run left to right; forward
references work, cycles do not. This example maps a fraction to a percentage, rounds it, formats
thousands with grouping, inserts it into a label, and smooths a numeric channel over 200 ms.
`interpolate` is initialized from the load value; duration uses milliseconds, unlike timelines.
Binding `options` JSON overrides declaration options; a whole `$path` option reads live data.

```xml
<anima version="0.1" name="data-converters" grid="20" requires="data bind convert">
  <model name="Score"><number name="progress" default="0.25"/><number name="points" default="1234.5"/></model>
  <circle id="dot" cx="10" cy="10" r="1" fill="#000" data-label="" data-total=""/>
  <converter name="pct" type="range" from="0 1" to="0 100" clamp="true"/>
  <converter name="whole" type="round" decimals="0" mode="round"/>
  <converter name="label" type="template" text="{0} percent"/>
  <converter-group name="percentage" chain="pct whole label"/>
  <converter name="money" type="number-format" decimals="2" grouping="true"/>
  <converter name="smooth" type="interpolate" duration="200"/>
  <bind target="dot.properties.label" value="$progress" convert="percentage"/>
  <bind target="dot.properties.total" value="$points" convert="money"/>
  <bind target="dot.x" value="$progress" convert="smooth"/>
</anima>
```

The label starts as `25 percent`; total is `1,234.50`. Other converter types:

| Type | Use and options |
| --- | --- |
| `formula` | `expression="sin(value) * 2"`; trig uses radians. `random="always|once|on-change"` controls seeded random evaluation. Math also includes cos/tan/inverse trig, log/exp/pow/sqrt/abs/round/ceil/floor. |
| `calculate` | `operation="add" operand="2"` (or a numeric `$path`); arithmetic/math operation. |
| `negate` | Invert a boolean. |
| `to-number`, `to-string` | ECMAScript conversion; nonnumeric strings become zero for to-number. |
| `color-format` | Hex/RGBA input; `format="hex|hexa|rgb|rgba"`. |
| `pad` | `length="8" fill="0" side="start|end"`; UTF-16 string length. |
| `trim` | Whitespace removal with `mode="start|end|all|none"`. |
| `remove-zeros` | Remove redundant fractional zeros and an empty decimal point. |
| `enum-to-index` | `values="calm happy angry"`; zero-based ordered member index. |
| `list-length` | List to number. |
| `number-to-list` | Bounded integer count to index values or repeated `item`; no retained model creation. |
| `trigger` | Boolean passthrough or truncated integer counter; no trigger-destination delivery yet. |
| `degrees-to-radians` | Multiply by pi/180; reverse multiplies by 180/pi. |
| `normalize` | `from="0 100"`; reverse denormalizes, no implicit clamp. |

`range` also supports modulo, reverse and easing. `round` accepts floor/ceil and 0–100 decimals.
Templates support positional/named `args` JSON (including `$path` values), sequential `{}` slots,
custom `open`/`close`, grouping and precision/padding such as `{points:2:8}`.
See `anima docs convert` for all defaults and limits.

Check a saved list example with these commands (shell single quotes preserve `$`):

```sh
anima validate board.animl
anima inspect board.animl
anima sample board.animl -e 'advance 0; snapshot $items.2.title $items.length $main:items.0.score c.r'
anima schema data
anima schema bind
anima docs data
anima docs convert
anima docs host
```

`inspect` lists scalar `$` paths as inputs; selected sample snapshots print their typed values.
For the list above the selected data values are `"Lin"`, `3`, `2`, with `c.r` equal to `6`.
Use `set $score 12`, `set $name "Ada"` and `fire $pulse` in sample scripts. Import
`@anima-format/web/data`, `/bind`, `/convert` as needed alongside the web runtime; host access
additionally needs `/host`. Inline markup also needs its matching markup bundles.

Common diagnostics carry a code, JSON pointer, message and hint (AniML also gives source positions):

| Code | Fix |
| --- | --- |
| `data-path` | Declare the property/instance; check the list index and `$main:score` spelling. |
| `data-type` | Match the declared type; use `fire` for triggers, not defaults or sets. |
| `data-model`, `data-instance` | Declare the referenced model/instance; flag only one default. |
| `data-property`, `data-enum` | Use valid property names, ordered numeric limits and unique enum members. |
| `data-readonly` | Write an item property, not list length. |
| `data-cycle` | Make nested defaults/references acyclic. |
| `data-asset` | Declare an asset with the reference's kind. |
| `data-binding` | Reverse modes need a direct writable path and compatible target. |
| `data-converter`, `convert-reference` | Declare the converter/group name. |
| `convert-cycle`, `convert-options`, `convert-type`, `convert-unknown-type` | Break group cycles; check type/option names and operand types. |
| `data-copy`, `data-value-source` | Use `$source -> $destination` of matching types; load input/focus for their value sources. |


<!-- invalid: data-trigger.animl -->
```text
<anima version="0.1" name="bad-trigger" grid="20" requires="data">
  <model name="Score"><trigger name="pulse" default="true"/></model>
  <circle id="dot" cx="10" cy="10" r="1" fill="#000"/>
</anima>
```

<!-- diagnostics: data-trigger.animl -->
```text
data-trigger.animl:2:23 error data-type triggers have no stored value
  hint: use fire with the trigger path
data-trigger.animl: 1 error
```

<!-- invalid: data-enum.animl -->
```text
<anima version="0.1" name="bad-enum" grid="20" requires="data">
  <model name="Score"><enum name="mood" values="happy happy"/></model>
  <circle id="dot" cx="10" cy="10" r="1" fill="#000"/>
</anima>
```

<!-- diagnostics: data-enum.animl -->
```text
data-enum.animl:2:23 error data-enum enum needs unique members or a declared system enum
  hint: check the data model, instance and property declaration
data-enum.animl: 1 error
```

Intentional converter differences: boolean → string is `"true"`/`"false"` (native true is
`"1"`); interpolation starts eagerly from the load value instead of snapping on the first
non-default change, and RGBA channel rounding is round-half-up. Decimal rounding and degrees →
radians keep doubles; measured native differences are float32 storage precision. Enum → index's
native dump is an observation limit. The unchanged findings and exact paths are linked in
`anima docs convert`; they remain findings, not passing oracle comparisons.

Not implemented: the 13 pending data inventory rows include data-backed keyframes, layout/text
consumers, script inputs/model API/scripted converters, upward-relative component lookup, editor
preview selection, export filtering, artboard references, contextual list-position properties and
text-style properties. The converter-options row's named integration now exists, but its inventory
status remains pending. The four pending convert rows cover HSL/component-format markers,
retained number-to-model-list creation, counter delivery into trigger destinations and scripted
converters. Scalar/index-list/boolean functions do not imply those broader capabilities. System
enums declare vocabulary only; they do not implement future layout/text consumers.

## Lists

Add `lists components data` to `requires` and import `@anima-format/web/lists` alongside
components, data and bind. A repeat creates one component player per list item. Bindings in that
component read the item: `$score` is its score, `$index` is its current zero-based position,
and `$parent.bonus` reads the enclosing board. The component's data declaration names the item's
model. `index` and `parent` are reserved property names (`reserved-name`).

```xml
<anima version="0.1" name="players" grid="30" requires="components data bind lists">
  <model name="Player">
    <number name="score"/>
  </model>
  <model name="Board">
    <number name="bonus" default="2"/>
    <list name="players" of="Player"/>
  </model>
  <instance name="main" model="Board" default="true">
    <set path="players" value="[{&quot;score&quot;:3},{&quot;score&quot;:7}]"/>
  </instance>
  <component name="row" grid="10" data="Player">
    <circle id="dot" cx="2" cy="2" r="1" fill="#000"/>
    <bind target="dot.r" value="$score"/>
    <bind target="dot.x" value="$index"/>
    <bind target="dot.y" value="$parent.bonus"/>
  </component>
  <repeat id="rows" list="$players" component="row" dy="10" size="30 10"/>
</anima>
```

`dy="10"` offsets each row by its current index; `dx` works the same way. `size="30 10"`
overrides each instance's local bounds without scaling its geometry. Inserting, removing or swapping
list objects preserves the surviving component players, including clocks and machine state.
A removed item releases its player. Repeated references to one object have separate players,
matched in occurrence order. There can be at most 256 live repeated instances per player.

For mixed models, use `component="Player:row Header:heading"`; JSON uses
`"component": {"Player":"row","Header":"heading"}`. Declare each mapped component with its own
model. A missing mapping for a list with a known model is `list-map`; an unmapped runtime model is
skipped and recorded in `listState(player).warnings` from `@anima-format/core/lists`.

An explicit `<instance id="badge" component="row" data="$team"/>` supplies a model reference;
`data="main"` selects a named instance. A component without `data` inherits its parent's context.
Inside a nested component, `$parent.parent.bonus` walks two context levels. `$index` is read-only;
relative parent paths are read-only too. A component with `data="Player"` keeps its own default
Player storage when it is placed without an explicit context.

Use `count` when a number supplies the length. This is the number-to-list form of a repeat;
instances retain index identity as the count grows and shrinks. Counts are floored, negative counts
produce no items, and counts above 256 are rejected.

```xml
<anima version="0.1" name="stars" grid="20" requires="components data bind lists">
  <model name="Board"><number name="stars" default="3"/></model>
  <component name="star" grid="4">
    <circle id="dot" cx="2" cy="2" r="1" fill="#e90"/>
    <bind target="dot.opacity" value="1 - $index / 10"/>
  </component>
  <repeat id="stars" count="$stars" component="star" dx="4"/>
</anima>
```

`anima schema repeat` lists both source fields. Inspect and sample accept the same documents;
select `rows/0/dot.r` in snapshots and use `rows.0.input` for a child input. Browser hosts using
AniML also import `@anima-format/web/markup-components` for component and repeat authoring.

## Page data API (host module)

Load `anima-icon.js`, `anima-data.js` and `anima-host.js` as module scripts, plus
`anima-markup.js` when using inline AniML. Data and host can arrive in either order.
Add `auto-bind` to select the default model instance, or call `icon.data.bind('main')`.
Wait for `anima:load` before accessing data. A retained API/handle belongs to that load;
reacquire it after reload. Destroying an icon stops its scheduler.

```js
const api = icon.data;
const score = api.number('$score');
const unsubscribe = score.on('change', (value) => {
  output.textContent = String(value);
});
api.batch(() => {
  score.set(10);
  score.set(12);
  api.string('$label').set('Ada');
});
// The next animation step delivers 12 once.
unsubscribe();
const next = api.create('Score', { score: 4, label: 'Grace' });
api.bind(next);
```

Use `models()` to discover properties and enum members, `instances()` for named
instances, `get('$main:score')` for an explicit read. `.boolean`, `.color`, `.enum`,
`.list`, `.image`, `.font` work like `.number`. `.trigger('$pulse').fire()` sends a
signal. Catch `DataError` to inspect `code`, `pointer`, `message`, `hint`.

`examples/page.html` is a self-contained page using the built browser bundles.
See `anima docs host` for the complete host contract.

## Editing page data (host-edit module)

Import `@anima-format/web/data`, `@anima-format/web/host`, and
`@anima-format/web/host-edit` (either host load order). Await the imports, then
`await customElements.get('anima-icon').ready`. This is module registration readiness;
`await icon.ready` waits for that icon's document.

```js
icon.data.bind(icon.data.defaultInstance());
const tracks = icon.data.list('$tracks');
const first = tracks.at(0);
icon.data.batch(() => {
  tracks.add({ title: 'Next' });
  tracks.insert(0, { title: 'Intro' });
});
// Changes appear on the next frame, or player.step(0) for manual playback.
// After that frame:
tracks.swap(0, 1);
tracks.remove(first); // follows the item identity, even after a move
icon.data.color('$accent').set([217, 119, 87, 255]);
console.log(icon.data.color('$accent').rgba, icon.data.color('$accent').hex);
icon.data.enum('$mood').index = 1;
console.log(icon.data.enum('$mood').values);
```

`tracks.length` is read-only; `tracks.at(i).string('title')` is a typed nested handle.
Call the nested accessor again after reordering to obtain its current property path.
To insert a shared or mixed-model item, pass `icon.data.instance('named')` or the record returned
by `icon.data.create('Track', values)`. `defaultInstance()` discovers but does not bind the default.

List helpers preserve stored item objects for the lists module's repeat matching. Whole-list
`.set()` remains a replacement. In a step mixing helpers with ordinary host `.set()` writes,
helpers apply first; use separate steps when the order matters.

With components imported, `icon.instance('badge').data` addresses the existing child's models.
`<anima-icon component="badge" src="icons.ani">` selects a component as root. Set the component
attribute before loading; change it and reload to select another component.

For images, point the property at a declared image asset first, then:

```js
await icon.data.image('$cover').set('/images/cover.png');
await icon.data.image('$cover').set(fileBlob);
```

These promises wait for decode. The next frame applies the decoded replacement to uses of the
current asset in that icon; the data value remains its asset name. Failed decode rejects with a
`DataError`. Use `assetPolicy = 'any'` (assets module) for external URLs. Core-only consumers can
set declared asset names, while URLs and Blobs require the web consumer.

For typed constructor readiness, import `AnimaIcon` from `@anima-format/web/host-edit` and await
`AnimaIcon.ready` after all desired module imports. The base web constructor has no preload cost.
