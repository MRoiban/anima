# Log

One entry per milestone: what changed, decisions, open issues.

## M0 — Spec review and repo setup (2026-11-05)

**Changed**

- `spec/SPEC.md` is now 0.1 (frozen for implementation). Every draft open question is settled or
  deferred in §12, and the gaps found while reading are closed: name patterns, member order, limits,
  diagnostic codes (§11.3), the script language (§11.2), local time for each loop mode, timeline event
  rules, the resolve rule for crossfades and layers, the pointer model, knockout geometry, trims,
  reduced motion for looping timelines, and `a11y.held`.
- `examples/bell.ani` reconciled with the spec: key times are the Rive frames as `frame / 60` to six
  decimals (the draft's four-decimal times were up to 3e-5 s off, which is ~0.01° on the swing —
  more than the M2 parity bar of 1e-3°), angles to four decimals in degrees, the Rive hit disc as
  `hit`, and `"held": "down"`.
- npm-workspaces monorepo (`packages/{core,web,cli}`), TypeScript 6 strict, Vitest, ESLint
  (core may not import anything but its own modules, nor use `Date`/`Math.random`/DOM globals),
  Prettier, a size-budget script, and GitHub Actions running all of it.

**Decisions** (details and rationale in SPEC §12)

1. Strokes always scale; no non-scaling flag.
2. Colours lerp in non-premultiplied 8-bit sRGB with `floor(c + 0.5)`; OKLab reserved for 0.2.
3. Keyboard → bool mapping is explicit (`a11y.held`).
4. Additive layers, 5. path morphing, 6. data binding, 7. draw-on for glyph outlines: deferred to
   0.2 and reserved (`reserved` diagnostic).
- Clocks advance before transitions (fixes a draft bug where `settled` could be true with an `@end`
  transition still pending); transitions chain within a step (cap 16) with carried-over time; the
  crossfade source is always a frozen snapshot; exact version match before 1.0.
- The web runtime uses the core hit test in the browser too (ARCHITECTURE "Input"), so headless and
  browser runs share one code path.
- The element box is the grid box; the bleed overflows (Glyphy drop-in sizing).
- No build step in development: Node 24 runs the TypeScript sources directly.

**Open — needs the user**

- Package names / npm scope (working names `@anima-format/*`, all private).
- Licence (none added), before the repo goes public.

**Open — technical**

- The 12 KB budget includes the strict validator, because the runtime default is strict. Its
  messages are the largest part; keep them short and measure from M1 on.

## M1 — Registry, loader, validator (2026-11-05)

**Changed**

- `packages/core/src/registry.ts`: every 0.1 node type, animatable property (type, default, range)
  and paint field, plus the shape of every object in a document. `check.ts` validates structure
  against those shapes; `schema.ts` turns them into `spec/schema/ani.schema.json` (`npm run gen`; a
  test fails if the committed file is stale).
- `load.ts`: strict loader, `load(text | object) → { model?, diagnostics }`. Resolves glyphs,
  subpaths, addresses, timelines, states, conditions, listeners and a11y into a `Model` the player
  will compile. Never partially loads.
- `path.ts`: full SVG path grammar (relative, implicit repeats, H/V/S/T/Q, arcs to cubics), split by
  subpath with source ranges, so selecting all subpaths of a Glyphy path returns `d` byte for byte.
- Tests: one broken document per diagnostic code in `packages/core/test/invalid/` (the test also
  checks every code in SPEC §11.3 has one, and every pointer resolves); examples validate against
  the schema (Ajv 2020) and the loader; every prefix of `bell.ani` loads or fails cleanly; hostile
  input (deep nesting, 2 MB, junk) fails with diagnostics; path parsing on all nine glyphs.

**Decisions**

- Structural errors stop the load before semantic checks, so one typo does not cascade into a page
  of follow-on errors. The fix-and-rerun loop is cheap for agents.
- `duplicate-key` and `hash-mismatch` are `anima validate` checks (they need a positional JSON
  tokenizer and SHA-256, which do not belong in the browser bundle); they get their tests in M3.
