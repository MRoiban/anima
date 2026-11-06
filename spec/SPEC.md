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

**Limits.** Loaders refuse documents beyond these limits with `limit-exceeded`: 1 MiB of text, nesting
depth 32 nodes, 2 048 nodes, 20 000 keyframes in total, 64 layers, 256 states per layer.

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

`step(dt)` with `dt ≥ 0` seconds does, in order:

1. **Inputs.** Apply queued writes in arrival order (`set`, `fire`, `toggle`). Number writes clamp to
   the input's `min`/`max`. A fired trigger becomes pending (firing a pending trigger again is a
   no-op). Listener `emit` actions add their events now.
2. **Clocks.** Advance every layer's state time and crossfade elapsed time by `dt`. A crossfade whose
   elapsed time reaches its duration ends.
3. **Layers**, in declaration order, each against the values resolved by the layers before it:
   1. *Timeline events.* Report the current state's timeline events crossed by step 2 (below).
   2. *Transitions.* Unless a non-interruptible crossfade is running (§8), evaluate the current
      state's `on` list in order; take the first transition whose
      condition holds. Taking it: (a) freeze the layer's current output for `dom(F) ∪ S(current)` as
      the new snapshot `F` (this is also what makes interrupting a crossfade smooth); (b) mark the
      triggers the condition named as consumed by this layer; (c) enter the target: state time =
      **carry** (the overshoot `t − threshold` of the `@end`/`@after` term that made the condition
      hold, the largest one if several; else 0), crossfade elapsed = carry; a `blend` of 0 drops the
      snapshot; (d) report the target's `emit`, then its timeline events in `[0, carry]`. Then
      evaluate the new state's `on` list the same way. A layer takes at most **16** transitions per
      step; reaching the cap reports the event `@limit` for that layer and stops its transitions for
      this step. A trigger already consumed by this layer does not hold for it again in this step.
   3. *Write* the layer's output over the values (resolve rule).
4. **Bindings, then clamp.** Evaluate declared `bind` expressions against the current inputs,
   overriding the state-machine values (see the bind chapter). Clamp resolved values to their property's range (`opacity`, trims 0..1; `r`, `w`, `h`,
   `rx`, `stroke.width` ≥ 0).
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
  term      := "!"? NAME  |  NAME OP NUMBER  |  "@end"  |  "@after(" NUMBER ")"
  OP        := "==" | "!=" | "<" | "<=" | ">" | ">="
  ```

  `name` holds when the trigger is pending (and not yet consumed by this layer this step) or the
  bool is true · `!name` when the bool is false · `name OP number` compares a number input ·
  `@end` when the state's `once` timeline has finished · `@after(s)` when the state time is at least
  `s`. All terms must hold. There is no `||`: write two transitions. Whitespace between tokens is
  ignored.
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
  number inputs), `toggle` (bool input name or list) *(not in bell)*, `emit` (event name)
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
  `prefers-reduced-motion` unless the element sets `motion="full"` (or `motion="reduce"` to force it).

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
| `motion reduce\|full` | Turn reduced motion on or off for states entered from now on. |
| `snapshot [address …]` | Print one JSON line (below), optionally limited to animated addresses and bool/number input names. An input is reported under its input name. |

A snapshot line is `{"time": t, "values": {address: value}, "states": {layer: state},
"events": [...], "settled": bool}`: `time` is the total step time so far, `values` holds every
address any track or pose writes (or the listed ones), `events` holds the events reported since the
previous snapshot, and `settled` is the last step's result.
Explicit input names appear in `values` under their own names (for example,
`snapshot dark knob.x`). They report the currently applied value; queued `set`/`toggle`
writes take effect only after a step. Triggers have no persistent value and cannot be
selected. An unknown address or input is a script error. With no arguments, `snapshot`
continues to include only animated addresses, never inputs.

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
| `fill` | x=W/I, y=H/J |
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

### Gradients

A `fill` or `stroke` contains either `color` or a gradient, never both. A gradient has `type`:

| Type | Required coordinates (grid units) | Optional coordinates |
|---|---|---|
| `linear` | `x1`, `y1`, `x2`, `y2` (start and end) | — |
| `radial` | `cx`, `cy`, `r` (centre and radius, `r ≥ 0`) | `fx`, `fy` (focal point, each defaults to the corresponding resolved centre coordinate) |

Both have `stops`, an array of at least two `{ position, color }` objects. `position` is 0..1,
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

Rect corners is a four-item nonnegative array [tl,tr,br,bl], AniML corners="1 1 0 0".
Each value is animatable as tile.corners.0 through .3 (indices without leading zeros).
The rectangle uses the cutback/quadratic construction above and renders as a path.
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

The optional `bind` module requires `requires: ["bind"]`. At document level,
`bind: { "ring.stroke.trimEnd": "progress" }` maps animatable addresses to expressions.
Every step evaluates bindings after all state layers resolve and before property clamping (§7),
so a binding overrides a pose, timeline or crossfade on the same address. Resolved bound
addresses appear in `Player.values()`, `anima sample` snapshots, dirty slots and `anima inspect`
(the `bound` list). Inputs still apply in queued arrival order. A settled binding sleeps until
an input write wakes the player; its value changes on the next step, including `step(0)`.

### Expressions and types

Sources are declared number or bool input names, finite JSON number literals, hex colours
(`#rgb`, `#rrggbb`, `#rrggbbaa`), parentheses, unary `+`/`-`, binary `+ - * /`, and the functions
`min(a,b)`, `max(a,b)`, `clamp(x,lo,hi)`, `mix(a,b,t)`. Nothing else is allowed: no property
reads, strings, boolean literals, comparisons, assignments or arbitrary calls. Identifiers use
the input-name grammar; a hyphen is part of a name, so write `level - other` for subtraction
between inputs. Multiplication/division precede addition/subtraction; binary operators associate
left; unary signs have highest precedence. Whitespace is insignificant between tokens.

