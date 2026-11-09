# Features

Anima's base runtime is deliberately small. Everything beyond shapes, paths, timelines, states,
inputs and listeners is an optional **feature**: a scene lists what it uses in `requires`, and the
page loads only those modules. A scene whose feature isn't loaded fails with `unknown-feature`
instead of drawing the wrong thing; the hint names the import to add.

```xml
<anima version="0.1" name="card" grid="24" requires="paint text layout">
```

```html
<script type="module" src="anima-icon.js"></script>   <!-- base runtime, always first -->
<script type="module" src="anima-paint.js"></script>  <!-- one file per entry… -->
```

```sh
npx anima bundle --modules paint,text,layout -o anima.js   # …or one bundle with just these
```

With npm-style imports, each entry is `@anima-format/web/<entry>`. `@anima-format/web/<feature>`
also works, so the hint's import is always valid.

## How to read the tables

- **Feature** is the name you write in `requires`.
- **Entry** is the browser module you load: `anima-<entry>.js` in `packages/web/dist/`, or
  `--modules <entry>` for `anima bundle`. Entries in the same row are split for size; load the
  extra ones only when you use what they hold. An extra entry imports the one it builds on, so
  loading `text-input-extra` also loads `text-input`.
- **Budget** is the most the entry may add, min+gzip, enforced by `node tools/size.ts`. Real sizes
  are usually lower. *Heavy* entries are larger, Rive-class capabilities that stay out of the
  typical app-UI page.
- Each feature's normative chapter is `npx anima docs <feature>` (or the module name). It includes
  the spec chapter, the module's own notes and a list of example files.

Some web entries have no `requires` feature because they don't change the document format. They
change how the page runs it (canvas rendering, focus overlay, host APIs). You load them when you
want that behaviour.

## Base runtime

`anima-icon.js` (`@anima-format/web`), about 23 KB min+gzip, owner ceiling 24 KB.

What's included without any module:
- **Shapes:** paths (including Glyphy glyphs), rects, circles, arcs and groups, with fills and strokes.
- **Animation:** transforms and opacity, timelines with eases, state machine layers with poses and blends.
- **Inputs:** bool, number and trigger inputs, with pointer listeners.
- **Page integration:** colour slots themed from CSS, `knockout` cut-outs, a document-level `a11y`
  role (button, switch, checkbox…), reduced motion, and a frame loop that sleeps when nothing moves.

## Drawing

| Feature | What it adds | Entry (budget, B) |
|---|---|---|
| `paint` | Gradients, dashes, stroke trims, ellipses, polygons, stars, triangles, rect corner radii, path morphing, fixed-width strokes | `paint` (4,416); `paint-sampling` (1,216) for image sampling |
| `corners` | Rect corner radii alone, without the rest of `paint` | `corners` (1,024) |
| `composite` | Blend modes, masks, clips, several ordered paints per shape, stroke position, sibling draw order | `composite` (4,160) |
| `contour` | Authoring geometry: contours with per-vertex curvature and path operations | `contour` (3,840) |
| `mix` | Refined compositing on top of `composite` | `mix` (1,856) |
| `colormix` | A colour that blends two slots or colours by an animatable weight (`<colorMix>`) | `colormix` (3,072) |
| `surface` | Image paints, nine-patch slicing, paint feathering | `surface` (8,192) |
| `componentpaint` | A live component used as a repeating paint | `componentpaint` (2,176) |
| — | Canvas2D renderer instead of SVG (`renderer="canvas"`) | `canvas` (5,888, heavy) |

## Motion and interaction

| Feature | What it adds | Entry (budget, B) |
|---|---|---|
| `motion` | Typed and string tracks, seek, reverse, work areas, quantised time, timeline control | `motion` (6,528) |
| `machine` | Blend states, transition options, random and any-state transitions, layer actions | `machine` (6,720) |
| `input` | Drag, keyboard, scroll, gamepad and capture listeners | `input` (7,104) |
| `focus` | Focus targets, traversal order, scopes, pointer focus, focus/blur listeners | `focus` (3,456) |
| `events` | Typed event payloads, URL events (opt-in), audio events, lifecycle events | `events` (3,264) |

## Data

