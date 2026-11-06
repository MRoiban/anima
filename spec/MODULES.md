# Anima modules (draft for 0.2)

Status: design for P4 onward; normative once the first module ships. Format 0.1 (`spec/SPEC.md`) is
unchanged: a document without `requires` is a 0.1 document and every 0.1 runtime plays it.

## 1. What a module is

A module adds format features — node types, keys on existing objects, paint kinds, timeline or
state-machine constructs — behind one feature name. A document that uses any of them lists the name
in `requires`; a runtime that lacks the module refuses the document with `unknown-feature` (spec
§11.3), exactly as 0.1 already does for unknown names.

| Feature | Module | Phase |
|---|---|---|
| `paint` | gradients, dashes, shapes, corner radii, path morphing, fixed stroke | P4a |
| `composite` | blend modes, masks, clips, multiple paints, stroke position, draw order, paint visibility | P4a |
| `bind` | bindings: an address follows an expression of inputs every step (P5; `design/p5/DESIGN.md` §4) | P5 |
| `components` | components and instances with their own inputs and state machines (P5, §3) | P5 |
| `surface` | image paints, n-slice patches, feathering (8192 B budget) | P5 |
| `assets` | image, font, audio and blob assets; the `image` node (P5, §5) | P5 |
| `motion` | more eases, typed and string tracks, seek / reverse / work area / quantize, host timeline control, animatable pivot | P4b |
| `interaction` | blend states, transition flags, drag, keyboard, focus, scroll, gamepad | P4c |
| `events` | event payloads, open-URL events, audio events | P4d |
| `data` | view models, bindings, converters, lists | P4e |

Feature names are lower-case words. A module may add later versions of itself as `paint@2`; a
runtime that has `paint@2` also accepts `paint`.

## 2. One registry, still

Every key a module adds is a registry entry (`packages/core/src/registry.ts` shapes and props) with
both spellings (`markup` names where SVG has them), so the JSON Schema, AniML, `anima schema`, the
loader and the formatter keep deriving from one place. A module's entries carry `feature: '<name>'`.

- **Declared use.** Using a key whose entry has a `feature` that the document does not list in
  `requires` is an error: `undeclared-feature`, pointer at the key, hint
  `add "<name>" to "requires"`. (In AniML: `requires="paint"` on `<anima>`.) This keeps a 0.1
  runtime's refusal honest: a document never relies on a module silently.
- **Schema.** The JSON Schema includes module keys; `anima schema <type>` marks them with their
  feature.

## 3. Where the code lives

Each optional module has one source folder at the repository root:

```
modules/<name>/
  manifest.ts           tooling metadata; named `after` export for runtime ordering
  core/index.ts         registry entries and pure loader/player/draw hooks (when applicable)
  core/svg.ts           SVG backend (when applicable)
  markup/index.ts       compiler forms/hooks not expressible by registry descriptors
  web/index.ts          optional browser registration
  web/markup.ts         optional registration-only markup entry (when applicable)
  test/<package>/       core, markup, web and CLI tests owned by this module
```

Paint, composite, bind, assets, components and surface follow this layout. Bind needs no SVG
backend; assets/composite/surface supply structural AniML forms through their core descriptors and
share paint's structural engine. Markup-libraries owns its markup expansion, async resolver, hook
slots, web entry and tests in the same layout. The shared markup browser entry has a small manifest
under `modules/markup/`; the base compiler/parser remain in `packages/markup`.

The default manifest export declares:

- `name` and `after`: ordering constraints among installed module manifests. Runtime `after` orders
  only the modules present; it does not import another module. The current chain preserves the P5
  execution order: components → bind → assets → paint → composite → surface. This also puts surface
  after the paint refinements and nested drawing hooks it extends.
- `core`: implementation entry/export and optional SVG entry/export.
- `web`: browser entry names, byte budgets, optional measurement base (`over`) and heavy-class flag.
  Registration-only markup entries have separate hook budgets. `sizeOrder` preserves the existing
  aggregate measurement import order; `buildOrder` preserves the browser worker lane assignments; new entries may omit it and follow the existing entries.
- `adapters` and `exports`: package source adapter paths mapped to local implementations, and public
  package subpaths. These preserve all existing `@anima-format/{core,markup,web}` imports, including
  internal compatibility paths. The adapters contain no implementation or runtime dependencies.
