# Anima ↔ Glyphy compatibility research

Sources read (read-only):
- Installed Glyphy 0.2.0: `/home/jarvis/.local/share/uv/tools/glyphy/lib/python3.13/site-packages/glyphy/` (identical to `src/glyphy/` in a shallow clone of MRoiban/glyphy @ `ea40694`, cloned to `a local shallow clone of MRoiban/glyphy`; `diff -rq` shows no differences).
- Project: `/data/t3/projects/antrophic-glyphs/icons/` (`glyphy.toml`, `glyphs/*.svg`, `glyphs.json`, `glyphs-sprite.svg`, `out/baseline.json`, `out/report.json`, `out/brief.md`), `/data/t3/projects/antrophic-glyphs/reference/{anthropic,extras}/`, `/data/t3/projects/antrophic-glyphs/drafts/claude-svg/`.
- Bell: `fixtures/bell/rive-reference/gen_scene.py`, generated `scene.rml`, `build/inspect.json`, `web/template.html`, `web/make_page.py`. Rive semantics (units, flags) were checked with `~/.rive/bin/rive schema` and are noted where they matter.

---

## 1. Glyphy's style model

### 1.1 `glyphy.toml` layout

All lengths are **grid units** (1 unit = 1 px at native size). Sections: `[style]` (rules), `[trace]` (vectorisation knobs), `[paths]`, `[brief]`, `[glyphs.<name>]`, `[picks]`. Loaded by `glyphy.config.load()`, which merges each section over `DEFAULT_STYLE` / `DEFAULT_TRACE` / `DEFAULT_PATHS` / `DEFAULT_BRIEF`. `Project.settings(name)` returns `{**style, **trace, **glyphs[name] minus concept/replaces}`, so any style/trace key can be overridden per glyph.

The project's actual `[style]` (20-unit grid, measured from 39 anthropic.com icons):

```toml
[style]
grid = 20                    # units per side of the canvas (hand-set; default 16)
stroke = 1.0                 # measured: median stroke width
stroke_tolerance = 0.12      # hand-set: |measured - target| allowed
letter_stroke = [0.95, 1.0]  # measured: accepted letterform stroke range
letter_stroke_target = 0.99  # measured
live = 14.94                 # measured: largest ink-box side for icons (median of max(w,h))
letter_height = 15.97        # measured
pad_min = 1.88               # measured: minimum padding on every side
centring_max = 0.5           # hand-set: |pad_l-pad_r| + |pad_t-pad_b|
crisp_reference = 0.4        # measured, informational
roughness_reference = 0.23   # measured, informational
roughness_max = 0.0          # 0 = report only
locked = []                  # keys `glyphy measure` must not overwrite
```

`[trace]` holds ~40 knobs (method `vector`, `work_scale` 64, `decimals` 3, `corner_deg`, `line_tol`, `curve_tol`, `snap_deg`, `vector_mitre_limit` 4.0, `offsets` 4, `hint` false, potrace params, …). `[paths]`: `reference`, `generated`, `traced`, `picked = "glyphs"`, `out`. `[brief]`: `variants`, `image_size`, `notes`, `template`.

Per glyph (this project):

```toml
[glyphs.bell]
concept = "a notification bell with a small clapper arc below"
kind = "icon"            # "icon" | "letter"
# optional: replaces = "<reference icon>", box = [w, h], stroke_target = x, any style/trace key
[picks]
bell = "bell-1"          # chosen variant stem in traced/
```

### 1.2 What the style model does NOT contain

