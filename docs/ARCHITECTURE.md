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
5. **Static SVG** (`svg.ts`: `sceneTree` + `attrs`, serialised by `toSVG`; the web runtime builds the
   same tree as DOM). `toSVG(player | doc, options)` serialises the current resolved scene to a
   standalone SVG string. Used by the CLI renderer, by server-side rendering, and as the no-JS
   fallback. At rest it must reproduce the Glyphy SVG (same `d`, `fill-rule`, `currentColor`); tested pixel for pixel on every fixture glyph.

## web (`packages/web`)

- `<anima-icon src="bell.ani">`, an inline `<script type="application/vnd.anima+json">` child, or
  `el.load(doc)`. The runtime requests nothing on its own: the only fetch is the `src` the page
  gives it (like `<img src>`), and with an inline document the page makes no requests at all.
- **Shadow DOM.** The element renders into an open shadow root (a `<style>` and the `<svg>`). CSS
  custom properties and `color` inherit through it, so slots theme from the page.
- **Retained SVG DOM.** Build the tree once from the core's `sceneTree`: a `<g>` per node carrying its
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