- `markupHook`: optional typed compiler slot and implementation exports. Descriptor-only modules
  need no additional hook slot.
- `tests`, `conformance`, `docs`: explicit test globs, conformance case-name prefixes and docs files.
  Test ownership includes shared markup registry/corpus integration tests where needed; browser
  ownership is explicit and never inferred from mentions/imports of other modules.

`node tools/modules.ts` discovers manifests, validates dependencies, and generates core/all,
package adapters/exports, browser build entries, size tables, compiler hook registration and test
scope tables. `--check` is part of `npm run check` and fails without writing when wiring is stale.
Generated files are committed, but never edited by hand. A new module requires additions only under
its folder plus generator output; `tools/modules.test.ts` proves this in a temporary repository.
No shared hand-written index changes are needed. Existing source package exports remain the
repository's development API; package publishing is still deferred (all packages are private).

Core registration composes the base tables plus the complete declared module set in dependency
order, with lexical ordering of simultaneously ready modules. Exported table/map identities stay
stable for separately bundled browser entries. Recomposition rebuilds cached node shapes and applies
wildcard contributions to the final node set, so a late node receives earlier modules' fields without
recursive replay inside `applyEntry`. Initializers can run again during recomposition and must keep
registration setup idempotent. Duplicate registration by name remains a no-op. Runtime dependency
cycles throw before changing the active registry; manifest cycles and missing dependencies fail the
generator. `packages/core/test/module-order.test.ts` exercises 12 arrival orders (all permutations of
components/paint/assets with the other modules before and after), comparing JSON Schema, CLI schema
output, loaded models and snapshots for every example/conformance document, and corpus AniML output.

Tooling (`core/all`, CLI, playground and conformance runner) registers the entire generated module
set. Browser builds load only explicit imports. The layout changes no document syntax or semantics. The single-source registry/generation principle
continues the existing design rationale in `docs/research/rive-format-and-graph.md` (generated type
metadata); no Rive implementation or file conversion is involved.

Hook points (revised at P4a, owner decision 2026-11-06: rendering is renderer-neutral):

- `registerModule(m: Module)` in core; `Module = { name, entries, load?, model?, value?,
  interpolate?, outline?, resolve?, draw? }`.
- `load(model, raw, diag)`: validate and compile the module's keys after the core loader.
- `model` / `value` / `interpolate`: new animatable value kinds use the player's existing slots and
  sampling; a module declares their value type and default.
- `outline(player, node)`: the node's current outline for hit testing.
- `draw`: the module's contribution to the **draw layer** (§3.1). Modules never produce SVG
  elements, attributes or canvas calls.

### 3.1 The draw layer

Between the player and every renderer sits one renderer-neutral description of what to draw:

- **Draw tree** (static per document, built once at load): one entry per drawn node — a group
  (children, isolation for masks/blends), or a shape — plus the document's shared resources
  (gradients, mask and clip sources) referenced by id. Built by core for 0.1 nodes and extended by
  each module's `draw.tree` hook.
- **Draw frame** (per frame, from the player): for every entry its resolved values — local
  transform, opacity, visibility; geometry (`path` data, or a primitive `circle` / `rect` /
  `ellipse` the backend may draw natively); paints in order (fill or stroke; solid colour or
  colour slot, linear / radial gradient with resolved stops; width, cap, join, dash array and
  offset in grid units, trim, position); clip and mask references with their mode; blend mode.
  Module `draw.frame` hooks fill in what they own. Unchanged entries are reported unchanged, so a
  retained backend diffs cheaply.
- **Backends** turn draw data into output: the **SVG backend** (retained DOM in `<anima-icon>`,
  and `toSVG` for static output — the default for icons and the only one in core + web), and the
  **canvas backend** (optional module, `@anima-format/web/canvas`, needed for rigging, meshes and
  large scenes). A backend may decline a feature it cannot draw faithfully by reporting
  `unsupported-render` with the feature name; conformance renders every case in every backend and
  compares pixels within a tolerance.

The SVG backend keeps the retained-SVG rules (docs/ARCHITECTURE.md): transforms on `<g>` wrappers
only, attributes always present, masks attached for the document's life. The draw layer must not
grow core + web for icon documents: `tools/size.ts` measures it.