- Size: the strict loader alone was 10.4 KB min+gzip. A build flag (`flags.ts`) lets the browser
  build drop message/hint text and warnings (spec §2 now allows that), bringing it to ~8.7 KB.
  That is still most of the 12 KB budget, so M4 will need more trimming (see Open).

**Open**

- Budget risk: loader ~8.7 KB gz before the player and the element. Options for M4, in order:
  tighten loader code, share vocabulary with the player, then (only if needed) move pure-lint
  errors that cannot affect playback out of the browser build — that would need a spec change and
  the user's agreement, since the runtime default is strict.

## M2 — Sampling and the player (2026-11-05)

**Changed**

- `player.ts`: `Player.step(dt)` per SPEC §7 — inputs, clocks, per-layer timeline events and chained
  transitions with carried time, frozen crossfade snapshots, the resolve rule, clamping, trigger
  consumption and buffering, `settled`. Also the §9 pointer model with core hit testing (fill rule,
  stroke half-width, padding, groups expand to descendants, the top-level `hit` shape) and §10
  reduced motion. `takeDirty()` reports changed slots for the renderer.
- `script.ts`: the §11.2 command language, shared by the conformance suite and (M3) `anima sample`.
- `geom.ts`: matrices per §4 and point-in-polygon / distance-to-polyline hit tests.
- `tools/gen_eases.py` → `spec/conformance/eases.json`: golden vectors from an independent Python
  implementation (200-step bisection); the TypeScript eases match to 1e-7.
- 12 conformance cases in `spec/conformance/` (sampling edges, loop and pingpong wraps with events,
  triggers consumed/lost/buffered/expired, crossfade interruption, two layers on one property,
  `@end` chains with carry, the chain cap, re-entry, number conditions, reduced motion, pointer).
  Their expected values were worked out by hand from the spec (round numbers, linear eases) before
  the first run; all matched.
- Bell parity: the swing and clapper angles from `bell.ani`, stepped at 240 Hz, agree with the Rive
  keyframes read straight out of `gen_scene.py` to 6.0e-5° (bar: 1e-3°).

**Decisions**

- The first `step` reports the initial states' entry events (spec §7, added).
- The `@limit` chain cap does not keep a player awake: `settled` follows its usual definition, so
  a broken machine cannot spin the page's frame loop. `anima inspect` (M3) should flag it.

## M3 — CLI (2026-11-05)

**Changed**

- `packages/cli`: `anima validate | inspect | sample | render | fmt | new | schema | docs`, each with
  `--format=json` and exit codes 0/1/2. `validate` adds the two checks that need more than the core:
  `duplicate-key` (a positional JSON scanner, which also gives every diagnostic a line and column)
  and `hash-mismatch` (SHA-256 of glyph data). PNG output uses `@resvg/resvg-js` (CLI-only).
- `packages/core/src/svg.ts`: the SVG scene (element tree + per-frame attributes) shared by
  `toSVG` and, in M4, the web runtime, so both draw exactly the same thing. Knockouts are
  `<mask>`s that are dropped while the cut is empty, keeping the rest frame mask-free.
- `docs/AUTHORING.md`: the agent guide, with the exact diagnostic for each common mistake (taken
  from real `anima validate` runs). `anima docs` serves it, by section, and the spec.
- Tests: every command; `anima new` on all nine glyphs renders at rest **pixel-identical** to the
  source SVG at 16, 20, 48 and 200 px; `fmt` round-trips the bell; and a comparison with the Rive
  reference frames (`packages/cli/src/compare.ts`, run directly for a side-by-side PNG).

**Rive comparison** (mean |Δ| per RGB channel, 0–255, 240×240, dark colours):
rest 0.19 · hover 0.20 · ring f3 2.76 · f7 3.47 · f17 0.38 · f27 0.26 · f57 0.24 · rested 0.22 ·
out 0.21. The residue is anti-aliasing (Rive draws each wave as one cubic, Anima as a true arc) and
a fraction of a frame of press timing in f3/f7.

