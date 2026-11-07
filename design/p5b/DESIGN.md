# P5b design: lists, contexts, asset pipelines, host data editing

Decided by the orchestrator (2026-11-06) for the 112 P5b parity rows. Coders implement it; a needed
deviation is raised with its reason before it is built. Everything from 0.1–P4e keeps working.

## 0. Scope moves (rows that wait for a later consumer)

| Rows | To | Why |
|---|---|---|
| `assets.font`, `font-formats`, `font-glyphs-*`, `google-font-import`, `host-decode-font`, `replacement-scope-font`, `host-api.data-font`, `data.host-font` | P6 | fonts only matter once text renders |
| `assets.image-encoding-astc`, `-bc7`, `-etc2rgba`, `host-api.wasm-url` | P10 | GPU texture formats and backend loaders |
| `components.layout-size`, `components.list-layout-inheritance` | P7 | layout |
| `components.script-instance`, `assets.script-blob` | P9 | scripting |
| `assets.psd-layers` | later | binary PSD parsing for raster layers; little value for icons |

## 1. Modules and budgets

| Module | Holds | Budget |
|---|---|---:|
| `lists` (new) | repeated components over a data list, per-item data context, `$index`, `$parent`, model→component maps, item size | 6 KB |
| `host-edit` (new) | host API editing beyond §7 of P4e: list mutation, instance management, default/global instances, colour/enum helpers, image replacement, component-instance handles, document cache, `ready` preload | 4 KB |
| `assets` (existing, 1 521 / 2 048 B) | audio and blob loading, audio clips, loader metadata, fetch policy | split into `media` if it would pass 2 KB |
| `paint` / `canvas` (existing) | image sampling: filter and wrap | within budgets |
| CLI (`anima build`, no size limit) | asset import, sniffing, encoding, SVG and Lottie import, export exclusion | — |
| `components` (existing, 3 184 / 4 096 B), `data`, `convert`, `motion` | wave 2 extras (§6, §7) | split before raising |

**Ceiling:** the full-featured page was 93.6 KB of 100 KB at the start of P5b; after lists and host-edit
(100.5 KB) the owner raised the ceiling to 128 KB (2026-11-06). Keep runtime additions lean anyway.
`bind` (2 048 / 2 048 B) and `host` (4 042 / 4 096 B) are full: P5b work goes into new modules, not
into them.

## 2. Lists and data contexts (`lists`)

```xml
<model name="Player"> <string name="name"/> <number name="score"/> </model>
<model name="Board"> <list name="players" of="Player"/> </model>
<component name="row" grid="30" data="Player">   <!-- the component's data context is one Player -->
  <rect id="bar" x0="0" y0="0" width="0" height="2"/>
  <bind target="bar.width" value="$score / 100"/>  <!-- $score = this item's score -->
</component>
<repeat id="rows" list="$players" component="row" dy="5"/>  <!-- one instance per item -->
```

- `<repeat>` (`.ani`: node `{type: "repeat", list, component, dx?, dy?, size?}`) places one instance
  per list item, offset by `(dx, dy)` × index, and keeps instances matched to items by identity:
  inserting, removing or swapping items moves instances, it does not rebuild them (players and
  their state survive).
- `component` may be a map from model name to component (`component="Player:row Header:header"`,
  `.ani` `{Player: "row", Header: "header"}`) for lists of mixed models (`list-map`). An item whose
  model has no entry is a diagnostic at load when the list's model is known, else skipped at run
  time with a recorded warning.
- `size="w h"` overrides each generated instance's bounds (`list-size-override`).
- Inside a component bound to data (`data="Model"`, a repeat item, or an explicit
  `<instance data="$team">`), `$name` resolves in that context (**explicit context**). A component
  without `data` sees its parent's context (**inherited context**).
- `$index` is the item's index in its list (read-only number). `$parent.name` resolves one context
  up, `$parent.parent.name` two (**relative binding**). `index` and `parent` are reserved property
  names: declaring one is `reserved-name`.
- `number-to-list` (convert) feeds a repeat: `<repeat count="$stars" component="star" dx="2"/>`
  repeats N instances without a data list; identity is the index.

## 3. Host data editing (`host-edit`)

