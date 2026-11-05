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
| `paint` | gradients, dashes, more shapes, blend modes, masks and clips, multiple paints, stroke position, trim modes, path morphing, draw order | P4a |
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

A module is code in three places, all in its own files:

1. **Core** (`packages/core/src/modules/<name>/`): registry entries, loader hooks (validate and
   compile its keys into the model), player hooks (new animatable value kinds, sampling), and scene
   hooks (extra SVG elements, defs and attributes). Core's own files only gain the hook points.
2. **Web** (`packages/web/src/<name>.ts`): `import '@anima-format/web/<name>'` registers the module
   with the runtime, like `@anima-format/web/markup`. A page that never imports it never loads it.
3. **Tooling**: the CLI, the markup compiler, the playground and the conformance runner always
   register every module, so authoring sees the whole format.

Hook points (names fixed by the first module, P4a):

- `registerModule(m: Module)` in core; `Module = { name, entries, load?, model?, scene?, attrs? }`.
- `load(model, raw, diag)`: validate and compile the module's keys after the core loader.
- `scene(model, el)`: add elements to `sceneTree` (e.g. gradient and mask defs).
- `attrs(player, el, paint)`: attribute values for the module's elements and extra attributes on
  core elements, per frame.
- Animatable values a module adds (e.g. gradient stop colours) use the player's existing slots and
  sampling: a module declares their value type (number, colour, bool) and default.

## 4. Size

Each browser module has its own budget (`docs/parity/README.md`), measured like the markup module:
`gzip(bundle(web + module)) − gzip(bundle(web))`, enforced by `tools/size.ts`. The core + web
budget (25 KB) covers the hook points only.

## 5. Conformance and oracles

Every feature ships with: the spec section (a `## <feature>` chapter in `spec/SPEC.md`), registry
entries, diagnostics with tests, conformance cases (`spec/conformance/<feature>-*/`, authored as
`case.animl`), an AniML example with its `.ani`, CLI support, a size check and, where Rive has the
same capability, an oracle case (`tests/oracle/<case>/`, see `docs/parity/README.md`). Where an
algorithm closely follows Rive's MIT runtime, the spec says so and `NOTICE` carries the
attribution.

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