### Backend contract and Canvas2D seam

`drawTree(model)` returns the document's stable `DrawTree`, built after successful load validation.
`nodes` is indexed by document node index, with `parent`, `children` and `roots` in authored order.
Each entry declares group/geometry kind, knockout radius and optional compositing references;
`resources` identifies shared gradients and mask/clip sources by node index and paint key.
A knockout isolates the preceding siblings in its parent list; its source geometry cuts those
siblings with the specified stroke expansion. Blend/mask groups preserve that isolation.

`drawFrame(player)` returns a cached `DrawFrame` with `revision`, `tree`, `viewBox`, `nodes` and
`changed` indices. A frame is a live view: its arrays update on the next resolved revision.
Unchanged node records retain object identity. `changed` describes that revision's potentially
changed entries (static dependency lists include spatial source/ancestor changes); a consumer remembers
`revision` and ignores a repeated revision. It does not drain `Player.takeDirty()`.
`DrawNode` supplies local affine `transform`, opacity, visibility, geometry and ordered paints.
Compositing adds world matrices, source indices, mask mode/sourceDraws, clip rule, blend and a
resolved sibling `DrawFrame.order` rank table; absent ranks mean authored order. A backend draws source subtrees
independently of whether `sourceDraws` hides their ordinary drawing. Source ancestor transforms
apply, ancestor opacity/visibility do not. Geometry clips ignore source paint and visibility.

Colours are literal colours/`currentColor` or `{slot, fallback}`. Gradient coordinates/stops are
resolved in local grid space; stops already obey the nondecreasing rule. Paints include fill rule,
visibility, stroke width/cap/join, trim fractions/offset, dashes in local grid units, position
and scale mode. Relative authored dashes also retain `dashNormalized`/`dashOffsetNormalized`
fractions so SVG can preserve normalized pathLength output, including zero-length outlines;
Canvas2D uses the resolved grid-unit `dash`/`dashOffset` directly.
A Canvas2D backend can traverse the same groups and primitives/paths, resolve colours from its host,
apply transforms/opacity, use ordered paints, and isolate masks/blends in offscreen surfaces.
Fixed strokes follow the viewport semantics in SPEC; a backend must not approximate nonuniform
scales with a scalar inverse. No SVG attributes, element tags or canvas calls occur in module draw
hooks. The optional `modules/canvas/web/renderer.ts` backend implements this traversal. Its heavy web
entry has an 8192 B incremental budget; it adds no core registry feature. The host's renderer
factory seam provides draw/layout, connect/disconnect/destroy and inverse pointer mapping.
`renderer="canvas"` opts in; SVG remains the default. Offscreen surfaces are pooled per renderer
and used only for opacity, masking, knockout lists, feathering and outside strokes. Unsupported
features emit `unsupported-render` with a feature name, source pointer, message and hint; see the
canvas chapter in SPEC and the browser comparison README for the explicit limits.

SVG registers separate `SVGBackend.tree/attrs` functions. `sceneTree` and `attrs` remain SVG backend
APIs for existing callers; they consume the draw tree/frame. Optional web compositing also installs
its retained DOM reorder function. The base 0.1 runtime has no compositing reorder implementation.
Registry entry targets `node` and `painted` apply to every matching current or subsequently
registered node type; feature attribution remains with the declaring module.
`Module.init(registry, shapes)` receives the active runtime's module and shape registries, so
separately bundled modules share the same registry objects rather than private copies.
It also supplies `resolveAddress`, the active runtime’s address resolver, so a separately bundled
bind module can target properties installed by other modules.

## 4. Size

Each browser module has its own budget (`docs/parity/README.md`), measured like the markup module:
`gzip(bundle(web + module)) − gzip(bundle(web))`, enforced by `tools/size.ts`. The core + web
budget (30 KB) covers the hook points only. P4a-4 additionally targets its 16697 B baseline.
Paint is limited to 5120 B, composite to 4096 B, bind to 2048 B and markup to 8192 B incremental.
Paint is limited to 5120 B, composite to 4096 B, assets to 2048 B and markup to 8192 B incremental.

## 5. Conformance and oracles

