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

**Size gates** (owner decision, 2026-11-07; min+gzip; enforced in CI by `tools/size.ts`). They
replace the single full-featured ceiling (128 KB since P5b, 100 KB before), which bundled the
in-browser AniML compiler and devtools that no shipped page loads: raising one artificial number
every phase constrained nothing. The gates measure what users download. Rive's web runtime is about
1 MB; Anima stays far below it.

| Gate | What is measured | Ceiling |
|---|---|---|
| core + web | every page pays for it (bell, trash, moon load only this) | **24 KB** (tightened from 30 KB) |
| each scene | the real bundle of every `examples/*.ani` and benchmark scene, from its `requires` | **≤ 64 KB** |
| app-UI scene | a fixed reference set in `tools/size.ts` (paint, assets, assetio, events, components, lists, data, bind, derive, motion, machine, input, focus, convert, host, host-values, a11y, a11y-actions, a11y-dom, composite; text and layout are added as they land, text input is heavy) | **≤ 128 KB** |
| runtime sum | every runtime module in one bundle (sprawl guard; authoring and heavy excluded) | **≤ 160 KB** |
| authoring add-on | manifest `authoring: true` entries (markup*, devtools, future in-browser compilers and inspectors) on top of core + web; not in page totals | **≤ 16 KB** |
| heavy / Rive-class | runtime plus heavy modules (canvas, rigging, text input, later GPU) | **≤ 250 KB** |
| each module | its own budget | **≤ 8 KB** |
| tools (playground, CLI) | run locally | no limit |

Rules (owner, 2026-11-07):
1. These ceilings are **final for the in-scope plan through P8**. If a phase would cross one, cut code
   or move it to a heavy or optional module; don't ask to raise a ceiling mid-phase. Only if neither
   works does it go to the owner, with numbers.
2. **Size round before P6:** the runtime sum drops by at least 5 % (about 5 KB) from its value at the
   end of P3b. Look first at the modules at ≥ 95 % of their budgets and at helpers duplicated across
   modules; afterwards reset each module's budget to leave about 10 % headroom as a design target,
   not to fit whatever the code measures.