Extends `icon.data` / `player.data` when loaded (P4e's `host` keeps working alone):
- lists: `list(path).add(values?)`, `.insert(index, values?)`, `.remove(index | item)`, `.swap(a, b)`,
  `.length`, `.at(index)` returning a nested handle; changes notify like other writes, after the step;
- instances: `defaultInstance()`, `instance(name)`, `setGlobal(name, instance)`;
- typed helpers: `color(path).rgba`, `.hex`, `.set([r, g, b, a])`; `enum(path).values`, `.index`;
- assets: `image(path).set(assetName | url | Blob)` replaces the image the property points at;
- component instances: `icon.instance(id)` returns the nested player handle (its own `data`,
  `set`, `fire`), and `<anima-icon component="name">` shows a named component as the root;
- `AnimaIcon.ready` (promise: runtime and modules registered) and a document cache keyed by URL,
  so two icons with the same `src` parse and decode once.

## 4. Assets

Runtime (`assets`):
- `audio` assets load through the same resolver as images; `<asset type="audio" … start="0.2"
  end="0.9"/>` declares a clip of a source (`audio-clip`); events play clips.
- `blob` assets load as `ArrayBuffer` and are readable by the host (`icon.asset(name)`).
- `icon.assetPolicy = 'local' | 'any'` (default `'local'`: same-origin and data URIs only; external
  URLs need `'any'` or a resolver) — the CDN-policy rows.
- Loader metadata: the resolver's `info` gains `{type, source, size?, mime?}`.

Image sampling (`paint`, SVG + canvas): `<image … sampling="nearest|bilinear" wrap="clamp|repeat|mirror"
wrap-x=… wrap-y=…>` and `fit="resize"` (stretch to bounds). SVG: nearest via
`image-rendering: pixelated`, repeat/mirror via patterns; where SVG has no faithful form, report
`unsupported-render` with the reason.

Build (`anima build`, CLI):
- sniff and validate PNG/JPEG/WebP/WAV/MP3/FLAC sources (magic bytes, dimensions, duration);
  mismatches are diagnostics;
- `encode="png|jpeg|webp" quality=…` re-encodes images at build time; PNG in-process, JPEG/WebP via the
  cached headless Chromium canvas; without a browser, `build-encoder-unavailable` with a hint;
- `export="false"` excludes an asset from the built `.ani` (host supplies it at run time);
- `anima import file.svg` → AniML (paths, groups, fills, strokes, gradients, transforms; unsupported
  SVG features listed as warnings);
- `anima import file.json` (Lottie) → AniML for the common subset: shape layers, groups, fills,
  strokes, transforms, keyframes and easing, trim paths; every unsupported feature is a warning with
  its Lottie path. Never silently dropped.

## 5. Order of work

Wave 1 (parallel, disjoint files):
1. `lists` + data contexts (§2) — owns `modules/lists`, may add hooks to `components` and `data`.
2. `host-edit` (§3) — owns `modules/host-edit`; uses `host`/`data` exports only.
3. assets (§4) — owns `modules/assets`, image sampling in `paint`/`canvas`, the CLI build/import.
4. P4e follow-up: fresh Rive captures for `derive` and bind comparisons (CLI 1.9.1).

Wave 2 (after wave 1 merges):
5. data extras (§6) and 6. components extras (§7), then the benchmark (§8).

## 6. Data extras (wave 2)

Typed literals in guards: `$mood == "happy"`, `$tint == #d97757`, `$avatar == asset("photo")`,
`$card == component("row")`, `$ready == true`; trigger guards stay `when="$levelUp"`. Colour
formatting markers: `pattern="{h} {s}% {l}%"` with `{r} {g} {b} {a} {h} {s} {l} {hex}`. Trigger
destinations: a binding whose target is a trigger fires it when the converted value changes.
`<key t="0.5" value="$peak"/>` keyframe values from data (`bind-keyframes`, motion). `export="true"`
on an instance lists it for hosts. A `component` property type holding a component name, used by
`<instance component="$card"/>` (`property-artboard`).

## 7. Components extras (wave 2)

Nested time: `<instance time="$t" fps="12">` remaps and quantizes a child's clock. `fit`/`align` on
an instance fit the child's viewBox into `size` (`leaf-fit`). Component outputs: `<output
name="done" value="…"/>` in a component, readable by the parent as `badge.outputs.done` (read-only).
Library export selection, library data definitions and `anima library update` for vendored
libraries. `paint="component:row"`: a live component render as a fill (`paint-artboard`).

## 8. Benchmark brief (P5b)

A playlist: a list of tracks drawn by a repeated row component (cover image with nearest sampling,
title bar, duration bar), the host adds/removes/reorders tracks, clicking a row plays its audio clip
and highlights it, and a counter of tracks is derived from the list.
