# AniML — Anima Markup Language, 0.1

Status: **0.1**, the authoring format for `.ani` 0.1. AniML is how agents and people write
animations; `anima build` compiles it into `.ani` (`spec/SPEC.md`), which stays the runtime and
conformance format. Every capability of `.ani` has exactly one markup form; markup adds only
conveniences that compile away (named eases, the keyframe text form, `and` in conditions).

`examples/bell.animl` is the reference document; it builds to `examples/bell.ani` byte for byte.

## 1. File

- Extension `.animl`, media type `application/vnd.anima+xml`, UTF-8.
- The syntax is a subset of XML 1.0: one root element, elements, attributes in double or single
  quotes, text, comments, the five named entities and numeric character references. An optional
  `<?xml …?>` declaration may come first. DOCTYPE, processing instructions, CDATA and namespace
  prefixes are errors (`markup-syntax`).
- One leniency, so conditions read naturally: inside a quoted attribute value a raw `<`, and an `&`
  that does not begin an entity, stand for themselves. Tools write well-formed XML (`&lt;`, `and`).
- Element and attribute names are case-sensitive. Whitespace between elements is insignificant;
  text is allowed only where §4 says so.
- Comments may appear anywhere. The first comment inside an element, before its first child
  element, becomes the `$comment` of the JSON object that element compiles to; all other comments
  are dropped by `build` (and kept by `anima fmt`).

## 2. Values

| Kind | Markup | Example |
|---|---|---|
| number | JSON number syntax | `-2.0054` |
| boolean | `true` / `false` | `visible="false"` |
| name | `[a-z][a-zA-Z0-9-]*` | `id="wave-r1"` |
| vector | numbers separated by whitespace and/or one comma (SVG style) | `pivot="10 2.5"`, `viewBox="-2 -2 24 24"` |
| name list | names separated by whitespace | `subpaths="0 1"`, `fire="ring"` |
| assignments | `name=value` pairs separated by whitespace | `set="hover=false down=false"` |
| colour | as in `.ani` §6: slot name, `#rgb`, `#rrggbb`, `#rrggbbaa`, `currentColor` | `fill="accent"` |
| ease | as in `.ani` §5, or a name declared with `<ease>` | `ease="sway"` |
| condition | as in `.ani` §8; `and` may be written for `&&` | `when="hover and !down"` |

A value that does not parse is `bad-attribute`, pointing at the attribute's value.

## 3. Names: one registry

Element and attribute names come from the registry (`packages/core/src/registry.ts`), the same
entries that define the JSON Schema. The rules, applied by the registry, are:

