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
| `a11y` | `role`, `label`, `activate` (trigger or bool input name), `pressed`, `held` | — | `a11y` |
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

Decompiling a hand-written `.ani` and building it again gives the same document up to three
normalisations, none of which changes playback: `$schema` is dropped; a `$comment` on an object
that has no element of its own (`inputs`, `colors`, a `fill` or `stroke`, …) is dropped; and a
one-item action list (`"fire": ["ring"]`) is written as a single name (`"fire": "ring"`).

`anima fmt x.animl` reformats markup into the same canonical layout but keeps the author's
comments, element order, named eases and track style: a track written inline with `;` stays inline
(one space between columns), a track written one key per line stays so, with aligned columns.

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
- **Runtime.** The optional authoring entry `@anima-format/web/markup-hooks` teaches
  `<anima-icon>` to compile markup for the runtime modules a page loads. It includes the lean
  `@anima-format/web/markup` compiler; that lean entry remains available for static AniML
  and explicit hook imports. Animation authoring (track text, named eases, transition conditions
  and listener `set` assignments) lives in `@anima-format/web/markup-animation`, which also loads
  the lean compiler. `markup-hooks` includes this entry; its existing import remains sufficient.
  A page using only the lean compiler adds `markup-animation` when it needs that syntax; otherwise
  it reports `markup-animation-unavailable` with the source position, JSON pointer and a message/hint
  naming the entry or `anima build`. Loading it later retries retained failed sources.
  The default tooling compiler installs it automatically. The compiler and hooks have separate authoring budgets and are
  not part of the core + web budget; a page that ships compiled `.ani` never loads them.
  Library/template support additionally requires
  `@anima-format/web/markup-libraries` (which also loads markup support). Without it,
  `<import>`, `<template>` and `<apply>` report `markup-libraries-unavailable`, with a hint to load
  that entry or run `anima build`. The default tooling compiler entry always registers this layer;
  the lean `@anima-format/markup/browser` entry uses it only when registered.
- Module compilation is optional too. Runtime entries such as `@anima-format/web/components`
  and `@anima-format/web/bind` register runtime features only. Load
  `@anima-format/web/markup-hooks` alongside them, in either order; the authoring entry installs
  the compiler hooks synchronously for existing and subsequently loaded runtime modules. Inline and fetched sources also recover when a module arrives after the icon is connected. Without its hook,
  `<component>` / `<instance>` report `markup-components-unavailable` and `<bind>` reports
  `markup-bind-unavailable`; each diagnostic includes the source position, JSON pointer and
  a message/hint naming the entry to load (or `anima build`). The registration-only entries
  `@anima-format/web/markup-components` and `@anima-format/web/markup-bind` are available
  separately; they do not install their runtime modules or the compiler.
- Registry-derived forms (including `<asset>` and ordinary module node attributes) remain in
  markup. Structural paint handling (gradient children, masks, clips, multiple paints and dash
  lengths) is registered by `@anima-format/web/markup-hooks` when the paint runtime is loaded,
  or separately by `@anima-format/web/markup-paint`. A composite-only page using structural children must load
  `markup-paint` alongside `composite` and `markup`; without it those children report
  `markup-paint-unavailable`, naming `markup-paint` in the message and hint. These hooks are
  shared through the registered element class, including across separately emitted bundles.
  For `surface` image paints, slices and feathering, load `markup-hooks` alongside the
  runtime entry, or load `markup-surface` alongside the lean compiler. Tooling's main entry registers all modules and hooks; the lean browser
  entry imports neither `core/all` nor the tooling entry. CLI and playground compilation are unchanged.
- Failed source loads retain their source and retry when compiler hooks or runtime modules register.
  The initial attempt still reports diagnostics through `anima:error` and rejects its `ready` promise;
  a registration-triggered attempt installs a fresh `ready` promise. A later successful load clears
  the retained source. An explicit `destroy()` cancels retries. Registrations never replace an
  already loaded player. This applies to inline scripts, fetched sources and explicit `load` calls.

## 10. Reserved for 0.2

The markup forms of the `.ani` features reserved in SPEC §12 are reserved too, and rejected with
the loader's `reserved` code: `<layer mode="additive">`, a track target
`spring(…)` eases, and `<timeline colorSpace>`.

## Paint module

Declare `requires="paint"` on `<anima>`. A painted node may contain a `<linearGradient>` or
`<radialGradient>` child for each paint, instead of its flat `fill` / `stroke` attribute:

