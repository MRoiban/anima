# The `.ani` format — 0.1

Status: **0.1, frozen for the first implementation.** Sections marked *(normative)* define behaviour
every runtime must reproduce exactly; the conformance suite in `spec/conformance/` is the tie-breaker
when prose and tests disagree. §12 records the decisions taken for 0.1 and what is deferred.

`examples/bell.ani` is the reference document. Every construct below appears in it unless marked
*(not in bell)*.

## 1. Goals

1. **Agent-authored.** A language model writes and edits `.ani` files directly as text, checks them
   with `anima validate`, and sees them with `anima sample` / `anima render`. Every mistake an author
   can make is either impossible to express or a load error naming the JSON pointer and the fix.
2. **Icon-scale and Glyphy-native.** Coordinates are glyph grid units. Glyphy's path data is embedded
   byte for byte and animated in place: nodes pick subpaths and declare pivots instead of rewriting
   geometry. The resting frame is identical to the static Glyphy SVG.
3. **Deterministic.** One `step(dt)` function, fully specified, so a headless run and a browser run of
   the same inputs produce the same values.
4. **Small and web-first.** The reference runtime renders retained SVG DOM, themes with CSS, sleeps
   when nothing moves, and is accessible by default.

Non-goals for 0.x: bones/meshes, text layout, scripting, nested artboards/components, raster images,
a binary encoding, importing `.riv`.

## 2. Document

A `.ani` file is UTF-8 JSON (RFC 8259) with media type `application/vnd.anima+json`. Keys named
`$comment` are allowed on any object and ignored. `$schema` is allowed at the top level.

| Key | Type | Required | Meaning |
|---|---|---|---|
| `anima` | `"0.1"` | yes | Format version. A 0.1 runtime loads exactly `"0.1"`; before 1.0 every minor version may change the format, so any other value is `version-unsupported`. |
| `name` | kebab-case string | yes | Identifier, `^[a-z0-9]+(-[a-z0-9]+)*$`. Must not end in `-<digits>` (Glyphy reserves that for variants). |
| `title` | string | no | Human name. |
| `grid` | number > 0 | yes | Glyph grid size in units (Glyphy's `style.grid`, usually 20). |
| `viewBox` | `[x, y, w, h]` | no | Drawing area in grid units, `w, h > 0`; defaults to `[0, 0, grid, grid]`. May be larger than the grid so motion has room (bell: `[-2, -2, 24, 24]`). |
| `requires` | string[] | no | Optional features the file uses. A runtime that lacks one refuses the file (`unknown-feature`). 0.1 defines `"knockout"`; listing it is allowed but not needed. |
| `meta` | object | no | Free-form metadata (strings, numbers, booleans, arrays and objects of them) that runtimes ignore and tools preserve, e.g. Glyphy's `concept`, `kind`, `stroke`. |
| `colors` | `{slot: color}` | no | Colour slots, see §6. |
| `glyphs` | `{name: Glyph}` | no | Embedded path data, see §3. |
| `a11y` | object | no | See §10. |
| `inputs` | `{name: Input}` | no | See §8. |
| `nodes` | Node[] | yes | Scene tree, see §4. |
| `hit` | `{ "circle": [cx, cy, r] }` or `{ "rect": [x, y, w, h] }` | no | Hit area of the whole icon, see §9. Default: the `viewBox`. |
| `timelines` | `{name: Timeline}` | no | See §5. |
| `machine` | object | no | See §8. |
| `listeners` | Listener[] | no | See §9. |

**Names.** Node ids, input, slot, glyph, timeline, layer, state and event names all match
`^[a-z][a-zA-Z0-9-]*$` (`bad-name`). Names starting with `@` are reserved for built-ins.

**Order.** JSON member order is significant in exactly one place: `machine.layers` (layer order
decides who writes last, §7). Tools must preserve member order. Everything else that is ordered is
an array.

**Strictness** *(normative)*. Unknown keys, unknown node types, unknown properties, duplicate ids,
dangling references, type mismatches (a colour keyframe on a number property), non-increasing
keyframe times and unreachable references are **load errors**. A runtime never partially loads a
document: it either loads with no errors or reports every error it found and loads nothing.
Every diagnostic has a `code`, a `severity` (`error` | `warning`), a JSON `pointer` (RFC 6901) to the
offending value, a `message` and, where possible, a `hint` (`did you mean "rotate"?`). Warnings never
stop a load. The codes are listed in §11.3. A size-optimised runtime build may drop message and
hint text (the message is then the code) and skip computing warnings; it still reports every error
with its code, severity and pointer, and `anima validate` gives the full text. Duplicate object keys are invalid JSON for `.ani`;
`anima validate` reports them (`duplicate-key`), while runtimes built on a standard JSON parser may
keep the last value. Keys reserved for a later version (§12) are reported as `reserved`, not as
unknown keys, so the message can say which version brings them.

For an unavailable optional feature, verbose diagnostics include the web module import,
for example `import '@anima-format/web/machine' before loading this document`. CLI tools
register the full feature set; an accepted CLI document still needs its declared modules in the browser.

A document declaring `components` may have an empty `nodes` array: it is a library container
whose exported components can be instantiated as host roots. Ordinary documents need a node.

**Limits.** Loaders refuse documents beyond these limits with `limit-exceeded`: 1 MiB of text, nesting
depth 32 nodes, 96 levels of JSON nesting anywhere (free-form values such as `meta` included),
2 048 nodes, 20 000 keyframes in total, 64 layers, 256 states per layer.

**Units** *(normative)*: lengths in grid units, y down; time in **seconds**; angles in **degrees**,
positive clockwise (y down), 0° along +x; opacity, scale and blend weights are plain numbers
(1 = 100 %). There are no frames or radians. The optional paint module adds percentage dash lengths (see its chapter).

## 3. Glyphs

```json
"glyphs": { "bell": { "source": "glyphy", "sha256": "…", "d": "M9.493 4.473C…Z" } }
```

| Key | Required | Meaning |
|---|---|---|
| `d` | yes | SVG path data. Glyphy writes absolute `M L C Z` only; runtimes accept the full SVG 1.1 path grammar (all commands, relative forms, implicit repeats, arcs) but tools emit Glyphy's subset. |
| `source` | no | Free text naming where the data came from (`"glyphy"`). |
| `pick` | no | Glyphy's variant stem (`"bell-1"`). |
| `sha256` | no | Hex SHA-256 of the `d` string's UTF-8 bytes. Tools use it to detect a re-traced glyph; a mismatch is the warning `hash-mismatch` from `anima validate`, not a load error. |

Subpaths are numbered from 0 in the order their `M`/`m` commands appear. A path node takes
`"subpaths": [i, …]` (distinct, in range, any order — they are always drawn in `d` order); omitted
means all.

## 4. Nodes

Every node has `id` (unique across the document) and `type`. Paint order is **document order, later
on top** (SVG order — the reverse of Rive).

Common properties (all animatable unless noted):

| Property | Type | Default | Meaning |
|---|---|---|---|
| `x`, `y` | number | 0 | Translation. |
| `rotate` | number | 0 | Degrees about `pivot`. |
| `scale` | number | 1 | Uniform scale about `pivot`; multiplies `scaleX`/`scaleY`. |
| `scaleX`, `scaleY` | number | 1 | Axis scales about `pivot`. |
| `opacity` | number | 1 | Group opacity, clamped to 0..1 when resolved. |
| `visible` | boolean | true | Hold-only. An invisible node draws nothing, hits nothing and cuts nothing. |
| `pivot` | `[x, y]` | `[0, 0]` | **Not animatable.** Point the transform turns and scales about. |

**Transform** *(normative)*: children are authored in the same grid coordinates as their parent (no
re-origining, so Glyphy geometry is used as-is). A node's local matrix is

`T(x, y) · T(px, py) · R(rotate) · S(scale·scaleX, scale·scaleY) · T(−px, −py)`

and its world matrix is `parent.world · local` (the root's parent is the identity in `viewBox`
coordinates). Because nothing is re-origined, the pivot is the same point in the node's and its
parent's coordinates at rest.

Types:

| `type` | Own keys | Notes |
|---|---|---|
| `group` | `children` (Node[]) | |
| `path` | `glyph` + optional `subpaths`, **or** inline `d` | Exactly one of `glyph` and `d` (`path-source`). |
| `circle` | `center` `[x, y]`, `r` (animatable, ≥ 0) | Its outline starts at angle 0 and runs in the direction of increasing angle (matters for trims). |
| `rect` | `x0`, `y0`, `w`, `h`, `rx` (`w`, `h`, `rx` animatable, ≥ 0; `rx` defaults to 0) | *(not in bell)* Outline starts at `(x0 + rx, y0)`, clockwise. |
| `arc` | `center`, `r`, `from`, `to` (`r`, `from`, `to` animatable) | Open circular arc, angles in degrees, drawn from `from` to `to` in the direction of increasing angle. At rest `0 < to − from ≤ 360` (`bad-value`). Stroke only (`arc-fill`). |

Paint (on `path`, `circle`, `rect`, `arc`):

- `fill`: `{ "color": slot-or-color, "rule": "nonzero" | "evenodd" }` — `rule` defaults to `nonzero`;
  Glyphy glyphs need `evenodd`.
- `stroke`: `{ "color", "width", "cap", "join", "trimStart", "trimEnd", "trimOffset" }`.
  `width` defaults to 1, `cap` (`butt`|`round`|`square`) and `join` (`miter`|`round`|`bevel`) default
  to **`round`** — Glyphy styles carry no cap or join, and the reference sets are round. Trims are
  fractions of the outline's length: the visible part runs from `trimStart + trimOffset` to
  `trimEnd + trimOffset`, wrapping around 1 (defaults 0, 1, 0; start and end clamp to 0..1 when
  resolved). When `trimEnd − trimStart ≤ 0` nothing is stroked (no dots from round caps). Trims are
  allowed on `circle`, `rect`, `arc` and single-subpath `path`s (`trim-multi-subpath`).
- Animatable paint addresses: `<id>.fill.color`, `<id>.stroke.color`, `<id>.stroke.width`,
  `<id>.stroke.trimStart|trimEnd|trimOffset`.
- A painted node with neither `fill` nor `stroke` draws nothing (warning `no-paint`); it can still be
  a listener target.
- **Stroke width scales with the world transform** *(normative)*, as SVG and Glyphy ink do (§12.1).

**Knockout** *(normative)*: `"knockout": w` (number ≥ 0) on a painted node cuts the node's painted
area — its fill area if it has a fill, plus its stroke area if it has a stroke — grown by `w` units
(as if stroked with width `2w`, round joins and caps), out of every **earlier sibling** in the same
parent, following the node's animated transform. The cut's strength is the node's own resolved
`opacity`; an invisible node cuts nothing. Later knockouts cut earlier knockout nodes too. This
replaces the "paper-coloured disc" trick, so badges work on any background. (bell: the
notification dot cuts the body and clapper.)

## 5. Timelines

```json
"timelines": { "ring": { "duration": 1.4, "loop": "once", "reducedMotion": "end",
  "tracks": { "swing.rotate": [[0, 0, "cubic(0.2, 0, 0.3, 1)"], [0.116667, 17.1887, "…"], [1.1, 0]] },
  "events": [[0.05, "ding"]] } }
```

- `duration` seconds (> 0). `loop`: `once` (default) | `loop` | `pingpong`. `reducedMotion`: §10.
- `tracks` maps a **property address** `"<node-id>.<property>"` to keyframes `[time, value, ease?]`
  (at least one). Times strictly increase (`key-order`) and lie in `[0, duration]` (`key-range`).
  The value type must match the property (number, colour string, boolean) (`value-type`).
- `events` *(not in bell)*: `[time, name]` pairs, `time` in `[0, duration]`, reported when playback
  crosses them (§7).

**Clock boundaries** *(normative, every runtime)*. Time calculations use IEEE-754 binary64
seconds. Use the absolute constant `ε = 1e-9` seconds in the clock being compared (state,
fade, or unquantized timeline seconds, after speed/offset conversion). A clock `t` has
**reached** a boundary `b` iff `t ≥ b − ε`; it is strictly before it otherwise. This
applies to event crossings, key sampling, `@after`/`@end`, exit/exitFraction/exitNext,
fade completion (including entry carry), trigger-buffer expiry and settled detection.
A strict "later than" comparison means `!reached(b, t)` (`b < t − ε`). Never scale ε with
elapsed time, frame rate, speed or duration; never round the accumulated clock or `dt` to a time grid.
Carry remains `max(0, t − b)`, so early recognition introduces no negative target time.
Events, sampling, once completion and `exit`/`exitFraction` compare in source-timeline
seconds; `@after`, fades, buffer ages and armed `exitNext` state-time gates compare in
state/fade seconds. Authored times, input/value comparisons and validation ranges retain
their exact meaning.

For forward events use `!reached(previous, event) && reached(now, event)`; on entry replace
the first test with `reached(event, previous)`. For reverse events use
`!reached(event, previous) && reached(event, now)`, likewise including the previous bound
on entry. Thus an event recognized within ε fires once, including across `step(0)`;
nearby distinct authored events retain their identity and authored ordering. A pingpong
endpoint has one occurrence per full period: enumerate it with the authored endpoint
plus an integer multiple of the period, never both the forward and reflected formulas
(they can differ by a binary64 rounding bit). This does not merge distinct authored events.

For sampling choose the last key reached by `t` (or the first if none), snapping `t`
to that key when within ε before interpolating. For repeating clocks and work areas,
snap the offset from work start to the nearest integer multiple of the work span when
within ε, before folding; a loop boundary folds to the start and a pingpong turn to
its endpoint. Grid-index floor operations recognize that integer tick directly,
avoiding a second division rounding below it. Quantize similarly recognizes a sample
grid point within ε; otherwise it floors as usual. Halfway ties choose the greater
grid index. This local comparison rule preserves arbitrary authored sub-microsecond
times without imposing integer-microsecond rounding on all frames or changing clock speed.

**Sampling** *(normative)*, for track keys `k0 … kn` at local time `t`:
- `t ≤ t0` → `v0`; `t ≥ tn` → `vn`.
- Otherwise find `i` with `ti ≤ t < ti+1`; `u = (t − ti) / (ti+1 − ti)`; the **ease on key `i`**
  (the left key of the segment) maps `u → w`; result `vi + (vi+1 − vi) · w`. The ease on the last key
  is never read and should be omitted.
- Booleans take `vi` for the whole segment; their keys may only carry `hold` or no ease (`bad-ease`).
- **Colours** interpolate per channel in non-premultiplied sRGB, channels 0..255 including alpha:
  `c = vi.c + (vi+1.c − vi.c) · w`, then `round(c) = floor(c + 0.5)` and clamp to 0..255 (§12.2).

**Eases** *(normative)*, written as strings:

| Ease | Definition |
|---|---|
| omitted / `linear` | `w = u` |
| `hold` | `w = 0` |
| `in`, `out`, `inOut` | `cubic(0.42, 0, 1, 1)`, `cubic(0, 0, 0.58, 1)`, `cubic(0.42, 0, 0.58, 1)` |
| `cubic(x1, y1, x2, y2)` | CSS `cubic-bezier`: with `Bx`, `By` the Bézier through `(0,0) (x1,y1) (x2,y2) (1,1)`, find the parameter `s ∈ [0, 1]` with `Bx(s) = u` and return `By(s)`. `x1, x2 ∈ [0, 1]` (so the root is unique); `y` unbounded (overshoot allowed). Implementations must be within 1e-7 of the exact root (Newton from the linear guess, falling back to bisection, is sufficient). `w(0) = 0` and `w(1) = 1` exactly. |
| `elastic(a, p)` | Ease-out elastic, `a ≥ 0`, `p > 0`: with `A = max(a, 1)`, `s = p / (2π) · asin(1 / A)`; `w = A · 2^(−10u) · sin((u − s) · 2π / p) + 1`; `w(0) = 0`, `w(1) = 1` exactly. |

Arguments are JSON numbers separated by commas; spaces are optional. `spring(…)` is reserved for a
later minor version (`reserved`). Golden vectors for every ease live in
`spec/conformance/eases.json`.

**Local time** *(normative)*. A timeline played for `τ` seconds (state time × `speed`, §8) is at local
time: `once` → `min(τ, d)`; `loop` → `τ − d·⌊τ/d⌋`; `pingpong` → with `q = τ − 2d·⌊τ/2d⌋`,
`q ≤ d ? q : 2d − q`. A `once` timeline has **finished** when `τ ≥ d`.

## 6. Colours

`colors` declares named slots: `{ "ink": "currentColor", "accent": "#d97757" }`. A paint `color` is
either a slot name or a literal (`#rgb`, `#rrggbb`, `#rrggbbaa`, case-insensitive, or `currentColor`);
anything else is `bad-color`, and a name that is not a declared slot is `unknown-color-slot`.
In the web runtime a slot renders as `var(--anima-<slot>, <default>)`, so pages theme icons with CSS:
`anima-icon { color: …; --anima-accent: … }`. Static renders use the slot's default unless the
caller overrides it.

Slots are not animatable in 0.1. A paint colour that any track or pose writes must have a hex
literal as its document value, and every keyframe and pose value for it must be a hex literal
(`color-slot-animated`).

### Optional slot mixing (`colormix`)

With `requires: ["colormix"]`, a node fill or stroke can replace `color` with
`"mix": { "a": "off", "b": "on", "t": 0.3 }`. The endpoints are hex literals or declared
slots with hex defaults; they remain static references. `currentColor` defaults are rejected
(`colormix-color`) because static renderers cannot resolve page inheritance. Page overrides may
still use `currentColor`. Slots themselves remain non-animatable.

The number address `<id>.<fill|stroke>.mix.t` is animatable and bindable through the ordinary
numeric channels. Its rest value must be in 0..1 (`colormix-range`); sampled, blended and bound
values clamp to that interval after resolution. Ordinary numeric key/pose validation applies.
AniML uses a child `<colorMix a="off" b="on" t="0.3"/>` (default fill), or
`<colorMix paint="stroke" .../>`; install `@anima-format/web/markup-colormix` for browser
compilation. Stroke width/cap/join keep their usual spelling. This module adds no syntax to the
base AniML colour parser. JSON Schema and CLI schema describe `fill.mix` and `stroke.mix`.

SVG renders `color-mix(in srgb, var(--anima-off, <default>), var(--anima-on, <default>) 30%)`.
The second colour has weight t and the first 1−t. Literal-only and static SVG renders resolve the
colours first; static renders use defaults or supplied slot overrides. Canvas resolves page slots
from its owning host, including offscreen effects surfaces. All interpolate **premultiplied** sRGB
channels and alpha, then unpremultiply (zero alpha gives zero RGB), round channels to the nearest
8-bit value with ties upward, and clamp to 0..255. This matches CSS `color-mix(in srgb)`; it does
not change §5's existing non-premultiplied colour-track interpolation.

`mix` cannot accompany `color`, gradient `type`, or component `paint`, and is currently a node
fill/stroke source, not an ordered `paints` entry (`colormix-source`). Invalid endpoint names or
non-hex defaults are `colormix-color` at `/nodes/…/<paint>/mix/a` or `/b`, with a hex/default hint.
An out-of-range rest weight is `colormix-range` at `…/mix/t`, with a 0..1 hint. Malformed objects,
missing arguments, incorrect argument types and unknown fields retain registry diagnostics
(`type`, `missing-key`, `unknown-key`) at the object/argument. Absent declarations use
`undeclared-feature` at `…/mix`. A paint still needs exactly one colour/gradient/source.

## 7. Playback, blending and the step function *(normative)*

A **player** holds: input values, pending triggers, and per layer: the current state, its **state
time** (seconds since entry), and an optional crossfade (a frozen *from* snapshot, its duration, ease
and elapsed time). A new player has every input at its default and every layer in its initial state
at time 0 with no crossfade; its values are resolved as by steps 3–4 below, and nothing else is
evaluated until the first `step`, which reports the initial states' entry events (`emit`s and
timeline events at time 0) before anything else.

**Resolve rule.** Each layer is a function from the values below it to the values above it. Start
from the **rest values** (each property's document value, or its registry default). Let `S(state)`
be the set of addresses a state writes: its pose's keys, or its timeline's tracks. A layer that is
not crossfading writes `sample(state, p)` for every `p ∈ S(state)` and passes every other property
through. A layer crossfading from snapshot `F` to state `T` with eased progress `w` writes, for every
`p ∈ dom(F) ∪ S(T)`, `lerp(a, b, w)` with `a = F[p]` if `p ∈ dom(F)` else the value below, and
`b = sample(T, p)` if `p ∈ S(T)` else the value below. So a property the target state does not set
blends back to what is below it — for a single layer, its rest value. `lerp` is linear for numbers,
per channel with rounding for colours (§5), and for booleans `a || b` while the crossfade runs and
`b` once it ends. Later layers win where two layers write the same property.

`step(dt)` with finite `dt ≥ 0` seconds does, in order:

1. **Inputs.** Apply queued writes in arrival order (`set`, `fire`, `toggle`). Number writes clamp to
   the input's `min`/`max`. A fired trigger becomes pending (firing a pending trigger again is a
   no-op). Listener `emit` actions add their events now. A queued listener action evaluates its
   expression-valued sets here, when that action is reached, using one pre-action input snapshot
   for all its sets (§bind). Later actions see earlier writes. With `derive`, recompute
   computed inputs once after this queue, before clocks and machine guards (derive chapter).
2. **Clocks.** Motion clock expressions and `exitNext` gates prepare here (motion chapter). Advance every layer's state time and crossfade elapsed time by `dt`. A crossfade whose
   elapsed time reaches its duration ends (using §5 clock boundaries).
3. **Layers**, in declaration order, each against the values resolved by the layers before it:
   1. *Timeline events.* Report the current state's timeline events crossed by step 2 (below).
   2. *Transitions.* Unless a non-interruptible crossfade is running (§8), evaluate the current
      state's `on` list in order; take the first transition whose
      condition holds. Taking it: (a) freeze the layer's current output for `dom(F) ∪ S(current)` as
      the new snapshot `F` (this is also what makes interrupting a crossfade smooth); (b) mark the
      triggers the condition named as consumed by this layer; (c) enter the target: state time =
      **carry** (the overshoot `t − threshold` of the `@end`/`@after` term that made the condition
      hold, the largest one if several; else 0), crossfade elapsed = carry; a `blend` of 0 drops the
      snapshot; (d) run the source exit, transition actions and target entry blocks (§bind), then
      report the target's `emit`, then its timeline events in `[0, carry]`. Then
      evaluate the new state's `on` list the same way. A layer takes at most **16** transitions per
      step; reaching the cap reports the event `@limit` for that layer and stops its transitions for
      this step. A trigger already consumed by this layer does not hold for it again in this step.
   3. *Write* the layer's output over the values (resolve rule).
4. **Bindings, then clamp.** Evaluate declared `bind` expressions against the current inputs,
   overriding the state-machine values (see the bind chapter). Clamp resolved values to their property's range (`opacity`, trims 0..1; `r`, `w`, `h`,
   `rx`, `stroke.width` ≥ 0).
   **Layout stage (optional).** After bindings and clamping, resolve participating boxes using
   the layout contract, including nested-player/post-step updates, before drawing. Guards read
   the previous step's boxes; layout never reruns transitions in the current step.
5. **Triggers.** A pending trigger that some layer consumed this step is cleared. One that no layer
   consumed is cleared too, unless its input declares `"buffer": seconds`: then it stays pending until
   it has been pending for longer than `buffer` seconds of step time, or is consumed.
6. Return `{ events, settled }`.

**Timeline events.** A play state reports each event whose time, mapped through the loop mode, lies
in `(τprev, τnow]` of played time, plus events at time 0 when the state is entered; for `loop` an
event at `te` occurs at `te + k·d`, for `pingpong` at `te + 2kd` and `2(k+1)d − te` (counted once
when those coincide); a `once` timeline reports nothing after it finishes. Events are reported in
time order. Each event is `{ name, layer, time }`: `time` is the event's timeline time, or 0 for an
`emit`; listener events have `layer: null`. Order within one step: listener events, then layer by
layer in declaration order as described in step 3.

**Settled.** `settled` is true when no trigger is pending and every layer is at rest: no crossfade
is running, the current state is a pose or a finished `once` timeline (or a timeline frozen by
reduced motion, §10), and none of the current state's transitions has an `@after(s)` term with
`s` greater than the state time. A settled player's values cannot change until an input changes, so
it needs no frames until then.

Large `dt` is processed in one step; runtimes clamp `dt` to 0.25 s per frame for display, but the
headless `sample` command does not.

## 8. Inputs and the state machine

```json
"inputs": { "ring": { "type": "trigger" }, "hover": { "type": "bool" }, "level": { "type": "number", "default": 0, "min": 0, "max": 1 } }
```

Types: `bool` (`default` false), `number` (`default` 0, optional `min` ≤ `max`; the default must lie
in range), `trigger` (optional `buffer` ≥ 0 seconds, default 0). Inputs are the **only** host
interface: the page sets them, listeners set them, conditions read them. (Rive moved from
state-machine inputs to view models; at icon scale one flat typed namespace does both jobs.) Host
writes to an unknown input or with the wrong type are rejected by the API, never ignored.

```json
"machine": { "layers": { "ring": { "initial": "idle", "states": {
  "idle":    { "pose": { "dot.scale": 0 }, "on": [{ "when": "ring", "to": "ringing" }] },
  "ringing": { "play": "ring", "emit": "rang", "on": [{ "when": "@end", "to": "rested" }] } } } } }
```

- A **layer** has `initial` (a state name) and `states`.
- A **state** has exactly one of `pose` (a map of property address → value, i.e. a timeline of one
  instant; `{}` writes nothing) or `play` (a timeline name, optional `speed` > 0, default 1), plus
  optional `emit` (event name on entry) and `on` (transitions) (`state-kind`).
- Entering a `play` state restarts its timeline at 0; its played time is state time × `speed`.
- A **transition** `{ "when", "to", "blend", "ease", "interruptible" }`: `when` and `to` are
  required; `blend` is a crossfade duration in seconds (default 0); `ease` shapes the crossfade
  (default `linear`). `interruptible` (default `true`): when `false`, the layer takes no transitions
  while the crossfade this transition started is running, so the target pose is fully reached first
  (a quick click still shows its press). Triggers are cleared as usual meanwhile — give the input a
  `buffer` if a fire must survive the crossfade. `to` may
  name the current state (re-entering it restarts its timeline) only if the condition contains a
  trigger, `@end` or `@after` term (`self-transition`), so it cannot re-fire every step.
- **Conditions** (`when`), a deliberately tiny grammar (`bad-condition` otherwise):

  ```
  condition := term ( "&&" term )*
  term      := "!"? NAME  |  NAME OP NUMBER  |  EXPR OP EXPR  |  "@end"  |  "@after(" NUMBER ")"
  OP        := "==" | "!=" | "<" | "<=" | ">" | ">="
  ```

  `name` holds when the trigger is pending (and not yet consumed by this layer this step) or the
  bool is true · `!name` when the bool is false · `name OP number` compares a number input ·
  `@end` when the state's `once` timeline has finished · `@after(s)` when the state time is at least
  `s`. All terms must hold. There is no `||`: write two transitions. Whitespace between tokens is
  ignored. `EXPR OP EXPR` requires `bind` and uses its numeric expression language; legacy
  `NAME OP NUMBER` keeps its number-input-only type rule, including when bind is declared.
  Arithmetic comparisons may be joined with existing trigger/time/bool terms.
