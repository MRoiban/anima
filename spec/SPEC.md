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
(1 = 100 %). There are no frames, no radians and no percentage flags anywhere in the format.

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
4. **Clamp.** Clamp resolved values to their property's range (`opacity`, trims 0..1; `r`, `w`, `h`,
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
5. **Path morphing — deferred to 0.2** (address `<id>.d` reserved). Glyphy traces differ in point
   count and structure even between variants, so morphing needs tooling first.
6. **Data binding — deferred to 0.2** (key `bind` reserved, in the shape
   `"bind": { "<address>": { "from": "level", "map": [0, 1, 0, 1] } }`). 0.1 hosts drive values
   through inputs and conditions.
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
