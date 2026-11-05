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
  cli/     anima validate | inspect | sample | render | fmt | new | schema | docs
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
3. **Compiler.** Flattens the doc into arrays: nodes in paint order with parent indices, property
   slots (`Float64Array` for numbers, side arrays for colours/booleans), tracks as typed arrays of
   times/values/ease ids, conditions pre-parsed. Path data is parsed once per glyph and split by
   subpath.
4. **Player.** Implements spec §7 exactly. `step(dt) → { events, settled }`,
   `set(name, value)`, `fire(name)`, `pointer(kind, x, y)` (core hit-testing on flattened geometry so
   headless runs can click), `values()` (resolved property snapshot), `dirty` (slot indices changed
   since the last read — the renderer only touches those).
5. **Static SVG.** `toSVG(player | doc, options)` serialises the current resolved scene to a
   standalone SVG string. Used by the CLI renderer, by server-side rendering, and as the no-JS
   fallback. At rest it must reproduce the Glyphy SVG (same `d`, `fill-rule`, `currentColor`).

## web (`packages/web`)

- `<anima-icon src="bell.ani">`, or an inline `<script type="application/vnd.anima+json">` child, or
  `AnimaIcon.from(doc)`. The page owns fetching; the runtime makes no network calls of its own.
- **Retained SVG DOM.** Build the tree once (`<g>` per node with one `transform` attribute, `<path>`
  per painted node, `<mask>` for knockouts). Per frame write only dirty attributes. No canvas, no
  devicePixelRatio handling, crisp at any size.
- **Scheduler.** One shared `requestAnimationFrame` loop for all instances; an instance is in the loop
  only while not `settled`. Inputs, pointer events, attribute changes and visibility wake it. A shared
  `IntersectionObserver` and `document.visibilityState` pause off-screen instances. Clamp display
  `dt` at 0.25 s.
- **Input.** Pointer Events on the host element; map to grid units with the SVG's
  `getScreenCTM().inverse()`. Use the browser's own hit testing for node targets
  (`pointer-events: visibleFill/visibleStroke`) and the core hit test only headless. `touch-action`
  via CSS, never `preventDefault` by default.
- **A11y and motion** per spec §10: role, label, `tabindex`, Enter/Space, `:focus-visible` styling
  hook, `prefers-reduced-motion` with a `motion` attribute override.
- **Theming.** Slots become `var(--anima-<slot>, default)`; `currentColor` inherits.
- **API.** Element properties/methods: `set`, `fire`, `play(timeline)` (debug), `ready` promise,
  `values()`; DOM events: `anima:event` (detail `{ name, layer, time }`), `anima:state`.
- **Budget.** `core + web` ≤ **12 KB min+gzip**, enforced in CI. Rive's web runtime is ~1 MB gzip
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

## Glyphy integration

Glyphy (Python, `MRoiban/glyphy`) has no exporter registry: `export -f` is hard-coded to
`ts | json | sprite` (see `docs/research/glyphy-compat.md`). Integration path:

1. Anima side first: `anima new --glyphy` reads `glyphy.toml` (`style.grid`, picks) and the glyph SVG.
2. Then a small PR to Glyphy adding `glyphy export -f ani` that writes static `.ani` skeletons (one per
   glyph, rest pose only). Follow Glyphy's own `AGENTS.md`.
3. Respect Glyphy's conventions: grid units, absolute `M L C Z`, `fill-rule: evenodd`,
   `currentColor`, kebab-case names without a `-<digits>` suffix.
