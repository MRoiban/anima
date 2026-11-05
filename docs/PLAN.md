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

**Tracked per phase** (in each phase's LOG entry and PR summary): core + web and every module's
size (`tools/size.ts`) and compile time (`tools/perf.ts`: one bell compile, and the prefix sweep
the robustness test runs), with the previous phase's numbers beside them.

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
  - [ ] P4a-7 benchmark friction: pose path strings, group clips, optional clip rule,
        `anima schema pose`, dash caps in the docs.
  - [ ] P4a oracle cases against the Rive CLI for the paint features (MODULES §5).
- [ ] P5 Components and assets — **moved up** (owner, 2026-11-06): nested artboards / components,
      per-instance inputs, shared glyph and layer libraries (the reuse friction from M5 and from
      authoring the nine Glyphy icons: the same hover/press layer pasted into every file, a glyph
      embedded twice), image/font/audio assets, then images, n-slice and feathering in `paint`;
      **input → value binding** (a number input driving an animatable value; the P4a benchmark's
      one AniML miss) lands here with component inputs.
- [ ] Pc **Canvas backend, minimal** — brought forward from P10 (owner, 2026-11-06): the draw layer
      rendered to Canvas2D as `@anima-format/web/canvas`; runs every conformance case with a pixel
      comparison against the SVG backend; SVG stays the default for icons. Must exist before P8.
- [ ] P4b `motion`: eases, typed/string tracks, seek/reverse/work area/quantize, host timeline
      control, animatable pivot.
- [ ] P4c `interaction`: blend states, transition flags, drag, keyboard, focus, scroll, gamepad.
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