```xml
<anima version="0.1" name="paint" grid="20" requires="paint">
  <circle id="disc" cx="10" cy="10" r="8" stroke="#000"
      stroke-dasharray="10% 5%" stroke-dashoffset="0.1">
    <linearGradient x1="2" y1="2" x2="18" y2="18">
      <stop offset="0" stop-color="#ff000080"/>
      <stop offset="1" stop-color="#00f"/>
    </linearGradient>
  </circle>
</anima>
```

`paint="fill"` (default) or `paint="stroke"` selects the paint object. A `linearGradient` requires
`x1 y1 x2 y2`; `radialGradient` requires `cx cy r` and accepts optional `fx fy`. Each has at least two
`<stop offset="0…1" stop-color="…"/>` children. These map to the paint's `type`, coordinates and
`stops: [{position, color}]`. Flat paint and a gradient for the same target, or two gradients for one
target, are `paint-attribute`; an invalid selector is `bad-attribute`. Stop colours follow §2.

Gradient coordinate and stop addresses are identical in both syntaxes, e.g. `disc.fill.x2`,
`disc.fill.stops.0.color`, `disc.fill.stops.0.position`, `disc.stroke.fx`. Dashes are node attributes
`stroke-dasharray` (whitespace/comma-separated lengths, all numbers or all percentages) and
`stroke-dashoffset` (number). The offset's track/pose address `disc.stroke-dashoffset` maps to
`disc.stroke.dashOffset`. Units, sampling and trim precedence are defined in SPEC's paint chapter.
Module element/attribute names and canonical order derive from the same registry as `.ani`.

## Paint geometry forms

With requires="paint", ellipse, polygon, star and triangle are painted elements.
Their attributes match the numeric parameter names in SPEC's paint chapter.
Rect corners="1 1 0 0" supplies TL/TR/BR/BL; tracks address tile.corners.0 through .3.
Stroke-scale="fixed" maps to stroke.scale. Morph tracks target pathId.d and enclose
SVG paths in JSON double quotes: 0 "M0 0L2 2"; 1 "M1 1L3 3".
A pose accepts a path directly in its attribute: <pose pathId.d="M1 1L3 3"/>.
Pose blending follows the same command-structure rules and diagnostics as tracks.
See examples/shapes.animl for a complete document and SPEC for bounds and diagnostics.
## Composite module

Declare `requires="composite"`; use `requires="paint composite"` when also using paint features.
Browser hosts import `@anima-format/web/composite` separately.
Compositing uses `mix-blend-mode` and `stroke-position` node attributes. Paint visibility uses
`fill-visible` or `stroke-visible`. Structural children map directly to their JSON objects:
`<mask source="shape" mode="alpha" source-draws="false"/>`,
`<clip source="outline" rule="evenodd"/>` (`rule` optional, default `nonzero`), and
`<drawOrder target="sibling" position="after" active="true"/>`.
`<clip>` is also allowed inside `<group>` and clips all its children with the source outline.
The source must be a painted node, even when the target is a group.
Multiple paints are repeated `<fillPaint fill="#f00"/>` or
`<strokePaint stroke="#000" stroke-width="2"/>` children, in drawing order. Gradient paints
use `type="linear"` / `type="radial"`, coordinate attributes and nested `<stop>` children on
these elements. Track addresses keep the JSON paint-array path. A structural selector `for`
is reserved for registry routing and normally omitted.

## 11. Libraries and templates (build time)

A reusable file has root `<library name="ui">`, with `color`, `glyph`, `ease`, `template`,
`component`, `model`, authored data `instance`, `enum` and `import` children. A library is consumed by an import rather than compiled
as a standalone animation. Components require the components module; model definitions require data.

`<import src="lib/ui.animl" as="ui"/>` at document or library level brings its exported names into
that lexical scope. References to colours, glyphs, eases and templates use `ui:name`; nested
imports may be addressed as `ui:other:name`. Definitions inside a library use its own local names.
Imported colour and glyph names become collision-free generated `.ani` names; eases inline as
usual. An imported component keeps its original name if that name is unique among all compiled
components (including private dependencies and local declarations). Colliding imported components
use `<alias>:<name>`; nested imports use the full alias chain, e.g. `ui:basic:switch`. A local
declaration retains its key and owns that exact bare name. Import order and unrelated declarations
do not change these component keys. Library-internal references are rewritten in their lexical
scope; an unambiguous imported original name also works in the consumer.