**Decisions**

- **`interruptible` (spec §8, new).** The first comparison showed f3/f7 off by 11–14: in Rive a
  transition's crossfade cannot be interrupted unless "early exit" is set, so a click shows the press
  dip before the release; Anima let the release cancel it in the same frame, so a quick click showed
  no press at all. Anima keeps interruptible as the default (smoother hover in/out) and adds
  `"interruptible": false` per transition; the bell's hover layer uses it. New conformance case
  `uninterruptible`.
- `render` applies the script's queued inputs (`step(0)`) before drawing, so `-e "fire ring"` starts
  the ring at frame 0.
- Suggestions also match shared 5-letter stems (`rotation` → `rotate`), and pose values that are
  arrays reach the `not-animatable` check (`icon.pivot` → "animate x and y instead").
- Node 24's `JSON.parse` messages no longer carry positions, so the CLI finds syntax errors itself.

## M4 — Web runtime (2026-11-05)

**Changed**

- `packages/web`: `<anima-icon>` renders the core's SVG scene as retained DOM in an open shadow root
  (slots theme through CSS custom properties, `currentColor` inherits), writes only changed
  attributes, and shares one `requestAnimationFrame` loop that sleeps when every icon has settled and
  pauses off-screen (IntersectionObserver) and in hidden tabs. Pointer Events go through the core's
  pointer model and hit test; keyboard and ARIA follow spec §10; reduced motion follows the media
  query unless `motion` overrides it. `el.trace` records steps, pointer events and input writes.
- `tools/browser-build.ts`: esbuild with terse diagnostics, then terser. `tools/build-web.ts` writes
  `packages/web/dist/anima-icon.js` and the standalone demo `examples/web/index.html` (runtime and
  `bell.ani` inlined; CI checks it is current).
- Browser tests (`packages/web/test/browser.test.ts`, headless Chromium via `playwright-core`; CI
  installs the headless shell): hover/press/ring/rested with the real mouse, keyboard (Enter on down,
  Space on up, `held`), reduced motion and `motion="full"`, theming by CSS and dark mode, zero
  network requests and no wasm/canvas/watermark on the demo, the loop sleeping once settled and
  waking on input, pausing off-screen — and a replay cross-check: a real browser session's trace,
  run through `anima sample`, gives the same values, states and every SVG attribute.

**Size.** The strict runtime measured 16.4 KB (esbuild) → 15.2 KB (terser). Two parallel attempts
(GPT-6.1-Sol and Opus 5.5, same brief, separate worktrees) shrank it without removing any check or
feature: Sol plateaued at 14 950 B, Opus at **14 636 B** (kept: `#private` internals, terse thrown
text, tighter loader/player/path code). Opus also ran a parity checker over 6 060 documents and 40 k
random paths: identical diagnostics (codes and pointers in the terse build), player output and SVG.
Ablation showed the rest is required code: lighter browser validation would only reach ~13.1 KB, and
under 12 KB would also need DOM hit testing. **The owner raised the budget to 25 KB** instead, so
the browser keeps full strict validation and the one hit test it shares with the CLI.

**Decisions**

- `src` is the only fetch the runtime makes, and only because the page asked; inline documents make
  no requests at all.
- Property-name mangling was tried and dropped (−170 B, breaks string-keyed tables).

**Open**

- The browser renders through the same `attrs()` as `anima render`, so Rive-frame comparisons from
  M3 carry over; a direct browser screenshot comparison with the Rive frames is not automated.

### M4 — Firefox fix: stale clapper (2026-11-05)

**Report (owner, Firefox on macOS, GPU renderer).** Ringing a second time while hovering, the clapper
was drawn stationary for ~100 ms while the swing moved, then snapped (~0.2 units) when the runtime
removed its identity `transform`; the same on first hover. Computed values were smooth; headless
Chromium and headless Firefox (Linux) rendered correctly.

**Fix** (`packages/core/src/svg.ts`, used by the browser and `anima render`):

