# P5 design: reuse, components, binding, assets

Decided by the orchestrator (2026-11-06) from the owner's direction (a smaller, agent-native Rive;
reuse is the main authoring friction) and the P4a benchmark (no continuous input → value binding).
Coders implement this; a needed deviation is raised with its reason before it is built.

## 1. Two kinds of reuse

| Need | Mechanism | When it resolves |
|---|---|---|
| The same hover/press layer, colours, eases or glyph in many icons | **AniML libraries and templates** (§2) | at build time: `.ani` stays self-contained, the runtime pays nothing |
| A part with its own inputs and state machine, placed several times (a badge, a toggle, a list row) | **Components** (§3), feature `components` | at runtime: each instance has its own player state |
| A value that follows an input continuously (progress → ring) | **Bindings** (§4), feature `bind` | every step, after the state machine |

## 2. AniML libraries and templates (markup only)

- A library is an `.animl` file with root `<library name="ui">` holding `<color>`, `<glyph>`,
  `<ease>`, `<component>` (§3) and `<template>` elements.
- A document imports it: `<import src="ui.animl" as="ui"/>` (path relative to the importing file;
  in the browser module, a URL). Imported names are used as `ui:press` / `ui:sparkle`.
- A template is parameterised markup: `<template name="press" params="target scale-to">` … uses
  `{target}`, `{scale-to}` in attribute values … `</template>`; applied with
  `<apply template="ui:press" target="icon" scale-to="0.92"/>` wherever its content is allowed
  (layers, nodes, listeners, timelines). Parameters may have defaults (`params="target scale-to=0.92"`).
- `anima build` expands everything: the `.ani` output has no imports or templates. Diagnostics point
  into the file where the problem is (imported file and line), plus the `<apply>`/`<import>` site.
  `anima decompile` cannot recover templates (documented).
- Cycles, unknown imports, unknown names, missing parameters and unused parameters are diagnostics.

## 3. Components (`requires: ["components"]`)

- `.ani`: `components: { <name>: { grid, viewBox?, inputs, nodes, timelines, machine, listeners?,
  colors?, glyphs?, a11y? } }` — a nested document. AniML: `<component name="badge" grid="8">…
  </component>` at document level or in a library.
- Instance node: `{ id, type: "instance", component: "<name>", x, y, scale…, inputs: { <input>:
  <literal or binding §4> }, speed?: number, paused?: bool }` — a node like any other (transform,
  opacity, visibility animatable; may be clipped/masked/blended). AniML: `<instance id="b1"
  component="badge" x="12" y="2" count="{unread}"/>` (component inputs as attributes).
- Each instance runs its component's player: own inputs, states, timelines; stepped with the
  parent's step (× speed; not stepped when paused or invisible-and-settled). Pointer events reach
  an instance's listeners in its local coordinates; its events bubble to the parent as
  `<instanceId>.<event>` (listeners and transitions can react to them).
- The parent can write an instance's inputs: addresses `<instanceId>.<input>` in listener actions
  (`set="b1.count=0"`, `fire="b1.pop"`) and bindings.
- Nesting depth limit and instance count limit (diagnostics); no recursion.
- Draw layer: an instance contributes a group whose children are the component's draw tree with
  the instance's transform; ids are scoped (`b1/dot`).

## 4. Bindings (`requires: ["bind"]`)

- `.ani`: `bind: { "<address>": "<expression>" }` at document (and component) level. AniML:
  `<bind target="ring.trimEnd" value="progress"/>`, or in an instance's input attribute
  `count="{unread}"`.
- Expressions: input names, number literals, `+ - * /`, parentheses, `min(a,b)`, `max(a,b)`,
  `clamp(x,lo,hi)`, `mix(a,b,t)`, and a bool input as 0/1; colours: `mix(#hex,#hex,t)`. Nothing else
  (no strings, no calls beyond these). Type-checked at load (`bind-type`), unknown names
  (`unknown-input`), cycles (`bind-cycle`).
- Step order (spec §7): bindings are evaluated after the state machine has resolved values and
  before clamping, overriding them; a bound address is reported by `anima inspect` as "bound".
- A binding that targets a component input is how a parent drives an instance continuously.
- This is the P4a benchmark fix: `<bind target="ring.trimEnd" value="progress"/>`. P4e (`data`)
  later generalises the source (view models) without changing this form.

## 5. Assets (`requires: ["assets"]`)

- `.ani`: `assets: { <name>: { type: "image" | "font" | "audio" | "blob", source: "<data: URI or
  relative URL>", storage?: "embedded" | "referenced", width?, height? } }`.
- `image` node (`paint` module, needs `assets`): `{ type: "image", asset, x0, y0, width, height,
  fit: contain | cover | fill | none | scale-down | fit-width | fit-height, align, sampling:
  bilinear | nearest }`.
- Web: referenced assets load relative to the document URL; `icon.assets = (name, info) =>
  url | Blob | Promise<…>` lets the host resolve or replace them; `anima:error` on a failed load.
  CLI: `anima build --embed` inlines referenced assets as data URIs; `anima render` loads them.
- Fonts and audio are declared now and used by P6 (text) and P4d (audio events).

## 6. Order of work and ownership

1. `bind` (small; core step-order hook + module) — first, both §3 and the benchmark need it.
2. `components` (core player nesting + module + draw layer instance group) — after `bind`.
3. AniML libraries/templates (markup package + CLI + playground) — parallel to 1–2.
4. `assets` + `image` node — parallel to 2 (separate module files; draw layer gets an `image`
   geometry kind).
5. Then n-slice, feathering and image paints (rows moved to P5), and the P5 benchmark (brief: a
   toolbar of three Glyphy icons sharing one hover/press template and a badge component bound to
   an `unread` count).