Compilation records qualified lookup aliases in `meta.componentNames` (preserving other metadata).
`<anima-icon component="switch">`, qualified `component="ui:switch"`, CLI `--component`, core
component references and host component-valued writes share this lookup scheme. Qualified names
always select their import; an original name with several imported matches reports
`ambiguous-component`, with qualified alternatives in verbose diagnostics. Existing generated
`import-<number>-<name>` keys still resolve; after recompilation their suffix resolves when unique
and receives the ambiguity diagnostic otherwise. Component keys and literal references permit
colon-separated name segments; node IDs and input names retain their existing syntax. Libraries must not declare arbitrary document elements outside templates. Imports and
local declarations are visible regardless of source order.

`export="row Score"` on the library restricts public names; `export="row"` on an import selects
public declarations. The earlier root `exports` and import `select` spellings remain aliases;
a nonempty `export` takes precedence. Omitted selection exports/imports all public declarations. Private dependencies
stay in lexical scope. Imported model references (`data`, `model`, `of`) are renamed consistently.
An import's optional `source="../shared/ui.animl"` records a local vendoring origin; compilation
still reads `src` only. `anima library update file.animl [--check]` refreshes existing vendored files
from local origins, preflighting before writes and rejecting network paths. See
[the library contract](../modules/markup-libraries/SPEC.md).

`<template name="press" params="target scale=0.92">…</template>` declares a template. Parameters
are names, separated by whitespace, with optional `=default` (a single whitespace-free value).
`<apply template="ui:press" target="icon"/>` substitutes `{target}` and `{scale}` in attribute
values and text, including keyframes. Application inserts the template's children exactly where
it occurs; the normal parent-content rules apply after expansion. Templates can apply templates
in their defining lexical scope. Substitution is literal, without evaluation or XML reparsing.
Templates and imports compile away completely; runtime `.ani` contains neither.