- Load errors: unknown input (`unknown-input`); a negated trigger, a bare number or a compared
  bool/trigger (`input-type`); `@end` on a pose state or a `loop`/`pingpong` timeline (`bad-end`).
  Warnings: states no transition can reach (`unreachable-state`), inputs nothing reads or writes
  (`unused-input`).

## 9. Listeners

```json
"listeners": [ { "on": "click", "fire": "ring" }, { "on": "enter", "set": { "hover": true } } ]
```

- `on`: `enter` | `leave` | `down` | `up` | `click` | `move` *(drag: later)*.
- `target`: a node id, or omitted for the **whole icon** (the top-level `hit` shape if given, else
  the `viewBox`). A node target hits where its painted area is: fill area by its fill rule, plus the
  stroke within half its (world) width, of the node or, for a group, of any painted descendant,
  grown by the listener's optional `"hitPadding"` (grid units, ≥ 0). Invisible nodes do not hit.
  Hit testing may approximate curves, but must be exact for points farther than 0.05 units from an
  edge.
- Actions, at least one: `fire` (trigger name or list), `set` (`{ input: value }` for bool and
  number inputs; expression strings additionally require `bind`), `toggle` (bool input name or list) *(not in bell)*, `emit` (event name)
  *(not in bell)*. Action keys run in that order: `fire`, `set`, `toggle`, `emit`.
- **Pointer model** *(normative)*. The host reports pointer events in grid coordinates:
  `move(x, y)`, `down(x, y)`, `up(x, y)` (primary button only) and `leave()` (pointer left the icon
  or was cancelled). For each event, the player updates which targets are under the pointer, then
  runs listeners, in document order within each group: first `leave` for targets no longer under
  the pointer, then `enter` for targets newly under it, then `move`/`down`/`up` for targets under it,
  then `click`. `click` fires on `up` for a target that was also under the `down`, when the pointer
  moved less than 0.5 grid units in between. `leave()` cancels a press and leaves every target.
- Listener actions are queued as input writes for the next `step` (§7.1); runtimes call `step(0)`
  immediately after each pointer event so a press is visible in the same frame.

## 10. Accessibility and motion

### Web element sizing

The SVG `<anima-icon>` host defaults to a width of `1em` and an automatic height
with CSS `aspect-ratio` from the loaded model's viewBox width/height. Selecting a
root `component` uses that component's viewBox. Author CSS width, height and
aspect-ratio declarations take precedence over these shadow stylesheet defaults;
setting both dimensions keeps the authored box. Reloading or changing the shown
component refreshes the default ratio. Fit/alignment control the drawing within
that box. In the default grid/bleed mapping the host's long axis spans `grid`
units and its short axis follows the viewBox aspect. For a host `W×H` with the
viewBox aspect `w/h`, the uniform scale is `s=W/grid` when `w>=h`, otherwise
`s=H/grid`. The SVG viewport is `(x*s,y*s,w*s,h*s)` relative to the host and
retains the source aspect. If author CSS gives the host another aspect, a
non-square source still uses the same source-long-axis scale rule and keeps its
own aspect; square sources retain their legacy per-axis viewport placement.
Canvas uses the same placement; pointer coordinates
invert the drawing transform and semantic overlay bounds use it forwards.
Legacy square-viewBox grid offsets remain unchanged. The shadow SVG exposes
`part="svg"`; the canvas backend's canvas exposes `part="canvas"`. These hooks must
survive every shadow rebuild, including text-run changes, reloads and renderer switches,
so page `::part()` rules continue to apply.

### Host input queue

Web-host `set(name,value)` and `fire(name)` calls made without a player are queued
in call order. They are applied once to the next player created by that host,
before its first step, including when asset preparation deferred creation.
Superseded load completions do not consume the queue. Names and values are validated
by the player's normal methods when the queue is applied.

### Host settling

`icon.settle()` resolves current inputs, blends and once-timelines by stepping the
player first at `dt=0`, then at `dt=0.25` until settled or 60 simulated seconds have
elapsed. It returns whether rest was reached. Events from these steps are discarded;
no `anima:event` or `anima:state` is dispatched, and the settled state notification
baseline is updated so the next ordinary frame does not replay a suppressed change.
The result is drawn and ARIA updated. It preserves pause, speed and reduced-motion
settings, resets the display clock and re-arms normal playback when still busy.
Before a player exists it queues once, in order with host input calls, returns false,
and is resolved before that player's first draw. This supports mounting a control
already at rest after `set()` without animating from its initial state.

### Semantics and motion

The optional browser semantic overlay, native controls, focus synchronization and
host tree/diff API are specified in [a11y-dom/SPEC.md](../modules/a11y-dom/SPEC.md).
It consumes node accessibility; root document `a11y` below is unchanged.

`"a11y": { "role": "button" | "switch" | "img", "label": "…", "activate": "<trigger or bool>", "pressed": "<bool>", "held": "<bool>" }`

- `button`/`switch`: the element is focusable and exposes the role and `label`. **Enter** activates
  on key down (not on repeats); **Space** activates on key up — as native buttons do.
  Activation fires the trigger named by `activate`, or toggles it if it is a bool.
  While either key is held, the bool named by `held` (if any) is true. `pressed` names a bool input
  that `aria-pressed` (`button`) or `aria-checked` (`switch`, where it is required) follows.
- `img` or no `a11y`: `role="img"` with the label, or `aria-hidden` when there is no label.
- `activate`, `pressed` and `held` must name inputs of the right type (`unknown-input`, `input-type`).
- **Reduced motion.** Each timeline declares `reducedMotion`: `play` | `end` | `skip`, default `end`.
  With reduced motion on, entering a play state whose timeline says `end` freezes it at local time
  `d`, reporting all its events at once; `skip` freezes it at local time 0 and reports none; `play`
  plays normally. A frozen `once` timeline counts as finished (so `@end` holds at once) and a frozen
  timeline of any loop mode counts as at rest. Every crossfade takes 0 s. The web runtime follows
  Switching reduced motion on re-resolves all active play states at the next step: `end`
  freezes at `d`, reporting only events in (current local time, `d`] once (the rest of the
  current cycle for loops); `skip` freezes at 0 without events; `play` is unchanged.
  Motion work ranges and reverse playback use the same start/finish endpoint as state entry.
  In-progress crossfades complete immediately. Switching off resumes frozen loops from
  their frozen local time; frozen `once` states stay finished. This implements the stop
  request behind WCAG 2.2.2 even when the preference changes mid-animation (see
  `docs/research/rive-web-runtime.md`, recommendation 7). The web runtime follows
  `prefers-reduced-motion` unless the element sets `motion="full"` (or `motion="reduce"` to force it).

The host and semantic overlay do not stop DOM event propagation. Page listeners on
ancestors receive keyboard and pointer events that originate on an icon. Anima calls
`preventDefault()` only when its own handling consumes the browser default; internal
host routing guards prevent the same event from being handled twice.

## 11. Conformance

### 11.1 Cases

`spec/conformance/<case>/` holds `case.animl` (the authored source), `case.ani` (the compiled build
output), `script.txt` and `expected.jsonl`. `case.ani` is the runtime's normative input; hand-written
`.ani` remains valid. `npm run build:animl` rebuilds the sibling `.ani` files, and
`node tools/build-animl.ts --check` checks that they are current. Every runtime and the CLI run the
whole suite in CI. Numbers are compared at 1e-6, everything else exactly.

### 11.2 Script language

One command per line; `#` starts a comment. The same language drives `anima sample`.

| Command | Does |
|---|---|
| `advance <seconds> [in <n>]` | `step(seconds / n)` `n` times (default 1). |
| `set <input> <true\|false\|number>` | Queue a write. |
| `fire <input>` / `toggle <input>` | Queue a fire / toggle. |
| `pointer move\|down\|up <x> <y>` | Report a pointer event in grid units, then `step(0)`. |
| `pointer click <x> <y>` | `move`, `down`, `up` at that point, each followed by `step(0)`. |
| `pointer leave` | Report `leave()`, then `step(0)`. |
| `focus target <id>` / `focus clear` | Change logical focus, then step(0); requires focus. |
| `focus traverse <direction>` | Traverse next/previous/left/right/up/down, then step(0). |
| `key down\|up <key> [shift]` | Deliver a deterministic focus key, then step(0); input module integration extends this dispatch. |
| `semantics [id]` | Print the semantic tree or subtree as one JSON line; requires a11y. |
| `semantic <id> tap\|increase\|decrease\|focus` | Perform an advertised semantic action, then step(0); requires a11y-actions. |
| `motion reduce\|full` | Turn reduced motion on or off at the next step, including active states. |
| `touch down\|move\|up <id> <x> <y>` | Input-module pointer API with an integer id ≥ 0, in grid units; `up` also leaves. Each delivery is followed by `step(0)`. |
| `pointer drag <x0> <y0> <x1> <y1> [in <n>]` | Move/down at start, `n` equally spaced moves, up at end; each delivery steps at 0. Default `n=1`. |
| `contact move\|down\|up <id> <x> <y> [button]` | Input-module pointer, preserving pointer ids. `contact leave\|cancel <id>` ends a contact. |
| `key down\|up\|repeat <key\|Space> [shift+control+alt+meta\|-] [target]` | Extended key API when input is required; otherwise the focus-only spelling above. |
| `scroll <x> <y> <dx> <dy> [start\|move\|end\|cancel] [seconds]` | Input-module scroll API in grid units, followed by `step(0)`. |
| `gamepads <JSON-array>` | Poll the input-module gamepad API, then `step(0)`; records have index, connected, optional mapping, axes and buttons. |
| `pointer-enable <id> <true\|false>` / `scroll-cancel` | Enable a pointer or cancel scroll latching, then `step(0)`. |
| `data set <$path> <value>` | Queue a typed public host-data handle write; applies on the next step. JSON strings, bools, numbers, colors and lists are accepted according to the property type. |
| `data dump [prefix …]` | Print `{data: {path: value}}` as one JSON line. No prefixes selects all; multiple prefixes form a union. Includes named instance paths and default scalar aliases. |
| `data watch <$path …>` | Remember current values. Each later snapshot carries a `data` object of watched values changed since the previous snapshot (or watch registration). |
| `data break <$path> [== value]` | Preflight each next step by instrumented replay on an isolated player. Stop before applying the step live at the first write (including same-value or overwritten writes, optionally matching the condition), reporting `script-breakpoint`, old/written values and the actual writer. |
| `data break clear` | Clear all breakpoints; a session can then advance the pending step. |
| `expect <address\|$path\|input> ==\|!=\|<\|>\|~ <value>` | Compare applied values; `~` is absolute numeric error ≤ 1e-6. Failure emits `script-expect` with pointer and hint; execution continues. |
| `group <name>` / `end` | Open/close a named assertion group; nested groups label assertion diagnostics. Session groups may span requests. |
| `expect-error <code>` | Assert that the next nonempty command throws or emits that diagnostic code. A missing or different code emits `script-expect-error`; matching diagnostics are consumed. |
| `seed <n>` | Reset the shared core uint32 random source for this player and nested stepping to n. The player constructor option `seed` and CLI `--seed` initialize the same source. Without an explicit seed, existing deterministic machine/converter defaults are preserved. |
| `snapshot [--all] [--semantics] [address …]` | Print one JSON line. `--all` adds unanimated animatable properties and persistent inputs. `--semantics` appends `player.semantics()` or errors clearly if unavailable. Explicit addresses accept static properties too. |

`instance <id> <timeline> [mix]`, `timeline <name> play|pause|stop|seek|scrub|speed|mix|loop [value]`
and `machine <name> play|pause|stop|mix|fire|set [value …]` retain the motion module's control API.
JSON quoted strings can contain spaces and `#`; unquoted hex colors are values rather than comments.
Data commands require data in the document and the host module loaded; scripts without data commands
do not access host data. Commands add no authoring fields or registry spellings. Both `expect` and selected
`snapshot` addresses resolve AniML property spellings (for example `volumeFill.width` →
`volumeFill.w`) through the registry, including slash-scoped nested addresses. Exact inputs
and JSON addresses take precedence over aliases. The CLI groups unknown `$path-number`
diagnostics at the same pointer into one `data-path` diagnostic with a spaced subtraction
hint; declared hyphenated paths retain their meaning.

`anima sample` prints outputs in script order, emits assertion/breakpoint diagnostics on stderr,
and returns 1 for those diagnostics, 2 for invalid arguments/script commands. Targeting an absent input with set/fire/toggle or a hidden/absent semantic node with
semantic emits `script-target`, a script pointer and inspection guidance. Other script syntax
errors carry `script-usage`, `/script/<zero-based-line>`, a message and hint.

`anima session <file>` keeps the interpreter alive. Each stdin line is one command or a JSON
object with a string `cmd`; each receives exactly one JSON reply containing `ok`, outputs,
snapshots and diagnostics. A bad request does not end the process. `quit` replies then exits;
`reload` reads and validates the source again, resets time/inputs/control state, restores compatible
data values through public handles and steps at 0. Its reply lists restored/skipped paths; failed
reload retains the old interpreter. Breakpoints pause the current command, and the next request
may inspect/edit data or clear them. Preflight replays all prior operations, so its cost grows with
history and includes the next step. Tooling instruments instance setters and queued operations in
the replay player, capturing writes before mutation, including same-value and transient writes.
Writers identify a script line, listener pointer, state/transition action pointer or the actual
binding write function. Timeline-driven reverse writes identify the binding that stores the value.
Instrumentation is absent from shipped data/host bundles.

`anima bench <file> [-s script] [--frames N] [--format=json]` measures source compilation/loading
once, then renderer-neutral `Player.step(1/60)` and `drawFrame` separately for N frames (default
600, integer 1–1,000,000). It warms 50 frames on a separate player. Output includes `compileMs`,
frame count and step/draw median and p95 in microseconds, using sorted samples at indices
floor(N×0.5) and floor(N×0.95), capped at N−1. Script setup, filesystem I/O except source loading,
DOM and raster/GPU work are not frame costs. This follows the measurement boundary in
`tools/perf.ts`; see also `docs/research/rive-web-runtime.md` on native/GPU versus host overhead.
Bench additionally reports `memory` with `kind: "js-heap"`, `beforeBytes`, `afterBytes`,
`growthBytes` (after minus before), and `bytesPerFrame` (growth divided by N). Samples bracket
the measured frame loop after warming; GC can make growth negative. These are JS heap observations,
not retained allocation or WASM measurements. Both session and bench accept `--seed`, `--all`, `--semantics` and `--reduced-motion`; seed has
the shared source semantics above. Debugging and audio capture instrumentation are tooling-only.

A snapshot line is `{"time": t, "values": {address: value}, "states": {layer: state},
"events": [...], "settled": bool}`: `time` is the total step time so far, `values` holds every
address any track or pose writes (or the listed ones), `events` holds the events reported since the
previous snapshot, and `settled` is the last step's result.
Explicit input names appear in `values` under their own names (for example,
`snapshot dark knob.x`). They report the currently applied value; queued `set`/`toggle`
writes take effect only after a step. Triggers have no persistent value and cannot be
selected. Selected addresses accept both JSON paths and AniML property spellings (for example
`ring.stroke.trimEnd` and `ring.trimEnd`). Snapshot keys always use JSON paths, for both
selected and complete snapshots, including slash-scoped component addresses. Exact input
names and JSON paths take precedence over aliases. An unknown address or input is a script error. With no arguments, `snapshot`
continues to include only animated addresses, never inputs (unless `--all` is set).

### 11.3 Diagnostic codes

| Code | Severity | When |
|---|---|---|
| `json-syntax` | error | The text is not JSON. The message carries line and column. |
| `duplicate-key` | error | An object repeats a key (`anima validate`). |
| `type` | error | A value has the wrong JSON type. |
| `missing-key` | error | A required key is absent. |
| `unknown-key` | error | A key is not defined here. Hint: the closest valid key. |
| `reserved` | error | A key, ease or address reserved for a later version. |
| `version-unsupported` | error | `anima` is not `"0.1"`. |
| `undeclared-feature` | error | A module key or address is used without its feature in `requires`; hint: add the feature to `requires`. |
| `unknown-feature` | error | `requires` names a feature this runtime lacks. |
| `bad-name` | error | A name breaks its pattern. |
| `duplicate-id` | error | Two nodes share an id. |
| `unknown-node-type` | error | `type` is not a node type. |
| `bad-value` | error | A value is out of range or not an allowed option. |
| `bad-color` | error | A colour string does not parse. |
| `unknown-color-slot` | error | A paint names a slot that is not declared. |
| `unknown-glyph` | error | A path names a glyph that is not declared. |
| `bad-path` | error | Path data does not parse. |
| `bad-subpath` | error | A subpath index is out of range or repeated. |
| `path-source` | error | A path has both or neither of `glyph` and `d`. |
| `arc-fill` | error | An arc has a fill. |
| `trim-multi-subpath` | error | A stroke with trims on a path of several subpaths. |
| `unknown-address` | error | A track or pose names an unknown node or property. |
| `not-animatable` | error | A track or pose writes a property that cannot be animated. |
| `value-type` | error | A keyframe or pose value has the wrong type. |
| `color-slot-animated` | error | An animated colour uses a slot or `currentColor`. |
| `empty-track` | error | A track has no keyframes. |
| `key-order` | error | Keyframe times do not strictly increase. |
| `key-range` | error | A keyframe or event time lies outside `[0, duration]`. |
| `bad-ease` | error | An ease does not parse, has invalid arguments, or eases a boolean. |
| `unknown-timeline` | error | A state plays a timeline that is not declared. |
| `unknown-state` | error | `initial` or `to` names a state that is not in the layer. |
| `state-kind` | error | A state has both or neither of `pose` and `play`, or `speed` without `play`. |
| `bad-condition` | error | A condition does not parse. |
| `guard-literal` | error | A module literal function uses the wrong property, name or operator; use ==/!= with a matching typed property. |
| `data-keyframe` | error | A key source path or live channel value has the wrong type; use compatible scalar data. |
| `unknown-input` | error | A condition, listener or `a11y` names an input that is not declared. |
| `input-type` | error | An input is used in a way its type does not allow (`a11y.activate` needs a trigger or bool; `pressed` and `held` need bools). |
| `bad-end` | error | `@end` on a pose state or a looping timeline. |
| `self-transition` | error | A transition to the current state with only level terms. |
| `unknown-target` | error | A listener targets a node that does not exist. |
| `limit-exceeded` | error | A §2 limit is exceeded. |
| `hash-mismatch` | warning | A glyph's `sha256` does not match its `d`. |
| `no-paint` | warning | A painted node has neither fill nor stroke. |
| `unreachable-state` | warning | No transition reaches a state. |
| `unused-input` | warning | Nothing reads or writes an input. |

### 11.4 Local playground

`anima playground [file.animl] [--port N]` serves a local authoring inspector on `127.0.0.1`
(default port 4519, next free if occupied). With no file it opens the reference bell as a read-only
scratch example; Save cannot change it. AniML edits use the strict compiler and its source positions
(`spec/ANIML.md` §7). Errors keep the last valid document visible, marked as stale. The live stage
uses the web runtime and the same inputs, listeners and player semantics as a hosted icon.

Timeline scrubbing samples the chosen timeline at the clamped time `[0, duration]` using §5 over
the document rest pose. It pauses live playback and input controls; returning to live mode resumes
the saved live state. It does not advance the state machine or emit timeline events. This is an
inspector view, not a new player stepping mode. Save writes only the opened file; a changed disk
revision must be reloaded before saving. Details and keyboard controls: `docs/PLAYGROUND.md`.

## 12. Decisions for 0.1, and what is deferred

These were the open questions of the draft. Each is settled for 0.1; the deferred ones are reserved
so a 0.1 loader rejects them with `reserved` and a pointer to the version that brings them.

