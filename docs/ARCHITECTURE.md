# Architecture

Anima is a monorepo of small packages around one normative spec (`spec/SPEC.md`). TypeScript,
ES2022, no runtime dependencies in the packages that ship to browsers.

```
spec/
  SPEC.md                 normative format + semantics
  schema/ani.schema.json  generated from the registry, never hand-edited
  conformance/            runtime-independent cases (case.ani, script.txt, expected.jsonl)
packages/
  core/    parse → validate → compile → Player.step(dt); pure, deterministic, no DOM
  web/     <anima-icon> custom element: retained SVG DOM, scheduler, input, a11y
  cli/     anima validate | inspect | sample | render | fmt | new | schema | docs | playground
  playground/ private local editor and inspectors; plain DOM/SVG, compiler + web runtime
modules/   one manifest + core/SVG/markup/web sources + tests per optional module
examples/  bell.ani and later icons
fixtures/  Glyphy glyphs and the Rive reference for the bell
docs/      architecture, plan, research notes
```

## core (`packages/core`)

1. **Registry — the single source of truth.** One TypeScript table describing every node type,
   property (type, default, animatable, hold-only, range) and paint field. It generates the JSON
   Schema, the `anima schema` output, the docs tables, and drives validation, sampling and the
   renderer's attribute mapping. Adding a property is one registry entry plus tests. (Rive's
   generated core-def model is the inspiration; see `docs/research/rive-format-and-graph.md`.)
2. **Loader.** `parse(text) → Result<Doc, Diagnostic[]>`. Strict by default. Diagnostics carry
   `{ pointer, code, message, hint }`. Resolve → link → validate passes; never partially load.
   Loops are capped and inputs are bounded (fuzz and truncation tests).
   Structure is checked against shapes declared in the registry (`check.ts`), then references and
   semantics (`load.ts`). The browser build sets `flags.ts` `VERBOSE = false`, which folds away all
   message and hint text and the warning passes; codes and pointers stay (spec §2).
3. **Compiler.** Flattens the doc into arrays: nodes in paint order with parent indices, property
   slots (`Float64Array` for numbers, side arrays for colours/booleans), tracks as typed arrays of
   times/values/ease ids, conditions pre-parsed. Path data is parsed once per glyph and split by
   subpath.
4. **Player.** Implements spec §7 exactly. `step(dt) → { events, settled }`,
   `set(name, value)`, `fire(name)`, `pointer(kind, x, y)` (core hit-testing on flattened geometry so
   headless runs can click), `values()` (resolved property snapshot), `dirty` (slot indices changed
   since the last read — the renderer only touches those).
5. **Draw layer** (`draw.ts`): a static tree built after validation and a cached, renderer-neutral
   resolved frame. Player revision stamps track changes without consuming dirty-slot reads.
   Module `draw.tree/frame` hooks contribute geometry, paints and compositing references.
6. **Static SVG** (`svg.ts`: `sceneTree` + `attrs`, serialised by `toSVG`; the web runtime builds the
   same tree as DOM from draw data). `toSVG(player | doc, options)` serialises the current resolved scene to a
   standalone SVG string. Used by the CLI renderer, by server-side rendering, and as the no-JS
   fallback. At rest it must reproduce the Glyphy SVG (same `d`, `fill-rule`, `currentColor`); tested pixel for pixel on every fixture glyph.

## web (`packages/web`)

- `<anima-icon src="bell.ani">`, an inline `<script type="application/vnd.anima+json">` child, or
  `el.load(doc)`. The base runtime fetches only the `src` the page gives it (like `<img src>`); inline
  documents without referenced assets make no requests. The optional assets module decodes image
  sources relative to that document URL, or asks `icon.assets` for a replacement URL/Blob. Embedded
  data URIs require no network. Image geometry stays renderer-neutral; SVG owns the clipped viewport.
- **Shadow DOM.** The element renders into an open shadow root (a `<style>` and the `<svg>`). CSS
  custom properties and `color` inherit through it, so slots theme from the page.
- **Retained SVG DOM.** Build the tree once from the SVG backend's `sceneTree`: a `<g>` per node carrying its
  `transform`, `opacity` and `display`, with the painted element inside it untransformed; `<mask>` for
  knockouts, attached to a wrapper `<g>` that has no transform of its own. Per frame write only changed
  attributes, and never remove `transform`/`opacity`/`display` (identity is written out as
  `matrix(1 0 0 1 0 0)`). These rules came from a Firefox paint bug (LOG, M4 Firefox fix): a transformed
  leaf inside an animated, masked group was painted stale. No canvas, no devicePixelRatio handling,
  crisp at any size.
