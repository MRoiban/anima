# Fixtures

- `glyphs/*.svg` — nine glyphs made with Glyphy in the anthropic.com interface style (20-unit grid,
  1-unit stroke, filled outlines, `fill-rule="evenodd"`, `currentColor`). `glyphy.toml` is the Glyphy
  project's style file.
- `bell/bell.svg` — the glyph `examples/bell.ani` animates. Subpaths: 0 outer body, 1 body hollow,
  2 clapper.
- `bell/rive-reference/` — the same animation built with the Rive CLI 1.9.0, kept as the behavioural
  reference:
  - `gen_scene.py` — generator holding the exact keyframes, eases, pivots, states and listeners
    (frames at 60 fps, angles in radians — Anima uses seconds and degrees).
  - `scene.rml` — its output (Rive's markup).
  - `frames/` — headless Rive renders at 240×240 in dark-mode colours (ink `#f0eee6` on `#1d1d1d`),
    produced by `frames/commands.txt`: rest, hover, ring at frames 3/7/17/27/57, rested, pointer out.
  - `page-template.html` — the web page that hosted the Rive version.