A bare bool input retains its bool type for boolean targets. Numeric operations and number
targets convert bools to 0/1. Numbers do not implicitly become bools. `min`, `max`, `clamp` and
numeric `mix` return numbers; `mix` also accepts two hex colours and a numeric/bool weight,
returning a colour. Mixing a number and colour is invalid. Colour interpolation is §5 sRGB
channel interpolation (including alpha, rounding and channel clamping); weights may extrapolate.
Numeric `mix` is `a + (b-a)*t`; `clamp` is `min(max(x,lo),hi)`. Non-finite arithmetic results
(including division by zero) resolve to zero when consumed by another operation or the target,
before property clamping. Trigger inputs cannot
be values. Evaluators accept a scope map of named inputs, reusable for component input bindings.

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
## assets

The optional `assets` module adds an `assets` map and image draw data. Image nodes also
require `paint`. Core validation and `Player.step` perform no IO. Fonts, audio and blobs
are declarations only; their consumers arrive in P6/P4d.

Each named asset is `{ type, source, storage?, width?, height? }`. `type` is `image`, `font`,
`audio` or `blob`. `source` is required and nonempty: a data URI or URL (relative URLs are
relative to the document). Optional `storage` is `embedded` for data URIs or `referenced`
for URLs; omitted storage is inferred. A disagreement is `asset-storage` at `/assets/<name>/storage`.
`width` and `height`, when present, are positive intrinsic dimensions, in grid units for
layout. Omitted dimensions are decoded by the host before drawing. Declared dimensions override
decoded dimensions independently. Data URIs use percent encoding or padded standard base64;
malformed encoding is `bad-data-uri` at the source. An empty source is `missing-source`;
an absent source is `missing-key` at the asset object. Messages carry a repair hint.

AniML declares `<asset name="photo" type="image" src="photo.png" storage="referenced"/>`
at document level; registry `source` maps to `src`. All other field spellings match JSON.

The browser module `@anima-format/web/assets` registers assets and the SVG image backend;
image documents also import `@anima-format/web/paint`. Images decode before `anima:load` and
initial `ready` resolution. URLs resolve relative to the icon's `src`, or `document.baseURI`
for inline/programmatic documents. `icon.assets = (name, info) => url | Blob | Promise<url | Blob>`
replaces the source before decode; `info` is a copy of the authored declaration. A resolver rejection
or image decode failure empties the icon and dispatches `anima:error` with `asset-load`, the
source pointer, message and hint. Embedded data URIs require no network. Resolved data is private
to the loaded model; source declarations are preserved. Superseded loads cannot install their scene.
Fonts/audio/blob do not load or invoke the resolver yet.

`anima build --embed` embeds local referenced assets (paths relative to the source file), sets
storage to `embedded`, and changes no fields outside the assets map. It supports AniML and
AniML scripts in HTML. Already embedded assets are unchanged. Other URL schemes cannot be read
by this disk build and report `asset-load`; HTTP asset fetching is a browser host responsibility.
`anima render` embeds local image sources and decodes intrinsic sizes through resvg before
rendering; other asset types remain declarations. IO/decode failures report `asset-load` at
`/assets`, with a message and hint. Build does not decode or transcode image bytes.


## components

The optional `components` module requires `requires: ["components"]`. A document's `components`
map holds named nested documents: `grid`, optional `viewBox`, `inputs`, `nodes`, `timelines`,
`machine`, `listeners`, `colors`, `glyphs`, `a11y`, `hit` and `bind`. Definitions inherit the enclosing
`requires` list. References to components resolve in the enclosing document's component map,
including from other definitions; all definitions, even unused ones, are validated. Each placement
owns a separate player; compiled definitions and static geometry may be shared.

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
Instances do not establish a viewport clip or automatic fit; use their ordinary transforms and
composite clipping to place/clip them.

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
