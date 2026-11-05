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

Full capability parity, the Anima way; see `docs/parity/README.md` for the inventory, matrix, module
split and budgets. Every capability counts as done only with: a spec section, registry entries (both
syntaxes), diagnostics, conformance cases, an AniML example with its `.ani`, CLI support, a size check
and an oracle test against Rive.

- [x] **Phase A — inventory.** 1 238 sourced capabilities in `docs/parity/` (inventory, matrix,
      roadmap), generated views checked by `tools/parity.test.ts`.
- [x] P1 AniML (authoring markup; `spec/ANIML.md`): compiler, decompiler, `anima build`/`decompile`,
      markup in every command and in HTML, optional browser module, round-trip tests, head-to-head.
- [x] P2 M5 (Glyphy export draft, two more glyphs in AniML; the head-to-head ran in P1).
- [ ] P3 Playground/inspector and the web host API.
- [ ] P4 Interaction, paint, events, data binding.
- [ ] P5 Components and assets.
- [ ] P6 Text.
- [ ] P7 Layout.
- [ ] P8 Rigging.
- [ ] P9 Scripting.
- [ ] P10 GPU effects and the canvas/WebGL renderer.
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
