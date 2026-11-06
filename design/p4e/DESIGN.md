# P4e design: data (view models, bindings, converters)

Decided by the orchestrator (2026-11-08) for the ~200 P4e parity rows. Coders implement it; a
needed deviation is raised with its reason before it is built. 0.1 inputs keep working unchanged:
view models generalise them, they do not replace them.

## 1. Modules

| Module | Feature | Budget | Holds |
|---|---|---:|---|
| `data` | `data` | 8 KB | view models, properties, enums, instances, lists, `$` paths, binding modes, data listeners, custom node properties |
| `convert` | `convert` | 8 KB | named converters and converter groups, formula functions, string/number formatting, interpolation |
| web host API | (part of `data`'s web entry) | — | typed data access for pages |

`convert` may be split again (e.g. `format` for string/number formatting) if it passes its budget.

## 2. View models

```xml
<model name="Player">
  <number name="score" default="0" min="0"/>
  <string name="name" default="Ada"/>
  <bool name="online"/>  <color name="tint" default="#d97757"/>  <trigger name="levelUp"/>
  <enum name="mood" values="calm happy angry" default="calm"/>
  <list name="items" of="Item"/>          <!-- list of Item instances -->
  <model-ref name="team" model="Team"/>   <!-- nested view model -->
  <asset-ref name="avatar" type="image"/> <!-- image | font | blob -->
</model>
<instance name="main" model="Player" default="true"> <!-- values override defaults -->
  <set path="score" value="12"/>
</instance>
```

- `.ani`: `data: { models: { Player: { properties: { score: { type: "number", default: 0, min: 0 } …
  } } }, instances: { main: { model: "Player", default: true, values: { score: 12 } } }, enums:
  { … } }`. System enums (`horizontal-text-align`, `layout-*`, `word-wrap`, …) are declared by name
  (`<enum name="align" system="horizontal-text-align"/>`) and used by P6/P7.
- Global models (`global="true"`) are shared by every component instance in the document;
  components declare public data (`<component … data="Player">`) bound per instance by the parent.

## 3. Paths: `$`

A data path starts with `$`: `$score`, `$team.name`, `$items.2.title`, `$items.length`. It is valid
wherever an input name is valid — conditions (`when="$score > 10"`), bindings (`value="$score / 100"`),
actions (`set="$score=$score+1"`, `fire="$levelUp"`), event fields, component input values — and
resolves against the document's default instance (or a named one: `$main:score`). Unknown paths,
type mismatches and writes to read-only paths are diagnostics with pointers.

## 4. Bindings with sources and modes

`<bind target="ring.trimEnd" value="$progress"/>` (existing form, now with `$` paths) plus
`mode="to-target" | "to-source" | "two-way" | "once"` (two-way: `prefer="source|target"` on
conflict) and `convert="name"` (a converter or group, §5). `to-source` / `two-way` write the target's
value into the data path (target must be animatable and the path writable). Node custom properties
(`<path … data-label="x">` → `nodes[].properties`) are bindable targets and sources.

## 5. Converters (`convert`)

`<converter name="pct" type="range" from="0 1" to="0 100"/>`, `<converter name="label" type="template"
text="{0} pts"/>`, `<converter-group name="fmt" chain="pct round label"/>`. Types: `formula`
(expression with the bind language + trig/log/exp/pow/sqrt/round/ceil/floor/abs/random with
`random="always|once|on-change"`), `range` (map, clamp, modulo, reverse), `round`, `negate`,
`to-number`, `to-string`, `number-format` (decimals, grouping), `color-format`, `pad`
(start/end), `trim` (start/end/all/none), `template` (positional args, delimiters, number
formatting per argument), `remove-zeros`, `enum-to-index`, `list-length`, `number-to-list`,
`trigger`, `degrees-to-radians`, `normalize`, `interpolate` (number/colour over time; the only
stateful converter — its state lives in the player). Deterministic: `random` is seeded per player.

## 6. Listeners that write data

`set` (with `$` paths and expressions, existing), `copy="$a -> $b"`, value sources for input-driven
writes (`value="focused"`, `value="gamepad-axis:0"` from the input/focus modules), and data listeners
`<listener on="change:$score">` (fires when the path's value changes).

## 7. Host API (web + core)

`icon.data` (core: `player.data`): `get(path)`, typed `number/string/boolean/color/enum/list/
trigger/image/font(path)` handles with `.value`, `.set()`, `.fire()`, `.on('change', cb)`;
`instances()`, `create(model, values)`, `bind(instance)`, `models()` (reflection: names, property
types, enums), `batch(fn)` (one notification after many writes), `auto-bind` attribute (bind the
default instance on load). Subscriptions are delivered after the step that changed the value.

## 8. Order of work

1. `data` core (§2–4, §6, custom properties) — first; defines the `$` resolver and binding hooks.
2. `convert` (§5) in parallel: pure converter functions behind a registry interface
   `(value, options, ctx) => value` that `data` calls; the bind expression language gains the math
   functions through a registration hook (keep `bind` under its 2 KB budget).
3. Host API (§7) after 1 lands.
4. The 18 remaining `paint` rows (angular gradient, gradient transform, trim modes, effect order and
   shared effects, additive blend, paint blend override, fill-rule clockwise, geometry origin, editable
   vertex kinds) in parallel — own module files, no data dependency.
5. Benchmark brief: a scoreboard bound to a view model (list of players, formatted scores, a
   two-way-bound slider).
