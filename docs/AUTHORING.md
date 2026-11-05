# Authoring `.ani` files

A guide for agents (and people) who write Anima animations by hand. It assumes you can run the
`anima` CLI and read its output; you never need a browser. The normative rules are in the spec
(`anima docs spec`); this guide is about doing the work.

## The loop

Every change goes through the same four commands:

```sh
anima validate icon.ani            # 0 = loads; otherwise every error with a line, pointer and hint
anima inspect icon.ani             # what is animated, the state graph, who writes what
anima sample icon.ani -e "fire ring; advance 0.2; snapshot swing.rotate"
anima render icon.ani -o out.png --sheet 8 -e "fire ring"   # look at it
```

Fix every `validate` error before anything else; `sample` and `render` refuse invalid files. Add
`--format=json` to any command when you want to parse the output. Exit codes: 0 ok, 1 diagnostics,
2 usage.

## Start from the glyph

```sh
anima new bell --glyph icons/glyphs/bell.svg       # or: anima new bell --glyphy <glyphy project>
```

The scaffold embeds the glyph's path data byte for byte, with its SHA-256, as one `path` node
filled with the `ink` slot (`currentColor`). Its rest frame is pixel-identical to the SVG — keep it
that way: **at rest, every transform is identity and every added element is invisible** (opacity 0
or scale 0). Then the animated icon drops in where the static one was.

Split the glyph into parts by subpath. Subpaths are numbered from 0 in the order their `M`
commands appear in `d`. A hole and its outline must stay in one node (they are drawn even-odd
together):

```json
{ "id": "body",    "type": "path", "glyph": "bell", "subpaths": [0, 1], "fill": { "color": "ink", "rule": "evenodd" } },
{ "id": "clapper", "type": "path", "glyph": "bell", "subpaths": [2],    "fill": { "color": "ink", "rule": "evenodd" }, "pivot": [10, 9] }
```