1. Where SVG has a name for the same thing, AniML uses it: `viewBox`, `cx`/`cy` (a node's
   `center`), `width`/`height` (a rect's `w`/`h`), `fill` (the fill colour), `fill-rule`, `stroke`
   (the stroke colour), `stroke-width`, `stroke-linecap`, `stroke-linejoin`.
2. Everything else keeps its `.ani` name: `rotate`, `scaleX`, `opacity`, `pivot`, `trimEnd`,
   `knockout`, `reducedMotion`, `hitPadding`, `interruptible`, …
3. Paint is flattened: the `.ani` objects `fill: { color, rule }` and `stroke: { color, width, cap,
   join, trimStart, trimEnd, trimOffset }` become the attributes above on the node. A `fill-rule`
   without `fill`, or any stroke attribute without `stroke`, is `paint-attribute`.

**Addresses** in markup (`<track target>`, `<pose>` attribute names) are `<node-id>.<attribute>`
with the markup attribute name: `dot.fill` (`.ani` `dot.fill.color`), `wave.stroke-width`
(`wave.stroke.width`), `wave.trimEnd` (`wave.stroke.trimEnd`), `bar.width` (`bar.w`). Every other
address is spelled the same in both formats (`swing.rotate`, `icon.scaleX`).

## 4. Elements

The root is `<anima>`. Its children may come in any order; within each kind, order is kept (it
becomes the order of the `.ani` map or array). Node elements are painted in document order.

| Element | Attributes (required in **bold**) | Children / text | Compiles to |
|---|---|---|---|
| `anima` | **`version`** (`0.1`), **`name`**, `title`, **`grid`**, `viewBox`, `requires` (name list), `xmlns` (ignored) | everything below | the document; `version` → `anima` |
| `meta` | — | JSON object as text | `meta` |
| `color` | **`name`**, **`value`** | — | `colors[name]` |
| `glyph` | **`name`**, **`d`**, `source`, `pick`, `sha256` | — | `glyphs[name]` |
| `a11y` | `role`, `label`, `activate`, `pressed`, `held` | — | `a11y` |
| `bool` / `number` / `trigger` | **`name`**; `default` (bool, number); `min`, `max` (number); `buffer` (trigger) | — | `inputs[name]` with that `type` |
| `hit` | exactly one of `circle` (vector of 3), `rect` (vector of 4) | — | `hit` |
| `group` | node attributes | node elements | a `group` node with `children` |
| `path` | node attributes, paint, `knockout`, `glyph` + `subpaths` or `d` | — | a `path` node |
| `circle` | node attributes, paint, `knockout`, **`cx`**, **`cy`**, **`r`** | — | a `circle` node |
| `rect` | node attributes, paint, `knockout`, **`x0`**, **`y0`**, **`width`**, **`height`**, `rx` | — | a `rect` node |
| `arc` | node attributes, stroke paint, `knockout`, **`cx`**, **`cy`**, **`r`**, **`from`**, **`to`** | — | an `arc` node |
| `ease` | **`name`**, **`curve`** (an ease) | — | nothing: uses of `name` are replaced by `curve` |
| `timeline` | **`name`**, **`duration`**, `loop`, `reducedMotion` | `track`, `event` | `timelines[name]` |
| `track` | **`target`** (address) | keyframe text (§5) | `tracks[target]` |
| `event` | **`at`** (seconds), **`name`** | — | an entry of `events` |
| `layer` | **`name`**, **`initial`** | `state` | `machine.layers[name]` |
| `state` | **`name`**; `play`, `speed`, `emit` | at most one `pose`, then `on` | `states[name]`; a state without `play` is a pose state (`pose: {}` if it has no `<pose>`) |
| `pose` | any number of `<address>="value"` | — | the state's `pose` |
| `on` | **`when`**, **`to`**, `blend`, `ease`, `interruptible` | — | an entry of the state's `on` |
| `listener` | **`on`**, `target`, `hitPadding`, `fire` (name list), `set` (assignments), `toggle` (name list), `emit` | — | an entry of `listeners` |

Node attributes, on every node element: **`id`**, `pivot`, `x`, `y`, `rotate`, `scale`, `scaleX`,
`scaleY`, `opacity`, `visible`. Paint: `fill`, `fill-rule`, `stroke`, `stroke-width`,
`stroke-linecap`, `stroke-linejoin`, `trimStart`, `trimEnd`, `trimOffset`.

Errors: an element the parent does not allow is `misplaced-element` (or `unknown-element` if it is
nowhere allowed); an attribute the element does not take is `unknown-attribute`; a missing
required attribute is `missing-attribute`; a repeated attribute is `duplicate-attribute`; two
declarations with the same name in one map (two `<color name="ink">`, two states `idle`) are
`duplicate-name`. Each has a "did you mean" hint where one is close.

## 5. Keyframes

A `<track>` holds its keyframes as text, one per line or separated by `;`:

```
time value [ease]
```

`time` is a number of seconds, `value` a number, `true`/`false` or a colour, and `ease` (optional,
the rest of the keyframe) an ease. Columns may be aligned with any whitespace; blank lines are
ignored. A keyframe that does not have this shape is `bad-keyframe`, pointing at it. As in `.ani`,
the ease on a key shapes the segment to the next key, and the last key's ease is omitted.

```xml
<track target="swing.rotate">
  0         0         cubic(0.2, 0, 0.3, 1)
  0.116667  17.1887   sway
  1.1       0
</track>
<track target="dot.scale">0 0 hold; 0.666667 0 elastic(1, 0.45); 0.966667 1</track>
```

## 6. Named eases

`<ease name="sway" curve="cubic(0.45, 0, 0.55, 1)"/>` declares a name usable wherever an ease is
(keyframes, `<on ease>`). Names must not shadow the built-in eases (`linear`, `hold`, `in`, `out`,
`inOut`) (`duplicate-name`). The compiled `.ani` contains the curve, written canonically
(`cubic(0.45, 0, 0.55, 1)`: a comma and a space between JSON numbers).

## 7. Compilation

`anima build x.animl [-o x.ani]` parses, checks the markup, compiles, runs the `.ani` loader on the
result, and writes `.ani` in the canonical form of `anima fmt`. The compiler:

1. reports markup errors (§1–§6) with their positions;
2. builds the `.ani` document, writing keys in canonical order and normalising eases (§6) and
   conditions (`and` → `&&`, single spaces around operators);
3. records a **source map**: for every JSON pointer it produced, the position (line, column) of the
   markup that produced it — an element, an attribute value, or a keyframe token;
4. loads the result with the strict `.ani` loader and maps each diagnostic back through the source
   map (the longest pointer prefix that has an entry), so every diagnostic names a line and column
   in the `.animl` file. Agents never need to read the compiled output.

Diagnostics keep the `.ani` loader's codes and add the markup codes below. Each has `file`, `line`,
`column`, `code`, `severity`, `message`, `hint` (where possible) and the compiled `pointer`.

| Code | When |
|---|---|
| `markup-syntax` | The text is not well-formed AniML (§1). |
| `unknown-element` | An element AniML does not define. |
| `misplaced-element` | An element in a parent that does not allow it. |
| `unknown-attribute` | An attribute the element does not take. |
| `missing-attribute` | A required attribute is absent. |
| `duplicate-attribute` | An attribute appears twice on one element. |
| `duplicate-name` | Two declarations share a name, or an ease shadows a built-in. |
| `bad-attribute` | An attribute value does not parse as its kind (§2). |
| `bad-keyframe` | A keyframe line does not read as `time value [ease]`. |
| `paint-attribute` | A fill or stroke detail without the `fill` or `stroke` it belongs to. |

## 8. Decompilation and formatting

`anima decompile x.ani` writes the canonical markup for a compiled document: children of `<anima>`
in the order `meta`, colours, glyphs, `a11y`, inputs, `hit`, nodes, timelines, layers, listeners;
attributes in registry order; tracks one keyframe per line with aligned columns; eases and
conditions as in `.ani`. `$comment`s become first-child comments. For every document,
`build(decompile(build(m)))` equals `build(m)` (round-trip stability).

`anima fmt x.animl` reformats markup in place of the same canonical layout but keeps the author's
comments, element order and named eases.

## 9. Markup inside HTML

HTML parses `<path/>` and friends as HTML, so markup in a page is wrapped in a script element:

```html
<anima-icon>
  <script type="application/vnd.anima+xml">
    <anima version="0.1" name="dot" grid="20"> … </anima>
  </script>
</anima-icon>
```

- **Build time (recommended).** `anima build page.html` compiles every such script inside an
  `<anima-icon>` into `<script type="application/vnd.anima+json">` with the compiled document.
- **Runtime.** The optional module `@anima-format/web/markup` teaches `<anima-icon>` to compile
  markup in the browser. It has its own size budget and is not part of the core + web budget; a
  page that ships compiled `.ani` never loads it.

## 10. Reserved for 0.2

The markup forms of the `.ani` features reserved in SPEC §12 are reserved too, and rejected with
the loader's `reserved` code: `<layer mode="additive">`, `<bind target from map>`, a track target
`<id>.d` (path morphing), `spring(…)` eases, and `<timeline colorSpace>`.
