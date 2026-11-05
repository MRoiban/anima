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