To find which subpath is which, render each one alone (temporarily set the others' `subpaths`),
or read the start points: each subpath begins right after an `M` in `d`.

## Geometry and pivots

- Everything is in glyph grid units (Glyphy's `grid`, usually 20), y down. Nothing is re-origined:
  children use the same coordinates as their parents, so Glyphy's numbers work unchanged.
- To turn or scale a part about a point, give the node a `pivot` in those same coordinates. The bell
  swings about the top of its handle (`[10, 2.5]`); the clapper lags about `[10, 9]`.
- Nest groups to compose motion: the clapper is a child of `swing`, so it swings with the bell and
  adds its own rotation.
- Motion that leaves the glyph box needs room: set `viewBox` larger than the grid
  (bell: `[-2, -2, 24, 24]`). The icon is still laid out by its grid box; the bleed overflows.
- Authored ink (sound waves, sparkles) should match the glyph's stroke weight: Glyphy's `stroke`
  (1 unit in the anthropic set) with the default round caps and joins. Strokes scale with their
  node, like the glyph's filled outline.

## Timelines

A timeline is a set of tracks keyed by **address** (`<node-id>.<property>`), each a list of
`[time, value, ease]` keyframes:

```json
"ring": { "duration": 1.4, "tracks": {
  "swing.rotate": [[0, 0, "cubic(0.2, 0, 0.3, 1)"], [0.116667, 17.1887, "cubic(0.45, 0, 0.55, 1)"], [1.1, 0]]
} }
```

- Times are **seconds**, angles **degrees** (positive is clockwise), scale and opacity plain
  numbers. No frames, radians or percentages anywhere.
- The ease on a key shapes the segment **to the next key**; the last key's ease is never used.
- Before the first key the first value holds; after the last, the last value holds.
- `hold` keeps a value until the next key — use it for "wait, then move" (the dot stays at 0 until
  0.67 s, then pops).
- Eases: `linear`, `hold`, `in`, `out`, `inOut`, `cubic(x1, y1, x2, y2)` (CSS `cubic-bezier`), and
  `elastic(amplitude, period)` (ease-out spring-like overshoot; the bell's dot uses `elastic(1, 0.45)`).
- `anima schema` lists every animatable property; `anima schema stroke` the paint fields.

## States, inputs and listeners

Inputs are the only interface between the page and the icon: `bool`, `number` and `trigger`.
Listeners write inputs from pointer events; layers of states read them.

```json
"inputs":    { "ring": { "type": "trigger" }, "hover": { "type": "bool" } },
"listeners": [ { "on": "click", "fire": "ring" }, { "on": "enter", "set": { "hover": true } },
               { "on": "leave", "set": { "hover": false } } ],
"machine": { "layers": {
  "ring":  { "initial": "idle", "states": {
    "idle":    { "pose": { "dot.scale": 0 }, "on": [{ "when": "ring", "to": "ringing" }] },
    "ringing": { "play": "ring", "on": [{ "when": "@end", "to": "rested" }] },
    "rested":  { "pose": { "dot.scale": 1 }, "on": [{ "when": "ring", "to": "ringing" }] } } },
  "hover": { "initial": "rest", "states": {
    "rest":  { "pose": {}, "on": [{ "when": "hover", "to": "hover", "blend": 0.18 }] },
    "hover": { "pose": { "icon.scale": 1.05 }, "on": [{ "when": "!hover", "to": "rest", "blend": 0.22 }] } } } } }
```

- A state is a `pose` (values held still) or `play`s a timeline. Each layer is in one state at a
  time; layers run together, in order, and a later layer wins where two write the same property.
  Keep layers to separate properties when you can (`anima inspect` lists overlaps).
- A property a state does not mention goes back to its rest value (crossfading if `blend` is set).
  So an empty pose `{}` means "rest".
- Conditions: `name` (trigger fired, or bool true), `!name`, `level > 0.5`, `@end` (the state's
  timeline finished; `once` timelines only), `@after(0.3)`, joined with `&&`. For "or", write two
  transitions.
- Triggers are dropped at the end of the step if nothing used them. A click during `ringing` above
  is ignored, by design. If a fire must wait for a crossfade, give the input `"buffer": 0.3`.
- `"interruptible": false` on a transition lets its crossfade finish before the layer reacts again;
  the bell uses it so a quick click still shows the press.
- For buttons, add `"a11y": { "role": "button", "label": "…", "activate": "ring", "held": "down" }`:
  Enter and Space then fire `activate`, and `held` is true while the key is down.
- Every timeline has `reducedMotion`: `end` (default; jump to the last frame, events still fire),
  `skip` (stay on the first frame) or `play`.

## Checking the motion

`sample` runs a script and prints JSON snapshots; it is the fastest way to check numbers.

```sh
anima sample bell.ani -e "pointer move 10 10; advance 0.3; snapshot icon.scale; pointer click 10 10; advance 0.05; snapshot"
```

Script commands: `advance <s> [in <n>]`, `set <input> <value>`, `fire <input>`, `toggle <input>`,
`pointer move|down|up|click <x> <y>`, `pointer leave`, `motion reduce|full`, `snapshot [addresses]`.
Pointer coordinates are grid units. Each snapshot has `values`, the layer `states`, the `events`
since the last snapshot, and `settled` (true when nothing will move until an input changes — make
sure your icon reaches it, or the page keeps animating).

`render` shows it. `--sheet N` draws N frames evenly from the end of the script until the icon
settles (or `--over <seconds>`), labelled with their time. `--dark` uses ink `#f0eee6` on
`#1d1d1d`; `--color accent=#e08a6d` overrides a slot. Look at the sheet: check the rest frame is
the plain glyph, that parts turn about the right pivot, that nothing is clipped by the `viewBox`,
and that the last frame is where you meant to stop.

## Common mistakes

Each with the exact diagnostic `anima validate` prints (line numbers vary).

**Property names from other tools.** It is `rotate`, not `rotation`, and `scale`/`scaleX`/`scaleY`:

```
bell.ani:202:23 error unknown-key /nodes/0/children/1/rotation: unknown key "rotation" — did you mean "rotate"?
```

**Frames instead of seconds.** Frame 7 at 60 fps is `0.116667`:

```
bell.ani:219:13 error key-range /timelines/ring/tracks/swing.rotate/1/0: time 7 lies outside [0, 1.4]
bell.ani:224:13 error key-order /timelines/ring/tracks/swing.rotate/2/0: time 0.283333 does not come after 7 — keyframe times must strictly increase
```

**Radians.** There is no diagnostic: `0.3` is a valid angle, just a tiny one. Angles are degrees;
convert with `× 180 / π` (0.3 rad = 17.1887°). If a swing looks frozen in `render`, check this.

**CSS ease syntax.** It is `cubic(…)`, not `cubic-bezier(…)`:

```
bell.ani:216:13 error bad-ease /timelines/ring/tracks/swing.rotate/0/2: "cubic-bezier(0.2, 0, 0.3, 1)": not an ease — linear, hold, in, out, inOut, cubic(x1, y1, x2, y2) or elastic(a, p)
```

**Animating a pivot.** Pivots are fixed; move the node instead:

```
bell.ani:518:29 error not-animatable /machine/layers/hover/states/hover/pose/icon.pivot: "pivot" cannot be animated — animate x and y instead
```

**Animating a colour slot.** Slots are themed by the page (CSS), not animated. Give the paint a hex
colour if it must change:

```
bell.ani:458:27 error color-slot-animated /timelines/ring/tracks/dot.fill.color: "dot.fill.color" is animated, so its colour must be a hex literal, not "accent" — slots are not animatable in 0.1
```

**Negating a trigger, or `||`.** Triggers are events, not states; and conditions only have `&&`:

```
bell.ani:472:25 error input-type /machine/layers/ring/states/idle/on/0/when: trigger "ring" cannot be negated
bell.ani:507:25 error bad-condition /machine/layers/hover/states/rest/on/0/when: "hover || down": cannot read "hover || down" — terms: name, !name, name OP number, @end, @after(s), joined with &&
```

**A typo in a state name.** The orphaned state is reported too:

```
bell.ani:483:23 error unknown-state /machine/layers/ring/states/ringing/on/0/to: no state "rest" in layer "ring" — did you mean "rested"?
bell.ani:487:21 warning unreachable-state /machine/layers/ring/states/rested: no transition reaches "rested"
```

**`@end` on a looping timeline.** A loop never ends; use `@after(seconds)`:

```
bell.ani:483:25 error bad-end /machine/layers/ring/states/ringing/on/0/when: @end needs a "once" timeline; "ring" is loop
```

**Counting subpaths from 1.** They start at 0:

```
bell.ani:172:17 error bad-subpath /nodes/0/children/1/children/1/subpaths/0: subpath 3 is out of range (the path has 3)
```

**Firing a bool, or setting a trigger.** `fire` is for triggers, `set`/`toggle` for bools and numbers:

```
bell.ani:565:15 error input-type /listeners/1/fire: "fire" needs a trigger input; "hover" is bool
```

**A state that transitions to itself on a level.** It would restart every frame:

```
bell.ani:533:25 error self-transition /machine/layers/hover/states/hover/on/2/when: "hover" → itself needs a trigger, @end or @after term — otherwise it would re-enter every step
```

**A re-traced glyph.** When Glyphy re-traces a glyph, its subpaths may be renumbered. Paste the new
`d`, then validate: the stale hash tells you to re-check every `subpaths` list before updating it.

```
bell.ani:14:17 warning hash-mismatch /glyphs/bell/sha256: glyph "bell" changed since its hash was taken — if it was re-traced, check that subpath indices still pick the right parts, then update sha256
```

**Visible at rest.** No diagnostic either: render the rest frame (`anima render icon.ani -o rest.png`)
and compare it with the glyph. Added parts need `opacity: 0` or `scale: 0` in the document, and the
states that show them set them in a pose or timeline.

## Formatting

`anima fmt --write icon.ani` puts keys in a stable order and each keyframe on its own line, so diffs
stay readable. It never reorders `machine.layers` (their order matters) or any other map.
