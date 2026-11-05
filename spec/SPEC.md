# The `.ani` format — draft 0.1

Status: **draft**. This is the design the first implementation builds against. Sections marked
*(normative)* define behaviour every runtime must reproduce exactly; the conformance suite in
`spec/conformance/` is the tie-breaker when prose and tests disagree. Open questions are listed at
the end; resolve them in this file, not only in code.

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
| `anima` | `"MAJOR.MINOR"` | yes | Format version. A runtime refuses an unknown major; a newer minor loads only if every feature it uses is supported (see `requires`). |
| `name` | kebab-case string | yes | Identifier. Must not end in `-<digits>` (Glyphy reserves that for variants). |
| `title` | string | no | Human name. |
| `grid` | number | yes | Glyph grid size in units (Glyphy's `style.grid`, usually 20). |
| `viewBox` | `[x, y, w, h]` | no | Drawing area in grid units; defaults to `[0, 0, grid, grid]`. May be larger than the grid so motion has room (bell: `[-2, -2, 24, 24]`). |
| `requires` | string[] | no | Optional features this file uses beyond the core (e.g. `"knockout"`). A runtime that lacks one refuses the file with a message naming it. |
| `colors` | `{slot: color}` | no | Colour slots, see §6. |
| `glyphs` | `{name: Glyph}` | no | Embedded path data, see §3. |
| `a11y` | object | no | See §10. |
| `inputs` | `{name: Input}` | no | See §8. |
| `nodes` | Node[] | yes | Scene tree, see §4. |
| `timelines` | `{name: Timeline}` | no | See §5. |
| `machine` | object | no | See §8. |
| `listeners` | Listener[] | no | See §9. |

**Strictness.** Unknown keys, unknown node types, unknown properties, duplicate ids, dangling
references, type mismatches (a colour keyframe on a number property), non-increasing keyframe times
and unreachable references are **load errors**. Loaders report every error with a JSON pointer, a
message and, where possible, a suggestion (`did you mean "rotate"?`). A lenient mode may exist for
tooling but the runtime default is strict.

**Units** *(normative)*: lengths in grid units, y down; time in **seconds**; angles in **degrees**,
positive clockwise (y down), 0° along +x; opacity, scale and blend weights are plain numbers
(1 = 100 %). There are no frames, no radians and no percentage flags anywhere in the format.

## 3. Glyphs

```json
"glyphs": { "bell": { "source": "glyphy", "sha256": "…", "d": "M9.493 4.473C…Z" } }
```

- `d` is SVG path data. Glyphy writes absolute `M L C Z` only; runtimes must accept the full SVG
  path grammar but tools emit Glyphy's subset.
- `sha256` is the hex SHA-256 of the `d` string's UTF-8 bytes. Tools use it to detect a re-traced
  glyph; a mismatch is a warning from `anima validate`, not a load error.
- Subpaths are numbered from 0 in the order their `M` commands appear. A path node takes
  `"subpaths": [i, …]`; omitted means all.

## 4. Nodes

Every node has `id` (unique, `[a-z][a-z0-9-]*`) and `type`. Paint order is **document order, later
on top** (SVG order — the reverse of Rive).

Common properties (all animatable unless noted):

| Property | Default | Meaning |
|---|---|---|
| `x`, `y` | 0 | Translation. |
| `rotate` | 0 | Degrees about `pivot`. |
| `scale` | 1 | Uniform scale about `pivot`; multiplies `scaleX`/`scaleY`. |
| `scaleX`, `scaleY` | 1 | Axis scales about `pivot`. |
| `opacity` | 1 | Group opacity, 0..1 (clamped). |
| `visible` | true | Boolean, hold-only. |
| `pivot` | `[0, 0]` | **Not animatable.** Point in the parent's coordinates the transform turns and scales about. |

**Transform** *(normative)*: children are authored in the same grid coordinates as their parent (no
re-origining, so Glyphy geometry is used as-is). A node's local matrix is

`T(x, y) · T(px, py) · R(rotate) · S(scale·scaleX, scale·scaleY) · T(−px, −py)`

and its world matrix is `parent.world · local`.

Types:

| `type` | Own properties | Notes |
|---|---|---|
| `group` | `children` | |
| `path` | `glyph`, `subpaths`, or inline `d` | Geometry from a glyph or inline data. |
| `circle` | `center`, `r` (animatable) | |
| `rect` | `x0`, `y0`, `w`, `h`, `rx` (w, h, rx animatable) | *(not in bell)* |
| `arc` | `center`, `r`, `from`, `to` (r, from, to animatable) | Open circular arc, angles in degrees, drawn from `from` to `to` in the direction of increasing angle. |

Paint (on `path`, `circle`, `rect`, `arc`):

- `fill`: `{ "color": slot-or-color, "rule": "nonzero" | "evenodd" }` — `rule` defaults to `nonzero`;
  Glyphy glyphs need `evenodd`.
- `stroke`: `{ "color", "width", "cap": "butt"|"round"|"square", "join": "miter"|"round"|"bevel",
  "trimStart", "trimEnd", "trimOffset" }` — width and trims animatable; trims are fractions of path
  length (draw-on effects).
- Animatable paint addresses: `<id>.fill.color`, `<id>.stroke.color`, `<id>.stroke.width`,
  `<id>.stroke.trimStart|trimEnd|trimOffset`.
- Stroke width scales with the world transform (SVG default). *(Open question: a
  `nonScaling` flag for crisp strokes under scale.)*

**Knockout** (`requires: ["knockout"]` optional in 0.1, implied by use): `"knockout": w` on a painted
node cuts the node's shape, grown by `w` units, out of every **earlier sibling** in the same group,
following the node's animated transform. This replaces the "paper-coloured disc" trick, so badges
work on any background. (bell: the notification dot.)

## 5. Timelines

```json
"timelines": { "ring": { "duration": 1.4, "loop": "once", "reducedMotion": "end",
  "tracks": { "swing.rotate": [[0, 0, "cubic(0.2, 0, 0.3, 1)"], [0.1167, 17.189, "…"], [1.1, 0]] },
  "events": [[0.05, "ding"]] } }
```

- `duration` seconds (> 0). `loop`: `once` (default) | `loop` | `pingpong`.
- `tracks` maps a **property address** `"<node-id>.<property>"` to keyframes `[time, value, ease?]`.
  Times strictly increase and lie in `[0, duration]`. The value type must match the property
  (number, colour string, boolean).
- `events` *(not in bell)*: `[time, name]` pairs reported when playback crosses them (§7).

**Sampling** *(normative)*, for track keys `k0 … kn` at local time `t`:
- `t ≤ t0` → `v0`; `t ≥ tn` → `vn`.
- Otherwise find `i` with `ti ≤ t < ti+1`; `u = (t − ti) / (ti+1 − ti)`; the **ease on key `i`**
  (the left key of the segment) maps `u → w`; result `vi + (vi+1 − vi) · w`. The ease on the last key
  is never read and should be omitted.
- Booleans and anything with ease `hold` take `vi` for the whole segment.
- Colours interpolate per channel in non-premultiplied sRGB 0..255 including alpha, rounded to the
  nearest integer. *(Open question: linear-light or OKLab; sRGB is the 0.1 rule.)*

**Eases** *(normative)*:

| Ease | Definition |
|---|---|
| omitted / `linear` | `w = u` |
| `hold` | `w = 0` |
| `in`, `out`, `inOut` | `cubic(0.42, 0, 1, 1)`, `cubic(0, 0, 0.58, 1)`, `cubic(0.42, 0, 0.58, 1)` |
| `cubic(x1, y1, x2, y2)` | CSS `cubic-bezier`: solve `Bx(s) = u` for `s` (Newton, falling back to bisection, to 1e-7), return `By(s)`. `x1, x2 ∈ [0, 1]`; `y` unbounded (overshoot allowed). |
| `elastic(a, p)` | Ease-out elastic: with `A = max(a, 1)`, `s = p / (2π) · asin(1 / A)`; `w = A · 2^(−10u) · sin((u − s) · 2π / p) + 1`; `w(0) = 0`, `w(1) = 1` exactly. |

`spring(…)` is reserved for a later minor version. Golden vectors for every ease live in
`spec/conformance/eases.json`.

## 6. Colours

`colors` declares named slots: `{ "ink": "currentColor", "accent": "#d97757" }`. A paint `color` is
either a slot name or a literal (`#rgb`, `#rrggbb`, `#rrggbbaa`, `currentColor`). In the web runtime
a slot renders as `var(--anima-<slot>, <default>)`, so pages theme icons with CSS:
`anima-icon { color: …; --anima-accent: … }`. Slots are not animatable in 0.1; literal paint colours
are.

## 7. Playback, blending and the step function *(normative)*

A **player** holds: input values, pending triggers, per-layer state (current state, state time,
optional crossfade), and the resolved property values. `step(dt)` with `dt ≥ 0` seconds does, in
order:

1. **Inputs.** Apply queued writes in arrival order (`set`, `fire`). A fired trigger becomes pending.
2. **Transitions**, for each layer in declaration order: evaluate the current state's `on` list in
   order; the first transition whose condition holds is taken (at most one per layer per step).
   Taking a transition consumes the triggers its condition named. A transition may interrupt a
   crossfade in progress: the layer's current blended output is frozen as the new "from" pose.
3. **Clocks.** Advance each layer's state time and crossfade progress by `dt`. `once` timelines clamp
   at `duration`; `loop` wraps; `pingpong` reflects. Leftover time after a wrap carries over.
4. **Resolve.** Start every property from its **rest value** (the document value). For each layer in
   declaration order, compute the layer output — the state's pose or timeline sample, or during a
   crossfade `lerp(from, to, ease(progress))` per property — and write it over the current value.
   A property the target state does not set blends toward its rest value. Later layers win where
   two layers write the same property.
5. **Events.** Collect, in time order: state-enter `emit`s, then timeline events crossed during this
   step (including across loop wraps), each tagged with layer and time.
6. **Triggers.** Clear triggers that no transition consumed this step. (An input may declare
   `"buffer": seconds` to keep an unconsumed trigger pending for that long.)
7. Return `{ events, settled }`. `settled` is true when no crossfade is running, every playing
   timeline is `once` and finished, and no trigger is pending. A settled player needs no frames
   until an input changes.

Large `dt` is processed in one step; runtimes clamp `dt` to 0.25 s per frame for display, but the
headless `sample` command does not.

## 8. Inputs and the state machine

```json
"inputs": { "ring": { "type": "trigger" }, "hover": { "type": "bool" }, "level": { "type": "number", "default": 0, "min": 0, "max": 1 } }
```

Types: `bool`, `number`, `trigger`. Inputs are the **only** host interface: the page sets them,
listeners set them, conditions read them. (Rive moved from state-machine inputs to view models; at
icon scale one flat typed namespace does both jobs.)

```json
"machine": { "layers": { "ring": { "initial": "idle", "states": {
  "idle":    { "pose": { "dot.scale": 0 }, "on": [{ "when": "ring", "to": "ringing" }] },
  "ringing": { "play": "ring", "emit": "rang", "on": [{ "when": "@end", "to": "rested" }] } } } } }
```

- A **state** has either `pose` (a map of property address → value, i.e. a timeline of one instant)
  or `play` (a timeline name, optional `speed`), plus optional `emit` (event name on entry) and `on`.
- Entering a `play` state restarts its timeline at 0.
- A **transition** `{ "when", "to", "blend" }`: `blend` is a crossfade duration in seconds (default
  0); optional `"ease"` shapes the crossfade (default linear).
- **Conditions** (`when`), a deliberately tiny grammar:
  `name` (trigger pending, or bool true) · `!name` (bool false) · `name OP number` with
  `OP ∈ == != < <= > >=` (number inputs) · `@end` (the state's timeline has finished, `once` only) ·
  `@after(seconds)` (state time reached) · conjunction with `&&`. No `||`: write two transitions.
- Validation errors: unknown input, a trigger negated, `@end` on a pose state or looping timeline,
  a state with no way out that is not intended as terminal (warning), unreachable states (warning).

## 9. Listeners

```json
"listeners": [ { "on": "click", "fire": "ring" }, { "on": "enter", "set": { "hover": true } } ]
```

- `on`: `enter` | `leave` | `down` | `up` | `click` | `move` *(drag: later)*.
- `target`: a node id, or omitted for the **whole icon** (the `viewBox`, or the top-level `hit` shape
  if one is given). Node targets hit-test fill area plus stroke within half its width, plus optional
  `"hitPadding"` (grid units) on the listener.
- `click` fires when `down` and `up` land on the same target with the primary button and the pointer
  moved less than 0.5 grid units.
- Actions: `fire` (trigger name or list), `set` (input → value), `emit` (event name).
- Listener actions are queued as input writes for the next `step` (§7.1); runtimes call `step(0)`
  immediately so a press is visible in the same frame.

## 10. Accessibility and motion

`"a11y": { "role": "button" | "switch" | "img", "label": "…", "activate": "<trigger>", "pressed": "<bool input>" }`

- `button`/`switch`: the element is focusable, exposes the role and label, and Enter/Space fire
  `activate` (and, for `switch`, `aria-checked` follows `pressed`). Keyboard activation also sets
  `down` while the key is held if a `down` input exists. *(Open question: make that mapping explicit.)*
- `img` or no `a11y`: `role="img"` with the label, or `aria-hidden` when there is no label.
- **Reduced motion.** Each timeline declares `reducedMotion`: `play` | `end` (jump to the final
  pose; events still fire) | `skip` (stay at the first pose). Default `end`. Crossfades become 0 s.
  The web runtime follows `prefers-reduced-motion` unless the element sets `motion="full"`.

## 11. Conformance

`spec/conformance/<case>/` holds `case.ani`, `script.txt` (the same command language as
`anima sample`: `advance 0.1`, `set hover true`, `fire ring`, `pointer click 10 10`, `snapshot`) and
`expected.jsonl` (resolved property values and events after each `snapshot`, numbers compared at
1e-6). Every runtime and the CLI run the whole suite in CI.

## 12. Open questions

1. Non-scaling strokes (keep Glyphy's 1-unit weight under `scale`) — flag or default?
2. Colour interpolation space.
3. Keyboard → `down` mapping for `button`.
4. Additive layers (e.g. a breathing idle under a hover tilt) — needed before 1.0?
5. Path morphing between compatible subpaths (`<id>.d` keyframes) — 0.2?
6. Data binding beyond conditions (e.g. a `number` input driving `bar.scaleX` through a range map) —
   0.2, as `"bind": { "<address>": { "from": "level", "map": [0, 1, 0, 1] } }`.
7. Draw-on for Glyphy outlines (Glyphy has no centerlines): stroked mask with trims, or an authored
   centerline subpath?