- **No caps / joins / corner radius.** There is no `linecap`/`linejoin` key. The only join-like settings are tracing internals (`stroke_shape = "cross" | "round" | "mitre"`, `mitre_limit`, `vector_mitre_limit` — the vector pipeline offsets outlines with **mitred** joins to correct weight). Caps and joins are whatever the drawing had. The anthropic references are filled outlines of strokes with **round caps** (e.g. `arrow-down.svg` ends `M10 3C10.2761 3.00006 10.5 3.2239 10.5 3.5` — a 0.5-unit radius) and rounded outer joins. Anima must therefore carry its own cap/join defaults (round for this set) for any stroke it authors (e.g. the bell's sound waves).
- No colour, no optical size, no corner radius, no names beyond keys, no tags/categories.

### 1.3 How a style is measured (`glyphy measure` → `style.measure_references`)

1. Every file in `reference/` (SVG, PNG/JPG/WEBP) is rendered to a mask at **32 px per unit** (`grid*32` square; SVGs via CairoSVG with `currentColor` replaced by `#000`; the viewBox is scaled into the square, so 14- or 24-unit icons would be rescaled onto the 20 grid — note `reference/extras/` has such off-grid icons and is deliberately not used).
2. `metrics.measure(mask)`: **stroke** = median of `2 × distance-to-edge` along the skeleton, using only the 20th–80th percentile band (junctions/corners inflate it); ink bbox `width/height`, `pad_*`, `coverage`, `components`, `holes`; `centring` = |pl−pr|+|pt−pb|.
3. Rules: `stroke` = median stroke (rounded 0.01); `live` = min(grid, median of max(w,h)); `pad_min` = max(0.25, 0.75 × min(median pad, (grid−live)/2)); letterforms (h ≥ 0.6·grid and w ≤ 0.75·h) set `letter_height`, `letter_stroke`, `letter_stroke_target`; `crisp_reference` = median share of solid pixels at 1 px/unit; `roughness_reference` = roughest reference's wobbles/unit (ceil to 0.01). Keys in `locked` are kept.
4. Writes `out/baseline.json` (stats: median/p10/p90 for stroke, box_side, min_pad, coverage, centring, crispness, roughness; letterforms; `derived_style`; `icons_measured` per icon) and `out/reference-sheet.png`. Here: stroke median 1.0 (p10 1.0, p90 1.01), box_side median 14.938, min_pad median 2.5, crispness median 0.4.

Checks (`trace.check`) use the **same** measuring code: `stroke_ok` (|stroke − target| ≤ 0.12), `box_ok` (≤ live + 0.05), `pad_ok` (≥ pad_min − 0.01), `centring_ok` (≤ 0.5), optional `roughness_ok`; plus `crisp`/`crisp_2x`. `glyphy check <files>` runs this on any finished SVG (exit 1 on failure) — usable by Anima to verify rendered frames/poses.

---

## 2. Glyphy's outputs

### 2.1 Picked glyph SVG (`glyphs/<name>.svg`, copied verbatim from `traced/<stem>.svg`)

Written by `vector.to_svg` (vector method) / `trace.to_svg` (raster method). Exact template, one line + `\n`:

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {grid} {grid}" fill="currentColor"><path fill-rule="evenodd" d="{d}"/></svg>
```

- `viewBox="0 0 20 20"`, **no width/height**, no `<title>`, no class/id, no `xmlns:xlink`.
- `fill="currentColor"` on the root; **one `<path>`**, `fill-rule="evenodd"`.
- Path grammar (`vector.to_d`): absolute, uppercase **`M`, `L`, `C`, `Z` only**; every segment repeats its command letter; coordinates separated by single spaces, no commas; numbers formatted `f"{v:.3f}"` with trailing zeros/point stripped (`decimals = 3`), `-0` → `0`, never exponent or leading `.`; each subpath is `M … Z`, the next `M` follows `Z` directly. Whole project: 25 M, 352 L, 540 C, 25 Z — nothing else.
- Holes are separate subpaths under even-odd (winding is not guaranteed opposite; bell's outer is negative signed area, its hollow positive — treat as even-odd only).
- The vector pipeline does not de-duplicate near-coincident points; outlines contain many short `L` runs (bell: 129 segments, roughness 0.186).
- References and hand drafts use richer syntax (`H`, `V`, relative commands, `a` arcs, `<rect>`, `stroke=`…); Anima's parser must accept full SVG path syntax, but may assume M/L/C/Z for Glyphy finals.

### 2.2 `glyphs.json` (`glyphy export -f json`)

`json.dumps({"grid": grid, "glyphs": {name: d}}, indent=1)`, names sorted (from sorted `glyphs/*.svg`). **Only grid and path data** — no concept, kind, variant, size, report numbers. Trimmed real example:

```json
{
 "grid": 20,
 "glyphs": {
  "bell": "M9.493 4.473C9.423 4.49 9.326 4.517 9.256 4.493L8.602 4.66 … L9.494 4.444C9.494 4.454 9.494 4.463 9.493 4.473ZM4.988 13.492L5.57 12.823 … L4.974 13.584L4.988 13.492ZM10.173 17.469C10.219 17.457 … C9.521 17.454 9.849 17.458 10.173 17.469Z",
  "bookmark": "M5.863 2.753C5.592 2.964 5.323 3.196 5.181 3.517 …Z",
  "folder": "M2.55 10.796L2.55 14.411 …Z",
  "home": "…", "moon": "…", "pencil": "…", "sparkle": "…", "terminal": "…", "trash": "…"
 }
}
```

`_paths()` extracts with regex `\sd="([^"]+)"` — the **first** `d=` only; multi-path SVGs would silently lose paths.

### 2.3 Sprite (`-f sprite`, `glyphs-sprite.svg`)

One line + `\n`:

```
<svg xmlns="http://www.w3.org/2000/svg" style="display:none"><symbol id="bell" viewBox="0 0 20 20"><path fill-rule="evenodd" d="…"/></symbol><symbol id="bookmark" …>…</symbol>…</svg>
```

Symbol `id` = glyph name; **no `fill` attribute** on symbol/path (inherits from the `<use>` context; consumers must set `fill: currentColor`). The Claude skill warns that `svg { fill: none }` base CSS overrides the `fill` attribute.

### 2.4 TypeScript (`-f ts`, default)

```ts
// Generated by glyphy. Each glyph is one even-odd path on the grid below.
export const GLYPH_GRID = 20;
export const GLYPH_PATHS = {
  "bell": "M…Z",
  …
} as const;
export type GlyphName = keyof typeof GLYPH_PATHS;
```

### 2.5 Metadata available (only in the project, not in exports)

| Where | What |
|---|---|
| `glyphy.toml [glyphs.<name>]` | `concept` (free text), `kind` (`icon`/`letter`), optional `replaces`, per-glyph overrides (`box`, `stroke_target`, any style/trace key) |
| `glyphy.toml [picks]` | `name → variant stem` (`bell → bell-1`) |
| `out/report.json[<stem>]` | `glyph`, `raw_stroke`, `stroke`, `stroke_target`, `box`, `min_pad`, `centring`, `*_ok`, `ok`, `roughness`, `crisp`, `crisp_2x`, `vector_match`, `vector_worst`, `hint_match`, `offset`, `draft_transform` [S, tx, ty] (draft px → units), `stroke_offset`, `segments`, `bytes`. Bell-1: stroke 1.002, box [12.25, 14.94], min_pad 2.53, crisp 0.22 / 0.63, segments 129. |
| `out/baseline.json` | measured style stats |

No tags, categories, aliases, keywords, licence, or variant families exist anywhere.

---

## 3. CLI, extension points, packaging, tests

### 3.1 Commands (`glyphy --help`, v0.2.0)

All take `--project/-p` (default `.`): `init [-r refs…] [--grid 16] [--force] [--profile classic|refined|vector]`, `measure [--json]`, `add <name> <concept> [--kind icon|letter] [--replaces X]`, `brief [--print] [--set K=V…]`, `trace [--only …] [--offsets N] [-j N] [--set …] [--json]`, `check <files…> [--kind] [--set]`, `inspect [stems…]`, `sheet`, `pick [name=variant…] [--best]`, `export -f {ts,json,sprite} -o OUT` (required `-o`), `status`, `set [K=V…] [--profile] [--lock]`, `config [--glyph NAME]`.

### 3.2 Extension points: none formal

- `export -f` choices are **hard-coded** in argparse (`choices=["ts","json","sprite"]`) and in an `if/elif` in `export.export()`. No exporter registry, no entry points, no plugin discovery, no subcommand hooks.
- Adding `-f ani` upstream = edit `cli.py` choices + a branch in `export.py` (or refactor to a dict registry, optionally fed by an `importlib.metadata` entry-point group like `glyphy.exporters`). `glyphy animate` would be a new `command(...)` in `cli.main`.
- Repo rules (`AGENTS.md`) any upstream change must follow: every CLI behaviour also reachable as a public Python function; every number from `Project.settings()` (new keys go in `DEFAULT_*` and the README table); new ideas behind settings that are off by default; keep `skills/glyphy-{claude,gpt}/SKILL.md` in step with the CLI; `pytest -q` must pass.
- Non-invasive route (recommended first): a separate `anima` Python package that imports Glyphy's public API: `glyphy.load(root) → Project` (`.grid`, `.style`, `.glyphs`, `.picks`, `.path("picked")`, `.settings(name)`), `glyphy.check_svg(project, svg)`, `glyphy.measure_svg`, `glyphy.crispness`. Path extraction is the private `glyphy.export._paths` (re-implement: regex on `glyphs/<name>.svg`, or read `glyphs.json`). Reading only files (toml + svg/json) avoids a hard dependency on Glyphy's heavy deps (cairo, scipy, skimage, shapely, potracer).

### 3.3 Language / packaging / tests

- Python ≥ 3.11 (installed on 3.13), hatchling, `src/glyphy` layout, script `glyphy = "glyphy.cli:main"`. Deps: numpy, pillow, scipy, scikit-image, cairosvg, potracer, tomli-w, shapely; TOML read via stdlib `tomllib`, written with `tomli-w` (`Project.save()` rewrites the whole file with a fixed header — an Anima writer must not hand-edit glyphy.toml through Glyphy, or comments/order get normalised).
- Tests: single `tests/test_pipeline.py` (pytest, `.[test]` extra), synthetic SVG icons rendered to PNG drafts; `test_pick_and_export` checks `'"box":'` and `GLYPH_GRID = 16` in TS output; `test_defaults_reproduce_the_example` retraces `examples/codicon-style` and compares renders **pixel-for-pixel** at 512 px. Anima can copy this pattern: render the `.ani` rest frame and compare with `glyphs/<name>.svg`.
- Example project `examples/codicon-style/` (16-unit grid) ships `export/glyphs.ts` and `export/glyphs.json` — a second fixture source with a different grid.

### 3.4 What a Python-side `.ani` writer needs

1. `grid` (`style.grid`), glyph name, path `d` (from `glyphs/<name>.svg` or `glyphs.json`), and ideally `style.stroke`, `style.live`, `style.pad_min`, `concept`, `kind`, pick stem.
2. A tokenizer for M/L/C/Z (bell's `parse_contours` is 30 lines) to split subpaths, compute bboxes and pick parts.
3. A content hash of the source `d` (to detect when a re-trace invalidates part references).
4. Optional: `glyphy.check_svg` on rendered poses to verify stroke stays within tolerance.

---

## 4. Compatibility requirements for `.ani`

1. **Units = glyph grid units.** Store `grid` (20) and author all geometry, pivots, offsets and stroke widths in units, y-down, origin at the glyph's top-left — exactly the SVG viewBox space, so Glyphy path data is used unmodified. Pixels appear only at render time (the bell used 10 px/unit; Glyphy treats 1 unit = 1 px at native size). Rotation: pick one unit and say it (Rive uses radians; the fixture below gives both).
2. **Canvas with bleed.** Animations overflow the glyph grid (waves, swing, hover scale). The bell uses a 24-unit artboard with the 20-unit grid centred (2 units of bleed each side ⇒ viewBox `-2 -2 24 24`). `.ani` needs `grid` plus an explicit `canvas`/`bleed`, and the host should lay out by the grid box, not the canvas.
3. **Embed path data byte-identical.** Copy Glyphy's `d` string verbatim (or reference `glyphs.json#bell` / `glyphs/bell.svg` plus a hash). Do not convert to vertex/handle form or re-quantise, as `gen_scene.py` had to for Rive. Keep `fill-rule: evenodd` as the default.
4. **Address parts by subpath, not by rewriting geometry.** Glyphy emits one path; animation needs parts (bell: body = subpaths 0+1, clapper = subpath 2). `.ani` should let a node take `subpaths: [i…]` (0-based, in `d` order) from the source path, evaluated with even-odd within the group. Geometry stays in absolute glyph coordinates; nodes carry a **pivot/origin** in glyph units, rather than translating geometry into pivot-local space as Rive needed. Hole-and-outline pairs must stay together in one fill (body outer + hollow). Re-traces can renumber subpaths, so store the source hash and optionally a selector (e.g. "lowest bbox") for regeneration.
5. **Filled outlines, not strokes.** Every Glyphy final is a filled outline of a ~1-unit stroke, with no centreline. Implications:
   - Stroke draw-on/trim, stroke-width animation, and dash effects cannot be applied to glyph ink directly. Options: (a) reveal through a **mask** whose geometry is a stroked approximate centreline (width > 1 unit) animated with trim — the visible ink stays the exact outline; (b) a separate authored centreline (the hand drafts in `drafts/claude-svg/*.svg` are true centreline strokes, `stroke-width 1`, round caps/joins, but they are not the picked geometry: Claude's bell has no handle); (c) a future Glyphy option to emit centrelines (it only has pixel skeletons today, `fidelity.Centreline`).
   - Scaling a node scales stroke weight. Glyphy's own check allows `stroke ± stroke_tolerance` (1.0 ± 0.12). The bell's poses (hover 1.05, press 0.95, waves up to 1.08) stay inside it. A useful lint: the stroke weight at any held pose must stay within tolerance (checkable with `glyphy check`).
   - Authored ink (waves) must use **native stroke primitives** with width = `style.stroke` and round caps/joins, declared in `.ani` because Glyphy has no cap/join fields.
   - Morphing between glyphs is impractical: point counts and structure differ per trace (129 segments for bell).
6. **Rest frame equals the static glyph.** At rest every transform should be identity and every added element invisible, so the first frame matches `glyphs/<name>.svg` pixel for pixel. That keeps Glyphy's crispness choice (sub-pixel offset picked for 1×/2×; any rotation or scale breaks it). The bell does this: Idle has the dot at scale 0 and the waves at opacity 0. A runtime may render the plain SVG when idle.
7. **Theming via `currentColor`.** Glyphy ink is `fill="currentColor"` (the sprite inherits fill). `.ani` should define a primary paint `ink` that defaults to `currentColor`, plus named extra paints (bell: `paper`, `accent`) the host can set (CSS custom properties such as `--anima-accent`, or a JS API). The bell's "cutout" is a paper-coloured disc and breaks on non-solid backgrounds. `.ani` should provide true knockout (mask/clip, or a boolean subtract) so it needs no `paper` colour.
8. **Naming.** Glyph name = `glyphs/<name>.svg` stem = `[glyphs.<name>]` key = JSON key = sprite `<symbol id>` = TS key. Names are kebab-case in practice (`arrow-right-to-line`, `comment-toggle`). `<name>-<digits>` is reserved for variant stems (`trace.glyph_name` strips a numeric suffix), so a glyph name must not end in `-<n>`. Suggested: `bell.ani` beside `glyphs/bell.svg`, `glyph: "bell"`, and an id regex such as `^[a-z0-9]+(-[a-z0-9]+)*$` that rejects a trailing `-\d+`.
9. **Metadata pass-through.** Carry `concept`, `kind`, `grid`, `stroke`, the source pick (`bell-1`) and the source hash into `.ani` metadata. Glyphy's exports drop all of these, so read `glyphy.toml` for them.
10. **Timing.** The fixture is authored in frames at 60 fps. `.ani` can store ms or frames, but must state the rule for which keyframe's easing applies (Rive: the easing on key *k* shapes segment *k → k+1*; the last key holds).
11. **Accessibility and host wiring** (from the page): a native `<button>` host with an `aria-label`, keyboard Enter/Space firing the same trigger as a click, an `aria-live` counter, and theme re-application on `prefers-color-scheme` and `data-theme` change. The template does **not** handle `prefers-reduced-motion`, and `.ani` should define that behaviour.

---

## 5. Reference fixture: the bell animation (exact data from `gen_scene.py`)

### 5.1 Constants

| Name | Value | Notes |
|---|---|---|
| Source glyph | `icons/glyphs/bell.svg` (pick `bell-1`) | 3 subpaths, 129 segments |
| Grid | 20 units | |
| Artboard | 240 × 240 px = **24 × 24 units** | `SCALE = 10` px/unit; glyph grid centred ⇒ glyph (gx, gy) → artboard px ((gx+2)·10, (gy+2)·10) |
| Colours (ARGB) | INK `FF141413` (#141413), PAPER `FFFAF9F5` (#FAF9F5), CLAY/accent `FFD97757` (#D97757) | page dark theme sets ink #f0eee6, paper #1f1e1d, accent #e08a6d |
| fps | 60 | all animations `oneShot` |

Pivots (glyph units):

| Pivot | (x, y) | Meaning |
|---|---|---|
| ICON centre (Hover node) | (10, 10) | artboard centre (120, 120) px |
| SWING | (10.0, 2.5) | top of the handle (handle top ≈ y 2.578) |
| CLAPPER | (10.0, 9.0) | inside the bell, above the clapper |
| WAVES | (10.0, 7.0) | centre of the sound arcs |
| DOT | (14.9, 4.6) | notification-dot centre |

### 5.2 Glyph subpaths (in `d` order)

Endpoint-based bboxes (glyph units; curves may bulge slightly):

| # | Role | Start point | bbox (x0, y0, x1, y1) | Segments | Assigned to |
|---|---|---|---|---|---|
| 0 | Body outer (with handle) | (9.493, 4.473) | (3.974, 2.578, 15.949, 14.621) | 23 L + 35 C = 58 | Body (even-odd with #1) |
| 1 | Body hollow | (4.988, 13.492) | (4.974, 5.357, 15.033, 13.584) | 20 L + 18 C = 38 | Body |
| 2 | Clapper (filled arc outline) | (10.173, 17.469) | (7.735, 15.02, 12.262, 17.469) | 33 C | Clapper |

Selection rule in the generator: the clapper is the contour with the largest min-y, and the other two are the body. It asserts exactly 3 contours.

### 5.3 Node tree

Positions are in glyph units, absolute (the Rive file stores them parent-relative in px; parent-relative values are in brackets). Rive draw order puts the **first declared on top**. The list is top-down in declaration order.

```
Hover          origin (10,10)         [artboard px (120,120)]   animated: scaleX, scaleY, rotation (Hover layer)
└─ Icon        origin (10,10)         [0,0]                      identity, never animated
   ├─ Waves    origin (10,7)          [0,-3 units]               container, not animated
   │  ├─ w_r1  opacity 0 (initial)   arc r=6.6, right            animated: opacity, scaleX, scaleY about (10,7)
   │  ├─ w_r2  opacity 0              arc r=8.2, right
   │  ├─ w_l1  opacity 0              arc r=6.6, left (mirrored)
   │  └─ w_l2  opacity 0              arc r=8.2, left (mirrored)
   └─ Swing    pivot (10,2.5)         [0,-7.5 units]             animated: rotation
      ├─ Dot   centre (14.9,4.6)      [4.9, 2.1 units]  scaleX=0, scaleY=0 initially; animated: scaleX, scaleY
      │  ├─ Badge   ellipse Ø 3.0 units (r 1.5), fill accent        (on top)
      │  └─ Cutout  ellipse Ø 5.4 units (r 2.7), fill paper         (knocks the body out around the dot)
      ├─ Body  subpaths 0+1, fill ink, evenOdd
      └─ Clapper Pivot  pivot (10,9)  [0, 6.5 units]            animated: rotation (composes with Swing)
         └─ Clapper  subpath 2, fill ink, evenOdd
Hit            ellipse Ø 21.6 units (216 px), centre (10,10), fill 00000000 (transparent)   (bottom; listener target)
```

Painter's order bottom→top: Hit, Clapper, Body, Cutout, Badge, w_l2, w_l1, w_r2, w_r1.

Wave arcs: stroke width **1 unit**, `cap round`, `join round`, colour ink. Each arc is one cubic from −46° to −18° (y-down angles, so up-right; mirrored arcs face left). Handle length k = 4/3·tan(Δ/4)·r: 1.0805 (r 6.6) and 1.3424 (r 8.2). Absolute glyph-unit geometry:

| Arc | d (glyph units) |
|---|---|
| w_r1 (r 6.6) | `M14.5847 2.2524 C15.362 3.0029 15.9431 3.9329 16.277 4.9605` |
| w_r2 (r 8.2) | `M15.6962 1.1014 C16.6619 2.034 17.3838 3.1893 17.7987 4.4661` |
| w_l1 (r 6.6) | `M5.4153 2.2524 C4.638 3.0029 4.0569 3.9329 3.723 4.9605` |
| w_l2 (r 8.2) | `M4.3038 1.1014 C3.3381 2.034 2.6162 3.1893 2.2013 4.4661` |

Rive stored the r 6.6 right arc as vertex px (45.8475, −47.4764) → (62.7697, −20.3951) relative to Waves, with outRotation 0.7679 rad and inRotation −1.885 rad.

### 5.4 Easings

| Name | Definition |
|---|---|
| EASE_IO | cubic-bezier(0.45, 0, 0.55, 1) |
| EASE_OUT | cubic-bezier(0.2, 0, 0.3, 1) |
| EASE_IN | cubic-bezier(0.6, 0, 0.9, 0.6) (defined, unused) |
| DOT_POP | elastic easeOut, amplitude 1 (× change), period 0.45 (× segment duration) |
| hold | step: value holds until the next key |

Rule: the easing written on key *k* shapes the segment from key *k* to key *k+1*. The last key of every track is `hold`.

### 5.5 Timelines (frames @ 60 fps; rotation in radians, degrees in brackets)

**Idle** (duration 1 frame): Dot scaleX = 0, scaleY = 0 (single key at frame 0).

**Ring** (duration **84 frames** = 1400 ms, oneShot):

| Target.prop | Keys (frame: value) | Segment easings |
|---|---|---|
| Swing.rotation | 0: 0 · 7: 0.30 [17.19°] · 17: −0.24 [−13.75°] · 27: 0.16 [9.17°] · 37: −0.10 [−5.73°] · 47: 0.055 [3.15°] · 57: −0.02 [−1.15°] · 66: 0 | 0→7 EASE_OUT; all later segments EASE_IO; 66 hold |
| Clapper Pivot.rotation | 0: 0 · 5: −0.12 [−6.88°] · 13: 0.17 [9.74°] · 23: −0.13 [−7.45°] · 33: 0.09 [5.16°] · 43: −0.05 [−2.86°] · 53: 0.02 [1.15°] · 63: 0 | 0→5 EASE_OUT; later EASE_IO; 63 hold |
| Dot.scaleX | 0: 0 · 40: 0 · 58: 1 · 84: 1 | 0→40 hold; 40→58 DOT_POP; 58→84 DOT_POP (constant 1); 84 hold |
| Dot.scaleY | same as scaleX | same |
| w_r1.opacity, w_l1.opacity | 0: 0 · 1: 0 · 8: 1 · 31: 0 | 0→1 hold; 1→8 EASE_OUT; 8→31 EASE_OUT; 31 hold |
| w_r1/w_l1.scaleX, .scaleY | 0: 0.82 · 1: 0.82 · 31: 1.08 | 0→1 hold; 1→31 EASE_OUT; 31 hold |
| w_r2.opacity, w_l2.opacity | 0: 0 · 7: 0 · 14: 1 · 37: 0 | 0→7 hold; 7→14 EASE_OUT; 14→37 EASE_OUT; 37 hold |
| w_r2/w_l2.scaleX, .scaleY | 0: 0.82 · 7: 0.82 · 37: 1.08 | 0→7 hold; 7→37 EASE_OUT; 37 hold |

The generator expresses the waves as t0 = 1 (inner pair, which leads) or t0 = 7 (outer pair): opacity keys (0,0) (t0,0) (t0+7,1) (t0+30,0); scale keys (0,0.82) (t0,0.82) (t0+30,1.08). Wave scale pivots on the Waves origin (10,7), the arc centre.

**Rested** (1 frame): Dot scaleX = 1, scaleY = 1. After the first ring the dot stays visible. On a re-ring, the Ring timeline resets and the dot drops to 0 at frame 0, then pops again at 40–58.

**Rest** (1 frame): Hover scaleX = 1, scaleY = 1, rotation = 0.
**Hover** (1 frame): Hover scaleX = 1.05, scaleY = 1.05, rotation = −0.035 [−2.005°].
**Press** (1 frame): Hover scaleX = 0.95, scaleY = 0.95, rotation = −0.015 [−0.859°].

Hover/Press scale and rotate about the Hover origin, the glyph centre (10,10).

### 5.6 View model "Bell" (default instance "Default", exported)

| Property | Type | Default | Bound to |
|---|---|---|---|
| `ring` | trigger | — | fired by click listener and page keyboard; Ring-layer conditions |
| `hover` | boolean | false | set by enter/exit listeners; Hover-layer conditions |
| `down` | boolean | false | set by down/up/exit listeners; Hover-layer conditions |
| `ink` | color | FF141413 | Body fill, Clapper fill, all 4 wave strokes |
| `paper` | color | FFFAF9F5 | Dot Cutout fill |
| `accent` | color | FFD97757 | Dot Badge fill |

### 5.7 Listeners (all on target `Hit`)

| Name | Event | Action |
|---|---|---|
| Ring | click | fire `ring` |
| In | pointer enter | `hover = true` |
| Out | pointer exit | `hover = false`; `down = false` |
| Press | pointer down | `down = true` |
| Release | pointer up | `down = false` |

### 5.8 State machine "Bell" (two layers run in parallel; AnyState and ExitState exist but are unused)

Layer **Ring**:

| From | To | Condition | Mix duration |
|---|---|---|---|
| Entry | Idle | — | 0 |
| Idle (anim Idle) | Ring | `ring` fired | 0 |
| Ring (anim Ring, `reset` flag) | Rested | exit time 100% of Ring (`enableExitTime`, `exitTimeIsPercetange` [sic], exitTime 100) | 0 |
| Rested (anim Rested) | Ring | `ring` fired | 0 |

A ring during Ring is ignored: Ring has no trigger transition, so it plays to the end first.

Layer **Hover** (mix durations are **milliseconds**, linear cross-fade between poses):

| From | To | Condition | Duration |
|---|---|---|---|
| Entry | Rest | — | 0 |
| Rest | Hover | `hover == true` | 180 ms |
| Hover | Rest | `hover == false` | 220 ms |
| Hover | Press | `down == true` | 90 ms |
| Press | Hover | `down == false` | 160 ms |
| Press | Rest | `hover == false` | 220 ms |

Transitions are evaluated in the listed order within each state. The Ring layer keys Swing, Clapper Pivot, Dot and the waves; the Hover layer keys only Hover. The layers never touch the same property.

### 5.9 Host page behaviour (`web/template.html`)

- Title "Ringing Bell". `<button class="stage" aria-label="Ring the bell">` wraps a 240×240 `<canvas>` (CSS 240 px, so 10 px/unit), with a 24 px border radius and a 1 px `--line` border. Focus ring is a 2 px accent outline offset by 4 px.
- Runtime: `@rive-app/canvas-single@2.45.1` (wasm inlined). The `.riv` is inlined as base64 by `make_page.py`, which writes `artifact.html` (fragment) and `index.html` (full document). Options: artboard "Bell", stateMachine "Bell", autoplay, autoBind, `Fit.Contain`, `Alignment.Center`; `resizeDrawingSurfaceToCanvas` on load and resize.
- Theming: CSS vars `--ink/--paper/--accent` (light #141413/#faf9f5/#d97757; dark #f0eee6/#1f1e1d/#e08a6d via `prefers-color-scheme` unless `data-theme="light"`, or `data-theme="dark"`) are written into VM colors as `0xff000000 | rgb`. They are re-applied on media-query change and on `data-theme` attribute mutation.
- Interaction: the file's own click listener fires `ring`. The page fires `ring.trigger()` only for keyboard clicks (`e.detail === 0`, i.e. Enter/Space), so mouse clicks are not doubled. `ring.on(...)` updates an `aria-live` count: "Rang once." / "Rang N times."
- Errors: a message appears if the runtime fails to load, the file has no view model, or loading fails. `window.__bell` exposes the instance.
- No reduced-motion handling.

### 5.10 Appendix: full bell path (source `d`, verbatim)

```
M9.493 4.473C9.423 4.49 9.326 4.517 9.256 4.493L8.602 4.66C8.543 4.675 8.464 4.703 8.409 4.73L7.835 5.016L7.366 5.328L6.888 5.748L6.485 6.211C6.428 6.277 6.354 6.377 6.313 6.452L6.009 6.998C5.984 7.043 5.955 7.099 5.939 7.147L5.714 7.805C5.692 7.871 5.666 7.981 5.659 8.05L5.605 8.614L5.605 10.357C5.605 10.417 5.589 10.486 5.579 10.545C5.532 10.817 5.449 11.086 5.338 11.338C5.317 11.387 5.297 11.444 5.27 11.488L4.972 11.98C4.945 12.023 4.907 12.062 4.876 12.102C4.846 12.139 4.818 12.183 4.788 12.218L4.223 12.866C3.945 13.187 3.76 13.793 3.974 14.186C4.04 14.307 4.138 14.394 4.25 14.469C4.326 14.519 4.484 14.621 4.575 14.621L15.38 14.621C15.516 14.621 15.657 14.542 15.762 14.463C16.203 14.128 16.199 13.552 15.949 13.102C15.905 13.022 15.841 12.912 15.778 12.849L15.262 12.333C15.21 12.281 15.161 12.215 15.114 12.156C14.893 11.882 14.696 11.575 14.579 11.241C14.538 11.125 14.522 11.001 14.487 10.883C14.477 10.847 14.455 10.811 14.447 10.776C14.441 10.749 14.445 10.722 14.434 10.697C14.428 10.684 14.398 10.661 14.398 10.658L14.374 8.304C14.35 8.276 14.373 8.247 14.367 8.216L14.24 7.579C14.222 7.485 14.157 7.3 14.115 7.214L13.8 6.572C13.72 6.411 13.607 6.256 13.495 6.115C13.47 6.084 13.444 6.043 13.417 6.017L12.947 5.547C12.927 5.526 12.92 5.529 12.898 5.516C12.883 5.507 12.878 5.481 12.865 5.471L12.413 5.133L11.93 4.86L11.457 4.664L10.924 4.514C10.806 4.481 10.672 4.484 10.551 4.467L10.551 2.953C10.551 2.912 10.512 2.871 10.497 2.835C10.474 2.782 10.458 2.725 10.417 2.681C10.372 2.631 10.297 2.601 10.236 2.578C9.97 2.476 9.694 2.537 9.563 2.807C9.549 2.835 9.494 2.901 9.494 2.929L9.494 4.444C9.494 4.454 9.494 4.463 9.493 4.473ZM4.988 13.492L5.57 12.823L5.897 12.351L6.137 11.92L6.358 11.384C6.407 11.263 6.477 11.018 6.489 10.891L6.545 10.312L6.545 8.664C6.545 8.614 6.568 8.563 6.573 8.512C6.58 8.444 6.573 8.313 6.587 8.257L6.71 7.763C6.721 7.718 6.738 7.661 6.758 7.62L7.019 7.091C7.058 7.011 7.125 6.899 7.182 6.833L7.559 6.399L7.966 6.043C8.038 5.979 8.127 5.927 8.209 5.876C8.503 5.697 8.827 5.552 9.16 5.462C9.221 5.446 9.292 5.422 9.355 5.416L10.001 5.357L10.614 5.413C10.668 5.418 10.728 5.436 10.781 5.449C11.13 5.532 11.472 5.678 11.777 5.869C11.84 5.908 11.913 5.949 11.968 5.997L12.49 6.456C12.575 6.53 12.646 6.628 12.713 6.719C12.983 7.089 13.202 7.524 13.324 7.966C13.343 8.033 13.369 8.111 13.374 8.18L13.422 8.861L13.422 10.639C13.422 10.953 13.543 11.337 13.66 11.626C13.685 11.687 13.709 11.758 13.741 11.815L14.074 12.399L14.402 12.831C14.43 12.868 14.462 12.899 14.492 12.932L14.939 13.423C14.958 13.444 15.03 13.561 15.033 13.584L4.974 13.584L4.988 13.492ZM10.173 17.469C10.219 17.457 10.27 17.455 10.317 17.447C10.414 17.431 10.51 17.412 10.605 17.387C10.759 17.347 10.907 17.289 11.051 17.224C11.154 17.178 11.26 17.133 11.355 17.073C11.622 16.905 11.838 16.646 12.005 16.382C12.185 16.099 12.376 15.685 12.262 15.346C12.18 15.101 11.838 14.963 11.598 15.035C11.507 15.062 11.439 15.133 11.367 15.19C11.348 15.204 11.322 15.216 11.306 15.233C11.289 15.25 11.282 15.299 11.274 15.322C11.231 15.45 11.196 15.587 11.14 15.71C11.101 15.796 11.036 15.869 10.973 15.939C10.712 16.229 10.312 16.462 9.908 16.385C9.864 16.377 9.821 16.362 9.777 16.355C9.721 16.346 9.663 16.346 9.609 16.328C9.567 16.314 9.529 16.285 9.49 16.264C9.432 16.233 9.368 16.208 9.313 16.171C9.28 16.149 9.256 16.115 9.226 16.089C9.2 16.068 9.17 16.053 9.144 16.032C9.08 15.981 9.027 15.917 8.982 15.849C8.89 15.713 8.848 15.547 8.795 15.393C8.777 15.341 8.764 15.275 8.73 15.231C8.676 15.16 8.597 15.123 8.517 15.089C8.441 15.056 8.361 15.024 8.278 15.02C8.155 15.015 8.045 15.079 7.945 15.141C7.929 15.151 7.896 15.183 7.878 15.185C7.831 15.281 7.747 15.389 7.735 15.497C7.722 15.609 7.777 15.702 7.803 15.807C7.818 15.871 7.823 15.939 7.844 16.002C7.873 16.085 7.93 16.162 7.972 16.24C8.027 16.344 8.067 16.457 8.136 16.554C8.356 16.859 8.86 17.208 9.212 17.339C9.521 17.454 9.849 17.458 10.173 17.469Z
```