1. **Non-scaling strokes — no flag; strokes always scale.** Glyphy ink is a filled outline, which
   scales with its node, so an authored stroke (the bell's waves) must scale the same way to keep
   matching it. Glyphy's own check allows `stroke ± 0.12`, and the bell's poses (0.95–1.08) stay in
   it (`docs/research/glyphy-compat.md` §4.5). SVG's `vector-effect: non-scaling-stroke` works in
   screen pixels, not grid units, so it could not express "keep 1 unit" anyway. Revisit with a
   grid-unit definition if an icon needs it.
2. **Colour interpolation — non-premultiplied sRGB, 8-bit channels, `floor(c + 0.5)`, clamped.**
   It is what CSS transitions and Rive do, so authors' expectations and the Rive reference agree,
   and the rule is exactly reproducible. A timeline key `colorSpace` (e.g. `"oklab"`) is reserved for 0.2.
   (Rive's lossy float round-trip, `docs/research/rive-animation-and-state.md` Lesson A.5, cannot
   happen: values are integers.)
3. **Keyboard → `down` — explicit.** `a11y.held` names the bool that is true while Enter or Space is
   held; nothing is inferred from input names. The bell sets `"held": "down"`.
4. **Additive layers — deferred to 0.2** (reserved layer key `mode`). 0.1 layers override; the
   resolve rule (§7) passes unwritten properties through, so layers that write disjoint properties
   compose already, which covers a breathing idle on one node under a hover tilt on another.
5. **Path morphing** is available through the optional paint module for compatible command lists
   (see the paint chapter). Automatic matching of differing Glyphy traces remains deferred.
6. **Data binding.** Input expressions are available in the optional `bind` module below.
   View models and general data sources remain for P4e.
7. **Draw-on for Glyphy outlines — deferred to 0.2.** Trims work on authored strokes in 0.1. For
   glyph ink the likely 0.2 design is a `reveal` mask: an authored centreline subpath, stroked wider
   than the ink and trimmed, used as a mask so the visible ink stays the exact outline
   (`docs/research/glyphy-compat.md` §4.5a). It needs a Glyphy centreline export to be practical.

Other decisions made while freezing 0.1:

- **Clocks advance before transitions** (§7). The draft evaluated transitions first, so a finished
  timeline could report `settled` while its `@end` transition was still pending.
- **Transitions chain within a step** (cap 16), with time carried over from `@end`/`@after`, so one
  large `dt` and many small ones reach the same state (Rive allows chains too, capped at 100;
  `rive-animation-and-state.md` §2.3).
- **The crossfade source is always a frozen snapshot** of the layer's output at the moment of the
  transition, not a still-playing timeline. One rule covers both normal transitions and
  interruptions, and only one timeline is sampled per layer.
- **Triggers are consumed per layer** and dropped at the end of the step unless the input declares
  `buffer` (Lesson A.11).
- **`hit`** is a top-level circle or rect for whole-icon listeners (bell: the Rive file's hit disc,
  radius 10.8 around the glyph centre).
- **Exact version match** before 1.0, rather than minor-version feature negotiation.
- **Cap and join default to `round`**, matching the Glyphy reference sets rather than SVG's `butt`.

## paint

The optional `paint` module (MODULES.md) extends 0.1 documents with `requires: ["paint"]`.
An unregistered module is `unknown-feature` at `/requires/<index>`, before structural checks.
Using its keys or animation addresses without declaring it is `undeclared-feature` at that key
or address, with hint `add "paint" to "requires"`. Ordinary 0.1 documents keep their behaviour.

### Image nodes

With `requires: ["paint", "assets"]`, an image node has `id`, `type: "image"`, `asset`,
`x0`, `y0`, positive `width` and `height`, and optional `fit`, `align`, `sampling`.
It accepts the common transforms, opacity and visibility. Width and height are animatable
(nonnegative resolved values); layout options and the asset name are static.
`unknown-asset` at the node's `/asset` names an absent declaration; `asset-type` at that
pointer rejects a declaration whose type is not `image`.

Let the box be W×H and the intrinsic size I×J. The image is scaled and clipped to the box:

| fit | scale (x and y unless specified) |
|---|---|
| `contain` (default) | min(W/I, H/J) |
| `cover` | max(W/I, H/J) |
| `fill`, `resize` | x=W/I, y=H/J |
| `none` | 1 |
| `scale-down` | min(1, W/I, H/J) |
| `fit-width` | W/I |
| `fit-height` | H/J |

`align` is `center` (default), `top-left`, `top`, `top-right`, `left`, `right`,
`bottom-left`, `bottom`, or `bottom-right`. Each axis places the scaled image at 0,
(box−image)/2, or box−image. Overflow is always clipped, including `none`.
The fitted image rectangle has geometric edge coverage even at fractional device coordinates;
nearest sampling selects texels without snapping that rectangle to whole pixels.
`sampling` is `bilinear` (default) or `nearest`; SVG maps these to `image-rendering="auto"`
and `image-rendering="pixelated"`. The browser's final display scaling remains host-controlled.

AniML: `<image id="photo" asset="photo" x0="0" y0="0" width="24" height="24"
fit="contain" align="center" sampling="bilinear"/>`. `x0`/`y0` specify the untransformed
box origin; common `x`/`y` remain transform translations. `fit` and `align` deliberately keep
their JSON spellings: SVG `preserveAspectRatio="xMidYMid meet"` maps to contain/center,
`slice` to cover and `none` to fill. No `preserveAspectRatio` input alias exists, since SVG
cannot express all seven fit modes. Backends receive `Geometry.kind: "image"`, box coordinates,
and renderer-neutral image metadata (asset, source, intrinsic size, fit, align, sampling).
SVG uses a nested clipped viewport and an image leaf; transforms stay on the node's group.
The host resolves missing intrinsic dimensions before rendering; core draw data keeps them absent.

### Image wrapping (P5b)

`wrap` is `clamp`, `repeat` or `mirror`. `wrapX`/`wrapY` (AniML `wrap-x`/`wrap-y`)
override their axis independently; an axis without its own value takes `wrap`, and `wrap` defaults to
`clamp` once any wrap control is authored. An image with **no** wrap control draws only its fitted
source rectangle, as before P5b (decided for compatibility: existing contain/none renders and their
conformance cases are unchanged). Fit and alignment first establish the fitted source rectangle.
Clamp extends the edge texels outside the fitted source rectangle to the box boundary. Repeat
tiles it in both directions; mirror reflects every odd tile, including negative tile indices.
Width/height animation
recomputes fit and pattern extent. Nearest clamp extends isolated edge texels on both backends,
including mixed periodic/clamped axes and centred alignment. `resize` is the `fill` alias: both axes stretch independently to the box.
The optional browser entry `@anima-format/web/paint-sampling` imports paint and installs SVG
wrapping. The ordinary paint entry declines explicit wrap controls with `unsupported-render` and an import
hint; it does not bundle pattern code. CLI/static SVG includes the backend. SVG uses user-space patterns and transformed groups for
reflected tiles, keeping transforms off
image leaves. Canvas uses equivalent source tiles. Filtering remains nearest/bilinear as above;
SVG declines bilinear `repeat` with `unsupported-render` at the repeating axis, a reason about
independent image filtering, and a nearest/canvas hint. A native UV-mesh probe measured maximum
channel delta 188 and 36,852/57,600 pixels above 16 before declining this combination (see
modules/assets/probes/native-measurements.json). Nearest repeat and mirror pass crisp native probes.
SVG also declines bilinear clamp when the fitted source leaves margins: stretching a clipped
texel would interpolate adjacent colours rather than hold the edge colour. This reports
`unsupported-render` at `/nodes/<index>/sampling` with a nearest/canvas hint. Canvas isolates and
pads texels before filtering; it implements bilinear clamp and mixed-axis wrapping.
GPU/rasterizer edge differences are not a claim of bit-identical rendering. Invalid wrap enums
use the existing `bad-value` structural diagnostic at the authored property. No new player state is
introduced. Both source syntax spellings and deterministic width tracks have conformance probes.

### Gradients

A `fill` or `stroke` contains either `color` or a gradient, never both. A gradient has `type`:

| Type | Required coordinates (grid units) | Optional coordinates |
|---|---|---|
| `linear` | `x1`, `y1`, `x2`, `y2` (start and end) | — |
| `angular` | `x1`, `y1`, `x2`, `y2` (centre and initial ray) | — |
| `radial` | `cx`, `cy`, `r` (centre and radius, `r ≥ 0`) | `fx`, `fy` (focal point, each defaults to the corresponding resolved centre coordinate) |

All have `stops`, an array of at least two `{ position, color }` objects. `position` is 0..1,
nondecreasing at rest; repeated positions are permitted (hard edges). `color` follows §6, including
slots, `currentColor` and hex alpha. Fill rule and stroke width/cap/join/trim/dashes remain on the
paint object. Coordinates belonging to the other gradient type are errors.

Animatable addresses are `<id>.<fill|stroke>.<coordinate>`,
`<id>.<fill|stroke>.stops.<index>.position` and
`<id>.<fill|stroke>.stops.<index>.color`. Indices are zero-based decimal integers without leading
zeros and must exist. Coordinates must belong to the authored gradient; optional focal coordinates
may be animated even when omitted, with their rest defaults equal to the authored centre.
`type`, the stop array's length/order and the dash array are not animatable.

Coordinates and positions use §5 number sampling and §7 blending; positions clamp to 0..1 and
radius to ≥0 after resolving. Stop colours use the existing non-premultiplied sRGB channel sampling
(including alpha), blending, dirty slots and hex-only animation restriction (§6). A static slot stop
remains themeable. In SVG, stop positions that cross during animation are displayed at the maximum
of that position and all earlier positions; sampled values retain their independently clamped values.

Gradients render as `<linearGradient>` / `<radialGradient>` defs, unique per node, paint and icon,
with `gradientUnits="userSpaceOnUse"`, sRGB colour interpolation and SVG's default `spreadMethod`
(`pad`). A paint references its def. Coordinates are in the node's untransformed grid space;
the node transform carries the paint with its geometry. Degenerate gradients and focal points
outside the radius follow SVG gradient semantics. Knockout geometry and hit tests stay as in §4/§9;
they do not acquire gradient alpha sampling.

### Angular gradients and affine gradient transforms

`type: "angular"` uses `(x1,y1)` as its centre and the ray to `(x2,y2)` as
position zero. Positions increase clockwise in SVG's y-down local coordinates over one full
turn. Coincident endpoints use the positive x axis. Stops pad to the first/last colour and
may repeat; the seam joins position one back to zero. Coordinates/stops animate like linear
gradients. AniML uses `<angularGradient x1="…" y1="…" x2="…" y2="…">` with `<stop>` children.
Canvas uses `createConicGradient`. SVG refuses angular gradient resources with
`unsupported-render`, a paint `/type` pointer and a hint to use canvas; it never substitutes
linear/radial interpolation or a finite wedge approximation.

Every gradient accepts static `gradientTransform` (AniML `gradient-transform`), six finite
numbers `[a,b,c,d,e,f]`. It maps gradient coordinates by
`(x,y) → (a*x+c*y+e,b*x+d*y+f)` before the node transform, affecting paint only.
Translations are grid units; linear coefficients are dimensionless (rotation coefficients
are cosine/sine of the desired angle). A singular matrix is `bad-value` at
`/gradientTransform`, with an invertibility hint. Non-gradient paints reject the field.
SVG emits `gradientTransform="matrix(…)"`; canvas paints the transformed gradient into a layer masked by the independently drawn
geometry, preserving stroke widths under nonuniform matrices. The matrix is static and theme slots still resolve normally.

### Dashes

`stroke.dash` is a nonempty array, all nonnegative grid-unit numbers (`[2, 1]`), or all decimal
percentage strings (`["10%", "5%"]`). Percentage syntax is `0` or a positive decimal integer,
optionally followed by a decimal fraction, then `%`; signs and exponents are not accepted.
A percentage refers to the entire outline length, **not** the SVG viewport diagonal. Units cannot
be mixed, and at least one length must be positive. Odd arrays repeat twice (SVG behaviour).
The array is static. Each subpath restarts the pattern as in SVG.

`stroke.dashOffset` is an animatable number, default 0, positive or negative. With numeric dashes
it is in grid units; with percentage dashes it is a fraction of total path length (0.1 = 10%).
It uses the existing number sampling and blending. Every backend resolves relative patterns to
natural local outline lengths using the core length algorithm below. Live and static SVG emit
absolute dasharray and dashoffset values, without `pathLength` normalization: browser engines'
internal primitive-length approximations must not change authored dash or trim lengths.

**Trim wins:** when resolved `trimEnd − trimStart < 1`, §4's trim dasharray and offset replace the
authored dashes and offset. A nonpositive trim suppresses the stroke entirely. A full trim permits
the authored pattern again, using its own units. Animating the offset still samples normally while
a trim overrides its display. With no dash array, `dashOffset` has no visual effect.

### Diagnostics and implementation

Registry structural errors retain §11.3 codes (`type`, `bad-value`, `missing-key`, `unknown-key`).
Missing coordinates/stops/paint kind are `missing-key` at the paint object with an add-key hint.
Unsorted stops, mixed/all-zero dashes, incompatible coordinates and flat colour plus gradient are
`bad-value` at the offending key with a corrective hint where possible. Invalid stop colours use
`bad-color` / `unknown-color-slot`; animated slot stops use `color-slot-animated`. Invalid addresses
are `unknown-address`, and static paint fields are `not-animatable`.

Module algorithms are independently implemented against SVG semantics. The registry approach
continues ARCHITECTURE §core.1 and the ideas recorded in
[format and graph research](../docs/research/rive-format-and-graph.md); the scene keeps the retained
DOM/dirty-node strategy in [web runtime research](../docs/research/rive-web-runtime.md).
No algorithm here closely follows Rive runtime source; no additional NOTICE attribution is needed.

### Parametric outlines

The paint module adds painted ellipse (cx,cy,rx,ry), polygon (cx,cy,sides,radius,
rotation=0,cornerRadius=0), star (cx,cy,points,radius,innerRadius,cornerRadius=0),
and triangle (x0,y0,width,height). All listed numeric parameters are animatable;
all lengths use local grid units. AniML element and attribute names equal these names.
Radii and dimensions are nonnegative. Authored sides are integers 3..1024 and points
integers 2..1024; sampled counts clamp to these bounds and round to nearest integer,
ties upward. Polygon vertices advance clockwise from the top, rotated by rotation
degrees. Star vertices alternate outer/inner radii clockwise from the top outer vertex.
Triangle vertices are (x0+width/2,y0), (x0+width,y0+height), (x0,y0+height).
Ellipse paths use two half-ellipse SVG arcs; zero axes produce SVG degenerate outlines.

Polygon/star rounding cuts back cornerRadius on both incident edges, independently
limited to half each edge's length, then joins the cut points with a quadratic Bézier
controlled by the original vertex. Straight edges connect the corners. The parameter
is a cutback distance, rather than an osculating circle radius; concave vertices use
that same construction. All new shapes render as SVG paths. Hit tests use the current
outline and the existing 12-chord cubic flattening convention, including morphs.
Invalid geometry uses registry bad-value diagnostics at the parameter/item; missing
required geometry uses missing-key. New types without paint use undeclared-feature at type.

### Rectangle corner radii

The small optional `corners` module also accepts this geometry without importing `paint`.
Declare either `paint` or `corners` (registry feature `paint|corners`); existing paint scenes
keep the same geometry and addresses. The browser entry is `@anima-format/web/corners`.

Rect corners is a four-item nonnegative array [tl,tr,br,bl], AniML corners="1 1 0 0".
Each value is animatable as tile.corners.0 through .3 (indices without leading zeros).
The rectangle renders as a path with circular quarter arcs approximated by cubic Béziers,
using k = 4(√2−1)/3 ≈ 0.5522847498. Each radius is independently clamped to half
the adjacent width/height; unequal clamped axes produce quarter ellipses. At each corner,
the two controls move k of the distance from each edge endpoint toward the corner vertex.
Polygon/star rounding keeps the quadratic construction above. This is an independent
standard circle approximation; no external runtime algorithm is ported.
Corners takes precedence over rx; rx remains unchanged without corners. An absent
corners array cannot be animated. Invalid addresses use unknown-address; invalid array
length or negative entries use bad-value at the array or offending item.

### Compatible path morphs

The paint-module animation address pathId.d accepts SVG path strings, including when
rest geometry comes from a glyph and selected subpaths. Keys contain path data, not
glyph identifiers; compatible glyph data may be used verbatim. Static d needs no module.
Rest, all keys and all pose values require identical expanded command lists:
same case, letters and repetition count. Implicit coordinate repetitions expand; extra moveto pairs become
lineto. No reversal, resampling or automatic matching occurs. Numeric arguments
interpolate with eased weight, including relative coordinates and arc parameters.
Arc flags choose 0 below 0.5, otherwise 1. State blending uses the same rule.
Intermediate strings use the SVG formatter's five decimal places; exact endpoint
samples retain their authored strings. Hit tests follow the sampled outline.

A state pose may set pathId.d to an SVG path string, using the same validation and
interpolation as tracks. Invalid paths produce bad-path at the key or pose value with a
valid-path hint; non-strings produce value-type. Incompatible commands produce morph-mismatch at the key or pose value,
with a hint naming the first differing zero-based segment and expected/actual command
(or end). Every key and pose value is checked against rest, keeping state blends compatible.
AniML encloses path values in JSON double quotes, for example:
<track target="a.d">0 "M0 0L2 2"; 1 "M0 0L4 4"</track>.
In a pose attribute, use the path directly: <pose a.d="M0 0L4 4"/>.
The compiler, formatter and decompiler preserve spaces inside path values.

### Transform-independent stroke

Stroke scale is normal (default) or fixed, AniML stroke-scale="fixed". It is static.
Fixed emits SVG vector-effect="non-scaling-stroke": the numeric width passes unchanged
while node and ancestor scale, rotation and shear transform the outline without
scaling its stroke. The host SVG viewport follows SVG vector-effect semantics,
including viewport resizing. This is not an inverse adjustment by one scalar for
nonuniform transforms. Geometry coordinates and sampled width stay unchanged.
Invalid scale values produce bad-value at the stroke scale field.

### Shared outline lengths

All renderers use natural local outline lengths for relative dashes and trims: both
dasharray components and dashoffset multiply by core's length before output rounding.
SVG omits `pathLength`. The `toSVG` option `staticLengths` remains accepted for compatibility;
absolute lengths are now unconditional, including live retained SVG and default `toSVG`.
Measurements are cached per retained geometry owner; path/radius/dimension/corner changes
invalidate the measurement, while transforms, colours and trim/offset changes reuse it.
Lengths include all subpaths and closing edges. Circles use 2πr; rectangles account for their
clamped elliptical corners; other outlines use current path data, including morphs.

Core pathLength parses into absolute lines/cubics, then recursively subdivides cubics
by de Casteljau at t=0.5 until control polygon length minus chord is at most 0.0001
grid units per accepted piece, or depth 20. Accepted pieces contribute the mean of
polygon and chord length. Arc conversion first uses at most 90° cubic pieces (§3),
so this tolerance describes subdivision flatness, not the initial arc approximation.
These are independent constructions, extending the shared scene and registry designs
in the format/graph and web-runtime research cited above. No algorithm follows Rive
runtime source; no additional NOTICE attribution is required.


## composite

The optional `composite` module extends 0.1 documents with `requires: ["composite"]`.
It owns blend modes, source masks, geometry clips, ordered paints/paint visibility,
stroke placement and sibling draw order. Gradients, dashes, additional geometry,
corners, morphs and fixed strokes belong to `paint`; using both sets requires
`requires: ["paint", "composite"]` (AniML `requires="paint composite"`).
An unavailable module is `unknown-feature`; using an undeclared feature is
`undeclared-feature` at the offending key/address with an add-feature hint (§11.3).
Composite alone supports ordinary 0.1 geometry and solid paints.

### Blend modes

`node.blend` (AniML `mix-blend-mode`) selects normal (default), multiply, screen, overlay,
darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue,
saturation, color or luminosity. It applies CSS `mix-blend-mode` to the node's group, compositing
against earlier siblings using SVG/CSS semantics. Blend is static. Additive is deferred: SVG
renderers do not consistently implement CSS `plus-lighter`; source-over is not a faithful substitute.

### Source masks

`mask: { source, mode, sourceDraws }` names a node, selects alpha, luminance, inverted-alpha or
inverted-luminance, and explicitly controls whether the source also draws in its ordinary place.
Any false `sourceDraws` use hides that source's ordinary drawing for the document's life.
The source subtree is shared through a retained definition and SVG `use`; its geometry, local transforms,
opacity and visibility animate normally. Its ancestors contribute coordinate transforms, but not
ancestor opacity or visibility. Mask space is the target's parent space. The target transform
stays inside a permanent, untransformed mask wrapper. Masks cover three viewBoxes, as knockouts do.
Luminance uses SVG luminance masking. Inversion uses an SVG filter with `feComponentTransfer`
alpha table `1 0`; inverted luminance first uses `feColorMatrix type="luminanceToAlpha"`, and
then multiplies that alpha by `SourceGraphic` alpha with `feComposite operator="in"` before
inverting it and using alpha masking. This preserves source opacity and antialias coverage,
which `luminanceToAlpha` alone discards. Filter interpolation is sRGB. Source drawing is independent of hiding
its ordinary copy. Unknown sources, self references and cycles are load errors.

### Geometry clips

`clip: { source, rule? }` names a painted node's outline; optional `rule` is `nonzero`
(default) or `evenodd`. A painted node or a group may take a clip. A group clip applies
to its entire child drawing, including nested groups; it does not change the source outline.
Fill, stroke, visibility, opacity and source compositing do not affect the clip. Source geometry and
world transforms animate; coordinates are projected into the target parent space. The SVG
`clipPath` contains an untransformed path (curves transformed control-point by control-point).
This avoids nonportable nested groups in clip paths while preserving the Firefox retained-leaf
rules. Singular target parent transforms yield an empty clip. SVG arcs are converted to cubic
curves by Anima's existing parser. A group source is `clip-source-not-painted`.

### Ordered paints and visibility

A painted node may replace single `fill` and `stroke` with a nonempty `paints` array. Each entry
has exactly one `fill` or `stroke` object, using the same flat/gradient/width/dash fields; later
entries paint over earlier entries. `visible` on any paint defaults true and is hold-only
animatable. Addresses are `<id>.paints.<index>.<fill|stroke>.<field>`, including gradient stops.
Indices must exist, and array structure is static. Single paint visibility addresses are
`<id>.fill.visible` and `<id>.stroke.visible`. Multiple strokes currently require center position;
noncenter positions on multiple paints are rejected. Paints and single fill/stroke cannot coexist.

### Stroke placement

Single `stroke.position` is center (default), inside or outside. Center uses the original width.
Inside doubles the width and clips the stroke to the shape's filled outline. Outside doubles the
width and luminance-masks it by a white viewport with a black filled outline. Fill is drawn once,
before the stroke. Definition geometry samples the same animated dimensions as the visible shape.
Masks stay attached for the document's life. Open contours use SVG's implicit closing for the
filled outline; fill rules apply to both clipping and exclusion. Position is static.

### Sibling draw order

`drawOrder: { target, position, active? }` moves a node before or after a named sibling when
active (default true). `drawOrder.active` is an ordinary hold-only boolean animation address;
changing it reapplies rules to authored sibling order. Rules run in authored node order, once
per frame, removing then inserting their node relative to the target. Multiple rules therefore
have deterministic precedence. Cyclic target chains and nonsibling targets are rejected.
Rules involving knockout siblings are rejected because knockout permanently groups earlier nodes.
Static SVG serializes the current order; web reorders existing DOM siblings without replacing
nodes or detaching their masks. The module's draw hook resolves sibling ranks before rendering.
Its registry factory binds to the active runtime's shared registry (MODULES §3.1).
Cross-node draw changes conservatively invalidate dependent draw entries, keeping animated
source references correct across node and ancestor boundaries.

### Compositing diagnostics

`unknown-source` points at mask/clip source or draw target; `self-reference` and `reference-cycle`
point at the referencing object. `clip-source-not-painted`, `bad-draw-target`, and `paint-conflict`
identify incompatible sources, ordering and paint combinations. Each includes a corrective hint.
Structural validation retains the ordinary registry diagnostics and JSON pointers. These features
are independently implemented from SVG semantics; no Rive code or algorithms were used.
The explicit references and retained ordering follow the lessons in
[format/graph research](../docs/research/rive-format-and-graph.md) §6; the sleeping renderer remains
as described in [web research](../docs/research/rive-web-runtime.md).

## bind

Bind expressions include numeric comparisons `< <= > >=`, typed equality `== !=`, and boolean
`and or not`. Ordering requires number operands; equality requires identical operand types.
Logical operands must be bool. Precedence from low to high is or, and, not, comparison,
addition/subtraction, multiplication/division, unary signs. Evaluation short-circuits logical
operators and produces bool, coercible to 0/1 for number destinations. These rules apply to
bindings, set actions and derive expressions. Guard scalar expressions use the same parser when
bind is declared; trigger and clock guard terms retain their specialized semantics.

The optional `bind` module requires `requires: ["bind"]`. At document level,
`bind: { "ring.stroke.trimEnd": "progress" }` maps animatable addresses to expressions.
Property bindings evaluate after all state layers resolve and before property clamping (§7),
so a binding overrides a pose, timeline or crossfade on the same address. Resolved bound
addresses appear in `Player.values()`, `anima sample` snapshots, dirty slots and `anima inspect`
(the `bound` list). Inputs still apply in queued arrival order. A settled binding sleeps until
an input write wakes the player; its value changes on the next step, including `step(0)`.

A motion play state may also use `time: "expression"`; see **Declarative timeline control**.
These are clock expressions evaluated before sampling, rather than property bindings.

### Expressions and types

Sources are declared scalar input names (including `$` data paths when `data` is declared),
finite JSON number literals, hex colours
(`#rgb`, `#rrggbb`, `#rrggbbaa`), parentheses, unary `+`/`-`, binary `+ - * /`, and the functions
`min(a,b)`, `max(a,b)`, `clamp(x,lo,hi)`, `mix(a,b,t)`, `floor(x)`, `mod(a,b)`,
`contains(text,part)`, `lower(text)`. Double-quoted strings, typed comparisons and `and or not` use the grammar above.
No scene property reads, boolean literals, assignments or arbitrary calls are allowed. Identifiers use
the input-name grammar; a hyphen is part of a name, so write `level - other` for subtraction
between inputs. Multiplication/division precede addition/subtraction; binary operators associate
left; unary signs have highest precedence. Whitespace is insignificant between tokens.

A bare bool input retains its bool type for boolean targets. Numeric operations and number
targets convert bools to 0/1. Numbers do not implicitly become bools. `min`, `max`, `clamp` and
numeric `mix` return numbers; `mix` also accepts two hex colours and a numeric/bool weight,
returning a colour. Mixing a number and colour is invalid. Colour interpolation is §5 sRGB
channel interpolation (including alpha, rounding and channel clamping); weights may extrapolate.
`floor(x)` returns the greatest integer ≤ x. `mod(a,b)` is `a - b*floor(a/b)`
(the result has the divisor's sign; a zero divisor resolves to zero). Numeric `mix` is
`a + (b-a)*t`; `clamp` is `min(max(x,lo),hi)`. Non-finite arithmetic results
(including division by zero) resolve to zero when consumed by another operation or the target,
before property clamping. Trigger inputs cannot
be values. Evaluators accept a scope map of named inputs, reusable for component input bindings.

`contains(text, part)` requires two strings and returns bool: true exactly when `part` is a
contiguous substring of `text` (case-sensitive ECMAScript `String.prototype.includes`, UTF-16
code units). An empty `part` returns true, including for empty `text`.
`lower(text)` requires one string and returns a string using Unicode default case conversion
(ECMAScript `String.prototype.toLowerCase`, locale-independent). It does not normalize Unicode,
trim whitespace or perform full case folding: for example, `lower("İ")` is `"i\u0307"`, and
`lower("ẞ")` is `"ß"`, not `"ss"`. Use `contains(lower($label), lower($query))` for
case-insensitive filtering. No number/bool/color-to-string coercion occurs. Both calls work in
bindings, set actions, derive expressions and scalar guards through the same typed parser.
A standalone bool call in a guard uses the existing parenthesized scalar form, e.g.
`(contains(lower($label), lower($query)))`.

### Validation

`bind-type` rejects incompatible operands or target types; `unknown-input` rejects unknown names.
`bind-syntax` rejects malformed expressions, unknown calls, wrong arity or limits (512 tokens,
64 nested expressions). Diagnostics point to `/bind/<escaped-address>`, include the 1-based
character offset in the expression message, and give a corrective hint. Parser nodes/errors
retain zero-based UTF-16 offsets. `bind-cycle` rejects attempted cyclic property references,
including self references. Valid expressions read only inputs and cannot form property cycles;
acyclic property references are also rejected. Targets use the ordinary `unknown-address`,
`not-animatable` and `undeclared-feature` diagnostics. The old object-valued `from/map` form is
not supported. `anima schema bind` describes both spellings from the registry.

The grammar and evaluator are independently written. Strict unknown-name checks and a single
post-state pass follow the lessons about silent unresolved bindings and feedback loops in
[animation/state research](../docs/research/rive-animation-and-state.md) §C. No Rive source,
documentation text or binary format was used.

<!-- capability: data.bind-listener-actions -->
### Input expressions in actions

Declare `bind`. Every action set (listener, bind machine block, or machine-module action group)
uses this single expression/type/snapshot contract. Listener `set` values may be expression strings, e.g.
`{"set":{"count":"count+1","previous":"count"}}`. Numeric/bool JSON literals keep their
0.1 meaning and type checks; a string is always an expression, never an implicit literal.
Number targets accept numeric or bool expressions (bool becomes 0/1); bool targets require bool
expressions. Colour expressions remain valid for colour properties and typed event fields;
there are no colour inputs, so setting a bool/number input to a colour is `bind-type`.
Unknown inputs are `unknown-input`; assigning a trigger is `input-type` (use `fire` instead).
Trigger reads and incompatible result types are `bind-type`; parser/arity errors are
`bind-syntax`. Diagnostics point to the set value, condition, or event field, with an expression
character offset where applicable and a hint. No property reads or assignments are added to the
expression language. No runtime dependencies or evaluator copies are introduced: the optional
bind module supplies a compile hook to core, returning pure input-scope closures. Merely importing
bind does not enable expressions in a document without `requires: ["bind"]`.

A listener is queued intact. When its action runs at §7.1, evaluate every set expression against
one input snapshot **before any write in that action**, then apply `fire`, all sets (clamping each
number result to its target min/max), `toggle`, and `emit`. Non-finite arithmetic becomes zero
before clamping. Separate actions run sequentially and see prior writes, including host writes
queued before them. Queuing two increments before one step increments twice.

The existing core machine also accepts state `entry` and `exit` blocks and transition `actions`
blocks. Each is an object with the same optional `fire`, `set`, `toggle`, `emit` keys as listeners;
State `entry`/`exit` blocks require bind even if their values are literals. Transition `actions`
requires either bind or machine; without machine it follows the immediate order below, while
with machine it follows that chapter's queued order. Bind blocks target local input names; scoped child writes remain a listener/host feature.
On initial construction, run each
initial state's entry in layer order before its entry emit and timeline events. On a transition,
run source exit then transition actions before the existing state-end/transition-start signals;
run target entry after the immediate transition-end signal (if any), before target emit and entry
timeline events. Each block is a separate snapshot action; writes are immediate and visible to
subsequent blocks, transitions in the chain, and later layers. Exit runs on reentry too; blend
completion does not rerun actions. Existing chain limits and trigger consumption apply. Pending
triggers fired from entry actions are checked during the next step; triggers fired in a step
remain subject to that step's ordinary consumption/expiry rule.

AniML listeners use `set="count=count+1 previous=count"`; spaces and commas within expressions
are allowed. Whitespace followed by an input name and `=` begins the next assignment. Machine
blocks are JSON attributes, e.g. `<state name="idle" entry='{"set":{"count":0}}'>` and
`<on when="tap" to="playing" actions='{"set":{"count":"count+1"}}'/>`.
Arithmetic conditions use `when="count > 0 and mod(count, 5) == 0"`. `anima schema listener`,
`state`, `transition` and `--json-schema` expose these forms. Input-only scopes avoid the
feedback loops described in [animation/state research](../docs/research/rive-animation-and-state.md)
§C; snapshot action maps avoid depending on JSON member order.

## assets

The optional `assets` module adds an `assets` map and image draw data. Image nodes also
require `paint`. Core validation and `Player.step` perform no IO. Fonts remain declarations until P6;
audio/blob consumers are optional host modules.

Each named asset is `{ type, source, storage?, width?, height? }`. `type` is `image`, `font`,
`audio` or `blob`. `source` is required and nonempty: a data URI or URL (relative URLs are
relative to the document). Optional `storage` is `embedded` for data URIs or `referenced`
for URLs; omitted storage is inferred. A disagreement is `asset-storage` at `/assets/<name>/storage`.
`width` and `height`, when present, are positive intrinsic dimensions, in grid units for
layout. Omitted dimensions are decoded by the host before drawing. Declared dimensions override
decoded dimensions independently. Decoded pixel counts remain separate host resource information;
authored width/height change layout, never the texel count used for clamped edge cropping.
Browser and CLI decoders supply these counts without adding a document field. Data URIs use percent encoding or padded standard base64;
malformed encoding is `bad-data-uri` at the source. An empty source is `missing-source`;
an absent source is `missing-key` at the asset object. Messages carry a repair hint.

AniML declares `<asset name="photo" type="image" src="photo.png" storage="referenced"/>`
at document or component level; registry `source` maps to `src`. All other field spellings match JSON.
A component resolves asset names in its own catalog, then its enclosing component/document catalogs
up to the root. A local declaration shadows the same outer name, even if its type is wrong.
This scope applies to image nodes, image/audio `asset-ref` values and event audio clips. Missing or
wrong-kind references report the offending node, event or data property/value JSON pointer;
default data asset errors point to `/data/models/<model>/properties/<property>/default`.
Image hit targets use their current rectangular bounds, including animated width/height.

The browser module `@anima-format/web/assets` registers assets and the SVG image backend;
image documents also import `@anima-format/web/paint`. Images decode before `anima:load` and
initial `ready` resolution. URLs resolve relative to the icon's `src`, or `document.baseURI`
for inline/programmatic documents. `icon.assets = (name, info) => url | Blob | Promise<url | Blob>`
replaces the source before decode; `info` is a copy of the authored declaration. A resolver rejection
or image decode failure empties the icon and dispatches `anima:error` with `asset-load`, the
source pointer, message and hint. Embedded data URIs require no network. Resolved data is private
to the loaded model; source declarations are preserved. Superseded loads cannot install their scene.
Audio/blob byte access and policy are specified below; fonts remain declarations.

`anima build --embed` embeds local referenced assets (paths relative to the source file), sets
storage to `embedded`, and visits root and component-local catalogs, including imported libraries.
Imported sources resolve relative to the file declaring that asset; diagnostics keep the complete
component asset pointer. The built file's embedded assets work after the source tree is removed. It supports AniML and
AniML scripts in HTML. Already embedded assets are unchanged. Other URL schemes cannot be read
by this disk build and report `asset-load`; HTTP asset fetching is a browser host responsibility.
`anima render` embeds local image sources and decodes intrinsic sizes through resvg before
rendering; other asset types remain declarations. IO/decode failures report `asset-load` at
`/assets`, with a message and hint. Build inspection and encoding are specified below.


### P5b asset pipeline

Asset declarations also accept `size` (nonnegative integer bytes), `mime` (MIME string),
`metadata` (a JSON object, AniML `metadata='{"credit":"self"}'`), and the build-only
`encode`, `quality` and `export` options. Resolver metadata includes every authored field;
its copy is detached, including nested metadata. Source declarations are never mutated by host IO.
`encode` is `png`, `jpeg` or `webp`; `quality` is in [0,1] and requires `encode`.
These two options are image-only. PNG ignores quality; JPEG/WebP pass it to the browser encoder.
Audio-only `start` and `end` are clip offsets in seconds; `duration` is the full source duration.
Omitted start is zero and omitted end is decoded duration. Require `0 <= start < end <= duration`
when the relevant bounds are known. Wrong-type options are `asset-option` at the option;
invalid bounds are `asset-clip` at `/assets/<name>/start` or `/end`. Both carry repair hints.
All fields have identical JSON/AniML names except `source` → `src`.

`icon.assetPolicy` is `local` (default) or `any`; other assignments throw RangeError.
Without a custom resolver, local policy permits data URIs and same-origin HTTP(S)/blob URLs,
relative to the document source URL. Any permits other origins, retaining the protocol allowlist.
A custom `icon.assets(name, info)` resolver explicitly authorizes its returned URL or Blob;
relative returned URLs still resolve against the document source URL. This policy applies to
image loading and event audio; browser CORS and media permissions still apply. Failed policy,
network or image decoding emits `asset-load` at the source with a resolver/policy repair hint.
Changing policy affects subsequent loads, not already decoded resources.

Import `@anima-format/web/media` for lazy audio/blob byte access; it imports assets and contributes
no new document fields. `icon.asset(name)` returns a promise of ArrayBuffer for audio/blob and
source URL for images/fonts. Byte loads use the same resolver/policy, cache by model and asset,
retry after a failure, and emit `asset-load` before rejecting with its diagnostics. Unknown names
reject with RangeError. Audio decoding remains the consumer's responsibility; events uses Web
Audio on demand after activation, as specified in events. Clip events start at `start` and play
for `end-start`; invalid decoded bounds emit `event-audio-load`. Neither policy nor media IO changes
Player.step output. The assets entry imports a separately budgeted `assetio` host-IO entry automatically, and preloads
images in reachable component catalogs as well as the root. Keeping media in its own entry follows the optional consumer principle in
`docs/research/rive-web-runtime.md` §1; no native code or document format is copied.

Build inspects local and embedded PNG/JPEG/WebP/WAV/MP3/FLAC signatures, dimensions or duration.
Extension/MIME/signature disagreement or wrong media kind is `asset-format` at the asset source;
read/truncation/decode errors are `asset-load`. Metadata `size`, `mime` and audio `duration` are
written from inspected bytes; clip bounds are checked against inspected duration. PNG/JPEG pixels
are validated with resvg, WebP with cached Chromium. Audio inspection validates container/frame
headers, not complete audio decoding; host decoding remains authoritative. Disk build never fetches
network URLs. Blob payloads remain opaque: their bytes are not decoded or container-validated,
MIME comes from the declaration or URL hint (otherwise application/octet-stream), size is the
byte length, and audio-only duration is never attached. Build embedding is byte-preserving without `encode`. PNG encoding runs in-process;
WebP input needs Chromium to decode because resvg cannot decode WebP. JPEG/WebP encoding uses the
cached headless Chromium canvas. A command owns one lazy browser shared by all images and HTML
scripts; each operation closes its page and the command closes its browser on success or failure.
PNG-only commands do not launch a browser unless they need WebP input decoding. Missing/unlaunchable Chromium is `build-encoder-unavailable` at
`/assets/<name>/encode` (or `/source` for WebP validation), hinting `CHROMIUM_PATH`.
`export=false` excludes bytes from embedding/encoding/inspection, preserving the source declaration
and resolver name so references remain valid; the host supplies that source. An already embedded
source becomes `anima:<name>` with referenced storage, so its bytes are actually excluded; this
placeholder requires a resolver. It does not delete
referenced names from the asset map. Build transformations apply equally to AniML and HTML scripts.

`anima import file.svg [-o out.animl]` imports paths, rects, circles, ellipses, lines/polygons,
groups, inherited fills/strokes (hex, basic named and RGB/RGBA colours), user-space linear/radial gradients, and translate/scale/rotate
or nonskew affine matrix transforms. Transform lists become nested groups to preserve order.
Unsupported elements/attributes/paint servers/transforms emit `import-unsupported` warnings with
SVG element/attribute paths. Unsupported geometry is omitted with a warning. The import never
fetches external references. `anima import file.json` accepts Lottie shape layers, groups, paths,
static rects/ellipses, fills/strokes, transforms and scalar/vector/path keyframes with hold or
cubic easing; stroke trim paths map to normalized trim fractions. Layer order reverses to preserve
Lottie's back-to-front order. Unsupported fields/features (including images, expressions, masks,
effects, skew, spatial curves, partial layer time ranges, animated anchors/primitive sizes and
paint opacity) warn at their JSON pointer. These warnings describe lossy imports, not exact parity.
Malformed XML/JSON or invalid import roots/clocks report `import-invalid` at the empty root
pointer with a source-format repair hint. All imported documents are validated before output. JSON command output includes diagnostics and
text or output path. The importer is independent of Rive.

## components

The optional `components` module requires `requires: ["components"]`. A document's `components`
map holds named nested documents: `grid`, optional `viewBox`, `inputs`, `nodes`, `timelines`,
`machine`, `listeners`, `colors`, `glyphs`, `a11y`, `hit` and `bind`. Definitions inherit the enclosing
`requires` list. References to components resolve in the enclosing document's component map,
including from other definitions; all definitions, even unused ones, are validated. Each placement
owns a separate player; compiled definitions and static geometry may be shared.
Component definition keys and literal references allow colon-separated name segments. Compiled
library documents retain their stable lookup aliases in `meta.componentNames`, a map from qualified
import name to definition key. Exact keys take precedence; an original name resolves when unique.
Ambiguous original names report `ambiguous-component` at the reference, with qualified alternatives
in the verbose hint. Legacy generated keys remain valid; a missing `import-<number>-<name>` lookup
resolves by its original suffix when unique and reports the same ambiguity otherwise. See
[the AniML naming scheme](ANIML.md#11-libraries-and-templates-build-time).

An instance node has `{id, type: "instance", component, inputs?, speed?, paused?}` and the ordinary
node transform, opacity and visibility properties. `component` names a definition. `inputs` maps its
bool/number inputs to literals or strings `{expression}`. Expressions use the bind grammar and
require `bind`; their scope is the parent's applied inputs. Triggers cannot be initialized with
values. Omitted inputs retain their component defaults. Literal initializers apply once, before
subsequent queued writes. Number inputs clamp to their declared bounds.

Component inputs must not use any key in the instance node's registry shape. This includes `id`,
`type`, `component`, `inputs`, transform keys, `opacity`, `visible`, `speed`, `paused`, and keys
installed by other node modules such as `blend`, `mask` and `clip`. Those names retain their plain
instance attributes and `<instanceId>.<property>` addresses. `reserved-input-name` points at the
input declaration (`/components/<name>/inputs/<input>`, with source line/column in AniML), with the
hint `rename the input; <name> is an instance property (e.g. use pos-x)`. The reserved set is derived
from the active registry's instance shape, including module keys; it is not a separate hand list.

### Stepping, writes and events

After §7 step 5, the parent evaluates instance input expressions, then resolved parent addresses
that name instance inputs, and steps children in node order with `dt * speed` (`speed` defaults to
1, must be finite and ≥0). Each child's own state speeds multiply this speed. A `paused` instance
(default false) retains its clocks and queued input actions without stepping. An invisible instance
whose player is settled and has no queued writes is not stepped. Invisible running players finish
normally. Reduced-motion policy propagates from the parent before stepping.

A parent's actions and host API may address `<instanceId>.<input>` in `set`, `toggle` and `fire`.
Bindings, poses and tracks may target a bool/number instance input at the same address; explicit
resolved addresses override inline instance expressions. Writes reach the child before its step.
Nested action addresses continue with dots (`outer.inner.count`). Invalid inputs/types are load
errors, just like local inputs.

Pointers are transformed through the inverse instance world matrix and routed to each child
player. Invisible or singular instances receive `leave`. The child's own hit areas and listeners
then operate in local grid units; parent listener targets on instances use their local viewBox.
Instances do not establish a viewport clip or automatic fit by default; the optional `nested`
module adds explicit fit/align into size. Use composite clipping when a viewport clip is needed.

A child's events are returned by that parent step as `<instanceId>.<event>`; nested names continue
with dots. Event layers use slash scope (`outer/inner/layer`), retaining null for listener events.
The parent queues the bubbled event as a one-step trigger and queues matching parent listeners
(`on: "badge.selected"`). Those actions and parent transition conditions (`when: "badge.selected"`)
are applied on the **next parent step**, including `step(0)`. Child events follow the parent's own
events in deterministic instance order. Pending bubbled events/actions keep the parent unsettled.
This single pass prevents event feedback from rerunning the state machine in one step. A parent is
settled only when its own machine and all unpaused children are settled and no actions are queued.

### Drawing and inspection

An instance contributes a renderer-neutral group with its local transform and the child's draw
tree as children. Draw entries have scoped ids (`badge/dot`, `outer/inner/dot`); resources and
source references are remapped into the enclosing draw tree. SVG uses scoped ids under the host's
unique id prefix. Clip, mask, blend and paint behavior use the ordinary draw/backend contract.

`Player.states()` and `inspect()` include slash-scoped child layers. `Player.values()` and sample
snapshots include child inputs (`badge/count`) and animated values (`badge/dot.r`), recursively;
selected snapshots accept those same scoped addresses. `anima inspect` lists placed instances and
their initial states. The playground's state panel shows live instance states.

### Limits and diagnostics

No recursive definitions are allowed: direct/indirect cycles are `component-cycle`. Expanded
placement depth is at most 8 and the total number of instances is at most 256, including repeated
nested placements (`limit-exceeded`). Ordinary per-document node/key/layer limits still apply to
each definition. `unknown-component` points at the instance's component name; `unknown-input` and
`input-type` point at bad input initializers/actions. Bind expressions retain `bind-syntax`,
`bind-type` and `unknown-input`. `unknown-event` rejects unresolved listener event names;
`component-event-collision` rejects a component input and event sharing a scoped address.
Diagnostics retain JSON pointers and corrective hints; errors inside definitions point under
`/components/<name>`. No partially valid instance tree escapes a failed load.

The optional `nested` module adds explicit time/fps, fit/align, scalar outputs and component-valued
selection. Its normative contract is [modules/nested/SPEC.md](../modules/nested/SPEC.md).

This implementation is independent. Explicit names, validation before references are used and
retained nested transforms follow [graph research](../docs/research/rive-format-and-graph.md) §6;
a single ordered update pass avoids the feedback loops discussed in
[state research](../docs/research/rive-animation-and-state.md) §C. Sleep behavior follows
[web runtime research](../docs/research/rive-web-runtime.md), with no separate instance scheduler.

## surface

The optional `surface` module extends `paint` and `assets` with image paints, patch slicing and
paint feathering. The independent algorithms below follow SVG semantics, not Rive source.
The split keeps paint (5120 B), composite (4096 B) and assets (2048 B) within their existing
budgets; surface has an 8192 B incremental budget. Browser import `@anima-format/web/surface`
also registers paint; assets and components remain separate imports. This follows the optional
backend and sleeping-renderer lessons in [web research](../docs/research/rive-web-runtime.md) §13
and the renderer-neutral contract in [MODULES §3.1](MODULES.md#31-the-draw-layer).

### Image paints

A fill or stroke with `type: "image"` requires `asset`, `imageWidth`, `imageHeight`; the last two
are strictly positive tile sizes in grid units. It also needs `assets` in `requires` and a declared
image asset. It replaces `color`, gradient coordinates and `stops`. Usual stroke width, cap, join,
dash, trim, visibility and ordered-paint semantics still apply. Optional `imageX`, `imageY`
(default 0), `imageRotate` (degrees, default 0), `imageScaleX`, `imageScaleY` (default 1) transform
the tile in local coordinates: scale, then rotate about the origin, then translate. Static zero
scales are load errors. Transform fields are animatable. The SVG backend uses a repeating
`pattern` with `patternUnits="userSpaceOnUse"`, `patternTransform`, and an image stretched to the
specified tile size. Intrinsic aspect ratio does not affect image paints.

Optional `modulate` is a literal hex colour. It multiplies non-premultiplied sRGB R, G, B and alpha
channels independently by the colour channels divided by 255; SVG uses an sRGB `feColorMatrix`
on the image inside the pattern. It is static. Defaults to identity. No slot modulation is defined.
Draw data contains the resolved URL, tile dimensions, transform and normalized modulation channels.
AniML uses `<imagePaint asset="tile" image-width="8" image-height="8" paint="stroke"/>`
inside the painted node (`paint` defaults to fill); the registry supplies both spellings.
See `examples/image-paints.animl` and `spec/draw-conformance/surface-image/`.

`unknown-asset`, `asset-type`, `undeclared-feature`, `missing-key`, `paint-conflict`, `bad-color`
and `bad-value` point at the affected paint/field and give a corrective hint. Image-specific
fields on another paint type are errors. Sources resolve through the same assets mechanism as
image nodes. No IO occurs during stepping.

### N-slice patches

`slice: { x, y, width, height, modes? }` on an image, group or component instance defines a source
rectangle using the first and last entries of strictly increasing `x`/`y` cut arrays (2–9 entries
per axis, grid units, including both bounds). There are at most 64 patches. `width`/`height` are
positive target sizes. `modes` has one entry per patch in row-major order: `stretch`, `repeat` or
`hidden`; omission means stretch everywhere. Slice structure and target size are static.

For four or more cuts on an axis, the first and last bands keep their authored lengths. Interior
bands divide the remaining target length in proportion to their source lengths. If the target
is smaller than the two border lengths, borders shrink proportionally and all interior bands
collapse to zero. Two or three cuts divide the entire target proportionally, since there is no
interior band bounded by two distinct border bands. Target origin is the first source cut for
groups/instances, or the image's `x0`,`y0` for images. Image source cuts must begin at zero and end
at the asset's declared intrinsic width/height; those dimensions are required. Slicing replaces
image fit/alignment and node width/height layout. Node transforms apply to the resulting drawing.

Stretch maps each source rectangle to its target rectangle, independently on each axis. Repeat
tiles that rectangle at its original grid size, from the target's upper-left corner, clipping the
last partial tile; it does not scale either axis. Hidden contributes no pixels. SVG implements
patches using clipped nested SVG viewports and patterns referencing a shared source drawing.

For vector groups and components the source is the live rendered local subtree, clipped at each
cut. Each patch scales the *whole* source appearance, including strokes, filters and compositing.
This is rendered-output slicing, not path deformation: geometry, hit testing, component inputs,
state and pointer coordinates remain in source space. Child animations remain live. Fixed-width
strokes are fixed in the source drawing before patch scaling. True geometry deformation and
inverse patch pointer mapping are deferred; duplicating stateful component players per patch
would change document semantics. The resolved draw data lists source/target rectangles and modes.

Diagnostics: `slice-cuts` for unordered cuts; `slice-limit` beyond 9 cuts; `slice-modes` for a wrong
mode count; `slice-bounds` for image intrinsic-bound mismatch; `slice-type` for an unsupported node
kind. Each points into `slice` and includes a hint. Structural errors use ordinary registry codes.
`spec/draw-conformance/surface-slice/` records the 9-patch result, including repeat and hidden patches.
AniML uses a `<slice x="…" y="…" width="…" height="…" modes="…"/>` node child.
Cut lists decode to numbers and modes to strings. See [ANIML](ANIML.md#surface-module) and
`examples/slice.animl` for the syntax and round-trip contract.

### Feather falloff

A paint may have `feather: { inner?, outer?, offset?, enabled?, space? }`. Amounts are nonnegative
grid distances, default 0. Offset is a two-number local vector, default `[0,0]`; enabled defaults
true and disabling preserves all settings. Space defaults `local`. Inner, outer, offset components
and enabled are animatable via `fill.feather.inner`, `stroke.feather.enabled`, etc., including
ordered paint addresses. Feathering applies independently to each paint, before node opacity.

Let P be the premultiplied RGBA paint image, A its original alpha, and T the offset translation.
Let B(r) be a Gaussian convolution of T(P) with standard deviation r/3, with B(0)=T(P).
The output is `A * B(inner) + (1-A) * B(outer)`, componentwise in premultiplied sRGB; alpha is
clamped to [0,1]. For a fully covered hard edge with no offset, Gaussian falloff has its midpoint
at the edge and about 99.7% of its transition within three standard deviations on either side.
This is an explicit Anima Gaussian model, not a claim of pixel parity with Rive's feather model.
At zero inner/outer and zero offset the original paint is unchanged.

SVG uses `feOffset`, two `feGaussianBlur` primitives (`stdDeviation=amount/3`), `feComposite`
in/out with SourceAlpha, then an arithmetic sum (`k2=k3=1`), all with sRGB filter interpolation.
The filter region expands the document viewBox by three times the greatest amount plus the
largest offset component. Root SVG viewport clipping still applies. Separate paint leaves prevent
feathering a fill from blurring an unfeathered stroke.

World-space feathering cannot preserve isotropic falloff through arbitrary local nonuniform
transforms in this SVG implementation. `space: "world"` is represented in draw data; when enabled,
the SVG backend throws an error carrying `code: "unsupported-render"`, the source JSON pointer,
a message and a hint to use local space. Canvas support is deferred to Pc. Disabled world feathering
renders normally. Unknown spaces and negative/nonfinite amounts receive registry diagnostics.
`spec/draw-conformance/surface-feather/` defines resolved draw data independent of browser rasterization;
Chromium/Firefox pixel tests check the Gaussian halo, disabled state and independent stroke.
AniML uses `<feather paint="fill|stroke" …/>` node children, or a feather child within an ordered
`fillPaint`/`strokePaint`. It retains the parent paint and preserves empty and disabled settings;
see [ANIML](ANIML.md#surface-module) and `examples/feather.animl`.

## motion

`requires: ["motion"]` opts into this chapter; AniML uses `requires="motion"`.
Loading the module alone does not change a 0.1 document's playback. It adds no renderer,
network operations or runtime dependencies. All times and work bounds are seconds.
The design follows the independent-playback, explicit composition and unit-consistency
lessons in [animation research](../docs/research/rive-animation-and-state.md#1-linear-animations)
and the small imperative handle in [web research](../docs/research/rive-web-runtime.md).
No Rive code is used. The elastic formulas below are reflections of Anima's existing
specified elastic-out formula, not an implementation of Rive's amplitude ramp or period-zero fallback.

### Curves

<!-- capability: animation.elastic-in -->
<!-- capability: animation.elastic-in-out -->
`elastic-in(a,p)` is `1 - elastic(a,p)(1-u)`; `elastic-in-out(a,p)` is
`elastic-in(a,p)(2u)/2` for `u < 1/2`, otherwise `1/2 + elastic(a,p)(2u-1)/2`.
Both require finite `a >= 0`, `p > 0`, and have exact 0/1 endpoints. The same strings
work on left keys and transition eases, with the same arguments in both syntaxes.
Invalid motion curves report `bad-ease` at the ease; a missing requirement reports
`undeclared-feature`, with a hint to add motion.

<!-- capability: animation.cubic-value -->
`value-cubic(x1,y1,x2,y2)` on a **numeric** left key is a value curve rather than a
weight. Solve the existing monotone cubic x curve for parameter `s`; evaluate the
cubic with ordinate controls `(leftValue,y1,y2,rightValue)`. The time controls are
normalized fractions in `[0,1]`; ordinate controls use the property's units. All
arguments must be finite. Equal endpoints can therefore move between the keys.
Endpoints, holds, before-first and after-last sampling retain §5 rules. A value curve
on colours, discrete channels, or transition eases is `bad-ease`; it cannot shape a
crossfade. Invalid controls are `bad-ease` with a syntax/range hint. The sampler is
compiled per segment; there is no mutable interpolator shared between tracks.

### Typed channels and mixing

<!-- capability: animation.keys-signed-integer -->
<!-- capability: animation.keys-unsigned-integer -->
<!-- capability: animation.keys-string -->
<!-- capability: animation.keys-reference -->
A node can declare `channels: { name: { type, value } }`, where `type` is `int`,
`uint`, `string`, or `reference`. A channel is addressed `node.channels.name` in
tracks and poses. `int` and `uint` hold 32-bit integers (signed or unsigned);
`string` holds arbitrary strings, including whitespace and empty strings;
`reference` holds an existing node id in this scene. They are typed scene data,
readable through node handles; a reference channel does not implicitly swap geometry
or a paint. Future consumers must explicitly define what they do with the reference.
AniML declares `<channel name="label" type="string" value='"Ready"'/>` inside its
node, and uses quoted JSON strings in keyframe text. Numerical channel values use
ordinary numbers. A channel value in a pose also uses a quoted JSON string when
string-valued. The registry defines both spellings and generates CLI/schema output.

All four types are hold-only: left value until the exact next key. An explicit ease
other than `hold` is `bad-ease`. Invalid integer values are `motion-integer` at the
value, with the allowed interval as hint; wrong string values are `value-type`;
unresolved references are `motion-reference` with an existing-node hint. Validation
covers document values, keyframes and poses. Structural channel/name errors use §11 codes.

<!-- capability: animation.mix-discrete -->
<!-- capability: animation.mix-numeric -->
A motion document's discrete channels and bool properties replace the incoming value
for **any positive mix**, including at the start of a crossfade. An explicit instance mix of zero writes
nothing. Numbers, colours and morphable paths use the existing interpolation rules.
An explicit instance writes `mix(incoming, sample, weight)` in composition order;
weights are clamped to `[0,1]`. These bool rules apply only to motion documents;
ordinary 0.1 bool crossfades still use §7's OR rule. During a state crossfade, a
channel absent from the target immediately passes through the value below it.

### Timeline clock

<!-- capability: animation.quantized-playback -->
<!-- capability: animation.work-area -->
<!-- capability: animation.reverse -->
A timeline may declare `speed` (finite, default 1), `quantize` (finite samples/second,
strictly positive), and `work: [start,end]` with `0 <= start < end <= duration`.
AniML uses attributes `speed`, `quantize`, `work="start end"`. Invalid work bounds
report `motion-work` at `/timelines/<name>/work`, with an interval hint. Structural
nonpositive quantization or nonfinite numbers use the existing range/type diagnostics.

A play state's speed multiplies the timeline's speed. Negative speed starts at the
work end; positive or zero starts at its start. The source clock is this start plus
`stateTime * effectiveSpeed`. Fold that clock into the work interval using §5 loop
or pingpong rules, or clamp for once. Quantize only the **sample** time down on the
absolute timeline grid (`floor(time*quantize)/quantize`), clamped to work start; an
exact work end remains exact. Keys outside the work interval remain valid and can
influence interpolation inside it. Events outside it never fire.

Event crossings use the unquantized source clock. Forward intervals exclude the
previous time and include the new one; reverse intervals include the new time and
exclude the previous time. On entry include both bounds. Loop and pingpong crossings
retain carry, emit each authored event once per crossing, deduplicate pingpong turns,
and sort in travel order; coincident events retain authored time/order. Start and end
are distinct authored events even when their loop crossings coincide. The existing
10,000-period enumeration bound remains unchanged. A once state finishes after
`workSpan / abs(effectiveSpeed)` state seconds. Zero speed holds and has infinite
completion time. State-machine zero-speed play states stay busy because transitions
may still depend on state time; explicit zero-speed timeline instances can sleep.
Reduced end/skip uses the directional work endpoint/start; end reports only the
work-area events, in travel order, including both ends. Frozen instances sample the
endpoint without looping it back to the start.

<!-- capability: state-machine.exit-time-seconds -->
A transition may add `exit` (nonnegative source-animation seconds) or `exitFraction`
(a fraction in `[0,1]` of its work span), never both. AniML uses the same names.
This is an additional gate on `when`, evaluated before entering the target. It measures
absolute source-animation distance since entry, including loops, before quantization,
so state and timeline speeds both matter; it is not wall/state time. It requires a
play source and must lie within its work span (`motion-exit`, pointing at the exit,
with a source/interval hint). Carry is the state-time overshoot of the gate, capped by
any existing time-condition carry; an input-only condition uses the gate's carry.
This avoids passing target time that predates the last gate becoming eligible.

### Declarative timeline control

These forms require `motion`; omitted fields preserve existing playback, including all 0.1
behaviour. AniML uses the JSON names verbatim. They extend §7's clock/transition passes,
not the post-state property-binding pass.

- A transition's `sync: true` transfers the **unquantized local time** from source to target,
  instead of restarting at the directional start. Both states must play the same timeline
  (`motion-sync` at `/machine/layers/<layer>/states/<state>/on/<index>/sync`, with a same-timeline
  hint). Work-area folding/clamping happens before transfer; quantization happens only at sample.
  The target uses its own speed from that time. A once target completes after its remaining
  directional distance, so `speed: -1` reverses from the current position and entering the forward
  state again turns around immediately. State time and fade elapsed still reset to carry (§7);
  interruptible fades still freeze the current output as their source. Sync does not replay
  timeline entry events at the transfer point; events crossed during target carry are reported.
- A play state's `hold: true` freezes its clock at the entry time (directional start normally,
  transferred local time with `sync`). It continues writing the same sampled tracks. State time,
  `@after`, input conditions and crossfades keep running. Holding does not itself satisfy `@end`.
  A held state can settle once its fade and future `@after` waits finish. `hold` and `time` are
  exclusive; either on a pose reports `motion-control` at the state (conflict at `/time`), with
  a hint to choose a play clock.
- A transition's `exitNext: "step" | "loop"` waits for the next clock boundary while its `when`
  remains true. At the start of §7 step 2, after queued inputs apply, arm the gate from the
  source clock **before advancing dt**. `step` uses the next local quantize grid point in the
  direction of travel, or the work endpoint if earlier; without quantize it uses the work
  endpoint. `loop` uses the next work endpoint (each turning point for pingpong). A request
  observed exactly on a boundary is immediately eligible (using the §5 clock-boundary rule).
  Changing the condition to false cancels the armed gate; a later request
  computes a new boundary. Frozen reduced-motion and zero-speed clocks are immediately eligible.
  The source clock and its timeline event interval stop at that boundary, even for a large dt;
  excess state time carries into the target (and its fade). A synced held target therefore
  captures the boundary, not the overshooting frame. Transition priority and the 16-transition
  cap stay as in §7. Locked fades do not arm gates. `exitNext` requires an autonomous play
  source (no hold/time) and persistent bool/number terms only; it cannot combine with triggers,
  `@end`, `@after`, `exit` or `exitFraction` (`motion-exit` at `/exitNext`, with an autonomous-source
  and persistent-condition hint).
- A play state's `time: "expression"` additionally requires `bind`. It evaluates the bind
  grammar against this player's inputs, producing local timeline seconds clamped to its work
  area. It owns the clock instead of advancing it; speed has no effect. It samples with the
  timeline's loop and quantize rules (a loop's end folds to its start). An ordinary entry
  evaluates the expression immediately. A synced entry keeps the transferred time and records
  the current expression value; the next **different evaluated value** seeks to that value.
  Thus completion can hold its angle until the author changes `phase`, without a snap to a
  stale phase on entry. A change that evaluates to the same clamped value is not a seek.
  Expressions update after inputs apply and before transitions/sample, including `step(0)`;
  they also initialize the constructor's initial state. Seeking emits no timeline events,
  does not complete `@end`, and can settle like a held clock. Errors use bind's existing codes
  at the state's `/time`; missing `bind` reports `undeclared-feature` there with an add-bind hint.

Held clocks report state `emit`s, but do not synthesize timeline events on entry or while held.
The pre-existing `exit`/`exitFraction` gates retain their elapsed-state-time × absolute effective
speed measurement; they do not observe seeks or the captured clock offset. `exitNext` instead
observes the selected autonomous clock and is restricted to that clock kind above.

Reduced-motion entry policy takes precedence over these clock controls, using the same
fixed directional endpoints and event policy as other motion play states. Time/hold states
still obey that frozen entry pose. Ordinary property bindings retain their post-state priority.
Named machines and component players own independent control clocks and input scopes.

Decision: put clock selection on states and clock handoff on transitions, keeping inputs as the
single listener interface. This follows the separation of state time, animation time and fade
snapshots discussed in [animation/state research](../docs/research/rive-animation-and-state.md)
and the sleep-when-settled lesson in [web runtime research](../docs/research/rive-web-runtime.md).
No animation is cloned and no property-read feedback is added to bind expressions.

### Animated transform origin

<!-- capability: transforms.origin-animation -->
`pivotX` and `pivotY` are numeric animatable node properties, with the same AniML names.
Each falls back to the corresponding component of the existing `pivot` vector, then
zero. They feed exactly the transform in §4, so drawing, world matrices and hit testing
use the same animated origin. The vector `pivot` remains a static convenience;
tracks address its independent scalar coordinates. Existing bind expressions may
also target those coordinates when bind and motion are both required.

### Explicit runtime instances

<!-- capability: animation.host-loop-override -->
<!-- capability: animation.host-play-pause-stop -->
<!-- capability: animation.seek -->
<!-- capability: host-api.animation-metadata -->
<!-- capability: host-api.low-level-animation -->
<!-- capability: host-api.low-level-scene-query -->
<!-- capability: host-api.multi-state-machine -->
<!-- capability: host-api.scrub -->
The optional module installs the following API on `Player` and `<anima-icon>`;
see [WEB](../docs/WEB.md#motion-module) for signatures and host scheduling.
Missing motion requirements reject calls; absent names and invalid finite-number
arguments throw. No implicit timeline instance is created by document timelines.
A default `timeline(name)` is created on first use; `createTimeline(name,{name,mix,
speed,loop})` creates an independent clock. Instance names are unique across timelines
and machines. Instances compose after ordinary layers and bindings, before clamping,
in **creation order**. They restart from the values below them on every step; there
is no accumulating weighted drift. Each named machine resolves its layers against the values below its instance, including
return-to-underlying crossfades. Only the properties actually written by a named
machine's active/fading states and bindings contribute, never all of its rest slots.

`seek(seconds)` clamps into the work area without emitting crossed events or changing
play/pause; `scrub(progress)` clamps progress to `[0,1]`, seeks over that area, and
pauses. A sought loop end folds to the start when sampled; reduced frozen endpoints
are the exception above. `play` retains the clock, `pause` retains its writes, and
`stop` resets to the directional start and removes its writes. Setting `loop` overrides
the authored mode; null restores it. Negative instance speed reverses from the current
clock. `advance(dt)` moves just this clock and returns crossed events; `apply(mix?)`
enables its writes. Values resolve on the next `Player.step`, including `step(0)`;
explicit manual advance does not dispatch DOM events. `didLoop` is reset on advance
and indicates that this advance crossed a work boundary (including once completion).
Changing metadata returned by `info` or `animations` cannot change the model.

`machines: { name: { layers } }` declares named machine definitions; AniML uses
`<machine name="name"><layer ...>...</layer></machine>`. `machine(name)` instantiates
one lazily with independent inputs and clocks over the shared scene. Its controls
support play/pause/stop, mix, set/fire/get and states. Stop removes writes and suspends
its state without resetting it; play resumes it. Paused machines hold their writes.
Their events use `instance/layer` as layer name. Their states are queried on the
instance and also appear as `instance/layer` in the player's states and inspector,
so they do not collide with the default machine's layer names. Definitions
are validated even before instantiation. `node(id,type?)` returns a typed read handle
or undefined for an absent id/type; it reads resolved properties and local/world
transforms. It does not fabricate bone or text handles before those node types exist.

### Conformance, CLI and oracle limits

Each capability marker above maps to its same-named `modules/motion/capabilities/`
example, test, and `spec/conformance/<hyphenated-id>/` case. Expected scalar values
are hand-computed, including 6 for the equal-endpoint cubic midpoint, 1/32 for elastic-in
at 1/2 with period 1/2, and sequential numeric mixes. Existing unmarked conformance
sources, scripts and expectations are unchanged.

The §11 script also accepts `timeline <name> play|pause|stop`, `timeline <name>
seek|scrub|speed|mix <number>`, `timeline <name> loop once|loop|pingpong|authored`,
`instance <id> <timeline> [mix]`, and `machine <name> play|pause|stop|mix|set|fire`
(with the input/value arguments for set/fire). Host operations resolve on an explicit
`advance`, which can be zero. CLI validate/build/decompile/fmt/schema/inspect/sample/render
use the same registry and player; no separate motion evaluator is introduced.

Native frame oracle mappings and unsupported observations are recorded per capability
and in the oracle README. A browser/API test is not evidence of a Rive frame match.

## canvas

<!-- capability: host-api.device-pixel-ratio -->
### Pixel ratio

The optional web Canvas2D backend reads `window.devicePixelRatio`. The HTML host's `pixel-ratio`
attribute overrides it with a finite positive number; `devicePixelRatioUsed` exposes the chosen
ratio when this backend is active. Invalid overrides emit `bad-pixel-ratio` at pointer `""` (the
host, not a document field), with a message and hint, and fall back to browser DPR. A resolution
media query and window resize notification track browser DPR changes, including monitor moves.
No document JSON or AniML key, `requires` name, or player property is introduced by canvas.

<!-- capability: host-api.resize-backing-surface -->
### Backing surface

Canvas viewport CSS placement follows the SVG host's grid/viewBox bleed, fit and alignment.
Backing dimensions are the rounded CSS viewport dimensions times the selected ratio, with a
one-pixel minimum. A ResizeObserver resizes and redraws when the host's CSS content size changes.
Size or pixel-ratio changes redraw without advancing the player or consuming queued input.
Repeated player revisions do not redraw; explicit `invalidate()` redraws once and resolves current
CSS colour slots. Playback, reduced motion, scheduler sleeping, visibility and hit outlines remain
those of the existing web host. Disconnect/destroy removes observers and DPR listeners; reconnect
resumes observation. Canvas contents are clipped to the viewBox viewport; SVG overflow is visible.

<!-- capability: platforms.web-canvas -->
### Canvas2D rendering

Import `@anima-format/web/canvas` and set `renderer="canvas"` on `<anima-icon>`. SVG remains the
default (`renderer="svg"` or absent). Selection may change on a loaded element without resetting
its player. An unavailable renderer emits `unsupported-render`, pointer `""`, with the renderer
name and an import hint. Other rendering diagnostics use the source JSON pointer where available.
This is a host selection, not a change to `.ani`, AniML, CLI render or schema.

The canvas backend consumes DrawFrame (§3.1 in MODULES) directly. Path2D geometry/primitives,
ordered fills/strokes, colour slots/currentColor, linear/radial gradients, grid-unit dashes/trims,
transforms, group opacity, source-relative clips, alpha/inverted/luminance masks, blend modes,
images, image patterns/modulation, components, n-slice patches and feathering use Canvas2D.
Group opacity and masks isolate into transparent offscreen surfaces; ordinary opaque groups do
not. A canvas is a compositing boundary and cannot blend with page content outside itself.
Fixed strokes use CSS viewport pixels (as SVG non-scaling-stroke does), without approximating
nonuniform node transforms with a scalar inverse. Trims use core outline lengths.

Feather follows the existing premultiplied Gaussian formula using `ctx.filter` blur and in/out
alpha composition. World space keeps the Gaussian isotropic after node transforms. The current
backend declines nonuniform/sheared **local** feathering, nonuniform viewport feathering, and
partial trims on fixed strokes with `unsupported-render` naming the feature, a pointer, message
and hint. It never silently substitutes an inverse average scale. Disabled feathering is ordinary
paint. Cross-origin image sources need CORS permission for canvas readback/patterns; failures emit
`asset-load`. CSS slot changes on an idle canvas require `invalidate()`.

Cross-backend pixel differences are measured and retained by the canvas browser conformance suite;
limits and findings are in `modules/canvas/test/web/README.md` and `RESULTS.md`. Renderer support
is not a claim of exact rasterizer identity or a passing Rive oracle for host-only operations.

## focus

The optional `focus` module declares `requires: ["focus"]`. It adds a static `focus`
object to any node: `enabled` (bool, default true), `enabledInput` (optional bool input
name), `pointer` (bool, default true), `order` (finite number, default 0), `scope`
(bool, default false), `edge` (`stop`, default, `closed-loop`, or `parent-scope`),
`label` (string, defaults to node id), `bounds` (local `[x,y,width,height]`, nonnegative
sizes; omitted means the local origin), and `tabStops` (bool, default false).
A scope container may set `enabled: false` while retaining its scope policy.
Unknown enabled inputs report `unknown-input` and non-bool inputs report `input-type`
at the node's `/focus/enabledInput`, with a message and corrective hint. Ordinary
registry shape/type/range and undeclared-feature diagnostics apply to all fields.

`Player.focused` is a synchronous, read-only node id or null. This is the hook for
machine `condition-focus`: compare the requested id with `player.focused`; no DOM
query, step or input write is required. Each player owns independent focus state.
`focusTarget(id|null)` changes the target if eligible; unknown/disabled/invisible
ids leave it unchanged. `focusClear()` clears it. Both return whether it changed.
`focusItems()` returns eligible targets; `focusItems(true)` includes unavailable
configured targets for DOM reconciliation. A target needs a focus object, enabled
true, enabledInput true when supplied, and visible ancestors (including itself).
Opacity does not affect eligibility. Focus lost through a resolved visibility/input
change clears after that step and queues blur actions; the step is unsettled until
the next step has consumed them.

`focusTraverse(next|previous|left|right|up|down)` defaults to next. Sequential order
is ascending `order`, then document node index. From no focus, forward directions
select the first eligible target and backward directions the last. Within a scope,
next/previous take the adjacent target. Spatial directions use centers of the local
bounds transformed by current world matrices. Candidates strictly ahead on the
requested axis are ranked by squared Euclidean distance, then sequential order.
The nearest enclosing ancestor with scope true owns the boundary. `stop` retains
the target; `closed-loop` wraps sequentially to the opposite end, or spatially to
the opposite extreme on that axis (ties use authored node order); `parent-scope`
retries in the enclosing scope, including its descendants. The outer icon boundary
stops. Traversal returns whether the target changed. Invalid direction names throw.

Focusable component internals are exposed as dotted instance paths (`save.label`),
with each component player's local traversal and scope rules. Root targets precede
component targets; instances and their descendants follow authored instance order.
Disabling a scope's own focus target does not hide its semantic subtree or disable
eligible descendants. Semantic elements remain in the accessibility tree; only
nonsemantic focus proxies are hidden when ineligible.

An instance is an implicit scope: after local traversal stops, its node's focus.edge
must be parent-scope to traverse outside it. Nested transforms compose for spatial
centers and pointer mapping. Focus changes route to the owning player's local
listeners; the parent hook reports the dotted path. Component-local state machines
read their local `focused` ids. Instance visibility excludes its focus descendants.

`focusPointer(x,y)` focuses the last eligible painted target under the point using
§9 hit testing, excluding targets with pointer false. Primary pointer down calls it
before ordinary pointer listener actions; up, move and leave do not change focus.
Component forwarding does not independently focus other overlapped instances.

Listeners add `on: "focus"` and `on: "blur"` (requires focus); `target` is a local node
id or omitted to observe every local change. Changing targets queues old blur
listeners then new focus listeners, each in authored order, with the existing §9
action semantics. Re-selecting the same target does nothing. Nested listeners act
inside their owning component. These hooks are independent of pointer enter/leave.

`focusKey(key, down=true, shift=false)` handles ArrowLeft/Right/Up/Down on down;
key up is inert. Tab traverses next/previous only with an authored tabStops opt-in.
This hook lets the input module share the same deterministic keyboard policy. Input key listeners
consume normal keyboard delivery by default (`propagate: true` opts into continued delivery);
this does not suppress the subsequent focus navigation hook or native Enter/Space activation.

### AniML and browser mapping

AniML uses a child `<focus enabled="true" enabled-input="available" pointer="true"
order="0" scope="true" edge="closed-loop" label="Save" bounds="0 0 4 4"
tab-stops="false"/>`. Names otherwise match JSON. Registry descriptors drive both
spellings, CLI/schema inspection, compilation and decompilation. Browser markup
loads focus and markup; the focus entry supplies structural authoring hooks.

The browser entry `@anima-format/web/focus` maps logical targets to real focusable
shadow-DOM elements, with button roles and labels. Focus is roving by default:
Tab enters the host's first eligible target; arrows move within it; Tab/Shift+Tab
leave to the surrounding document. Leaving clears logical focus. The icon remains
one sequential stop. Any authored focus.tabStops true opts the document into native
inner Tab stops (one per eligible target); the host then adds no extra stop. A parent
icon's a11y role/label/activate/pressed/held and §10 Enter/Space behavior are retained.
Pointer default focus is suppressed after logical pointer focus to prevent it from
displacing the chosen shadow target. Explicit pause ignores arrow navigation.

Focus proxies are semantic targets, not extra painted shapes. The small semantic
DOM and shared core input policy follow the guidance in
`docs/research/rive-web-runtime.md` (lessons 2 and 6); no Rive implementation is used.
Headless pixels alone do not observe focus. Native interaction oracles compare logical focus
and traversal through semantics dumps and focus/blur view-model reports. Browser tests separately
cover DOM focus and native Tab entry/exit; see `modules/input/ORACLE-RESULTS.md`.

## machine


`requires: ["machine"]` adds the fields below to 0.1 documents. Without that requirement,
playback is unchanged, even when this module is installed. The implementation extends the
base player's playback policy; it does not replace its input queue, transition chain cap,
trigger consumption, interpolation, clamping or frame resolution. `motion`, `bind` and
`components` order before machine when installed; none is imported as a runtime dependency.

This design independently implements the graph and deterministic-frame ideas discussed in
`docs/research/rive-animation-and-state.md` §§A.6–A.8 and its pitfalls about shared mutable
state. No Rive algorithm or source was copied; no additional NOTICE attribution is needed.

### State kinds and priority

States retain exactly one `pose` or `play`. `kind` optionally names `entry`, `exit`, `any`, or
`random`; these special states require `pose: {}`. An entry state is an ordinary empty pose
whose ordered conditions choose the next state at the first `step`, including `step(0)`.
An exit state is terminal and has no `on` list. It retains the outgoing state's own keyed samples at exit time as constant writes; its clock stops. With no outgoing state it writes nothing. Other layers continue, and post-state bindings retain priority.

An any state is a declaration, cannot be initial or a transition target, and does not run.
Its transitions are searched before the current state's transitions, in declaration order of
any states and then of their `on` lists. They are available in every nonterminal real state.
An any edge targeting the current state is omitted unless it has a trigger or `change` guard,
which permits restarting a pop animation on another increase without repeated re-entry.
All transitions still count toward the base limit of 16 per layer per step.

`reset: true` explicitly requests the normal restart on every re-entry. Omission is identical.
`reset: false` is rejected (`machine-state`); implicit pause/resume is not specified.

### Transitions and previous values

Transition fields (JSON and AniML names are identical):

- `disabled: boolean`: keep the edge but never select it.
- `exitRatio: number` in [0,1]: gate by this fraction of the source play duration. With motion,
  use its work span and effective speed. Spill the overshoot into the target, as in §7.
- `blendRatio: number` ≥ 0: blend for that multiple of source play duration, including work
  span and effective speed with motion. Exclusive with `blend`.
- `continue: boolean`: default false. True advances the outgoing timeline sampler during the
  crossfade instead of freezing its exit pose. It does not keep the outgoing state active or
  eligible for transitions. The target clock and transition fade advance as usual. Continued sources honor autonomous motion speed/work/quantization; held, expression-controlled or sync-entered sources are rejected with `machine-clock`. Outgoing timeline events stop at exit.
- `change: {input, mode}`: `mode` is `changed`, `increased` or `decreased`. Compare the input's
  current applied value with its value at the end of the preceding step (defaults before the
  first step). `changed` accepts bool or number; ordered modes require number. Queued writes
  are coalesced by the ordinary input stage: only the final applied value is compared.
  Advance the previous-value baseline once, after all parent layers and before nested players advance, even if no edge consumed it. Scoped input changes are observed when their component stage makes them available.
  The same change edge may fire once per layer per step, across any-state and self re-entry;
  every layer sees the same signal. A locked or disabled edge does not buffer changes.

`when` remains required. For an otherwise unconditional change edge use `when: "@after(0)"`:

```json
{"when":"@after(0)","to":"pop","change":{"input":"count","mode":"increased"}}
```

A single such edge on an any state handles arbitrary counts, including another increment
while popping; there is no ladder of numeric states. A zero-duration self-reentry does not
produce `@limit`. A held unchanged value never retriggers. Change-gated transitions always enter the target
at time zero, including their fade clock: the change is observed in this step, so time spent
waiting in the source is not target overshoot, even with `@after`, `@end` or `exitRatio`.
For a pulse on every increase, put this edge on an any state, play a once timeline
starting at the rest value, and return to idle with `@end`. Another increase during the
pulse restarts at its first key; decreases and unchanged values do not restart it.
See `modules/machine/examples/blend-pulse.animl`.

### Typed live guards and the focus seam

`guard: {left, op, right}` ANDs another predicate with `when` and `change`. Each operand is a
number, bool, or exactly one of `{artboard: "width"|"height"|"aspect"}`, `{component: "id.input"}`,
`{focus: "node-id"}`. Artboard dimensions are the document's viewBox dimensions in grid units,
not CSS pixels. Component operands read a validated scoped bool/number input through
`Player.get`, at the component stage already specified by the components module; they do not
read rendered geometry or create layout feedback. Equality accepts matching bool or numeric
operands; ordered comparisons require numbers. Operators are `== != < <= > >=`.

The focus module supplies `player.machineFocus = (nodeId: string) => boolean`, a pure live
reader returning whether that document node owns focus. It calls `player.onChange?.()` after
changes so a settled machine wakes. No focus owner or no installed reader means false.
Machine owns neither DOM focus nor focus traversal, and does not import the focus runtime.
A standalone headless host can install the same reader; both equality and inequality work.

### Blends and bound data

A blend is a play state with `mix: {mode, children, axis?, exit?}`. `children` is a nonempty
array of `{play: timelineName, at?: number, weight?: source}`. The state's `play` names the
child used for `@end`, exitRatio and blendRatio; `exit`, if present, is that child's zero-based
index and must agree with `play`. This makes the exit clock explicit even when its weight is 0.
Every child samples its own timeline at state elapsed time × state speed, with its own loop
mode. With motion installed and declared, each child also honors its own speed, work area and
quantization. A blend's primary state clock must be autonomous: hold/time and incoming sync
are rejected with `machine-clock`, rather than silently applying one child's clock to the others. A blend remains unsettled while any child timeline can move, including a zero-weight
child. Reduced motion is recorded on entry for every child: end/skip freeze at its directional work endpoint, while play children keep advancing. A zero-speed child is at rest. Missing child tracks
contribute the addressed property's rest value, never a value from an earlier frame.

A source is a number, a numeric input name string, or `{bind: "numeric expression"}`. The last
form additionally requires `bind` and compiles the existing bind expression language against
inputs. It evaluates at sampling time after queued input writes, before the ordinary
post-state property bindings. This is P4c's data-source bridge until P4e view models arrive:
there is no implicit view model, scene-property reference or binding feedback.

- `mode: "1d"`: requires `axis` and an `at` on every child, strictly increasing. Clamp the
  axis outside the first/last threshold to that endpoint. Within a segment interpolate its
  neighboring child samples. All other children have weight 0. One child is permitted.
- `mode: "direct"`: sample each child in authored order and interpolate the accumulated
  value toward it by its independently clamped [0,1] weight (default 1), starting at rest.
  Weights are not normalized. A first child at weight 1 establishes a baseline.
- `mode: "additive"`: apply the first child as the full baseline, then interpolate
  toward each later child's sample by its independent weight, in authored order.
  This is the direct-blend family exposed as Additive Blend in Rive's editor;
  it combines animations over a baseline, rather than accumulating numeric offsets
  from previous frames. The first child's authored weight is ignored.

The same base interpolation rules apply to colours and discrete values. State output still
passes through the base crossfade, layer ordering, property bindings and clamping.

### Deterministic random selection

`kind: "random"` selects among eligible outgoing transitions, using nonnegative `weight`
(default 1). Ignore disabled, false-condition and zero-weight edges. The first gate evaluation
selects once for that search; later probes do not redraw. No eligible edge consumes no random
number. A taken edge invalidates that search; another visit can choose again. Trigger names
already consumed in this layer/step remain ineligible. Declaration order resolves intervals.

Every player owns an unsigned 32-bit seed, `machineSeed` at the document root, default
`0x6d2b79f5` (1831565813). Before each choice:
`seed = (1664525 * seed + 1013904223) mod 2^32`, using integer multiplication;
`u = seed / 4294967296`. Choose the first eligible edge whose cumulative weight exceeds
`u * sum(weights)`. Without an explicit player/script seed, players, component instances and
named-machine players keep independent RNG state. An explicitly seeded root shares its core
source with nested stepping in authored order. Identical applied inputs, seed and step sequence produce identical choices. This
portable LCG is independent of Rive's unseeded native selection. With an explicit player/script
seed, machine and converter draws share one core source in evaluation order; the explicit seed
overrides `machineSeed`. Without it, the machine stream and converter stream retain these legacy defaults.

### Actions and completion

States support `enterActions` and `exitActions`; transitions support `actions` and `endActions`.
Each is an object with the listener actions `fire`, `set`, `toggle`, `emit`.
Sets use the shared **Input expressions in actions** contract (§bind), including expression
types, one pre-action snapshot, clamping and sequential action visibility; expression strings
require `bind`, while literal machine groups require only `machine`. Order on entry: outgoing exitActions, transition actions,
incoming enterActions. When `machine` is declared it owns transition `actions`, so that
block queues exactly once instead of also executing as a bind-only immediate block.
Bind's separate `entry`/`exit` blocks retain their immediate timing. Queue in that order using the ordinary input queue. Effects become
visible at the next step's input stage; emits have `layer: null`, as other queued actions.
The initial state's enterActions are queued during player construction and apply on the
first step. No action mutates the current transition search's inputs.

A positive blend's endActions queue when the fade completes at the clock stage. Zero-duration
or reduced-motion transitions queue them after entry actions at entry. Overshoot at or beyond
blend duration also completes immediately. An interrupted fade discards its endActions.
Pending actions prevent settlement through the existing queue; they never run twice.

### Syntax, diagnostics and tooling

Registry entries define JSON Schema, `anima schema`, both syntaxes and formatting. AniML keeps
scalar fields as attributes. Object-valued fields (`mix`, `guard`, `change`, each action group)
are JSON-valued attributes, with normal XML escaping; single quotes make authored JSON easier:
`<on when="@after(0)" to="pop" change='{"input":"count","mode":"increased"}'/>`.
`machineSeed` is an attribute of `<anima>`. Build/decompile/format use the same generic
non-node registry extension documented in MODULES §3. Browser JSON requires only machine;
browser AniML additionally loads markup, with no machine-specific compiler hook.

Shape errors retain `type`, `missing-key`, `bad-value`, `unknown-key` and declared-feature
errors. Semantic errors provide pointer, message and hint:

| Code | Pointer | Meaning / correction |
|---|---|---|
| `machine-state` | state `/kind`, `/reset`, `/on` or edge `/to` | Special state needs empty pose; any cannot be initial/target; exit has no edges; reset must be true; random weights must have finite total. |
| `machine-blend` | state `/mix`, `/mix/exit`, `/play` | Supply a numeric axis and sorted unique thresholds; choose an existing child exit clock matching play. |
| `machine-clock` | edge or `/blendRatio` | Relative timing needs a play source with finite duration (zero ratios remain zero); choose blend or blendRatio. Blend/continued clocks must be autonomous and unsynchronized. |
| `machine-guard` | edge `/guard` or operand | Choose one valid source and matching types; ordered comparisons require numbers. |
| `unknown-input`, `input-type` | source, action or `/change/input` | Declare the correctly typed input, including scoped component inputs. |
| `unknown-timeline` | `/mix/children/i/play` | Name an existing timeline. |
| `unknown-target` | guard operand `/focus` | Name an existing document node. |
| bind diagnostics | source `/bind` | Correct the numeric expression. |

The capability directories map rows to examples, validation, independently calculated
conformance cases and native-oracle evidence. A documented oracle skip is not native parity.

<!-- capability: state-machine.any-state -->

<!-- capability: state-machine.blend-1d-data -->

<!-- capability: state-machine.blend-1d-input -->

<!-- capability: state-machine.blend-additive -->

<!-- capability: state-machine.blend-direct -->

<!-- capability: state-machine.blend-exit-clock -->

<!-- capability: state-machine.blend-weight-constant -->

<!-- capability: state-machine.blend-weight-data -->

<!-- capability: state-machine.blend-weight-input -->

<!-- capability: state-machine.condition-artboard -->

<!-- capability: state-machine.condition-component -->

<!-- capability: state-machine.condition-focus -->

<!-- capability: state-machine.continue-on-exit -->

<!-- capability: state-machine.entry-state -->

<!-- capability: state-machine.exit-state -->

<!-- capability: state-machine.exit-time-relative -->

<!-- capability: state-machine.state-entry-actions -->

<!-- capability: state-machine.state-exit-actions -->

<!-- capability: state-machine.state-random -->

<!-- capability: state-machine.state-reset -->

<!-- capability: state-machine.transition-actions -->

<!-- capability: state-machine.transition-disabled -->

<!-- capability: state-machine.transition-duration-relative -->

<!-- capability: state-machine.transition-end-actions -->

<!-- capability: state-machine.transition-random-weight -->


<!-- capability: state-machine.condition-data -->
<!-- capability: state-machine.literal-asset -->
<!-- capability: state-machine.literal-boolean -->
<!-- capability: state-machine.literal-color -->
<!-- capability: state-machine.literal-enum -->
<!-- capability: state-machine.literal-string -->
<!-- capability: state-machine.literal-trigger -->
### Typed data guards

With `data`, a direct scalar path on the left accepts `==`/`!=` against JSON string/enum,
boolean, hex colour or `asset("id")` literals. Enum members and typed assets must exist.
Colors compare all four RGBA bytes; quoted `&&` stays inside a string. The existing JSON/AniML
`when` field retains its spelling. Type/operator mismatches emit `data-guard` at the `/when`
pointer with a correction hint. Bare `$trigger` guards consume signal occurrences; there is no
integer trigger literal syntax. Details: [data contract](../modules/data/SPEC.md).

## input

Optional P4c input behavior is specified in [the input contract](../modules/input/SPEC.md).
Capture listeners run from the outermost ancestor down to the target, with authored order at
equal depth. A `consume: true` capture listener stops delivery before inner capture or normal
listeners. Normal keyboard listeners stop delivery by default; `propagate: true` (AniML
`propagate="true"`) passes the key on, while `consume: true` takes precedence. Capture listeners
only stop delivery with explicit consume — an intentional difference from Rive, where a capture
listener claims the event by default (measured in `tests/oracle/input-capture-phase`): Anima keeps
the DOM's rule that observing an event in the capture phase does not take it away from the target. This policy includes nested component keys and all
three keyboard phases; unmatched key/modifier filters never claim a key. Focus navigation and
native Enter/Space activation retain the focus/host policies above. These input
consumption rules apply only to authored Anima listeners; DOM propagation to the
surrounding page remains intact as specified in §10.

Preserve-offset alignment intentionally differs from the measured native Rive probe. Anima
stores target origin minus grab point at pointer-down, then adds that offset to each pointer
position in parent coordinates. In `tests/oracle/input-align-preserve`, the origin is x=80,
the grab is x=88 (offset -8), and the move is x=104: Anima yields x=96 and retains it after
release; native Rive yields x=80 at both observations (absolute delta 16). This is an
intentional difference recorded separately, never a passing oracle or a relaxed tolerance.
Snap alignment agrees. See the retained native command/number dumps and
`docs/research/rive-web-runtime.md` lessons 2, 5 and 6 for the core/host boundary rationale.

Generic registry attributes and the sample command dispatcher are integrated. See per-row reports
for native comparison evidence and recorded differences.

<!-- capability: host-api.coordinate-mapping -->
<!-- capability: host-api.dom-listener-control -->
<!-- capability: host-api.gamepad -->
<!-- capability: host-api.low-level-pointer -->
<!-- capability: host-api.low-level-scroll -->
<!-- capability: host-api.manual-gamepad-batch -->
<!-- capability: host-api.multitouch -->
<!-- capability: host-api.pointer-exit -->
<!-- capability: host-api.scroll-hit-policy -->
<!-- capability: host-api.scroll-latching -->
<!-- capability: input.align-preserve -->
<!-- capability: input.align-snap -->
<!-- capability: input.bounded-hit-tests -->
<!-- capability: input.button-middle -->
<!-- capability: input.button-secondary -->
<!-- capability: input.capture-phase -->
<!-- capability: input.cursor-arrow -->
<!-- capability: input.cursor-hidden -->
<!-- capability: input.cursor-intent -->
<!-- capability: input.cursor-pointer -->
<!-- capability: input.cursor-resize-horizontal -->
<!-- capability: input.cursor-resize-vertical -->
<!-- capability: input.cursor-text -->
<!-- capability: input.disable-listeners -->
<!-- capability: input.gamepad-axis -->
<!-- capability: input.gamepad-button -->
<!-- capability: input.gamepad-button-phases -->
<!-- capability: input.gamepad-connected -->
<!-- capability: input.gamepad-disconnected -->
<!-- capability: input.gamepad-host -->
<!-- capability: input.gamepad-index-mapping -->
<!-- capability: input.hit-occlusion-query -->
<!-- capability: input.hit-parent-chain -->
<!-- capability: input.hit-shape-geometry -->
<!-- capability: input.hit-test-host -->
<!-- capability: input.key-down -->
<!-- capability: input.key-filter -->
<!-- capability: input.key-modifiers -->
<!-- capability: input.key-repeat -->
<!-- capability: input.key-up -->
<!-- capability: input.keyboard-bubbling -->
<!-- capability: input.multi-touch -->
<!-- capability: input.multi-trigger-listener -->
<!-- capability: input.opaque-targets -->
<!-- capability: input.pointer-cancel -->
<!-- capability: input.pointer-drag -->
<!-- capability: input.pointer-drag-end -->
<!-- capability: input.pointer-drag-start -->
<!-- capability: input.pointer-enable -->
<!-- capability: input.touch-page-scroll -->
<!-- capability: input.trackpad-scroll -->
<!-- capability: input.wheel-scroll -->
<!-- capability: transforms.collapse -->
<!-- capability: transforms.solo -->






## events

Declare `requires: ["events"]` and import the optional events runtime. The module adds
`eventDefs`, a name-keyed map of event definitions, and `audioVolumes`, an audio-asset-name map
of resource gains in [0,1]. Existing timeline `[time,name]`, state `emit` and listener `emit`
spellings and ordering remain unchanged. Definitions enrich every occurrence of that name;
undeclared names continue to report the original `{name,layer,time}` record.

A definition has optional `payload`, `url`, `target`, `audio` and `volume` fields. `payload`
is a field-name map of `{type,value?,input?,address?}` objects. Type is `number`, `bool` or
`string` or `color`; exactly one source is required. A literal must have the declared type. `input`
references a bool/number input of the same type; `address` references an animatable property
of the same type. Each reported event gets its own detached `payload` object. Values resolve
at the end of the local player's step, after queued inputs, state resolution and bindings;
all occurrences in that step observe that resolved snapshot, including time-zero entry events.
Payloads survive component bubbling unchanged; parent definitions do not reinterpret child names.
For number/bool/color fields, `value: "{expression}"` additionally requires bind and evaluates
against the same final-step input snapshot as `input` sources; it does not capture the instant of
an emit action. String fields always stay literal, including braces. Number fields accept bool
expressions as 0/1; bool fields require bool; colour fields require a colour expression or hex
literal and report a canonical hex string (including alpha when needed). Colours cannot reference
inputs because inputs are bool/number/trigger only. `anima sample` snapshots include these fields
verbatim. This is snapshot sampling, not scripting.
`events.script-event-context` is deferred to P9 because no script VM/context exists.

`url` is an HTTP(S) URL or a relative reference. `target` is `_self` (default), `_blank`,
`_parent` or `_top` and requires `url`. Core rejects non-HTTP schemes (`event-url`). Host URL
parsing is authoritative: no navigation occurs without explicit `url-policy="allow"` or an
`icon.urlPolicy(url,target,event)` callback returning exactly true. Relative references resolve
against the host document and must stay on its origin; absolute HTTP(S) may cross origins.
Protocol-relative or backslash references that resolve off-origin are rejected. Canonical
protocol checks run even with a permissive policy. Delivery uses `window.open` with `noopener`;
browser popup/target restrictions still apply. There is no navigation in core or CLI.

`audio` references an assets-module audio asset (`event-audio` otherwise); `volume` is an
optional [0,1] event gain, default 1. The browser requires prior user activation; earlier events
are dropped without fetching or decoding and are never replayed later. Decode is on demand and
cached per element/load/asset. Each occurrence starts a separate source, honoring asset clip `start`/`end` (assets chapter). Effective gain is
`event.volume * audioVolumes[asset] * icon.volume`, with each omitted gain equal to 1.
For bubbled component events the owning child supplies the asset and resource gain; the host
resolver receives its dot-scoped asset name (for example `child.tone`).
The asset resolver is consulted as for image assets. Relative asset sources use the element's
`src`, falling back to the host document. Reload/disconnect/destroy stops sources, closes the
context and invalidates outstanding decodes. Browser resume/fetch/decode failures report an
`anima:error` diagnostic `event-audio-load`; they do not change deterministic player output.

Local listeners may use `on: "event:<name>"` to queue their existing fire/set/toggle/emit
actions for the next step. This is an **intentional difference** from Rive's same-frame
listener response: a step cannot re-enter itself, so event-caused writes cannot affect
its own transitions or recursively run an event cascade. All runtimes keep this queue
boundary, including `step(0)` calls. Unknown local event names are `unknown-event`.
Pending actions keep the player unsettled; callbacks never recursively re-enter a step.
Components retain their existing scoped listener spelling and next-parent-step semantics.

Conditions and event fields that read an input changed by a listener action see the **new**
value in the step that applies the action: a click that sets `count = count + 1` and a
transition `when="mod(count, 5) == 0"` report the milestone at counts 5, 10, 15, … This is an
**intentional difference** from the measured Rive behaviour (`tests/oracle/data-bind-listener-actions`),
where the same scene reports at counts 6, 11, 16, … because its condition still sees the value
from before the increment. Anima follows what the author wrote.

For documents requiring events, state exits additionally report `@state-end`, then
`@transition-start`, each with `{payload:{state}}` (source state for end, target for start).
A completed blend reports `@transition-end` once with the target state. A state may additionally name
`endEmit`, and each transition may name `startEmit` and `endEmit`. Each named action reports an
ordinary event immediately after its corresponding metadata signal, using the same definitions,
payload resolution, URL/audio policy and next-step listeners as timeline and entry events.
Interrupted transitions do not fire their end action. These optional fields require events and
use the identical attribute names on AniML `<state>` and `<on>`. Component scopes expose the
named action events to existing parent listeners. Each player's active action is independent.
 Zero-duration,
reduced-motion and fully carried blends report end immediately before the target's entry emit.
Interrupted blends do not report completion. Fade completion is checked before layer timeline
crossings, after listener actions. These signals have timeline time 0 and the owning layer.

Repeating timeline states report `@loop` at each boundary: every duration for `loop`, every
turn for `pingpong`. There is no loop signal at initial entry, held/seeked clocks, reduced-motion
freezes or `once` completion. The existing motion crossing policy supplies work area, speed,
reverse and carry behavior. Loop signals precede that state's ordinary timeline event block;
ordinary event ordering is unchanged. Coincident authored endpoints remain distinct, while each
loop boundary is reported once. Existing crossing caps remain unchanged.

`event-payload`, `event-input` and `event-address` reject ambiguous/mistyped sources, missing
or mistyped input/property references. Diagnostics include a JSON pointer, message and hint.
AniML uses root `<event-def name="…" payload='{"field":{"type":"number","input":"count"}}'
url="…" target="_blank" audio="tone" volume="0.5"/>` and
`<audio-volume asset="tone" value="0.4"/>`. Payload is JSON inside the XML attribute and obeys
normal XML escaping. Neither form changes timeline `<event at="…" name="…"/>`.

The event delivery/subscription separation follows the host/runtime concerns recorded in
`docs/research/rive-web-runtime.md` §§2–3; no Rive implementation or documentation text is used.


Repeated event audio resolves its emitting player through both ordinary component placements and
list indices (for example `rows.1.inside.play`). Decode caches use asset declaration identity, so
reordering different component catalogs with the same clip name cannot replay another row's audio.
The host still observes the scoped event and the ordinary Web Audio start call after activation.

## contour

The optional `contour` module (5120 B browser budget) contains authoring geometry and path
operations. Declare `requires: ["contour"]`; gradients additionally require paint, ordered
paints additionally require composite. Core hooks contribute resolved geometry, never backend
commands. This follows MODULES §3.1 and the separation discussed in
[web runtime research](../docs/research/rive-web-runtime.md#lessons-for-anima).
The corner-control distance below follows Rive’s MIT natural-rounding construction; see NOTICE.
The other algorithms are independent constructions.

### Editable vertex authoring forms and geometry origin

A `contour` node has `vertices`, at least two objects `{point:[x,y], kind, …}`, optional
`closed` (default false), and optional `geometryOrigin:[x,y]` (default `[0,0]`). It accepts
ordinary painted-node transforms/fills/strokes. Each vertex point is in grid units; origin is
subtracted from every point before ordinary node transforms, independently of paint coordinates.
AniML `<contour>` uses `vertices="[…JSON…]"`, `closed="true"`, and
`geometry-origin="x y"`. The array is explicitly JSON-valued in the registry. Node/paint
fields, schema and CLI names derive from the ordinary registry. Authoring fields are static;
editing means reloading revised vertex data. Path morphing remains the paint module's `d` API.

Vertex kinds compile to an ordinary path shared by SVG, canvas and the outline hook:

| kind | Optional fields and construction |
| --- | --- |
| straight | No handles; adjacent edges are lines unless the neighbour supplies a cubic handle. |
| mirrored | `handle:[dx,dy]`, default zero; outgoing is handle, incoming is its exact negative. |
| asymmetric | `outgoing:[dx,dy]`, `incoming:[dx,dy]`, defaults zero. Outgoing supplies direction and length; incoming supplies length only, projected opposite outgoing. Nonzero incoming length requires a nonzero outgoing direction. |
| detached | `incoming` and `outgoing` vectors, independently positioned, default zero. |
| rounded | `radius ≥ 0`, default zero. Use one cutback min(radius, half previous length, half next length) and a cubic with the natural-rounding controls below. Open endpoints do not round. |

A cubic edge uses source outgoing and destination incoming controls (point plus vector).
A closed contour joins the last vertex to the first, then closes. Fields belonging to another
kind produce `bad-value` at that vertex field with a corrective hint; invalid array sizes,
coordinates, kinds and negative radii retain structural diagnostics. This is an explicit,
deterministic authoring contract. For rounded corners, let u/v be the vectors from the point to
its previous/next neighbour (using the neighbour’s adjacent cubic control when present).
Let θ = atan2(abs(cross(u,v)), dot(u,v)). With cutback r, set
h = min(1, (4/3) tan(θ/4) × (θ < π/2 ? 1+cos θ : 2−sin θ)).
The cubic’s controls lie fraction h from each cut toward the authored point. Zero-length
neighbour vectors collapse the rounding. This mathematical construction closely follows
[Rive’s MIT path implementation](https://github.com/rive-app/rive-runtime/blob/main/src/shapes/path.cpp),
reimplemented here without source-text copying; attribution/license are in NOTICE. Native
identity path-effect captures check acute, right, obtuse and degenerate corners independently.

### Sequential and synchronized trim; ordered/shared effects

`stroke.trim` is `{start?,end?,offset?,mode?}`: defaults 0,1,0,`sequential`. Start/end are
fractions in 0..1. Offset is an arbitrary fraction of one turn. Sequential trim measures the
concatenation of all subpath lengths in authored order; synchronized trim applies the same
fractions independently to each subpath. A nonpositive end−start draws nothing; a full span
keeps all geometry; other spans begin at `(start+offset) mod 1`, wrapping at one.

`stroke.effects` is an ordered JSON array of trim/dash objects or shared-stack names.
A trim is `{type:"trim",start?,end?,offset?,mode?}`. A dash is
`{type:"dash",dash:[nonnegative grid lengths…],offset?}`. Odd dash arrays repeat twice;
at least one entry must be positive. Positive offsets advance into the pattern. Dashes restart
at each input subpath. Each operation consumes the previous operation's output, so trim after
dash measures the remaining dash fragments, while dash after trim restarts at each trimmed
fragment. Effects alter stroke geometry only, preserving fill geometry and the hit outline.

Document `effects` maps names to arrays of effect objects, expanded by name at each use.
Shared arrays cannot contain references, so cycles are impossible. Each use starts from its
own node geometry. AniML uses JSON-valued root `effects` and stroke `effects` / `trim`
attributes, with ordinary XML escaping. Compound document fields explicitly opt in via their
registry markup name; existing document containers retain their structural forms.
`unknown-source` identifies a missing stack name at its exact array index. A dash without
positive length or fields of the wrong effect kind is `bad-value`, with field pointer and hint.
An effect stack and `trim`, or either plus legacy `dash` / `trimStart` / `trimEnd` /
`trimOffset`, is `paint-conflict`; move all operations into one stack. Legacy stroke behaviour
is unchanged. Effects are static; changing the stack requires reloading the document.

Cubic path segments are subdivided at the midpoint until control-polygon length minus chord
is at most 0.0001 local grid units (maximum depth 20). Operations slice the resulting segments
by Euclidean length. Geometry is compiled into resolved per-paint paths; neither backend uses
its own dash/trim approximation. Existing path-length/dash algorithms are unchanged.

### Clockwise fill

`fill.winding: "clockwise"` (AniML `fill-winding="clockwise"`) selects strictly positive
winding, overriding the ordinary fill `rule` for rendering. In local SVG y-down coordinates,
a clockwise contour contributes +1, counterclockwise −1. The filled region contains exactly
points whose total winding is greater than zero; nonzero negative regions are empty. Open
contours implicitly close. This applies to self-intersections, not merely signed whole-contour
area. The operation runs in local geometry space before transforms (a reflected node remains
filled). It compiles to nonoverlapping trapezoids split at endpoints and edge intersections;
curves use the same subdivision rule as effects. Both backends fill that ordinary path nonzero.
Stroke geometry is unchanged. Core pointer hit testing uses the same positive local winding,
including implicit closure of open fill contours, holes and self-intersections. Reflections do
not change the local winding test. Ordered fills contain a point if any fill contains it; stroke
and listener padding continue to use the original outline distance.

## mix

The optional `mix` module (5120 B browser budget) refines backend compositing. Declare
`requires: ["mix"]`; base node blend and ordered paints still require composite.

### Additive blend and strength

`node.mix: {mode, strength?}` selects a node compositor. Mode accepts the existing composite
blend names plus `additive`; strength defaults one and is in 0..1. `mix` and node `blend`
cannot coexist (`paint-conflict` at `/mix` with an instruction to choose one).
`<group mix="{&quot;mode&quot;:&quot;additive&quot;,&quot;strength&quot;:0.5}">` illustrates the
JSON-valued AniML spelling. `node.mix.strength` is an ordinary animatable number address.

Additive means Canvas2D `lighter`: sum premultiplied source and destination components,
clamping to the output range. Strength interpolates between source-over (zero) and addition (one). For premultiplied
source `S`, destination `D`, source alpha `Sa` and strength `a`, the result is
`S + D * (1 - Sa * (1 - a))`, clamped per component (including alpha). Node opacity
scales `S` and `Sa` before this operation. Canvas evaluates fractional strength once in premultiplied pixel space to avoid rounding
the source contribution twice in 8-bit intermediate surfaces; strength zero/one use native
source-over/lighter. Strength has no effect on other compositors. SVG refuses
additive nodes or paints with `unsupported-render`, reason and a canvas hint because
`plus-lighter` is not consistently supported by the supported SVG engines/static renderer.

### Per-paint blend override

Fill and stroke objects accept static `blend`, default `inherit`, selecting any node mix mode,
and animatable `blendAmount` in 0..1 (AniML `fill-blend`, `stroke-blend`,
`fill-blend-amount`, `stroke-blend-amount`). If any paint overrides blending, the node blend
is moved to each paint: inherit chooses the node blend, explicit mode replaces it. Paints
compose in authored order, then ordinary node opacity/masking/group isolation applies.
`blendAmount` selects the same source-over/addition interpolation for an additive paint; it
has no effect on other modes. Canvas uses each paint's compositor. SVG gives each paint a
separate blend group, with the geometry transform on an inner group. To avoid Firefox isolating
transformed ancestors, documents with paint overrides move node transforms into these inner
world-space groups; authored opacity, masks and node compositors retain their isolation. Mask
sources and clip outlines use the same world coordinate space. Gradients and fixed strokes
remain local to the inner geometry transform. Additive overrides retain the explicit SVG refusal.
A node without paint overrides retains the existing group compositor exactly.

### Host renderer and factory mapping

`AnimaIcon.renderers[name] = icon => renderer` is the host factory. It creates an `IconRenderer`
whose `draw(DrawFrame,force)`, `layout()`, `point(x,y)`, `connect()`, `disconnect()` and
`destroy()` implement the backend bridge. Factories own their paths, gradients, buffers, image
decoding and resource caches; there is no mandatory global resource superclass or per-verb
bridge. A custom backend may inject its own resource factory through that closure. The core
contract is the draw frame, including transforms, geometry, paints, clipping and opacity, so
playback is shared. Browser tests create and release host-owned paths and gradients in both
engines. These host-only API rows have no observable Rive screenshot counterpart.
## data

The optional `data` module generalizes typed inputs with view models, scalar and reference properties,
named instances, `$` paths, binding direction modes, data-writing listeners and node custom properties.
Its normative contract, step position, spellings, diagnostics and limits are in
[modules/data/SPEC.md](../modules/data/SPEC.md). `data` bindings resolve in §7's existing binding
position, after layers and before clamping/reporting/children. Change listeners queue for the next
step; no callback re-enters the machine. Existing 0.1 input behavior is unchanged.

Capability evidence and incomplete rows are enumerated in
[modules/data/ROWS.json](../modules/data/ROWS.json). No phase-completion claim is made.

<!-- capability: data.bind-conditions -->
<!-- capability: data.bind-converter-options -->
<!-- capability: data.bind-instance-values -->
<!-- capability: data.bind-keyframes -->
With `data motion`, a keyframe value may be a direct scalar data path. Sampling resolves needed
endpoints against the current player before interpolation, including blends and TimelineInstances,
without mutating shared tracks. JSON `[0.5, "$peak"]` and AniML `<key t="0.5" value="$peak"/>`
are equivalent. Full typing, diagnostics and timing: [data](../modules/data/SPEC.md#data-keyframe-values).

<!-- seam(P7-2): data.bind-layout is specified with layout below. -->
<!-- capability: data.bind-script-inputs -->
<!-- capability: data.bind-text -->
<!-- capability: data.binding-absolute -->
<!-- capability: data.binding-once -->
<!-- capability: data.binding-relative -->
<!-- capability: data.binding-to-source -->
<!-- capability: data.binding-two-way-prefer-source -->
<!-- capability: data.binding-two-way-prefer-target -->
<!-- capability: data.component-public-data -->
<!-- capability: data.custom-property-boolean -->
<!-- capability: data.custom-property-color -->
<!-- capability: data.custom-property-enum -->
<!-- capability: data.custom-property-number -->
<!-- capability: data.custom-property-string -->
<!-- capability: data.custom-property-trigger -->
<!-- capability: data.default-instance -->
<!-- capability: data.editor-preview-instance -->
<!-- capability: data.enum-members -->
<!-- capability: data.global-model -->
<!-- capability: data.instance-export -->
<!-- capability: data.list-items -->
<!-- capability: data.model-definition -->
<!-- capability: data.named-instances -->
<!-- capability: data.operation-operand-view-model -->
<!-- capability: data.property-artboard -->
<!-- capability: data.property-asset-blob -->
<!-- capability: data.property-asset-font -->
<!-- capability: data.property-asset-image -->
<!-- capability: data.property-boolean -->
<!-- capability: data.property-color -->
<!-- capability: data.property-enum-custom -->
<!-- capability: data.property-enum-system -->
<!-- capability: data.property-list -->
<!-- capability: data.property-number -->
<!-- capability: data.property-string -->
<!-- capability: data.property-symbol-list-index -->
<!-- capability: data.property-text-style -->
<!-- capability: data.property-trigger -->
<!-- capability: data.property-view-model -->
<!-- capability: data.script-model-api -->
<!-- capability: data.scripted-converter -->
<!-- capability: data.state-action-trigger -->
<!-- capability: data.system-enum-horizontal-text-align -->
<!-- capability: data.system-enum-layout-alignment -->
<!-- capability: data.system-enum-layout-direction -->
<!-- capability: data.system-enum-layout-display -->
<!-- capability: data.system-enum-layout-flex-direction -->
<!-- capability: data.system-enum-layout-position -->
<!-- capability: data.system-enum-layout-position-units -->
<!-- capability: data.system-enum-layout-scale-type -->
<!-- capability: data.system-enum-layout-wrap -->
<!-- capability: data.system-enum-scroll-direction -->
<!-- capability: data.system-enum-semantic-check-state -->
<!-- capability: data.system-enum-text-box -->
<!-- capability: data.system-enum-text-overflow -->
<!-- capability: data.system-enum-text-trim-bottom -->
<!-- capability: data.system-enum-text-trim-top -->
<!-- capability: data.system-enum-vertical-text-align -->
<!-- capability: data.system-enum-word-wrap -->
<!-- capability: drawing-paint.gradient-channel-binding -->
<!-- capability: input.data-listener -->
<!-- capability: input.write-data-constant -->
<!-- capability: input.write-data-copy -->
<!-- capability: input.write-focused -->
<!-- capability: input.write-gamepad-axis -->
<!-- capability: input.write-gamepad-button-pressed -->
<!-- capability: input.write-gamepad-button-value -->
<!-- capability: input.write-gamepad-changed-value -->

## host

Optional host data scripting is specified in [modules/host/SPEC.md](../modules/host/SPEC.md).
Import the host entry alongside `data`; it adds no document fields or AniML spellings. It provides
typed handles, reflection, instances, binding, batched writes, change subscriptions delivered after
the step that made the change, and the web `auto-bind` attribute.


<!-- capability: assets.replacement-scope-image -->
### Image replacement scope

Host `image(path).set(URL | Blob)` decodes a player-local replacement and queues only that
property's resource ID; image `asset` bindings follow it at the next step. Shared compiled
components, other data properties and authored resources retain their identities. Static nodes
without asset bindings keep legacy per-player resource replacement. See
[host editing](../modules/host-edit/SPEC.md) and [data-host](../modules/data-host/SPEC.md).

## host-edit

Optional page-data editing is specified in [modules/host-edit/SPEC.md](../modules/host-edit/SPEC.md).
Import `host-edit` alongside `host` and `data`; it adds no document fields. It provides
identity-preserving list mutation, default and named instance discovery, colour and enum helpers,
image replacement on the web, nested component player access, component root selection and a
constructor readiness promise. Its runtime registration key is `hostedit`.

## convert

Optional feature `convert`, after `bind` and `data`; no runtime dependencies. JSON declarations are a
`converters` map at the document root. Each value is `{type, ...options}` or `{chain: [names...]}`.
Names in a group execute left to right; forward references are permitted, cycles and missing
references are errors. A group occurrence has its own state key, including repeated names.

Named converters/groups register through the active data module’s `registerConverter(name, fn)`;
`fn(value, options, ctx)` receives `{player, dt, direction, get, state, key}`. Definitions are selected
from that player’s document, so equal names in different documents remain independent. Bindings
require `data` and `convert`. Binding `options` override declaration options; whole `$path` strings
resolve from the player’s current data scope. Formula `$` operands use the same resolver and bind
parser. Unknown named converters and invalid numeric operand paths fail at load with pointers.

`ctx.state` is a shared player-local Map. Convert namespaces a separate map per stable binding
`key` inside it, preserving external converters’ access to the shared map. Interpolation state is stored only
there, keyed by group occurrence and direction, including repeated converter names. No state is
stored on a loaded model or shared between players. The direct API `convertValue` and
`createConverterRunner` accept `{player,time,state,key?,get?,direction?}`; `time` is milliseconds
and direct temporal calls retain their context map. The runtime supplies `player.time * 1000`.
Converter-free documents install no scheduler wrappers. Active interpolation and `random="always"`
keep the player unsettled; `once`, `on-change`, and completed interpolation allow sleep.
Bindings evaluate once per data binding evaluation; `mode="once"` retains its converted output.

| Type | Options and semantics |
| --- | --- |
| formula | `expression`, `random`: always (default), once, on-change. Variable `value` is the input. |
| calculate | `operation`, numeric `operand` (default 1); arithmetic and registered math operations. |
| range | `from` and `to` number pairs (default 0 1); map linearly. `modulo`, then `clamp`, then `reverse` apply to normalized progress. Reversed endpoints are permitted; zero-width source is invalid. Optional `ease` uses the existing timeline easing grammar (default linear). |
| round | `decimals` (0–100, default 0), `mode`: round/floor/ceil; ECMAScript rounding semantics. |
| negate | Boolean inversion; numeric inputs are errors. |
| to-number | Number, boolean or string conversion using ECMAScript Number; nonnumeric strings become zero. |
| to-string | ECMAScript String conversion. |
| number-format | `decimals` (0–100, default 0), `grouping` boolean; fixed precision, dot decimal, comma thousands; locale independent. |
| color-format | Hex colour or RGBA tuple → `format` hex/hexa/rgb/rgba (default hex), or component `pattern` (see below). |
| pad | String `length` (0–10000), `fill` (nonempty string, default space), `side` start/end. UTF-16 length. |
| trim | `mode`: start/end/all/none; ECMAScript whitespace. |
| template | `text`, `open`/`close` delimiters (default braces), `grouping`, optional `args` map/array. Without `args`, scalar input is argument 0 and a list supplies positional arguments. Named keys, numeric positions and sequential `{}` placeholders are supported. `args` values may be `$` paths. `{points:2:8}` fixes two decimals and left-pads to width 8 (maximum 10000). Missing arguments are errors. |
| remove-zeros | Strip redundant fractional zeros and empty decimal point; integer zeros remain. |
| enum-to-index | `values`: ordered strings. Unknown values are errors. |
| list-length | Return list length. |
| number-to-list | Integer count 0–10000; produce index values or repeated `item`. Model instance creation awaits data integration. |
| trigger | Boolean passthrough or truncated integer counter; a trigger binding destination fires when the converted output changes (next step, no initial pulse). |
| degrees-to-radians | Multiply by pi/180 forward; by 180/pi in reverse. |
| normalize | Normalize using `from` pair, default 0 1; reverse denormalizes with the same pair. No implicit clamp. |
| interpolate | `duration` in milliseconds, default 0. First evaluation returns input immediately; changes retarget from the current sample. Numeric or rounded RGBA channel interpolation; optional `ease` uses the existing timeline easing grammar (default linear). No extrapolation before start or after completion. |

Expressions reuse bind precedence, token/depth limits, numeric/bool coercion and non-finite-to-zero
rules without eval or dynamic code generation. Added calls: sin/cos/tan/asin/acos/atan/atan2,
log (natural), exp, pow, sqrt, round, ceil, floor, abs, random(). Long aliases sine/cosine/tangent,
asine/acosine/atangent/atangent2/power/squareRoot are accepted. Radians for trig. Existing
min/max/clamp/mix/mod remain available. All math functions, including random(), register through the active bind module’s
`registerFunction(name,arity,fn)` and formulas compile with its `parse` hook. There is no second
expression parser. Random is evaluated within the formula context; unscoped random calls outside
a formula return zero. Math functions are available to ordinary bindings whenever convert is
installed. Random uses independently implemented uint32 LCG
`seed = (1664525 * seed + 1013904223) mod 2^32`, output seed/2^32; the stream is shared per player in authored evaluation order, while sites/bindings cache separately.
An explicit player/script seed joins this stream with machine draws through the core source, in
evaluation order. Reseeding resets the source, preserving existing once/on-change site caches.
`always` advances on evaluation, `once` caches per site, `on-change` invalidates when the incoming
value changes under Object.is. Repeated evaluation of unchanged input retains the cached value.

Diagnostics: `convert-unknown-type`, `convert-options`, `convert-type`, `convert-cycle`,
`convert-reference`; formula errors retain bind codes. Load-time diagnostics point at
`/converters/<escaped-name>/<option>` where possible and include message and hint.
`ConverterError` carries code and option for the data integration to attach a binding pointer.

AniML adapter: `convertMarkup.rootChild` accepts `<converter name="pct" type="range" from="0 1"
to="0 100"/>` and `<converter-group name="fmt" chain="pct round label"/>`.
The generated `convertCompiler` hook supplies declaration compilation/decompilation independently
of events/data authoring. Browser `markup-convert` registers the `convert` slot. JSON declarations,
AniML, CLI schema/inspect and `anima docs convert` use the same metadata and module chapter.

Remaining parity limits: retained model-instance list creation; scripted conversion (P9). Their canonical
probes retain precise `todo.json` reasons. Existing scalar/index-list/boolean conversion functions
are useful independently but do not complete those broader rows. See ROWS.json and REPORT.md.

### Intentional differences and observation limits

These decisions retain the original oracle findings unchanged; none becomes a passing comparison.

- Boolean → string uses ECMAScript `"true"`/`"false"`, rather than the native numeric spelling
  (`"1"` for true). See [boolean text finding](../tests/oracle/data-converter-to-string/finding.json).
- Interpolation initializes eagerly from the value at load. A later source change interpolates from
  that value rather than snapping on the first non-default change as native does. See
  [number interpolation finding](../tests/oracle/data-interpolate-number/finding.json).
  RGBA channels round half up, so a black/white midpoint is `#808080`, rather than native `#7f7f7f`;
  see [colour interpolation finding](../tests/oracle/data-interpolate-color/finding.json).
- Decimal rounding and degrees → radians retain doubles. Their measured differences are solely
  native float32 storage precision, not different arithmetic contracts. See
  [decimal rounder finding](../tests/oracle/data-converter-rounder/finding.json) and
  [degrees → radians finding](../tests/oracle/data-converter-system-degs-to-rads/finding.json).
- Enum → index returns the declared zero-based index. The native dump's unchanged numeric bridge
  is an observation limit, not evidence of a different enum conversion rule. See
  [enum observation finding](../tests/oracle/data-converter-enum-to-uint/finding.json).

Algorithms are independently implemented from standard arithmetic and ECMAScript functions.
No Rive source or .riv files were read; no CLI documentation text was copied. The registry design follows
the metadata rationale in `docs/research/rive-format-and-graph.md`; this is not a Rive algorithm port.


<!-- capability: data.converter-color-formatting -->
### Colour component patterns

JSON `pattern` / AniML `pattern` overrides `format` on a `color-format` converter.
Markers `{r} {g} {b} {a}` are rounded bytes, `{h}` rounded degrees (achromatic 0), `{s}`/`{l}`
rounded HSL percentages, `{hex}` lowercase `#rrggbb`. Unknown markers produce `convert-options`
at `/converters/<name>/pattern` with a hint. See [convert](../modules/convert/SPEC.md).

<!-- capability: data.converter-trigger -->
### Trigger destinations

A binding target naming a trigger queues one fire when its converted output changes after the
initial baseline; transitions/listeners observe it on the following step. Magnitude/direction
is irrelevant. `trigger` truncates numeric input and passes booleans unchanged. Forward-only
modes `to-target`/`once` are valid; reverse modes produce `data-binding` at the `/mode` pointer.

### Export discovery and keyframe bindings

JSON instance `exported: true` is AniML `export="true"` (legacy `exported` accepted).
`dataState(player).exports()` lists only explicitly exported authored `{name,model}` records.
Internal private instances remain addressable. Existing host APIs retain their all-instance list.
Data-keyframe values use the player-aware sampler; converter evaluation is isolated per player.

## derive

The optional `derive` module adds computed, read-only scalar model properties. The normative
contract is [modules/derive/SPEC.md](../modules/derive/SPEC.md); its `value` and `convert` keys
have identical JSON/AniML spellings. Dependencies resolve per instance and cycles are invalid.

## lists

The optional `lists` module adds retained repeats and nested data contexts. The normative
JSON/AniML spellings, ordering, bounds, identity, limits and diagnostics are defined in
[modules/lists/SPEC.md](../modules/lists/SPEC.md). Both `components` and `data` are required.

<!-- capability: components.list -->
### List instances
`type: "repeat"`, `list: "$items"`, `component: "row"` is
`<repeat id="rows" list="$items" component="row"/>`. Surviving item identities retain players.

<!-- capability: components.list-map -->
### Model component maps
`component: {Player:"row"}` is `component="Player:row"`; missing known mappings are `list-map`.

<!-- capability: components.list-size-override -->
### Item bounds
`size: [w,h]` is `size="w h"`; both numbers are nonnegative. It changes instance hit bounds.

<!-- capability: components.explicit-context -->
### Explicit data context
`data: "$team"` is `data="$team"` on an instance; the referenced model must match its public model.

<!-- capability: components.inherited-context -->
### Inherited data context
A component with no `data` declaration shares the inherited document's live named data instances,
recursively, including non-global models. This applies to host writes inside/outside `batch` and to
document writes. An explicit child `data` model keeps local storage unless bound; global models
retain their sharing contract. Each root player is independent. Descendant steps follow ancestor bindings; a shared data write
during a descendant step keeps the ancestor unsettled so its bindings resample on the next step.
With lists, a context-free
component additionally sees its actual parent's default/item context.

<!-- capability: data.binding-relative -->
### Relative bindings
`$parent.name` walks one context; `$parent.parent.name` walks two. Parent reads are read-only.

<!-- capability: data.property-symbol-list-index -->
### Item index
`$index` is the current zero-based index and is read-only. Declaring `index` or `parent` is
`reserved-name` at `/data/models/<model>/properties/<name>`, with a rename hint.

<!-- capability: data.converter-number-to-list -->
### Count repetition
`count: "$n"` is `count="$n"`. It floors nonnegative counts and retains players by index.
Counts above 256 are rejected; shrinking releases the removed indices. Any readable numeric data
path is accepted, including `$items.length`, named/relative numeric paths and (with `derive`)
`$title.length`. Nonnumeric paths report `list-source` at `/nodes/<index>/count` with the accepted
source forms. `anima inspect` lists only the repeated input slots in the current initial list/count,
including triggers; reserved potential slots for absent rows are omitted.

## nested

The optional module's normative contract is [modules/nested/SPEC.md](../modules/nested/SPEC.md).

<!-- capability: components.nested-remap -->
<!-- capability: components.nested-quantize -->
<!-- capability: components.leaf-fit -->
<!-- capability: components.stateful-output -->
Instances gain absolute `time`, positive `fps`, `size`/`fit`/`align`, and read-only scalar `outputs`.
The parent reads `badge.outputs.done`; the child declares `<output name="done" value="count > 1"/>`.

## markup-libraries

<!-- capability: components.library-export -->
<!-- capability: components.library-models -->
<!-- capability: components.library-update -->

Local libraries share model definitions, authored data instances and enums through lexical,
collision-free import expansion in both AniML and the resulting JSON data declarations.
Named-instance expressions and enum references are rewritten; member keys and authored values
are retained. Export selection and private dependencies follow the
[library contract](../modules/markup-libraries/SPEC.md). Native library-service comparison is
skip-noted because the required account commands are banned; this does not waive local tests.

Libraries support public export selection, model definitions and local vendoring updates.
See [modules/markup-libraries/SPEC.md](../modules/markup-libraries/SPEC.md).

<!-- capability: state-machine.literal-artboard -->
With `data components nested`, direct component-property guards accept `==`/`!=` against
`component("row")`, a typed definition-name literal. See [nested](../modules/nested/SPEC.md).
Independent guard/keyframe conformance and module-owned native comparisons cover this guard.

## componentpaint

<!-- capability: drawing-paint.paint-artboard -->
Declare `components paint componentpaint`. JSON `fill: {paint: "component:row"}` is AniML
`paint="component:row"`: an independent live component Player supplies a repeating shape-local
fill tile, clipped to its viewBox (including its origin). Its own default machine advances once
per parent step and honors reduced motion. Flat color/type/ordered-paint conflicts, unknown
components and recursive sources are errors. An ordinary stroke remains independent.
The normative lifetime, sampling, diagnostic and backend contract is
[modules/componentpaint/README.md](../modules/componentpaint/README.md).

## CLI projects and capture (tooling)

These operations are authoring tools, not runtime features: they do not alter `Player.step` or
require a feature declaration, registry field or conformance vector.

The CLI discovers `anima.json` from its working directory upward, taking the nearest file.
Supported keys are `entry` (default input path), `sources` (array of AniML library paths),
`exclude` (source globs), `constants` (named string/number/bool build-time values),
`presets` (map of render-option objects), and `out` (default local export directory). Paths are
relative to that configuration file. Unknown keys and malformed values fail with
`project-configuration`, a JSON pointer and a repair hint. Commands needing an input use `entry`
when no positional file is supplied. Explicit files take precedence. Configuration discovery is
based on the working directory, not the input file's directory.

Excluded source paths are matched relative to the project file using Node path glob semantics;
excluded libraries are omitted before reading or importing. An explicitly excluded input fails
with `project-configuration` at `/exclude`. This supports test-only libraries outside exports.
Constants replace `{{name}}` only in AniML attribute values, including imported sources; replacements
are XML escaped. Text nodes are untouched. Unknown names fail at `/constants/<name>`. Constants
never appear in runtime JSON and are not evaluated as expressions.

`sources` requires an AniML entry. Each source is an ordinary named `<library>` imported before
compilation, with its declared name as namespace. For example a library named `ui` exposes
`ui:button`. Existing import resolution, export selection, duplicate-name and cycle diagnostics
apply. Sources are not concatenated into a second format. Imported asset origins remain subject
to the existing compiler/build asset rules. A project file has no representation in `.ani`;
the generated `.ani` schema describes runtime documents only.

Render presets accept `component`, `fit`, `viewport`, `scale`, `size`, `at`, `dark`, `color`,
`current`, `background`, `sheet`, `over`, `frames`, `fps`, and `reduced-motion`. Numeric options may be numbers or
strings, boolean options must be booleans, and `color` is an array of `slot=value` strings.
`--preset name` supplies defaults; explicit flags override them. Presets cannot redirect files
or execute scripts. Repeated `--preset a --preset b` runs a sequential queue in that order,
stopping on failure. With multiple presets the output stem gains `-<preset>` to avoid collisions.
`frames` (1–10000) renders at `fps` (default 60, finite >0 and ≤240) after script/at setup,
stepping 1/fps between frames. PNG output gains zero-based `-0000` numbering. WebM uses CLI-only
headless Chromium canvas capture and MediaRecorder; timestamps follow real-time encoder scheduling,
so encoded bytes/timing are not a deterministic conformance output. WebM defaults to 60 frames.
Unavailable Chromium or WebM support emits `build-encoder-unavailable` with a PNG fallback hint.
Sequences reject sheet/compare and require PNG or WebM output.

`anima schema` accepts conjunctive `--animatable`, `--bindable`, `--inherited` filters.
Inherited fields are the shared node properties, bindable fields are animatable addresses;
static schema fields remain available in unfiltered lookup. `--editor-only` reports not applicable:
Anima has no editor-only entries. `docs authoring` includes a contents list;
`docs authoring <section-slug>` extracts a section. `docs spec --list` lists chapter and subsection
slugs, and `docs spec <slug>` extracts one. Doctor checks Node, executable browsers, writable cache,
module wiring, nearest project validity, the default playground port 4519, and Chromium mobile/touch
emulation. Authentication is explicitly not applicable because Anima has no accounts.

`anima render` selects a component with `--component name`, using the same inherited assets,
data, converters and component declarations as the web component root selector. Scripts address
the selected root's own inputs and nodes. The selector accepts the same original, qualified and
legacy component names as the web host. Ambiguous names are usage errors listing qualified
alternatives; unknown names are usage errors.
`--viewport WxH` sets positive integer output dimensions (default `--size` square).
`--fit contain` (default) centres a uniform fit, `cover` centres and crops, `fill` stretches,
and `none` centres the authored view box with one output pixel per view-box unit.
An explicit background covers the entire output viewport, including letterbox regions.
`--scale k` accepts finite `0 < k ≤ 1`, rounds each output dimension to the nearest integer,
with a minimum of one pixel. Fit is computed before downscaling. These options apply to single
frames; contact sheets reject viewport, fit and scale overrides.

`--probe 'x,y;x,y'` reports `{x,y,rgba:[r,g,b,a]}` for each point as one JSON object containing
`probes`. Coordinates are zero-based integer **output pixels after viewport and scale**, with
origin at the top left; channels are 0–255 including alpha. Out-of-bounds or malformed points
are usage errors. Probes can be requested without an output file.

`--audio out.wav` mixes script audio events at their exact occurrence within each step, with clip start/end and per-event
and document volume into stereo, 48 kHz signed 16-bit PCM using Chromium's `OfflineAudioContext`.
The output duration is the player's final time, at least one sample; clips are truncated there.
Audio sources must be local or base64 data URIs. Assets and document gains resolve in the emitting
player’s catalog, including inherited and shadowed component/repeat catalogs. Tooling captures source
clock crossing fractions before loop folding; the script session’s `onEvents` callback receives
absolute times and the emitting model via symbol metadata. Ordinary event JSON and shipped browser
bundles are unchanged. Unresolved assets fail explicitly.
The Chromium launch is lazy and always closed, including failures. Missing/unlaunchable Chromium
reports `build-encoder-unavailable` with a browser installation hint. It is not silently replaced
by a muted WAV.

`anima compare a.png b.png [--tolerance 0..255] [-o diff.png]` compares decoded RGBA without
resizing. Different dimensions fail. JSON reports `maxChannelDifference`,
`meanChannelDifference` (absolute differences averaged over all four channels of all pixels),
`differingPixels` (any channel differs), `pixelsBeyondTolerance` (any channel exceeds tolerance)
and `pass`. The diff is opaque grayscale with the largest channel delta per pixel. Exit 1 means
comparison failure; invalid tolerance, argument count or output extension is exit 2.

`anima schema --search words` searches registered node types, structural topics and fields
(including both spellings), and the diagnostic table in this spec. Each query term scores 100
for an exact name, 10 for a name substring, or 1 for a description substring. Scores add; zero
scores are omitted. Results sort by descending score then ascending name (code-point order).
`anima schema type.field` returns the matching registry field by JSON or markup spelling.

`anima inspect --summary` returns a wiring table (JSON: `{wiring:[…]}`) of unbound inputs,
unused component/model/property declarations, listener targets and unreachable states. Each
finding has code, pointer, message and hint. This is a conservative static aid: dynamic host writes
and imported/dynamically selected components may require human interpretation. Invalid documents
still report normal loader diagnostics rather than a partially linked graph.

`anima doctor` checks Node ≥24, cached Chromium/Firefox executables, cache write permission and,
inside a repository containing `tools/modules.ts` and `spec/MODULES.md`, generated module
wiring with `node tools/modules.ts --check`. It exits 1 if any check fails and supplies repair hints.
It does not install browsers or rewrite wiring.

`anima new directory --sample bell|moon|progress` creates a fresh project directory containing
`main.animl`, supporting local libraries, `anima.json` and agent instructions. An existing directory
is never overwritten. Existing `new --glyph`/`--glyphy` single-document scaffolding is unchanged.
`anima build [file] --out-dir directory` (or project `out`) exports canonical `.ani`, embedded local
assets, `anima.js` and an `index.html` with inline document JSON. It performs no upload or package
publication. HTML script text escapes `<` to preserve the raw-text boundary.

The renderer uses SVG viewports and the existing rasterizer; browser services supply audio.
This retains the browser-host split discussed in `docs/research/rive-web-runtime.md` without
copying runtime code or adopting a binary/native publishing path.

### Browser host stop and diagnostics

<!-- capability: host-api.stop -->
`icon.stop()` pauses playback and the shared clock, preserving the current frame.
`icon.play()` resumes from that frame without accounting for stopped wall time.
This host-only operation adds no JSON/AniML grammar, loader diagnostics or CLI operation.

<!-- capability: host-api.fps-counter -->
<!-- capability: host-api.performance-marks -->
<!-- capability: host-api.deprecation-policy -->
The optional browser-only `devtools` contract is specified in
[modules/devtools/SPEC.md](../modules/devtools/SPEC.md). It adds no document grammar.

## a11y

Node `a11y` supports `progressbar`, `meter`, `status`, and a local semantic-node
`controls` relation (Anima extensions without inventory rows). Progressbar/meter use
numeric bound `value`, min/max (defaults 0/100); omit progressbar value for indeterminate
progress. Status defaults to polite live announcements. `controls` maps to `aria-controls`.
Dialog `modal` and button/link/group/list-item `expanded` already accept bool literals,
inputs or data paths. `anima docs a11y` includes recipes; `anima schema a11y`
shows the complete registry vocabulary. These are node fields, separate from root §10 a11y.

Node semantics are specified in [modules/a11y/SPEC.md](../modules/a11y/SPEC.md). Interaction,
diffs and focus policy live in the companion `a11y-actions` (runtime key `a11yactions`); in-browser
AniML forms in the `markup-a11y` web entry. The optional `a11y-dom` web entry supplies the platform overlay,
including canvas positioning through the optional canvas backend's node-box adapter. Synthesized
semantic focus targets use world geometry-box centers; directional candidates exclude ancestors
of the current target. Unchanged semantic reads reuse retained dependencies before collecting the
scene. Geometry/visibility, binding and owner dependencies govern recollection; paint-only changes and
unchanged list steps preserve it. See the module contracts and `spec/conformance/a11y-spatial-focus`. Root §10 is unchanged.

### Native composite roles and synchronous actions

Node roles include `toolbar`, `grid`, `row` and `gridcell`. With a11y-actions and
focus, gridcells are implicit focus targets; the three structural roles are not.
The optional `@anima-format/web/a11y-navigation` entry includes the DOM overlay and
adds one tab stop per toolbar/grid. Toolbar arrows on both axes and Home/End use
the tab-list roving policy. A grid contains semantic rows of cells: Left/Right stay
within a row; Up/Down select the same authored column in the adjacent row (missing
or unavailable cells retain focus). Home/End select row endpoints; Ctrl+Home/End
select grid endpoints. Row `focus.edge` controls horizontal boundaries: stop,
closed-loop within the row, or parent-scope using existing focus traversal.
Vertical boundaries stop. Page Up/Down bubble unprevented for the page to handle.
See [the native navigation contract](../modules/a11y-dom/SPEC.md) for availability,
modifier and ordering rules. Module-owned conformance assertions are in
`modules/a11y/test/core/issues.test.ts`, with the paired `navigation` example.

Accepted host semantic actions synchronously step(0) through the scheduled-step
path: all resulting events (including nested component events) and state changes
are dispatched as `anima:event` and `anima:state`, just as for `icon.fire()`.
A focus-disabled scope retains its semantic role and subtree; enabled descendants
remain eligible for native focus and roving.

<!-- capability: a11y.tree-bounds -->
### Semantic bounds

`nodes[].a11y.bounds` (AniML `bounds`) is a local `[x,y,w,h]` box with nonnegative width and height,
transformed to world-grid coordinates. Without it, visible child boxes are unioned
for unpainted groups; an empty node reports its transformed origin as a point.
The bounded implementation and explicit path/stroke limitations are specified in
[modules/a11y/SPEC.md](../modules/a11y/SPEC.md). This row remains planned.


<!-- capability: a11y.property-heading-level -->
### Heading hierarchy

A node with `a11y.role: "heading"` accepts `level` as an integer 1–6 or a
number input/data path. AniML uses `<a11y role="heading" level="2"/>`; a bound
level uses a JSON string attribute, for example `level="&quot;depth&quot;"`.
Bound values must remain integers 1–6. Unknown names report `unknown-input`,
wrong types `input-type`, and invalid literal levels `bad-value`, at that field's
JSON pointer. See [the node semantics contract](../modules/a11y/SPEC.md), its
`a11y-property-heading-level` conformance case and paired capability example.


<!-- capability: a11y.focus-condition -->
### Focus transition condition

With `a11y-actions` and `focus`, a machine guard operand `{ "focus": "id" }`
is true for the primary target and focusable semantic ancestors. Documents without
node semantics retain exact-target focus conditions. The existing machine guard
registry and AniML JSON `guard` attribute own both spellings and unknown-target
validation. See `spec/conformance/a11y-focus-condition` and
[the node semantics contract](../modules/a11y/SPEC.md). Repeated targets are covered by the module tests; six native PNG stages independently verify
ancestor conditions, as recorded in the closure report.

## data-host

<!-- capability: transforms.computed-transform-values -->
<!-- capability: data.host-nested-paths -->
<!-- capability: host-api.nested-models -->
The optional `data-host` entry adds read-only computed geometry; the host API also resolves
nested paths through `at(path)` and discovers authored exports with `exportedInstances()`.
Host components, colors and batching use the existing data vocabulary in both syntaxes.
Bindings can use validated `asset("name")` literals with the `datahost` feature.
The normative contract is [modules/data-host/SPEC.md](../modules/data-host/SPEC.md).

<!-- capability: input.write-key-pressed -->
<!-- capability: input.write-pointer-x -->
<!-- capability: input.write-pointer-y -->
<!-- capability: input.write-pointer-delta-x -->
<!-- capability: input.write-pointer-delta-y -->
With `input data`, JSON `write: "$x", value: "pointer-x"` is AniML
`write="$x" value="pointer-x"`. A write map also accepts these source names as keys.
Coordinates are grid units; deltas are from the preceding event for the same pointer, initially
zero. `key-pressed` stores the triggering `KeyboardEvent.key` name (a string), on any selected
key phase. Missing event fields leave data unchanged. Wrong/read-only destination types or
unknown sources report `input-write` at `/listeners/<i>/write/<source>` with a type hint.
Both data properties and ordinary inputs of the matching type are writable. See
[input](../modules/input/SPEC.md) and its independent conformance/oracle probes.

## Tool font processing (P6-2)

The CLI's optional font tooling adds no browser runtime code. Text measurements use the contract
in `design/p6/DESIGN.md` §4: cumulative advances after each `Intl.Segmenter('und')` grapheme,
kerning included, in grid units. Tracking is inserted between graphemes. Metrics are in grid units;
descent is positive below the baseline. The tool uses OS/2 typographic metrics when USE_TYPO_METRICS
is set, otherwise hhea metrics; absent cap/x heights fall back to ascent / half ascent. It never
selects a system font for deterministic measurement. Missing registered families are `font-missing`.
A family list selects the first registered face; style and nearest weight select among local faces.
The weight supplies `wght` unless an explicit axis overrides it. Axis coordinates clamp to fvar bounds;
avar maps normalized coordinates and gvar tuples vary outlines and phantom-point advances.

Tool sources are local TTF/OTF/WOFF/WOFF2 or base64 data URIs. Font collections, CFF2, HVAR metric
variations and Type2 arithmetic/seac operators are currently unsupported. CFF1 Type2 contours,
subroutines and CID FDSelect 0/3 are supported, along with TrueType simple and composite glyphs.
WOFF uses bounded zlib decompression; WOFF2 uses bounded Brotli and inverse glyf/loca/hmtx transforms.
The reader maps cmap 4/12, reads hhea/hmtx, OS/2, head, maxp, name, kern and GPOS kern pair adjustments
1/2 (including extension lookups). Pair placement and advances are supported; a lookup whose
IgnoreBaseGlyphs/IgnoreLigatures/IgnoreMarks flag matches either glyph's GDEF class does not
adjust that pair. Every cmap mapping, across all subtables, counts toward the table operation limit
(`font-limit`). GPOS device/variation adjustments, mark placement and GSUB
shaping are not. Arabic, Hebrew, Indic, combining marks and joining controls issue
`text-shaping-approximate`; the tool does not claim shaped glyph equivalence.

`anima sample`, `validate`, `render` and the conformance runner install the tool measurer when text
is installed. `--font family=path` registers or overrides local faces. Font asset names, explicit
family names and name-table family names are aliases. The optional text module supplies
`setTextMeasurer(TextMeasurer)` (or `setMeasurer`) from `modules/text/core/measure.ts`.

`render` converts SVG text/tspan output into glyph outline paths before the existing rasterizer.
It preserves transforms, clipping and paints; scalar x/y/dx/dy and numeric grid-unit sizes are
supported. SVG position lists, nonzero glyph rotation and RTL outline conversion currently give
`font-unsupported`. `render --browser-text` explicitly selects cached Chromium for PNG shaping and
rasterization; SVG output embeds local faces for browser display. It uses the image encoder's lazy
browser and closes it after use. System-font fallback is browser-dependent in this explicit mode.

Font assets may request `glyphs: "all" | "used" | "custom"` (AniML `glyphs`), plus `chars` for custom
coverage; these keys are registered by the fonts module. All preserves every glyph. Used includes
literal authored text and string `default`/`value`/`placeholder` fields, including bound defaults.
Custom includes each Unicode scalar in `chars`. Subsetting embeds an sfnt TTF/OTF asset even without `--embed`.
TrueType subsetting retains glyph IDs, .notdef, composite dependencies and kerning/variation tables,
removes unused glyf payloads and replaces cmap coverage. With GSUB present it retains every outline
conservatively. CFF1 subsetting retains glyph IDs and subroutines, replaces unused charstrings with
empty glyphs, and relocates offset-bearing top/FD/private dictionaries and INDEXes. Unsupported
retained Type2 glyph operators diagnose instead of discarding implicit glyph dependencies.

`anima import-font <source> -o local.ttf|otf [--chars text]` normalizes a container to sfnt and emits
font asset metadata. `--google "Family:wght@400;600"` instead explicitly fetches Google Fonts CSS
and its font files at build time. Multiple sources use numbered output files. `--chars` requests
custom coverage and local subsetting. Network, invalid CSS/font bytes and unsupported forms are
errors; imports never require a network request at runtime. Downloads and font decompression are
limited to 32 MiB; malformed offsets and bounded recursion produce structured diagnostics rather
than uncaught CLI exceptions.

`anima flatten <file> [--node id] [-o out.ani|animl]` freezes authored/default text into editable path
groups, retaining surrounding nodes and common transforms. Remaining references to text-only
properties are rejected instead of silently dropped. Unsupported SVG features are rejected by the
conversion. The text module must be installed for text documents; layout semantics remain owned by
that module. The committed `fixtures/fonts/anima-test.ttf` is original generated test data;
`node tools/test-font.ts` reproduces it deterministically. Third-party fonts are not fixtures.

Tool font diagnostics carry severity, code, JSON pointer, message and hint: `font-invalid`,
`font-format`, `font-limit`, `font-unsupported`, `font-source`, `font-missing`, `font-option`,
`font-glyphs`, `font-download`, `font-flatten`, `font-contract`, `text-shaping-approximate`.

The independent implementation follows the [OpenType specification](https://learn.microsoft.com/en-us/typography/opentype/spec/)
and [WOFF2 specification §5](https://www.w3.org/TR/WOFF2/#compressed-data-format), not another reader's
source code. `docs/research/rive-format-and-graph.md` §1's bounded-reader pitfall informs the
allocation limits; `docs/research/glyphy-compat.md` §1's grid-unit convention informs the tool boundary.

## fonts

<!-- capability: assets.font -->
<!-- capability: assets.host-decode-font -->
<!-- capability: assets.replacement-scope-font -->
<!-- capability: data.host-font -->
<!-- capability: host-api.data-font -->
<!-- capability: host-api.font-fallback -->
<!-- capability: text.font-fallback -->
<!-- capability: text.font-assets -->
<!-- capability: text.font-decoding -->
<!-- capability: text.variable-axes -->
<!-- capability: text.opentype-features -->
<!-- capability: text.font-metrics -->

Optional runtime feature `fonts` uses the assets feature's existing `type: "font"` records.
JSON `{assets: {body: {type: "font", source: "body.woff2"}}}` is AniML
`<asset name="body" type="font" src="body.woff2"/>`; declare `requires="assets fonts"`.
No new asset fields or deterministic player channels are added. Core accepts font resources without
a browser; decoding is a web concern. This keeps the optional asset boundary described in
`docs/research/rive-web-runtime.md` without adopting its shaping engine or resource format.

<!-- // seam(P7-8): optional font introspection normative link. -->
Decoded metrics, coverage, effective options and derived glyph paths are specified in the
[optional fonts-info contract](../modules/fonts/INFO.md).

### Resources, decoding and readiness

The `@anima-format/web/fonts` entry loads font assets before `anima:load` and the first render.
Fonts and asset I/O preserve each other's preload hooks in either entry order.
Sources pass through `icon.resolveAsset`, including its local/any policy and host resolver.
URLs and resolver-returned Blobs are read as bytes, decoded using `FontFace.load`, added to
`document.fonts`, then awaited with `document.fonts.load`. Unsupported or corrupt fonts and
policy failures emit `anima:warning` with a diagnostic array: code `font-load`, severity `warning`,
JSON pointer `/assets/<escaped-name>/source`, message and recovery hint. The scene continues with
CSS fallback. A failed replacement preserves the previous face. Browser decoding does not change
`Player.step` values, timing or events; headless tools do not decode fonts through this module.

`await icon.fonts.decode(bytesOrURL, descriptors?)` returns a loaded FontFace. URLs obey the asset
policy; direct bytes are explicit host input. `await icon.fonts.set(name, faceOrBytesOrURL,
descriptors?)` replaces the named family for every consumer in that icon scope. Byte and URL
sources receive private family names, preventing cross-icon collisions. The latest replacement
wins; cleanup invalidates pending work. Faces stay retained until scope cleanup, except that a
completed replacement releases the superseded face once no name in that scope uses its family. Faces already in
`document.fonts` before adoption are never deleted by cleanup. Shared adopted faces use reference
counts. Child component catalogs use `icon.fonts.forModel(model)` to distinguish same-named assets.
Reload/dispose clears owned resources; imported pages without `requires: ["fonts"]` do not decode
font assets.

### CSS, fallback and metrics

`cssFont(spec)` accepts the structural FontSpec contract and returns CSS properties `font`,
`fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `letterSpacing`, `fontVariationSettings`, and
`fontFeatureSettings`. The `font` property is the canvas/FontFaceSet shorthand. `axes` and `features`
become quoted OpenType tags followed by numeric values; absent maps become `normal`.
For live asset aliases and host fallback, browser consumers MUST use
`icon.fonts.cssFont(spec)` (or `icon.fonts.forModel(model).cssFont(spec)` for children). Apply the
individual CSS properties to SVG text; canvas consumers apply `font` and the supported individual
properties. The text module owns field validation, layout, animation, measurement and backend
application. A controller does not synthesize axis or feature introspection from font bytes.

`await icon.fonts.ready(spec, text?)` awaits the used CSS font selection before measuring the actual
run text. `await icon.fonts.add(face, {weight}?)` adds a host fallback face and optional weight;
faces sharing a family remain eligible for browser weight selection. Families are appended in
insertion order after the authored CSS family list. Host fallback configuration survives source
reloads (including configuration before the first load); `icon.fonts.clear()` forgets it. Cleanup
releases owned document font registrations; the next CSS/readiness use restores configured faces.
With the `fonts-text` consumer, a disconnect likewise parks named asset faces and aliases (including
child scopes); the same player's next `forModel`/CSS use restores them, a reload discards them.
`icon.fonts.revision` increases on font changes and cleanup. Text measurement/layout caches must
invalidate on that revision even when a replacement preserves its CSS family name. Glyph coverage and fallback selection are
browser behavior. Metrics come from the text module's browser measurer after readiness; no guessed
metrics, coverage table, cap-height/x-height parser or outline extractor is supplied by `fonts`.

### Data assignment and replacement scope

With the optional data and host modules, `await icon.data.font(path).set(face)` accepts a decoded
FontFace. It allocates a player-local font resource id and queues the typed asset-reference write
through the existing host API. Other data properties and other icons keep their previous resources.
String assignment retains the existing typed font-asset validation. The public handle value remains
the selected resource id. Text styles must resolve that id through the owning controller. Named
resource replacement changes all uses in its resource scope; data-property assignment changes only
consumers of the assigned property. Bound text rendering and complete font-metric parity require
the text module; the fonts module alone does not add text nodes.

## text

The optional `text` module adds styled, data-bound text nodes, measured layout, SVG/canvas
drawing and named host run access. Its normative fields, defaults, validation, measurement
contract, fit/overflow algorithms and verification limits are specified in
[modules/text/SPEC.md](../modules/text/SPEC.md). Registry entries derive JSON Schema, CLI schema
and AniML spellings from the same vocabulary. P6 parity remains planned pending native evidence.

<!-- capability: text.flatten -->
### Text outline conversion

<!-- // seam(P7-6): normative CLI behavior belongs to the owned text specification. -->
`anima flatten` traverses root and component-definition text, preserves clips and common group
properties, and rejects remaining text-only references. See [the normative text contract](../modules/text/SPEC.md#text-outline-conversion-p7-6).

## text-effects

<!-- capability: text.background -->
<!-- capability: text.modifier-follow-path -->
<!-- capability: text.modifier-opacity -->
<!-- capability: text.modifier-origin -->
<!-- capability: text.modifier-rotation -->
<!-- capability: text.modifier-scale -->
<!-- capability: text.modifier-translation -->
<!-- capability: text.modifier-variation -->
<!-- capability: text.range-combine -->
<!-- capability: text.range-easing -->
<!-- capability: text.range-falloff -->
<!-- capability: text.range-run -->
<!-- capability: text.range-units -->
<!-- capability: text.script-direction -->

The optional `texteffects` feature (`web/text-effects`) adds logical per-cluster translation,
rotation, scaling, opacity, origins and font-axis effects; scoped glyph/word/line ranges with
falloff, easing and combination; path positions/tangents; and run backgrounds. The text node's
JSON `effects` array is AniML `text-effects` or structural `<text-effect>` children, with nested
`<text-range>` children. `direction` maps whole runs to native SVG/canvas bidi.

[modules/text-effects/SPEC.md](../modules/text-effects/SPEC.md) defines defaults, precise range
weights and matrix composition, animation addresses, validation, backend limits and evidence.
The registry drives schema, CLI and both syntax spellings. Thirteen raw native captures are retained; accepted
comparisons remain unresolved and these rows remain planned. Bidi's measured addition is 150 B min+gzip (owner guard: <=150 B).

<!-- capability: text.script-hit-testing -->
<!-- capability: a11y.inferred-text -->
### Text hit testing and inferred semantics (P6)

The optional `text-hit` host adapter exposes grapheme hit positions and caret/selection boxes
from the shared text layout. `input` listeners may write `text-index` on a text target. The
optional `a11y-text` browser adapter supplies visible text names and layout bounds to the semantic
tree; headless tools install this adapter with a11y. Existing JSON/AniML text, label, bounds and
listener fields are unchanged. See [the normative text semantics contract](../modules/a11y/TEXT.md).

## textinput

The heavy DOM-backed field feature is specified in [text input](../modules/text-input/SPEC.md).
Its browser entry is `text-input`; its registry feature is `textinput` (module feature names cannot contain hyphens).
Fields extend fixed text nodes. Registry descriptors define both spellings; no base compiler branch is added.


<!-- capability: text.input-text -->
### Independent field text drawable

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-editable -->
### Editable text fields

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-cursor -->
### Styled input caret

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-selection -->
### Styled input selection

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-selection-rounding -->
### Rounded selection geometry

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-focus-selection -->
### Select all on focus

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-ime -->
### IME and dead-key text entry

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-clipboard -->
### Text clipboard integration

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-limits -->
### Text input limits

Text fields accept the bindable bool address `<text>.textInput.obscured`; its rest
value is authored `obscured` or false. Resolved masking, semantic redaction and the
native input type change together, preserving selection and caret. Static
multiline+obscured remains a configuration error; bound obscuring is ineffective
on multiline fields.

`caretBlink` (`caret-blink`, default true) alternates 530 ms visible / 530 ms
hidden only for a focused browser field, restarting visible on edits and caret
moves. Reduced motion, paused/static and CLI rendering keep it steady. Blink
repaints do not advance Player time or keep an unfocused scene awake.

`selectionTextColor` (`selection-text-color`) colors selected glyphs over the
`selectionColor` highlight; omission preserves foreground. The older
`selectedTextColor` remains an alias; the new spelling wins if both are present.

The optional `text-input-extra` browser entry supplies blinking and scroll to
caret: horizontal for single-line fields (which never wrap), vertical for
multiline fields. Glyphs, highlight and caret clip to the fixed field box; the
viewport translation does not reflow layout. Tool/CLI rendering includes the
pure viewport projection and a steady caret.

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-multiline -->
### Multiline text input

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-obscured -->
### Obscured text input

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: text.input-placeholder -->
### Text input placeholder

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: host-api.text-input -->
### Text and IME bridge

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: host-api.clipboard-text -->
### Text selection for clipboard

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: input.text-listener -->
### Text input listeners

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: input.write-text -->
### Store text

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: a11y.role-text-field -->
### Semantic role: textField

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: a11y.state-multiline -->
### Semantic state: Multiline

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: a11y.state-obscured -->
### Semantic state: Obscured

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.

<!-- capability: a11y.text-proxy -->
### Accessible text proxy

See [the normative field contract](../modules/text-input/SPEC.md) for both spellings, selection, commits, native semantics, diagnostics and tooling. Tests live in `modules/text-input/test/`; native-reference closure remains planned.


## Host fit and artboard size (`host-fit`)

`@anima-format/web/host-fit` is an optional **host-only** entry. It adds no document
keys, `requires` name, registry entries, AniML attributes or CLI render options. An
AniML scene and its compiled `.ani` have identical host-fit behaviour; put host
attributes on `<anima-icon>`, not on `<anima>`. Existing static CLI fit options are
independent. This separation follows the host/scene distinction in
`docs/research/rive-web-runtime.md` (input mapping and accessibility overlay).

The HTML `fit` and `alignment` attributes have reflecting string properties with the
same names. `fit` accepts `contain`, `cover`, `fill`, `fit-width`, `fit-height`,
`none`, `scale-down`, `layout`; absent/unknown means contain. `alignment` accepts
`top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`,
`bottom-left`, `bottom-center`, `bottom-right`. Legacy `align` remains an alias;
`alignment` takes precedence when both exist. `top`, `left`, `right`, `bottom`
are accepted aliases for the middle edge positions. Unknown alignment means center.
The properties return the attribute spelling, or `contain`/`center` when absent.

With no fit, alignment or size request, loading the entry preserves the existing SVG
grid/bleed viewport and default host aspect ratio (B8). An explicit host-fit request
fits the whole artboard rectangle into the CSS content box, including any nonzero
viewBox origin. It clips drawing to that viewport in both backends. For a source
rectangle `(x,y,w,h)` and host `W×H` CSS pixels, scale is:

| fit | scale |
| --- | --- |
| contain (including unknown) | `s = min(W/w,H/h)` |
| cover | `s = max(W/w,H/h)` |
| fill | `sx = W/w`, `sy = H/h` |
| fit-width | `s = W/w` |
| fit-height | `s = H/h` |
| none | `s = 1` CSS pixel per grid unit |
| scale-down | `s = min(1,W/w,H/h)` |
| layout | `s = 1`; artboard size becomes `W×H` grid units |

Uniform fits use `sx=sy=s`. For alignment fractions `ax,ay ∈ {0,0.5,1}`, the source
to host matrix is `[sx,0,0,sy,(W-w*sx)*ax-x*sx,(H-h*sy)*ay-y*sy]`. Negative free
space aligns cropping by the same rule. SVG expresses this matrix with an equivalent
virtual viewBox and `preserveAspectRatio="none"`; canvas uses the identical virtual
viewBox before DPR scaling. Neither requires a transformed scene group. Pointer
coordinates invert that matrix; semantic bounds use it forwards. Resize, fit,
alignment, size overrides and renderer switches update these consumers together.
Zero-sized hosts defer fitting until they become positive-sized. Disconnect and
destroy stop resize observation; reconnect resumes it.

`icon.size` reads a detached `[width,height]` array of grid units (without a loaded
document or explicit override, `[0,0]`). Assign a pair of finite positive numbers to override the
artboard dimensions for this host, retaining its authored origin. The scene and shared compiled model
are never mutated; another host is unaffected. Invalid writes preserve the previous
size and dispatch `anima:error` with diagnostic `host-size`, pointer `""` (host API),
message and hint. `resetSize()` removes the override. The override persists across
loads on the same host. In layout fit, the host dimensions take precedence; resetting
size clears the explicit override but keeps responsive sizing while layout is active.

<!-- seam(P7-4): real per-player root layout integration. -->

**Layout integration:** fitting writes `player.layoutSize?: [w,h]` per
player, where undefined means authored root width/height. A layout provider consumes
this override for root containers without mutating model defaults and exposes
`player.layoutBox(id)`. On a changed override, the host calls `player.step(0)` when
that reader exists, then redraws. The scale for layout fit is one CSS pixel per grid
unit; DPR changes only the canvas backing store. Leaving layout restores the explicit
size if set, otherwise authored root dimensions. The layout module now consumes the override for
root containers through their normal bounds. Both engines compare real responsive child drawing
against native layout-fit captures at two host sizes, in SVG and canvas.

## dataartboard — bindable component data

<!-- capability: data.host-artboard -->
<!-- capability: host-api.bindable-artboards -->
<!-- capability: host-api.data-artboard -->
<!-- capability: components.host-artboard-reference -->

The normative contract is [modules/data-artboard/SPEC.md](../modules/data-artboard/SPEC.md):
`artboard` model properties, `instance component="$content"`, queued host handles and
values referencing components from another loaded document. Re-instantiation follows
the existing nested-player and data-context rules; a changed selection restarts the
child clock, and the same selection retains it. The four deterministic probes are
`data-host-artboard`, `host-api-bindable-artboards`, `host-api-data-artboard`, and
`components-host-artboard-reference`. Host comparison limits are evidenced in
[the native comparison note](../modules/data-artboard/NATIVE.md).

## layout

`requires: ["layout"]` adds single-line row/column containers, child sizing and a deterministic
layout stage. [The normative layout contract](../modules/layout/SPEC.md) defines both spellings,
the CSS-based algorithm, units, caching, geometry, guard timing, diagnostics and intentional native
differences. Animated reflow belongs to the separate `layout-reflow` entry.

<!-- capability: layout.containers -->

<!-- capability: layout.flex-direction -->

<!-- capability: layout.flex-justify -->

<!-- capability: layout.flex-align-items -->

<!-- capability: layout.self-alignment -->

<!-- capability: layout.alignment -->

<!-- capability: layout.spacing -->

<!-- capability: layout.fixed-sizing -->

<!-- capability: layout.hug-sizing -->

<!-- capability: layout.fill-sizing -->

<!-- capability: layout.size-bounds -->

<!-- capability: layout.visibility -->

<!-- capability: layout.participants -->

<!-- capability: layout.intrinsic -->

<!-- capability: layout.paint -->

<!-- capability: data.bind-layout -->


<!-- seam(P7-4): optional animated-reflow contract and host-fit closure. -->
<!-- capability: layout.animated-reflow -->
### Animated layout reflow

The normative [layout reflow contract](../modules/layout/SPEC.md#animated-reflow-layout-reflow)
defines container/participant `reflow`, §5 easing, inherited settings, uninterrupted retargets,
reduced motion and the target/drawn box readers. The optional `layout-reflow` web entry owns
interpolation and diagnostics; CLI tooling includes it. Deterministic target/drawn observations
are in `layout-animated-reflow`, with allocated text measurement in `layout-text-wrap`.
Native timing and retarget mapping remain pending; raw captures are retained without a new tolerance.

<!-- capability: host-api.fit-layout -->
### Responsive host layout

`<anima-icon fit="layout">` / `icon.fit = "layout"` uses the host's CSS content size as root layout
dimensions, at one CSS pixel per grid unit (DPR affects backing pixels only). Root layout reflows;
it is not merely scaled. `player.layoutSize` is the per-player grid-unit override; clearing it
restores authored sizing. The host adapter applies normal explicit-size/reset precedence as above.
A host whose computed content size is not a resolved pixel length (for example `display:none` with a
percentage size) is not measured; its layout size and viewport are kept until it has a layout box.
Browser conformance and byte-exact native references at two host sizes live in the host-fit tests.
This host-only control adds no scene registry keys, AniML attributes or static CLI rendering flag.

## posepad

<!-- capability: rigging.joystick -->
<!-- capability: animation.joystick-two-axis -->
<!-- capability: animation.joystick-invert -->
<!-- capability: animation.joystick-handle -->

`requires: ["posepad"]` enables `type: "posepad"`, AniML `<posepad>`. It draws nothing
and has no hit area. The identical lowercase node name follows the existing node registry;
no node-name alias or markup compiler extension is needed (P8 orchestrator decision).

| JSON | AniML | Meaning |
|---|---|---|
| `timelineX`, `timelineY` | `timeline-x`, `timeline-y` | Optional declared timeline names |
| `valueX`, `valueY` | `value-x`, `value-y` | Numbers, default 0, clamped to −1..1; animatable/bindable |
| `invertX`, `invertY` | `invert-x`, `invert-y` | Static booleans, default false |
| `handle` | `handle` | Optional node id; declares the optional handle entry requirement |
| `box` | `box` | `[x0, y0, width, height]` in pad coordinates, positive width/height |

After layout, pads run in authored node order, X before Y. Clamp control v to −1..1,
negate when its axis is inverted, then sample at `(v + 1) / 2 * timeline.duration`.
Sampling uses the active registry's track sampler (§5), including typed tracks, custom
eases and per-player data key values. Loop/work-area/playback controls do not change this
whole-duration mapping. Pad sampling never plays clocks or emits timeline events.

Sampled tracks form a per-player overlay above layers and bindings. Clamp numeric results
to each target property's registry range; later axes/pads win collisions. `prop`, `num`,
`value`, `values()` and snapshots expose the overlay. It does not mutate model rest values,
tracks or another player's state. Layout sees the previous step's overlay; guards never
read same-step posed output. Drawing revisions are invalidated for sampled target nodes.
A pad introduces no ongoing clock and does not prevent settling.

A handle requires the optional heavy `@anima-format/web/posepad-handle` entry in addition
to `@anima-format/web/posepad`. Declaring `handle` without that entry reports `posepad-handle`
at the handle field, with an import hint (verbose builds); it never silently poses freely.
Tooling includes handle support. A handle also requires `box`. Read the handle's current
world pivot (including motion's animated pivot), map it through the inverse pad world matrix,
then derive `valueX = clamp(2*(hx-x0)/width-1, -1, 1)` and similarly for Y. These outputs
are uninverted; inversion affects sampling only. A singular pad matrix yields centered outputs.
Both outputs are included in snapshots even when no track references them. Animate or bind
the handle, not these outputs. Pointer drags use the input/bind modules' existing queued writes.

With `rig`, chain `model.rigPose` between its solve passes, returning true when the pad wrote;
rig solves again exactly once. Without rig, chain a standalone `afterStep` stage after layout
and read `p.world`. The distance-gated handle conformance probe remains pending until rig lands.

Diagnostics: `posepad-timeline` at `/nodes/…/timelineX|timelineY` names an unknown timeline;
`posepad-handle` at `/nodes/…/handle` means an unknown handle or missing handle entry;
`posepad-box` at `/nodes/…/box` means the required box is absent. Structural box errors use
`bad-type` or `bad-value` at the offending field/coordinate. `posepad-output` points
at a bind, track or state-pose write to a handle-driven value. `posepad-cycle` at the pad's
axis timeline rejects a write to its handle, any handle ancestor, any transitive constraint
target (and its ancestors), or its own coordinate frame/ancestors. These restrictions keep
the bounded solve/pose/solve order independent of a dirt-restart loop.

Design rationale: [animation/state research](../docs/research/rive-animation-and-state.md) §2.3
and [format/graph research](../docs/research/rive-format-and-graph.md) §3.2–3.4 describe update
restarts; this explicit stage retains deterministic step order. No Rive source or binary format
is used. Native oracle captures await orchestrator-owned budgets and remain pending evidence.
