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