3. Every phase report and PR reports **all six gates**, not one total.
4. Pay only for what you use: new features go into on-demand modules, and an over-budget module is
   split before anyone asks to raise its budget. Size is not the only cost: compile time and
   per-frame cost are tracked next to bytes.

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
- [x] P5b The rest of P5: lists, data contexts, host data editing, assets (LOG "P5b — lists, assets,
      host editing"; design `design/p5b/DESIGN.md`).
  - [x] New modules `lists`, `host-edit`, `host-values` (split from `host`), `media`, `assetio` (split
        from `assets`), `nested`, `componentpaint`; image sampling in `paint`/`canvas`; build-time
        sniffing, encoding, SVG and Lottie import; typed guard literals and functions, colour
        patterns, trigger destinations, data keyframes; shared host write queue and document cache.
  - [x] Parity 77 rows done (624 / 1 238); 16 moved to P3b (15) and P10 (1); 19 moved before work
        began (fonts → P6, GPU formats → P10, layout sizing → P7, script instances → P9, PSD → later).
  - [x] Benchmark (playlist): AniML 5/6 → **6/6** after P5b-10; Rive 5/6 strict.
  - Owner raised the full-featured ceiling to 128 KB during P5b (page now 109.1 KB). `data`
    (8 034 / 8 192), `components` (4 051 / 4 096) and `bind` (2 038 / 2 048) must split before their
    next change.
- [x] Pc **Canvas backend, minimal** — brought forward from P10 (owner, 2026-11-06): the draw layer
      rendered to Canvas2D as `@anima-format/web/canvas`; runs every conformance case with a pixel
      comparison against the SVG backend; SVG stays the default for icons. Must exist before P8.
  - [x] Opt-in heavy canvas module, DPR/ResizeObserver, draw-frame traversal and tiny host hook.
  - [x] Both-engine visual corpus comparison, feature limits and measurements recorded in
        `modules/canvas/test/web/README.md` and `RESULTS.md`.
  - [x] Resolve 12 strict raster findings (9 Chromium, 3 Firefox) and obtain a green full check.
        Pc-2: 169/169 frames per engine (338 total), full check 1442 tests green at default
        concurrency; cached absolute SVG lengths, mask coverage and fractional nearest-image edges.
        No tolerance/budget/timeout increase; 0.1 SVG bytes unchanged. See canvas RESULTS.md for
        measured costs and the three retained explicit feature limits; phase/parity bookkeeping
        remains with the integrating owner.
- [x] P4b `motion`: eases, typed/string tracks, seek/reverse/work area/quantize, host timeline
      control, animatable pivot.
  - [x] Local implementation behind `requires="motion"`; both syntaxes, CLI/schema and host APIs.
  - [x] 27 new conformance cases; existing 41 unchanged; Chromium + Firefox host coverage.
  - [x] Seven native frame probes / 25 frames, max delta 1 with unchanged comparison method.
  - [x] Fifteen pending probes disposed by P4b-2 below; uint observation-path limit documented.
  - [x] P4b-3 declarative clock handoff/reversal, aligned step/loop exits, held/input-driven
        clocks; ten conformance cases; `anima docs <module>` chapters; sync example 6/6 via
        seven sample scripts / 66 snapshots. Full verification and measurements: LOG P4b-3.
        No phase-completion claim. Local size/perf and final verification: LOG P4b.
  - [x] P4b-2 motion oracle probe dispositions: 15/15 (7 verified, 8 skip-noted). Uint oracle uses
        exactly observable values through 2147483520; Anima independently round-trips
        4294967295. Historical number-dump -1 is a documented observation-path limit,
        with no expected failure. See tests/oracle/MOTION-PROBES.md.

- [x] P4c `interaction`: blend states, transition flags, drag, keyboard, focus, scroll, gamepad;
      an on-change / previous-value condition (P5 benchmark: 'count increased' took 10 states).
- [x] P4c-3 `focus`: traversal/scopes, pointer focus, focus/blur, component targets and real DOM
      focus; 16 conformance probes, Chromium + Firefox. 16 native focus/data oracle comparisons captured with the full-path CLI.

  - [x] P4c-1 `machine`: assigned 25 inventory rows + previous-value condition; 37 conformance
        cases, 18 native oracle cases/45 frames + eight documented skips; 5736/8192 B. Generic
        non-node AniML fields and the pure focus-reader seam are ready for companion modules.
        Full phase integration/benchmark/CI remains; see modules/machine/REPORT.md.

      P4c-2/P4c-4 integration: 54/54 implementation evidence sets, 18/54 strictly complete
      (3 captured + 15 documented host-only oracle skips); 36 native probes disposed: 27 verified, six evidenced limits, three numerical findings.
      Generic AniML fields, components event kinds and input/focus/machine seams integrated.
      Oracle pass recorded in modules/input/ORACLE-RESULTS.md; phase gates remain; parity statuses unchanged.
  - [x] P4c input finding decisions: capture parent claim mapped explicitly, default keyboard
        consumption with propagate opt-in, preserve-offset intentional difference; two verified
        zero-tolerance probes and one separately recorded difference (96 versus 80).
  - [x] P4c-4 interaction integration: generic fields, exact focus round-trips, event kinds,
        key/pointer/guard seams and per-row implementation evidence (modules/input/REPORT.md).
  - [x] P4c-6 interaction authoring: inline module contracts, registry write help, three
        built AniML examples in the corpus, change-gated pulse restart, inspect summaries,
        canonical snapshot output with markup aliases; 52 scoped files / 1673 tests pass.
  - [x] P4c-7 P4d integration: shared expression evaluation for queued machine actions, generic
        AniML/event fields, composed event kinds, boundary/lifecycle seams; six new conformance
        cases, strict oracle 120 cases/314 samples, full local check 4227 tests green.
        See `modules/machine/P4C-7-REPORT.md`; phase benchmark/PR remains with the parent.
- [x] P4d `events`: payloads, open-URL, audio; expression actions and `mod`/`floor` conditions.
  - [x] Local implementation: 32/33 requested rows; script-event-context deferred to P9.
        Events 3418/4096 B, core+web +266 B; 7 conformance cases and Chromium/Firefox coverage.
        Evidence: `modules/events/RESULTS.md`.
  - [x] P4d-2 deterministic clock boundaries: SPEC §5 absolute 1e-9 s rule across core/motion,
        nine conformance cases; next-step event listeners retained as an intentional difference.
        Fresh boundary captures: transition 30/30/45 matches; keys 15/30/60 vs Rive 15/30/61
        remain a recorded finding. Completed oracles 41; strict exit 0; full check 2530 tests green.
        See LOG P4d-2.
  - [x] P4d-3 action expressions and arithmetic conditions: bind evaluator reused; floor/mod,
        snapshot action sets, state entry/exit and transition blocks, typed event expressions.
        Seven conformance probes, share 6/6 through 25 clicks, 1274 scoped tests plus 18 markup
        browser tests. Core+web 19767 B (+420), bind 1866/2048, events 3551/4096.
        See `modules/events/P4D-3-RESULTS.md`; four exact post-click comparative oracles and one immediate-timing finding in `tests/oracle/ACTION-EXPRESSIONS.md`.
  - [ ] Parent integration, phase benchmark and parity promotion/PR.
- [x] P4e `data`: view models, bindings, converters, host data API, paint leftovers (LOG "P4e — data").
  - [x] `data` core (models, instances, lists, `$` paths, binding modes, data listeners, custom
        properties), `convert` (named converters and groups, formula functions, formatting,
        interpolation), `host` (page data API, `auto-bind`), `derive` (computed read-only model
        properties, from the benchmark), comparisons in bind expressions; paint leftovers 10/18 strict
        plus 8 rasterisation-only findings. Parity 160 rows done (547 / 1 238).
  - [x] Decided intentional differences: change listeners fire for every source; boolean → string
        `"true"`; interpolation starts from the value at load. Float32 dumps and the enum-index
        observation limit are recorded, not differences.
  - Moved on: 54 rows to P5b (40: lists and list helpers, artboard values, default-instance
    discovery, listener value sources, typed literals), P3b (6), P6 (3), P7 (2), P9 (3).
  - Open: `data` is near its budget (7 420 / 8 192 B after `derive` took bytes out), `bind` at
    2 048 / 2 048 B and `host` at 4 042 / 4 096 B — split before the next change to any of them;
    fresh Rive captures need the Rive CLI updated to 1.9.1 (owner decision).
**Scope and order after P5b** (owner triage, 2026-11-07; rows and reasons in
`docs/parity/triage-2026-11-07.md`). Anima is a smaller, agent-native Rive for animated web UI in general;
where the browser already does something well, Anima binds to it instead of reimplementing it.
Progress is reported against the in-scope rows: **738 of 886 done (83 %)**, next to 738 of 1 238 (60 %)
for the full matrix. Size estimates are min+gzip against the gates above (owner, 2026-11-07): the
app-UI scene (128 KB) and each scene (64 KB); heavy modules count toward Rive-class (250 KB).

- [x] P3b Accessibility and headless agent tools (119 rows; design `design/p3b/DESIGN.md`; closure
      `docs/parity/P3b-closure.md`). 96 rows done (in scope 624 → 720 of 886, 81 %), 23 moved to P3c.
      Node semantics bound to native browser elements (`a11y`, `a11y-actions`, `a11y-dom`,
      `markup-a11y`), headless semantics, actions and keys; agent tools (`anima session`, `bench`,
      `compare`, `doctor`, `schema --search`, `inspect --summary`, `anima.json`, data set/dump/watch/
      break, `expect`, seed, touch/drag); `data-host`; reduced motion stops running loops at once;
      `icon.stop()`; `devtools` (authoring). Benchmark: AniML 4/6 → 5/6 after fixes, Rive 5/6; item 1
      (visible text) an owner-accepted gap until P6. Size gates (owner, 2026-11-07) replaced the
      full-featured ceiling.
- [x] P3c Size round and P3b carry-overs (design `design/p3c/DESIGN.md`, survey
      `design/p3c/SIZE-SURVEY.md`, closure `docs/parity/P3c-closure.md`). Runtime sum 109 971 →
      104 285 B (−5.17 %, owner target ≤ 104 472 B met with the carry-overs included): AniML authoring
      hooks moved into the authoring class (`markup-hooks`, −4 470 B), production diagnostic prose
      guarded in events/data/machine, visual modules, converters and bind (−1 630 B). Budgets reset to
      ~10 % headroom. 18 carry-overs done (in scope 720 → 738 of 886, 83 %); `a11y.tree-bounds` → P6,
      four bindable-artboard rows → P7. Benchmark regression rerun: AniML 5/6 (item 1 owner-accepted).
- [ ] **Downstream bug reports (2026-11-07, "Anima Controls" kit, `anima-kit` f1373fd; owner OK).**
      Triage: fixed on `p6` in two bugfix tickets parallel to P6 (BF-1, BF-2), each confirmed first
      with a small scene and then covered by a regression test; none blocks P6.
      - [x] B1 (high, BF-1) data-bound values (theme colour) don't reach nested component instances.
      - [x] B2 (high, BF-2) with `focus` loaded one ArrowRight moves two tabs (two handlers); without
            `focus`, Enter on an overlay button that fires a trigger does nothing.
      - [x] B3 (medium, BF-2) tab overlay elements take focus but Space/Enter don't select the tab.
      - [x] B4 (low–medium, BF-1) `data.color(path).set("#rrggbb")` is silently ignored: accept hex
            strings (verified already supported); reject fractional/nonfinite RGBA channels.
      - [x] B5 (feature, BF-1) imported library components get generated names (`import-4-switch`):
            preserve unique names, qualify clashes by alias, share core/web/CLI/host lookup; documented.
      - [x] B6 (high, BF-2) the a11y overlay blocks pointer input (hover, press, drag) to the drawing.
      - [x] B7 (low, BF-2) native slider thumbs on the overlay scale with the drawing (oversized).
      - [x] B8 (medium, BF-2) the host element needs a square box: size it to the component's viewBox
            aspect ratio (SVG default; core+web +13 B; P7 keeps fit/alignment).
      BF-2 evidence: `modules/a11y-dom/BF2-REPORT.md`; B2 trigger-button failure and B7
      visible paint at default opacity did not reproduce on the current branch; retained
      regression scenes document these distinctions and the decided overlay policy.
      Second report (2026-11-07, anima-kit.mc2.onl, built on p3c; `anima-kit` 3ee3000, read-only).
      Duplicates closed: finding 8 square host = B8 (fixed on p6); "activate unreliable without
      focus" = B2 (BF-4 re-runs the kit's own case); "overlay magnifies range thumbs" = B7 (BF-4
      re-checks at the kit's scale).
      - [ ] B9 (perf, BF-3) `icon.load(doc)` recompiles the whole document per host (~55 ms per
            100–200 KB doc; 92 hosts 5.1 s): compile once per document, choose the root per host.
      - [ ] B10 (crash, BF-3) a model compiled for root A loaded with `component="B"` throws
            `anima: pop` from `Player.fire`: work with the root chosen at load, or a clear diagnostic.
      - [ ] B11 (BF-3) off-screen hosts show model defaults on their first visible frame after
            data writes made off screen: apply pending data and step once before the first paint.
      - [ ] B12 (BF-3) on a settled host a data write updates a derived bool but the guarded layer
            changes state only on the next write (one-step lag).
      - [ ] B13 (BF-3) `unknown-feature at /requires/N` doesn't name the module to import.
      - [ ] B14 (BF-4) `rect corners` draws quadratic corners, not circular arcs (≠ `rx`, CSS).
      - [ ] B15 (BF-4) every radio overlay is a tab stop; a radio group must be one tab stop with
            roving arrows (APG).
      - [ ] B16 (BF-4) host/overlay stops key and pointer events from bubbling to page listeners.
      - [ ] B17 (BF-4) role vocabulary lacks progressbar, meter, status and a controls relation
            (dialog modal and expanded exist: check discoverability).
      - [ ] B18 (BF-4, docs) animating a bound value with easing: the interpolate converter
            (`data.interpolate-number`) exists but the kit didn't find it; recipe in the authoring
            guide and `anima docs`, verified on a geometry bind.
      - [ ] B19 (BF-4) "write into data paths is broken": no details in the report; reproduce
            listener/`input.write-*` writes into data paths, or report not reproduced.
- [ ] P6 Text on the browser (83 rows: 76, plus 5 text a11y rows from P3b and, by the owner's
      follow-up of 2026-11-07, text hit testing through the host API and listeners and bidi control
      only if nearly free; the other `text.script-*` rows went with scripting). Shaping,
      fonts (`FontFace`), bidi, OpenType features and variable axes from the browser (`measureText`,
      SVG text, `Intl.Segmenter`); per-glyph modifiers and ranges kept; DOM-backed text input (a
      native field over the drawn text, caret and selection drawn from the native selection);
      build-time subsetting, Google Fonts import, text to outlines. The design records how the CLI
      renders text without a browser. Separate modules (text, text effects, text input, fonts).
      **Exit criterion (owner, 2026-11-07):** rerun the P3b settings-card benchmark; its item 1 (visible
      labels bound to data, an owner-accepted P3b gap) must be met, so the P6 benchmark covers text
      bound to data.
      **Estimate:** text 5–7 KB, text effects 3–4 KB, fonts 1–2 KB, text input 3–4 KB → 12–17 KB,
      which alone would use most of the remaining headroom (see the risk below). → ~125–130 KB.
- [ ] P7 Minimal layout and host fit (35 rows, with animated reflow brought back by the owner): hug content, padding/gaps, min/max, fixed sizes,
      row/column stacks with alignment and distribution, nested containers, painted layout boxes,
      layout values bound to data; host `Fit:*`, `Alignment:*` and override size. Design case: a
      button whose background grows with a label of changing length and animates as it grows (no
      snap). **Estimate:** 3–4 KB plus ~1 KB for animated reflow (host fit/alignment mostly in the
      existing web element).
- [ ] P8 Rigging (25 rows): bones, constraints, IK, skinning, meshes and vertex weights, as optional
      **heavy** modules on the canvas backend (owner confirmed 2026-11-07); path measurement stays internal
      to rigging (follow-path), not a public API. **Estimate:** 8–11 KB, counted toward Rive-class
      (114.5 KB now) rather than the full-featured page.
- P9 Scripting: **won't do** (a runtime VM is the largest size and security cost; expressions,
  `derive` and the host page's JavaScript cover it). P10 GPU (WebGL/WebGPU backends, multipass effects,
  BC7, worker replay, self-hosted WASM): **maybe later**. Also won't do: visual editor tooling, layout
  beyond the minimal subset, Rive's WASM build variants.
- **Size round before P6** (owner rule 2): the runtime sum drops ≥ 5 % from its end-of-P3b value; the
  P6 design keeps the app-UI scene ≤ 128 KB and each scene ≤ 64 KB with text input heavy (it no
  longer has to fit text into the ~10 KB left under the old single ceiling).
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