- **Scheduler.** One shared `requestAnimationFrame` loop for all instances; an instance is in the loop
  only while not `settled`. Inputs, pointer events, attribute changes and visibility wake it. A shared
  `IntersectionObserver` and `document.visibilityState` pause off-screen instances. Clamp display
  `dt` at 0.25 s.
- **Layout.** The element's box is the glyph **grid** box, so an animated icon drops in where the
  static Glyphy SVG was, at the same size; the `<svg>` covers the `viewBox` and overflows the box by
  the bleed (`overflow: visible`).
- **Input.** Pointer Events on the host element; map to grid units with the SVG's
  `getScreenCTM().inverse()` and hand them to the core's `pointer()`, so the browser and headless
  runs share one hit test and one listener model (spec §9) — the cross-check in M4 depends on it.
  `touch-action` via CSS, never `preventDefault` by default.
- **A11y and motion** per spec §10: role, label, `tabindex`, Enter/Space, `:focus-visible` styling
  hook, `prefers-reduced-motion` with a `motion` attribute override.
- **Theming.** Slots become `var(--anima-<slot>, default)`; `currentColor` inherits.
- **API.** See the [web host API reference](WEB.md) for attributes, properties, playback controls,
  introspection, cleanup, and DOM events.
- **Debug and replay.** `el.player` is the core `Player`; setting `el.trace = []` records every step,
  pointer event and input write, which converts one-to-one into an `anima sample` script — the
  browser tests use it to check the browser applies exactly what the headless run computes.
- **Budget.** `core + web` ≤ **25 KB min+gzip**, enforced in CI (`tools/size.ts`); 14.6 KB at M4 with the
  full strict validator (the owner raised it from 12 KB rather than relax validation; see LOG M4). The bundle is built
  by `tools/browser-build.ts`: esbuild with terse diagnostics, then terser. `node tools/build-web.ts`
  writes `packages/web/dist/anima-icon.js` and the standalone demo `examples/web/index.html`. Rive's web runtime is ~1 MB gzip
  (see `docs/research/rive-web-runtime.md`); the point of Anima is to not need that.

## cli (`packages/cli`)

The agent's feedback loop. Every command has `--format=json` and typed exit codes
(0 ok, 1 diagnostics, 2 usage).

| Command | Does |
|---|---|
| `anima validate <file>` | All diagnostics, with JSON pointers and hints. |
| `anima inspect <file>` | Summary: node tree, which properties each timeline/state writes, state graph, warnings (unreachable states, dead ends, layer write overlaps). |
| `anima sample <file> [--script f]` | Runs the command script (`advance 0.1`, `set hover true`, `fire ring`, `pointer click 10 10`, `snapshot`) and prints resolved values and events as JSON lines. Same language as the conformance suite. |
| `anima render <file> [--at t] [--script f] -o out.{svg,png}` | Static frame(s); `--sheet N` writes a contact sheet of N evenly spaced frames, labelled. PNG via `@resvg/resvg-js` (CLI-only dependency). |
| `anima fmt <file>` | Canonical formatting: stable key order, one keyframe per line. Diff-friendly. |
| `anima new <name> --glyph <svg> \| --glyphy <project-dir> <glyph>` | Scaffold a `.ani` with the glyph embedded (hash included) and a rest pose identical to the SVG. |
| `anima schema [type\|address]` | Registry lookup: properties, types, defaults, animatable. |
| `anima docs [topic]` | Ships the spec and an authoring guide for agents. |

## Packages, names and tooling

Optional implementations live in root `modules/<name>/` folders, grouped by capability across
package responsibilities. Each `manifest.ts` owns dependency order, core/SVG entry points, markup
hooks, web entries and their separate byte budgets, test globs, conformance prefixes, docs and
package adapters/exports. `node tools/modules.ts` generates the source adapters under the existing
packages, `core/all`, markup-hook registration and `tools/modules.generated.ts` for build, size and
scope consumers. `--check` runs first in `npm run check`. Public package import paths stay stable;
source implementations and tests have a single owner. The packages are private development APIs;
standalone package publication remains deferred. See `spec/MODULES.md` §3 for the manifest contract.

npm workspaces, TypeScript strict (6.0; typescript-eslint does not support 7 yet), Vitest, ESLint,
Prettier. Sources are erasable-syntax TypeScript with `.ts` import specifiers, so Node 24 runs them
directly (tests, CLI, tools) with no build step; esbuild bundles the browser build and measures the
size budget (`tools/size.ts`); `tsc` with `rewriteRelativeImportExtensions` will emit JavaScript
for publishing. `npm run check` runs everything CI runs.

The project name stays **Anima**, with `.ani` (runtime format) and `.animl` (markup) as the file
extensions (owner, 2026-11-05). Working package names (all `private` until the owner decides — `anima` and `anima-cli` are taken on
npm, and whether the `@anima` scope is claimed cannot be checked without logging in):
`@anima-format/core`, `@anima-format/web`, `@anima-format/cli` (binary `anima`).