Every feature ships with: the spec section (a `## <feature>` chapter in `spec/SPEC.md`), registry
entries, diagnostics with tests, conformance cases (`spec/conformance/<feature>-*/`, authored as
`case.animl`), an AniML example with its `.ani`, CLI support, a size check and, where Rive has the
same capability, an oracle case (`tests/oracle/<case>/`, see `docs/parity/README.md`). Where an
algorithm closely follows Rive's MIT runtime, the spec says so and `NOTICE` carries the
attribution.

### Unfinished capability probes

`node tools/new-capability.ts <row-id> [--module <name>] [--dry-run]` creates TODO evidence without
changing the row's status. A conformance or oracle directory may contain `todo.json` with
`status: "todo"` and a nonempty `reason`. Runners report these as pending TODO tests; they are never
passing conformance or parity evidence. AniML generation/corpus validation omits marked conformance
sources. Invalid markers are errors. Completed oracle manifest entries cannot retain this marker.
Remove it only after authoring the actual probe, independent expectations/reference frames and
compiled `.ani`. Existing unmarked cases retain their validation and comparison behavior.

### Geometry value hooks (paint)

The paint geometry implementation also uses optional module hooks:
- value(addr, value, pointer, diag) validates/compiles a module-defined path value during
  track and pose loading; path values are strings in the player's slots.
- interpolate(a, b, weight) samples and blends those strings; returns undefined for
  value kinds the module does not handle.
- outline(player, node) supplies current local polylines for hit testing; returns
  undefined to retain core geometry. Paint uses its SVG path construction and the
  existing flattening convention for parametric shapes, corners and animated paths.

The normal number, boolean and colour slots retain their existing sampling behaviour.

### Post-state bindings

`Model.bindings` optionally maps an address to `(scope: ReadonlyMap<string, number | boolean>) =>
Value`. The loader registers bound addresses in `Model.addrs`; the player evaluates these functions
against applied inputs after layer resolution and before clamping. Bind's exported `expression`
compiler takes named input types and `evaluate` takes a compiled expression and input scope.
Components can reuse the evaluator for instance inputs without coupling it to a document/player.

### Nested-player seam (components)

`Module.resolve(model, diag)` runs after nodes/inputs are compiled and before timeline, listener
and transition references resolve. Components use it to validate child models and expose scoped
input/event references to existing semantic validation. `Model.nesting(player)` creates an
optional `PlayerExtension` for input forwarding, local pointer routing, stepping and scoped
inspection. The base player owns no component policy. `draw.end(player, frame)` runs after all
local node hooks, so nested sibling ranks can be appended after the parent compositing pass. Child
draw entries are appended to the parent tree; the components final draw hook supplies their
resolved draw records and remaps resources.
`Module.init` also receives the active runtime's `load` and `Player`, preserving registry identity
when optional browser modules arrive as separate bundles.

Formatter-only registry shapes may specify `format: <shape>` to reuse canonical key ordering
without changing structural validation. Components reuse the document shape for their nested
self-contained documents. Module initialization also receives the active `nodeShape` resolver;
components derive reserved input names from the instance shape, including optional node keys.

### Playback hooks (motion)

Registry entries may also target `timeline`, `state`, and `transition`; recomposition
resets these shape tables as it does nodes. A refinement with `feature: ''` preserves
an existing base field's spelling; motion validates its expanded speed range against
the document requirement. `Module.ease` extends left-key/transition weight parsing;
`Module.track` compiles a custom `TrackM.sample(time)` for module value kinds/curves.
`Prop.discrete` marks an address whose state crossfade replaces rather than interpolates.

`Model.playback(player)` constructs a per-player `PlaybackPolicy` before state entry.
It supplies local time, completion duration, event crossings, reduced-motion endpoint
handling, extra transition gating/carry, optional transform origin, and post-binding
composition before clamping. Absent this factory, the 0.1 paths are unchanged. The
base player exposes `writes()` for exact active/fading address coverage and an
`onChange` wake callback. The active registry supplies its own `Player`, `sampleTrack`
and `mixValues` so separately bundled modules share sampling and value interpolation
with other modules. Motion's API implementation and clock policy live in its module,
not in core/web. It needs no SVG backend; its scaffold backend is an empty declaration.
