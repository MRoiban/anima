# Implementation plan

Goal: an open, agent-friendly animation format (`.ani`) and a tiny web runtime that plays it,
proven by reproducing the bell animation (`examples/bell.ani`) that was first built with the Rive CLI
(`fixtures/bell/rive-reference/`).

Work milestone by milestone. Each milestone ends with: tests green, `docs/PLAN.md` checkboxes
updated, a short entry in `docs/LOG.md` (what changed, decisions, open issues), and a commit.
When a decision changes the format, change `spec/SPEC.md` in the same commit.

## M0 — Spec review and repo setup

- [x] Read `spec/SPEC.md`, `docs/ARCHITECTURE.md` and all four notes in `docs/research/`.
- [x] Resolve or explicitly defer every open question in SPEC §12; record the decision in the spec.
- [x] Check `examples/bell.ani` against the spec; fix either side so they agree.
- [x] npm workspaces monorepo, TypeScript strict, Vitest, ESLint, Prettier; `npm test` runs
      everything. Node 24 is available locally.
- [x] CI (GitHub Actions): typecheck, lint, test, size budget.
- [x] Check npm name availability (`anima` and `@anima/*` are probably taken); pick package names
      and record them. *(Working names `@anima-format/{core,web,cli}`, private; see
      ARCHITECTURE "Packages". Final names are the user's call.)*

**Done when** the spec has no unresolved 0.1 questions and `npm test` runs an empty suite in CI.

## M1 — Registry, loader, validator

- [x] Registry (ARCHITECTURE §core.1) for every 0.1 node type, property and paint field.
- [x] Generate `spec/schema/ani.schema.json` from it; test that `examples/*.ani` validate against
      the schema *and* the loader.
- [x] Loader with strict diagnostics (pointer, code, message, hint). One test per error code, using
      small broken documents in `packages/core/test/invalid/`.
- [x] SVG path parser (full grammar) with subpath splitting; test on all `fixtures/glyphs/*.svg`.
- [x] Fuzz/truncation test: every prefix of `bell.ani` either parses or returns diagnostics, never
      throws.

**Done when** `bell.ani` loads with zero diagnostics and every SPEC "load error" has a test.

## M2 — Sampling and the player

- [x] Eases per SPEC §5 with golden vectors in `spec/conformance/eases.json` (generate them once
      from an independent implementation, e.g. a Python script in `tools/`, and commit both).
- [x] Track sampling, colour lerp, hold semantics.
- [x] `Player.step` exactly per SPEC §7, including trigger consumption, crossfade interruption,
      `@end`, events, `settled`.
- [x] Conformance cases: at least eases, sampling edges (before first / after last / exact key),
      loop & pingpong wrap with carry-over, trigger lost vs consumed vs buffered, crossfade
      interruption, two layers writing the same property, `@end`.
- [x] **Bell parity:** the swing and clapper angles sampled from `bell.ani` match the Rive keyframes
      run through the same cubic eases (compute expected values from
      `fixtures/bell/rive-reference/gen_scene.py`'s numbers) to 1e-3°.

**Done when** the conformance suite passes headlessly and bell parity holds.

## M3 — CLI

- [x] `validate`, `inspect`, `sample`, `fmt`, `schema`, `docs` (SPEC §11 script language).
- [x] `render` to SVG and PNG, `--sheet` contact sheets. Compare `bell.ani` sheets visually with
      `fixtures/bell/rive-reference/frames/` (those were rendered with dark-mode colours: ink
      `#f0eee6` on `#1d1d1d`; render the same way for comparison).
- [x] `new --glyph` / `--glyphy`. Test: `anima new` on every glyph in `fixtures/glyphs/` renders at
      rest pixel-identical to the source SVG (Glyphy's own tests use a pixel comparison — same idea).
- [x] `docs/AUTHORING.md`: a guide written *for agents* (how to build an interaction, how to check it,
      common mistakes with the exact diagnostic each produces). `anima docs` serves it.

**Done when** an agent can create, validate, sample and render the bell without opening a browser.

## M4 — Web runtime

- [x] `<anima-icon>` per ARCHITECTURE §web: retained SVG, dirty-attribute writes, shared scheduler
      that sleeps when settled, IntersectionObserver/visibility pause, Pointer Events, a11y,
      reduced motion, CSS slots, knockout via `<mask>`.
- [x] Playwright tests (Chromium; `playwright-core` + the cached `chrome-headless-shell` work on this
      machine): bell hover/press/ring/rested, keyboard Enter, reduced motion, dark theme via CSS,
      zero network requests, loop is idle (no rAF callbacks) once settled.
- [x] Cross-check: values the browser applies during a scripted run equal `anima sample` output for
      the same script.
- [x] Size budget in CI: core + web ≤ 25 KB min+gzip (was 12 KB; raised by the owner, see LOG M4).
- [x] `examples/web/`: a demo page with the bell, standalone (no CDN).

**Done when** the bell in the browser looks and behaves like the Rive version, with no watermark,
no wasm, and the budget met.

## M5 — Glyphy integration and more icons

- [x] Animate two more glyphs from `fixtures/glyphs/` using only the CLI, as an authoring test:
      `examples/trash.animl` (lid lifts, opens, can shakes) and `examples/moon.animl` (dark-mode
      switch). Friction in `docs/research/glyphs/`; the worst fixed (bool `activate`, `anima schema`
      for a11y/transition/listener/input, `inspect` lists glyph subpaths, `render --compare`, inputs in
      snapshots).
- [x] Draft the `glyphy export -f animl / -f ani` PR for `MRoiban/glyphy`: MRoiban/glyphy#2 (draft,
      awaiting the owner's review).
- [x] Agent skill: `skills/anima/SKILL.md` teaching another agent to author AniML with the CLI.

## Parity with Rive

Goal (owner, 2026-11-06): **Anima is a smaller Rive, and above all an agent-native one** — full
parity, the Anima way; see `docs/parity/README.md` for the inventory, matrix, module split and
budgets.

**Agent-native gate.** After every phase, the standing benchmark (`docs/benchmarks/agent-native.md`)
gives fresh agents the same brief, built with the phase's features, in AniML + the CLI and in Rive's
markup with the Rive CLI's local tooling (no account commands, no `.riv` reading). Each run records
success against the brief, attempts and validate/render iterations, wall time, and the diagnostics
and friction hit. A regression against the previous run is a bug fixed before the phase's PR merges.

**Size ceilings** (owner, 2026-11-06; min+gzip; enforced by `tools/size.ts`). Rive's web runtime is
about 1 MB; Anima stays far below it.

| Use case | What loads | Ceiling |
|---|---|---|
| An icon on a page | core + web, plus only the modules that icon uses | core + web ≤ 30 KB; each module ≤ 5–8 KB |
| Full-featured animation | core + web + most modules, SVG renderer | ≤ 100 KB total |
| Rive-class scenes | adds the canvas/WebGL renderer, rigging, text | ≤ 200–250 KB total |
| Tools (playground, CLI) | run locally | no limit |

Rules: core + web is the number that matters (every page pays for it; under 30 KB at full parity).
Pay only for what you use: new features go into on-demand modules, and an over-budget module is
split before anyone asks to raise it. Over a module's own budget inside the ceilings is fine with a
reason in LOG; crossing a use-case ceiling is the owner's call — stop and ask. Over ~250 KB total
is out of scope: heavy code (canvas/WebGL, rigging, text, scripting) loads only when a document
needs it. Size is not the only cost: compile time and per-frame cost are tracked next to bytes.

**Development process** (owner, 2026-11-07; no format change):

1. **Self-contained module folders.** Each module is one folder with a manifest (name, `after`
   dependencies, core code, SVG backend, markup forms, web entry, size budget, docs, tests); a
   generated index (`--check` in `npm run check`) replaces the hand-kept lists (`core/src/all.ts`,
   web entries, `tools/size.ts`, markup hooks, build-web). Registration order comes from the declared
   dependencies; the registry is composed from the set of modules, not mutated in place, and a test
   registers them in several orders and compares schema and model. Adding a module adds files and
   edits nothing shared, so parallel coders merge without conflicts.
   D1 implementation: root `modules/<name>/manifest.ts` + generated package adapters/exports,
   core/all, markup hooks, build/size/scope tables; `--check` guards wiring. Registration composes
   the declared set in `after` order; corpus equivalence covers 12 arrival orders. No format change.
2. **Scoped tests while coding; the full suite in CI.** Coders run a fast scoped command for the
   module or package they touch (`npm run test:scope -- <module|package>`); the full `npm run check`
   runs once per PR in GitHub Actions while the next task starts. A PR merges only when CI is green.
   One full local run before a phase PR only for what CI cannot run.
   D2 implementation: `tools/test-scope.ts` with derived ownership and scoped Vitest projects;
   CI invokes the complete check and summarizes size/perf. See AGENTS.md "Testing" for flags.
3. **Scaffold capabilities from parity rows.** `node tools/new-capability.ts <row-id>` reads the row
   from `docs/parity/` and generates the skeleton every capability needs (spec section stub,
   registry entry with both spellings, diagnostic and test stubs, conformance and oracle folders,
   AniML example and `.ani`, CLI/schema hook, size entry, parity mapping) with TODOs. Coder briefs
   start with `node tools/new-capability.ts <row-id> --dry-run`, then run without `--dry-run`;
   use `--module <name>` to override the inventory module (e.g. `motion` for animation rows in
   `core`). Fill the generated TODO checklist before claiming completion. `todo.json` probes and
   diagnostic `.todo` tests report pending, never passing; parity status is unchanged. Repeat runs
   preserve edits and generate no further changes. See AGENTS.md "Adding a capability".
   D3 implementation: `tools/new-capability.ts`, module-generated CLI/schema/size wiring, paired
   example, parity views, and explicit pending support in conformance/build/oracle tooling.

Order: after P5-7 (markup) lands — D1 module folders, D2 scoped tests (parallel with D1), D3
scaffolder (after D1) — before the next new module (P5 merges with them).

**Tracked per phase** (in each phase's LOG entry and PR summary): core + web and every module's
size and the use-case totals (`tools/size.ts`), compile time and per-frame cost (`tools/perf.ts`:
one bell compile, the prefix sweep the robustness test runs, and step + draw frame for the bell
and the composite example), with the previous phase's numbers beside them.

Every capability counts as done only with: a spec section, registry entries (both
syntaxes), diagnostics, conformance cases, an AniML example with its `.ani`, CLI support, a size check
and an oracle test against Rive.

- [x] **Phase A — inventory.** 1 238 sourced capabilities in `docs/parity/` (inventory, matrix,
      roadmap), generated views checked by `tools/parity.test.ts`.
- [x] P1 AniML (authoring markup; `spec/ANIML.md`): compiler, decompiler, `anima build`/`decompile`,
      markup in every command and in HTML, optional browser module, round-trip tests, head-to-head.
- [x] P2 M5 (Glyphy export draft, two more glyphs in AniML; the head-to-head ran in P1).
- [x] P3 Playground/inspector (`anima playground`) and the web host API (`docs/WEB.md`).
- [ ] P4a `paint` on the module system of `spec/MODULES.md` (PR):
  - [x] P4a-1 module system and gradients, dashes.
  - [x] P4a-2 geometry: ellipse, polygon, star, triangle, corner radii, path morphing, fixed
        stroke, static path lengths for PNG output.
  - [x] P4a-3 compositing: blend modes, masks, clips, multiple paints, stroke position, draw order.
  - [ ] P4a-4 **renderer-neutral draw layer** (owner, 2026-11-06; `spec/MODULES.md` §3.1): modules
        describe resolved draw data; the SVG backend turns it into retained DOM and `toSVG`;
        `paint` converted; core + web for icons must not grow (`tools/size.ts`).
        Draw tree/frame, independent paint/composite modules and SVG backends implemented; 706 tests
        green, 0.1 example SVG bytes unchanged. Acceptance remains open after size round 2:
        core+web 16901 B vs 16697 B (+204 B); paint 3708/5120, composite 3840/4096,
        markup 7502/8192 B.
        AniML prefix compilation is back within 10% of the same-session pre-draw baseline
        (759 → 767 ms median); see LOG for measurements and output parity checks.
  - [x] P4a-5 agent-native benchmark run with a paint brief: AniML 5/6, Rive 5/6
        (`docs/benchmarks/agent-native.md`).
  - [x] P4a-6 draw-layer costs: compile time back to the pre-draw-layer level (merge blocker; the
        prefix-compile test keeps its original limit). Core + web 17 175 → 16 901 B after two size
        rounds, 204 B above the pre-draw-layer 16 697 B — accepted by the owner (2026-11-06: "it
        shouldn't be a blocker"); still tracked per phase.
  - [x] P4a-7 benchmark friction: pose path strings, group clips, optional clip rule,
        `anima schema pose`, dash caps in the docs.
  - [x] P4a oracle cases against the Rive CLI for the paint features (MODULES §5) — **before P5
        merges** (owner, 2026-11-06). 17 cases / 21 committed reference frames;
        `tools/oracle.test.ts`, measurements and mapping limits in `tests/oracle/README.md`.
- [x] P5-3 AniML libraries/templates: optional browser layer; unchanged markup size gate restored (see LOG).
- [x] P5 Components and assets — **moved up** (owner, 2026-11-06): nested artboards / components,
      per-instance inputs, shared glyph and layer libraries (the reuse friction from M5 and from
      authoring the nine Glyphy icons: the same hover/press layer pasted into every file, a glyph
      embedded twice), image/font/audio assets, then images, n-slice and feathering in `paint`;
      **input → value binding** (a number input driving an animatable value; the P4a benchmark's
      one AniML miss) lands here with component inputs.
  - [x] P5-1 `bind`: typed input expressions, post-state resolution, both syntaxes, CLI schema/inspect/sample,
        progress example, four conformance cases, optional web module (2048 B budget) and browser tests.
  - [x] P5-2 `components`: implementation, scoped draw/player inspection, library AniML, toolbar,
        diagnostics (including registry-derived reserved input names), four conformance cases,
        Chromium/Firefox runtime and playground tests; optional component/bind/paint markup hooks
        restore the unchanged size gates. `npm run check`: 966 tests pass; markup 8010/8192 B.
- [ ] P5b The rest of P5: asset pipelines (encodings, imports), library detach/update, lists,
      script instances (72 rows).
- [ ] Pc **Canvas backend, minimal** — brought forward from P10 (owner, 2026-11-06): the draw layer
      rendered to Canvas2D as `@anima-format/web/canvas`; runs every conformance case with a pixel
      comparison against the SVG backend; SVG stays the default for icons. Must exist before P8.
  - [x] Opt-in heavy canvas module, DPR/ResizeObserver, draw-frame traversal and tiny host hook.
  - [x] Both-engine visual corpus comparison, feature limits and measurements recorded in
        `modules/canvas/test/web/README.md` and `RESULTS.md`.
  - [ ] Resolve 12 strict raster findings (9 Chromium, 3 Firefox) and obtain a green full check.
        Pc and its parity rows remain open; no tolerance/budget increase.
- [ ] P4b `motion`: eases, typed/string tracks, seek/reverse/work area/quantize, host timeline
      control, animatable pivot.
- [ ] P4c `interaction`: blend states, transition flags, drag, keyboard, focus, scroll, gamepad;
      an on-change / previous-value condition (P5 benchmark: 'count increased' took 10 states).
- [ ] P4d `events`: payloads, open-URL, audio.
- [ ] P4e `data`: view models, bindings, converters, lists.
- [ ] P3b The rest of P3: the `a11y` module, authoring/drawing tools, headless CLI extras.
- [ ] P6 Text.
- [ ] P7 Layout.
- [ ] P8 Rigging (on the canvas backend: bones, skinning, meshes).
- [ ] P9 Scripting.
- [ ] P10 GPU effects and the WebGL renderer.
- Maybe / later: native runtimes, editor round-trip, cloud tooling, low-level GPU, 3D (inventoried,
  not scheduled).

## Ground rules

- **No Rive code.** Rive's runtimes are MIT and the research notes cite them for ideas; write
  Anima's code independently. Don't copy text from Rive's proprietary CLI documentation. Don't build
  anything that reads `.riv` files.
- Spec first: behaviour that isn't in `spec/SPEC.md` isn't done.
- Keep the shipped packages dependency-free. CLI-only dependencies are fine.
- Prefer small commits on a branch per milestone; open PRs against `main`. Ask the user before
  making the repository public or publishing packages.

### P5-5 image and edge implementation checkpoint

- [x] Acceptance: image paints, n-slice and feathering in both syntaxes; full `npm run check` green.
  `surface` (8192 B budget) provides renderer-neutral image paint, patch and feather data and an SVG
  backend. Nested slice/feather AniML, examples and round trips are complete in P5-7; see
  `design/p5/SURFACE-HANDOFF.md`. Image/group/component slices and local feathering have draw
  conformance and Chromium/Firefox pixels. SVG world feathering still reports `unsupported-render`.
  No size budget or test limit was raised.

### P5-7 markup and browser integration

- [x] Nested slice/feather forms, ordered paints, descriptor-driven scalar arrays/tuples;
      standalone examples, draw conformance sources and round trips.
- [x] Default markup ≤ 7900 B target; every unchanged module budget passes.
- [x] Browser build emits/checks every table entry, including surface and all markup hooks.
- [x] Registration order and connected-before-registration recovery covered in Chromium/Firefox;
      three consecutive `npm run check` runs at default concurrency.