`compile(source, { file, resolve })` calls `resolve(path)` for source text. The path is normalised
relative to the importing file; URL file names use URL resolution. A resolver throws for unreadable
files. The compiler has no filesystem/network dependency. `compileAsync` accepts the same options
with a resolver returning text or a promise of text. Hosts own access policy: CLI reads relative
files, the playground reads only real paths within its project directory (the server's working
directory), and the optional browser markup-libraries module fetches URLs relative to the source document URL
(or the page's base URL for inline markup). The synchronous compiler remains usable without imports.

Additional error codes: `unknown-import` (missing resolver or unreadable file), `bad-import`
(non-library root), `import-cycle`, `unknown-name`, `missing-parameter`, `unknown-parameter`
(an undeclared placeholder or extra application attribute), `unused-parameter`,
`template-recursion`, `ambiguous-component`, and `components-unavailable`. Existing syntax, duplicate-name and placement
codes also apply. Diagnostics retain imported `file`, `line`, `column` positions; `related` is an
array of `{file?, line, column}` use/import positions. The CLI displays both origins and related
positions. The source map retains the imported file for loader diagnostics too.

`anima fmt` retains libraries, imports, templates, parameters and applications. `anima decompile`
recovers expanded markup only: it cannot recover imports, templates, parameter names or applications.

## Bind module

Declare `requires="bind"` on `<anima>` and import `@anima-format/web/bind` in browser hosts.
`<bind target="ring.trimEnd" value="progress"/>` compiles to
`bind: { "ring.stroke.trimEnd": "progress" }`. Both attributes are required; `target` uses
AniML animation address spelling and `value` is an expression exactly as specified in SPEC's
bind chapter. Repeat `<bind>` for multiple addresses; duplicate targets are `duplicate-name`.
For example, `<bind target="dot.fill" value="mix(#000, #fff, progress)"/>` binds a colour and
`<bind target="dot.visible" value="enabled"/>` binds a bool. Decompilation writes these forms
after listeners. Loader diagnostics map back to the expression attribute; their message gives
the character offset within the expression. The deprecated `from`/`map` attributes are rejected.
See `examples/progress.animl` for a continuously input-driven ring.
## Images and assets

With `requires="paint assets"`, declare `<asset name="photo" type="image" src="photo.png"/>`
at document level, then `<image id="photo" asset="photo" x0="0" y0="0" width="24"
height="24" fit="contain" align="center" sampling="bilinear"/>`. `src` maps to asset
`source`; other attributes retain their JSON spelling. Optional asset fields are `storage`,
`width`, `height`. Image `fit`/`align` replace SVG's combined `preserveAspectRatio`; there is
no input alias. Full layout and validation rules are in SPEC's paint and assets chapters.


## Components

With `requires="components"`, document-level `<component name="badge" grid="8" viewBox="…">`
contains ordinary inputs, nodes, timelines, layers, listeners and bindings. It compiles into
`components.badge` without a format/name wrapper. Components can also be declared in libraries;
`<instance id="badge" component="ui:badge"/>` resolves the imported name at build time. Referenced
library colours/glyphs are copied into the compiled component so it remains self-contained.

`<instance id="b1" component="badge" x="12" count="{unread}"/>` is an instance node. Ordinary
node attributes are unchanged; extra attributes are component input initializers, parsed as literal
numbers/bools or `{expression}` strings. Expressions additionally require `bind`. A literal example
is `count="3"`; bool inputs use `enabled="true"`. Unknown inputs are diagnosed at that attribute.
`speed="2"` and `paused="true"` control instance stepping. There is no automatic fit or viewBox clip.
The optional `nested` module adds `time="$t" fps="12"` and explicit `size="20 10" fit="contain"
align="right"`. A component may declare `<output name="done" value="count > 0"/>`; parent reads
use `badge.outputs.done`. Expanded decompilation may use a JSON-valued `outputs` attribute.
Inside a data model, `<component name="card" default="row"/>` declares the component property type;
`<instance id="badge" component="$card"/>` selects its live definition. The no-`grid` model property
is distinct from a component definition. See [nested controls](../modules/nested/SPEC.md).

Parent actions use dotted input paths (`set="b1.count=0"`, `fire="b1.pop"`,
`toggle="b1.enabled"`). `<bind target="b1.count" value="unread"/>` continuously drives an instance
input. `<listener on="b1.selected" set="unread=0"/>` and
`<on when="b1.selected" to="read"/>` react on the next parent step after a child emits `selected`.
Decompilation preserves components and input initializers, using ordinary local node/paint names
inside each definition; it cannot recover library imports/templates.

Input names equal to any instance node property are reserved (`reserved-input-name` at the input
declaration, with its line/column). This includes `x`, `y`, other transform attributes, `id`,
`type`, `component`, `inputs`, `opacity`, `visible`, `speed`, `paused` and installed module keys
such as `blend`, `mask` or `clip`. Instance properties keep their ordinary attribute and address;
rename a conflicting input, for example to `pos-x`. The registry's instance shape defines the set.


## Surface module

Declare `requires="surface"` in addition to the modules used by the node/paint. Browser markup
loads `@anima-format/web/surface` (which includes paint and `markup-surface`) alongside `markup`.
The optional registration-only `markup-surface` entry installs structural routing without a runtime.

`<slice x="0 2 6 8" y="0 2 6 8" width="16" height="16" modes="…"/>` is a child of an image,
group or instance and maps to `node.slice`. Cut lists are numbers. Optional `modes` is a row-major
list of `stretch`, `repeat` and `hidden`; omission defaults to stretch. The strict loader owns
cut ordering, bounds, count, mode count and supported node types, as specified in SPEC's surface
chapter. See `examples/slice.animl`.

`<feather paint="fill" inner="1" outer="2" offset="1 -2" enabled="true" space="local"/>` maps to
`node.fill.feather`; `paint="stroke"` selects `node.stroke.feather`. The selector defaults to fill.
The existing flat colour, gradient or image paint stays intact, regardless of child order.
An ordered `<fillPaint>` or `<strokePaint>` may contain `<feather …/>`; its paint is inferred from
the wrapper, and an explicit selector must match it. Duplicate objects at a target are
`duplicate-name`; a mismatched nested selector is `bad-attribute`. Empty `<feather/>` preserves
an explicitly authored default object. Decompilation emits these children, including empty and
disabled settings, without materialising defaults. See `examples/feather.animl`.

`<imagePaint asset="tile" image-width="8" image-height="8"/>` replaces the selected paint's colour
or gradient with an image paint; `paint` defaults to fill. Transform attributes are `image-x`,
`image-y`, `image-rotate`, `image-scale-x`, `image-scale-y`; `modulate` is a hex colour. Ordered
paints use these attributes directly on `<fillPaint type="image" …>` / `<strokePaint type="image" …>`.
Image paints additionally require assets and paint. Feathering's Gaussian model and SVG's
world-space limitation are specified in SPEC; this syntax makes no additional rendering promise.

Structural descriptors route a selected node key through an optional nested object path (for
example, fill → feather). Object shapes with an element name emit/consume child elements;
arrays whose items name an element remain repeated child elements. Other structural arrays and
tuples are scalar token lists, separated by whitespace or single commas. Their registry item
shapes determine number, boolean or string decoding, including positional tuple member types.
String tokens cannot contain whitespace or commas. Tuple arity, enums, ranges and minimum array
lengths are checked by the strict loader; diagnostics retain the attribute origin and item pointer.

## Motion authoring

With `requires="motion"`, timelines also accept `speed`, `quantize` (positive samples
per second) and `work="start end"`. States accept signed/zero speeds; transitions
accept either `exit="seconds"` or `exitFraction="fraction"`. Numeric left keys can use
`value-cubic(x1,value1,x2,value2)` and weight eases can use `elastic-in(a,p)` or
`elastic-in-out(a,p)`. All use the JSON names verbatim; semantics are in SPEC's motion
chapter. Nodes accept animatable `pivotX` and `pivotY` (falling back to `pivot`).

A node's typed data is declared with `<channel name="count" type="int" value="0"/>`
or `<channel name="label" type="string" value='"Hello world"'/>`. Types are `int`,
`uint`, `string`, `reference`; a reference's string value names an existing node.
Channel keys and pose values are addressed `dot.channels.label`; strings are quoted
JSON strings, entity-escaped where necessary in XML attributes. They always hold:
`<track target="dot.channels.label">0 "Ready"; 1 "Done"</track>`. Channel elements may
appear inside any node; they are metadata and add no painted child. Named machines
use `<machine name="accent"><layer name="tone" initial="idle">...</layer></machine>`;
top-level `<layer>` continues to define the default machine. See
[examples/motion.animl](../examples/motion.animl) for a complete source.

### Declarative clock controls

Motion states accept `hold="true"` or `time="phase * 1.2"` (the latter also requires `bind`).
Transitions accept `sync="true"` and `exitNext="step"` or `exitNext="loop"`.
`sync` transfers a clock between states playing the same timeline; `hold` freezes its entry
clock. A time expression owns the clock; after a synced entry it seeks only when its evaluated
value changes. `exitNext` finishes the current quantized interval before transitioning, with
overshoot carried to the target. It requires persistent input conditions, not time/trigger terms.
Exact boundaries, cancellation, event intervals, work areas, reduced motion and diagnostics
are normative in SPEC's **Declarative timeline control** subsection.

```xml
<state name="idle" play="turn" time="phase * 1.2">
  <on when="syncing" to="spin" sync="true"/>
</state>
<state name="spin" play="turn">
  <on when="!syncing" to="idle" exitNext="step" sync="true"/>
</state>
```

The complete sync button is [modules/motion/examples/sync.animl](../modules/motion/examples/sync.animl).

## Focus authoring

With `requires="focus"`, any node accepts a `<focus>` child. Its `enabled`, `pointer`,
`order`, `scope`, `edge`, `label` and `bounds` attributes match the JSON fields;
`enabled-input` names the bool input gating eligibility, and `tab-stops="true"`
opts the document into inner native Tab stops. `<listener on="focus|blur" target="id"
.../>` uses ordinary queued listener actions. See SPEC's focus chapter for traversal,
scopes, defaults, component-local ids and deterministic key commands.

## Machine fields and registry extension

With `requires="machine"`, state and transition attributes derive from the registry
(SPEC's machine chapter). Scalar fields keep their JSON names; `machineSeed` is an
`<anima>` attribute. Compound object, array and union fields use JSON-valued attributes, for example:

```xml
<on when="@after(0)" to="pop" change='{"input":"count","mode":"increased"}'/>
```

The same registry extension supports module fields on `<layer>`, `<timeline>` and
`<listener>`, honors `markup` aliases, and round-trips compound JSON values. Existing
listener name lists and assignments retain their forms. Unknown fields still report
`unknown-attribute`; malformed JSON attributes report `bad-attribute` with source position.

## Input listener forms

The input module extends `<listener on="…">` with `button`, `capture`, `consume`, `key`,
`modifiers`, `index`, `control`, `mapping`, `phase`, `align` and `write`. Names and meaning are in
[the input contract](../modules/input/SPEC.md). The generic live-registry path handles every
attribute, including `write='{"x":"dragX","y":"dragY"}'`. Compound fields use JSON and normal XML
escaping; `write="x=dragX"` is not a JSON-valued map. Combine input event names in `on` with `|`.
Existing `set`, `fire`, and `toggle` keep their assignment/name-list forms. An empty `set=""`
represents the valid empty action map; write-only input listeners normalize to that map.

Node module fields without an `element` descriptor use JSON-valued attributes for object/map/
union values. Fields with an `element` descriptor retain structural children: `<focus>` and
its aliases (`enabled-input`, `tab-stops`) round-trip through that existing registry path.
Unknown fields still fail. No input-specific compile/decompile hook is installed.

## Event definitions (`events`)

With `requires="events"`, root `<event-def name="…" payload='{"n":{"type":"number","input":"count"}}'/>`
declares typed payload fields. Optional url/target/audio/volume attributes map directly to the
JSON definition. Payload is a JSON object encoded in a normal XML attribute; the compiler and
decompiler preserve its structure. `<audio-volume asset="tone" value="0.5"/>` supplies a
resource gain. Timeline `<event at="0.5" name="…"/>`, state emit and listener emit are unchanged.
Local listeners use `on="event:name"`; component listeners keep their scoped event names.

State `endEmit="name"` and transition `<on startEmit="name" endEmit="name" .../>` report
named events at state exit, transition start and successful transition completion. Payloads and
host effects use the same event definitions. Interrupted transition end actions do not run.

## Input expressions in actions and conditions (`bind`)

With `requires="bind"`, listener assignments accept expressions:
`<listener on="click" set="count=count+1 previous=count" fire="pulse"/>`.
Finite numeric and bool literals keep their 0.1 meaning. Spaces and commas inside expressions
are retained; whitespace followed by `name=` starts the next assignment. All assignments in one
action read the same pre-action input snapshot when the queued action runs, then numeric results
clamp to the target bounds. Separate actions see earlier writes. Bool targets require bool results;
number targets also accept bools as 0/1. Colour results cannot be assigned to bool/number inputs.

The existing bind grammar adds `floor(x)` and `mod(a,b)` (SPEC bind chapter). Arithmetic comparisons
work on either side of a condition operator, for example
`when="count > 0 and mod(count, 5) == 0"`; legacy conditions retain their type rules.
State `entry`/`exit` and transition `actions` use JSON attributes with the listener action keys:
`<state name="idle" entry='{"set":{"count":0}}'>` and
`<on when="tap" to="playing" actions='{"set":{"count":"count+1"}}'/>`.
Bind-only blocks require bind and run immediately in SPEC §7/§bind order. With `machine`
declared, transition `actions` instead follow the queued machine-module order; machine
`enterActions`/`exitActions`/`endActions` use the same expression contract (SPEC §bind).

Typed event payload fields use the existing JSON payload attribute:
`payload='{"count":{"type":"number","value":"{count}"}}'`.
Number/bool/color expression fields require bind and resolve at event reporting after state
resolution and bindings, as existing input payload fields do. String fields keep literal braces.
Examples and executable evidence: `modules/events/examples/share.animl` and `share-evidence/`.

## Data models and binding modes

The optional data forms and their exact JSON equivalents are normative in
[modules/data/SPEC.md](../modules/data/SPEC.md). Root `<model>` and named `<instance model="…">`
children declare models and values; node `<instance id="…" component="…" data="main">` remains
a placement. Components declare public data with `data="Player"`. All model property types use
named typed child elements. Compound initial values use JSON in `<set path="…" value="…"/>`.
A root `data` JSON attribute retains model/preview metadata; it is merged with child declarations.
Custom `data-label="x"` maps to node `properties.label`; canonical output uses the `properties`
JSON attribute. `<bind>` adds `mode`, `prefer`, `convert`, `options`. Listener `copy` and `value`
are generic registry attributes; `$` paths are allowed in assignment keys and trigger lists.
See modules/data/examples/scoreboard.animl and the per-row conformance sources.


With `data motion`, tracks also accept `<key t="0.5" value="$peak" ease="linear"/>` elements.
`t` and `value` are required; `ease` is optional. Do not mix elements and text within a track.
The equivalent text key is `0.5 "$peak" linear`; canonical decompilation can use that form.
The motion registry owns the key element; data sampling semantics are specified in modules/data/SPEC.md.