## Glyphy integration

Glyphy (Python, `MRoiban/glyphy`) has no exporter registry: `export -f` is hard-coded to
`ts | json | sprite` (see `docs/research/glyphy-compat.md`). Integration path:

1. Anima side first: `anima new --glyphy` reads `glyphy.toml` (`style.grid`, picks) and the glyph SVG.
2. Then a small PR to Glyphy adding `glyphy export -f ani` that writes static `.ani` skeletons (one per
   glyph, rest pose only). Follow Glyphy's own `AGENTS.md`.
3. Respect Glyphy's conventions: grid units, absolute `M L C Z`, `fill-rule: evenodd`,
   `currentColor`, kebab-case names without a `-<digits>` suffix.

## playground (`packages/playground`)

A private development UI, built at serve time by `tools/build-playground.ts` into self-contained
HTML. `packages/cli/src/playground.ts` serves it and a single revision-checked file endpoint on
loopback. The client owns source editing, compile diagnostics, model-derived state graph layout
and a timeline sampler; it uses `Player.inspect()` and `<anima-icon>` rather than implementing a
second state machine or renderer. It adds no runtime dependencies to core or web. See
`docs/PLAYGROUND.md` for the build decision, API integration and screenshot reproduction.

## Optional modules (P4a-1)

`ModuleEntry` patches a registry object (`target`: `fill`, `stroke`, `document` or a node type)
with `shapes`, optional animatable `props`, and an optional replacement `required` list. `node: { painted: true }` declares a new painted node
type; its load hook may compile its geometry to an existing node model. Registration
marks each added shape/prop with the module's `feature` and is idempotent by name. `elements` carries
structural AniML descriptors (object shape, fixed discriminator values and an optional target
selector); the compiler, decompiler and formatter use them without paint-specific branches.

The `model(node, key)` hook resolves an extra address to `{ prop, rest }`; the loader converts it
into an ordinary sampling slot. `draw.tree(model, tree)` contributes static resource/geometry
metadata; `draw.frame(player, node, data, entry, frame)` resolves current drawing values. Modules never
return SVG elements or attributes. `load(model, raw, diag)` runs semantic validation after core
compilation, before a model can escape the loader. The static draw tree is built only after all
validation succeeds. Hooks run in dependency order and ignore nodes they do not own.
Each module's `svg.ts` separately registers its SVG backend using the same draw data for retained
DOM and `toSVG`. `core/all` registers all modules and SVG backends for authoring; browser builds
load only explicit imports. See MODULES §3.1 for the Canvas2D seam and change-tracking contract.

Module registration and the retained renderer are shared through the active `AnimaIcon` class,
so separately emitted base, paint and markup bundles use the same runtime. The browser markup
compiler copies the registered entries and the live DOC/fill/stroke shape refinements from module
initialization before compiling; its registry-derived forms remain in the lean `markup` authoring
entry (8 KB incremental budget). Runtime entries register runtime features only. Browser AniML
pages import `@anima-format/web/markup-hooks`, a separately budgeted authoring entry that includes
`markup` and installs compiler hooks synchronously for existing and subsequently loaded runtime
modules. The registration-only `markup-<name>` entries remain available with the lean compiler;
composite-only structural markup uses `markup-paint`. Library/template expansion additionally
uses `markup-libraries`. Tooling's `core/all` registration is folded out of terse browser builds.
Both optional bundle import orders are browser-tested.


## Testing scopes

`npm run test:scope -- <target…>` runs the affected package/module tests during development;
`conformance` and `oracle` select their independent runners. `changed` derives targets from the
branch merge-base with main and working-tree changes (`--base=<ref>` overrides the base).
`--no-browser` excludes browser files; `--browser=chromium|firefox` filters their engine suites.
`tools/test-scope-map.ts` consumes generated manifest test globs and conformance prefixes;
shared markup API/registry tests are explicitly listed by module manifests. Module browser scopes
include only their declared suites. Package scopes include module tests under `test/<package>/`. Shared files
select their whole package, and shared config/tooling selects all packages and tools (including
oracle).
`vitest.scope.config.ts` uses separate unit, conformance and browser projects so conformance case
and browser-name filters do not filter unit tests. The default Vitest config always runs every test.
CI runs `npm run check` on every PR and push and adds size/perf output to the job summary. A green
CI run is required before merge; see AGENTS.md for the local phase verification policy.

folded out of terse browser builds. Module and compiler registration notify pending source loads through the active element class;
failed loads retry after late registration and explicit destruction cancels retries. Tooling's
`core/all` import belongs to the markup package's tooling entry, never its shared name helpers.
Both optional bundle import orders and delayed registration after connection are browser-tested.