1. Transforms live only on `<g>` wrappers: every node is a `<g>` carrying `transform`, `opacity` and
   `display`; the painted `<path>`/`<circle>`/… inside it is never transformed. The knockout's cut in the
   `<mask>` gets the same wrapper.
2. Those three attributes are always present: identity is written `matrix(1 0 0 1 0 0)` and opacity
   `1`, so no attribute is ever added or removed during playback.
3. The knockout mask is attached for the document's whole life (no more toggling `mask` while the
   dot is hidden), on a wrapper with no transform of its own.

`anima new` rest frames stay pixel-identical to the glyph SVGs; the replay test and the Rive frame
comparison are unchanged. Bundle 14 545 B gz.

**Tests.** The browser suite now runs in Chromium **and Firefox** (Playwright, cached Firefox 157; CI
installs both). New regression test, in both browsers: the bell with body and clapper recoloured,
driven by a manual frame clock (rAF and `performance.now` advance only when the test ticks, so a
screenshot cannot let the runtime step between capture and measurement); first hover, a ring, then a
second ring while hovering, 201 frames; every frame the pixel centroids of clapper and body must be
where the player's world matrices put them (≤ 0.1 units at 20 px/unit) and the clapper may not jump
more than the model moved. Worst error 0.016 (Chromium), 0.019 (Firefox). A mutation that leaves the
clapper stale on some frames fails it in both browsers (0.37 units).

**GPU-rendered Firefox (not macOS).** On an Agent Desktop with Firefox ESR 153, hardware WebRender on
an NVIDIA GTX 1650 (`about:support`: "Compositing: WebRender", GL via VirtualGL), the sequence was
screen-recorded and every captured frame checked against frames rendered from the model (resvg, same
geometry); 8× slow motion and only frames that held still across two captures, to rule out capture
tearing. Old build: 1 of 4 runs had a stale-paint episode (4 stable frames, the swing body 0.15 units
off during the second ring); fixed build: 0 of 4 runs, every frame within 0.08 units (typically 0.012).
**The macOS symptom itself (stationary clapper, snap at ~1.07 s) did not reproduce on Linux**, so the
fix is not verified on the platform that showed it; it needs a check on the owner's Mac.
Gotchas found on the way: the desktop reports `prefers-reduced-motion: reduce` (the runtime then
correctly jumps every ring to its end; override `ui.prefersReducedMotion` to test motion), and 60 fps
X11 capture of a VirtualGL window tears.

## Phase A — Rive capability inventory (2026-11-05)

**Changed**

- `docs/parity/`: `inventory.json` (source of truth), generated `INVENTORY.md`, `MATRIX.md`,
  `matrix.json`, and the hand-written `README.md` (method, sources, module split, budgets, phase
  order, oracle tests). `tools/parity.ts` generates the views; `tools/parity.test.ts` checks them.
- 1 238 capabilities in 18 categories from the Rive CLI 1.9.0 (docs, schema, help), rive-runtime @
  1c8f5d3 and rive-wasm @ ada7b9f (read-only clones outside the repo), rive.app/docs, and our notes.
  Four parallel researchers (one per category group) wrote 1 275 rows; 37 duplicates merged.

**Decisions**

- Priorities from the owner: web runtime, AniML, Glyphy and the playground first. 162 capabilities are
  "maybe-later" (native runtimes, editor round-trip, cloud tooling, low-level GPU API, 3D,
  parallel/network scripting, video export); 3 are "won't do", all guardrail conflicts (.riv I/O,
  watermark, Rive account).
- The playground/inspector moves ahead of the first Phase B block (P3), because it is the owner's main
  tool and makes every later phase easier to check.
- Audit: 111 capabilities are done in 0.1; `exit-time-seconds` downgraded to partial.
- Copy check: one 7-word overlap in 1 238 descriptions against the 179 k-word `rive docs` corpus.

**Open**

- Module budgets are estimates until each phase measures its module.
- Scripting language: chosen in P9, with the reasoning in the spec.