| Feature | What it adds | Entry (budget, B) |
|---|---|---|
| `bind` | Bindings from inputs to properties, with expressions (`<`, `==`, `and`, `not`, arithmetic) | `bind` (2,048) |
| `data` | View models, typed properties, `$` paths, binding directions, data-writing listeners | `data` (7,040) |
| `convert` | Converters: number formats, ranges, string templates, chains | `convert` (6,464) |
| `derive` | Computed, read-only model properties | `derive` (2,624) |
| `lists` | Repeats over list data, with nested data contexts and stable identity | `lists` (5,120) |
| `host` | Page scripting of scene data: typed handles, reflection, instances | `host` (3,968) |
| `hostvalues` | Reading resolved values from the page | `host-values` (1,344) |
| `datahost` | Read-only computed geometry and nested model paths for the page | `data-host` (1,088) |
| `hostedit` | Editing scene data from the page: list mutation, defaults, validation | `host-edit` (4,032) |

## Structure, assets and layout

| Feature | What it adds | Entry (budget, B) |
|---|---|---|
| `components` | Named reusable components, instances with their own inputs, libraries | `components` (3,456) |
| `nested` | Nested component instances with their own state machines and events | `nested` (5,056) |
| `dataartboard` | Bindable artboards: data chooses which component an instance shows | `data-artboard` (1,024); `data-artboard-values` (1,536) |
| `assets` | Images and an asset catalog (sources resolved against the document URL) | `assets` (1,984; includes `assetio`, 768) |
| `media` | Raw bytes of audio and blob assets for page code (`icon.asset(name)`) | `media` (3,072) |
| `layout` | Single-line row/column layout: hug, fill, fixed, min/max, gap, padding, alignment | `layout` (4,096; includes `layout-svg`, 256); `layout-reflow` (1,024) to animate reflow |
| — | `fit` and `alignment` on `<anima-icon>`, scene size from the page | `host-fit` (768; includes `host-fit-size`, 512) |

## Text

| Feature | What it adds | Entry (budget, B) |
|---|---|---|
| `text` | Styled, data-bound text runs, browser shaping, wrapping, overflow and fitting | `text` (6,144); `text-overflow` (768), `text-hit` (1,024), `text-host` (1,024); `text-canvas` (768, heavy) on canvas |
| `fonts` | Declared fonts loaded with `FontFace`, per-player assignment | `fonts` (2,048); `fonts-text` (896), `fonts-options` (4,096); `fonts-info` (8,192, heavy) for metrics and glyph paths |
| `texteffects` | Per-glyph, word or line effects: offset, rotation, scale, opacity, follow-path, backgrounds | `text-effects` (4,096) |
| `textinput` | Editable text fields backed by a native input: caret, selection, IME, password, clipboard | `text-input` (4,544, heavy); `text-input-extra` (caret blink, scroll to caret), `text-input-svg`, `text-input-clipboard`, `text-input-canvas` |

## Accessibility

| Feature | What it adds | Entry (budget, B) |
|---|---|---|
| `a11y` | A semantic tree: roles, labels, values and states on nodes | `a11y` (2,496); `a11y-text` (576); `a11y-bounds` (4,096) for painted bounds |
| `a11yactions` | Semantic actions (activate, increase, decrease, focus) | `a11y-actions` (1,216) |
| — | Real DOM elements over the drawing, so screen readers and keyboards reach each control | `a11y-dom` (2,176); `a11y-navigation` (1,536) for toolbar and grid arrow-key roving |

## Authoring in the browser

`.ani` (JSON) needs no compiler. To load AniML (`.animl`, or inline `application/vnd.anima+xml`)
directly in the page, add the compiler: `markup` (8,192). Each feature's AniML spelling is a small
companion entry, such as `markup-paint`, `markup-text` or `markup-layout`. `markup-animation` adds
the text track syntax. `devtools` adds inspection helpers. These stay out of production bundles:
compile with `anima build` instead.

## In progress: rigging (P8)

Bones, constraints, IK, skinning, meshes, pose pads, path following and scroll constraints are being
built as heavy modules (`rig`, `ik`, `skin`, `mesh`, `posepad`, `pathfollow`, `scroll`) on the
`p8-rigging` branch, which holds the design in `design/p8/DESIGN.md`.

## Size gates

The owner's ceilings (min+gzip), checked on every pull request by `node tools/size.ts`:

| Gate | Ceiling | Now |
|---|---:|---:|
| Base runtime (core + web) | 24 KB | 22.8 KB |
| Any single scene's full bundle | 64 KB | 57.8 KB |
| The app-UI reference page (text, layout, data, a11y, …) | 128 KB | 108 KB |
| All runtime modules together | 160 KB | 136 KB |
| Authoring add-on | 16 KB | 15.0 KB |
| Rive-class (everything, heavy modules included) | 250 KB | 156 KB |
