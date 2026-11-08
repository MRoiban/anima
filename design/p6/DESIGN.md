# P6 design: text on the browser

Decided by the orchestrator (2026-11-07) for the 84 P6 rows (`docs/parity/inventory.json`, phase P6),
under the owner's triage (bind to the browser), the size gates (final through P8) and the owner's P6
requirements: text on browser primitives (`measureText`, SVG text, `Intl.Segmenter`, `FontFace`),
per-glyph modifiers kept, a DOM-backed text input bridge, build-time subsetting, Google Fonts import and
text to outlines, separate modules, text input counted as heavy, and the CLI text-rendering choice
recorded with why. Coders implement it; a needed deviation is raised with its reason before it is built.
Decisions not on the owner's ask list are logged in WORKLOG as "decided, owner may revisit".

## 1. Targets and guards

| Metric | Command | Baseline (main aca083b) | Target / guard |
|---|---|---:|---|
| app-UI scene (adds `text`, `text-effects`, `fonts`; not `text-input`) | `node tools/size.ts` | 85 154 B | ≤ 131 072 B; expected ≈ 96 KB |
| each scene | `node tools/size.ts` | largest 52 122 B | ≤ 65 536 B, including the settings-card rerun with text |
| core + web | `node tools/size.ts` | 20 622 B | ≤ 24 576 B; text adds nothing to core + web |
| runtime sum | `node tools/size.ts` | 104 285 B | ≤ 163 840 B |
| authoring add-on | `node tools/size.ts` | 14 544 B | ≤ 15 360 B (P3c cap) |
| Rive-class (heavy, incl. `text-input`) | `node tools/size.ts` | 109 904 B | ≤ 256 000 B |
| frame / compile cost of non-text pages | `node tools/perf.ts` | bell 29.4 µs, bell compile 1.64 ms | within noise (≤ 3 %) |
| benchmark | §9 | settings card AniML 5/6 (item 1 owner-accepted gap) | **exit criterion: item 1 met** (AniML ≥ Rive on both briefs) |

## 2. Modules and budgets

| Module | Class | Holds | Budget |
|---|---|---|---:|
| `text` | runtime | text node, runs, styles, layout (wrap, breaks, alignment, overflow, sizing, origin, spacing, tracking), SVG + canvas drawing, data-bound runs, run lists, style references, text-run host access, hit testing | 6 144 B |
| `text-effects` | runtime | modifiers (translation, rotation, scale, opacity, origin, variable axis), ranges (units, falloff, easing, combine, run scope), follow-path, highlight backgrounds, glyph paint | 4 096 B |
| `fonts` | runtime | font assets through `FontFace`, variable axes (`font-variation-settings`), OpenType features (`font-feature-settings`), host fallback lists, metrics, host decode and replacement | 2 048 B |
| `text-input` | **heavy** | DOM-backed editable field: native `<input>`/`<textarea>` over the drawn text, IME, clipboard, caret and selection geometry from the native selection, limits, placeholder, obscured, multiline, text listeners and writes | 4 096 B |
| CLI (tooling) | no limit | OpenType reader (metrics, kerning, outlines, subsetting), CLI text rendering, `anima import-font` / Google Fonts, text to outlines, exact semantic bounds | — |

`a11y` (2 226 / 2 496 B) takes the text roles and states (`text`, `text-field`, multiline, obscured,
inferred text) only within its budget; anything larger goes into `text-input` (field semantics) or
`text` (inferred text).

## 3. The text model (authoring)

```xml
<text id="title" x="2" y="2" width="20" sizing="auto-height" align="center" overflow="ellipsis"
      wrap="true" word-break="normal" origin="top-left" line-height="1.2" paragraph-spacing="0.5">
  <style id="h" font="inter" size="2" weight="600" tracking="0.02" fill="#141413"/>
  <run style="h" text="$title"/>            <!-- a run bound to a model string -->
  <run style="h" text=" — settings"/>
</text>
```

`.ani`: node `{type: "text", runs: [{style, text}], styles: {…}, sizing, width, height, align, valign,
overflow, wrap, wordBreak, origin, lineHeight, paragraphSpacing}`; registry-driven, both spellings.
Units are grid units (font size included). Font names refer to `fonts` assets or CSS family names.
Runs may come from a list (`runs="$items" text-field="label" style-field="style"`, `text.run-list`).
Text styles may be shared (`<text-style>` at the root, `style-reference`) and bound (`text-style`
model property). Diagnostics with tests for every field (unknown style, bad unit, `overflow` without a
fixed box, etc.).

## 4. Layout: one algorithm, two measurers (the contract)

Core holds the layout algorithm; it never measures glyphs itself. A **measurer** is registered:

```ts
type FontSpec = { family: string; size: number; weight: number; style: 'normal' | 'italic';
  axes?: Record<string, number>; features?: Record<string, number>; tracking: number };
type Measured = { advances: Float64Array;      // x after each grapheme of `text`, cumulative, kerning included
  ascent: number; descent: number; capHeight: number; xHeight: number; lineGap: number };
interface TextMeasurer { measure(font: FontSpec, text: string): Measured }
```

- Segmentation: `Intl.Segmenter` (graphemes, words) in both environments; `word-break` `normal` breaks
  at word boundaries, `break-word` splits overflowing words at graphemes, `break-all` breaks between any
  graphemes.
- Wrapping: greedy, by measured advances; lines report baseline, width, ascent/descent; alignment,
  vertical alignment, origin, overflow (visible, hidden, clipped, ellipsis, fit, fit-font-size by
  bisection over size), sizing (fixed, auto-width, auto-height), vertical trim and baseline fit follow.
- Output per frame (cached until a run, style, box or font changes): lines → glyph clusters with
  positions, which the backends and `text-effects` consume.
- **Browser measurer** (`text` web entry): Canvas 2D `measureText` on prefixes of each run (kerning and
  ligature widths included; memoised per font + string), font metrics from `fontBoundingBox*` /
  `actualBoundingBox*` and `FontFace`.
- **Tool measurer** (CLI, conformance): the OpenType reader of §6 on bundled fonts; deterministic.

Conformance cases use a test font **generated by our own script** (`tools/test-font.ts`: simple
outlines and kerning pairs for printable ASCII plus a few accented and right-to-left characters, a
`wght` axis), so no third-party font file enters the repository; the tool measurer reads it. Browser tests
compare browser layout to tool layout with a tolerance (positions within 0.5 % of the font size);
differences beyond it are recorded as findings, not hidden.

## 5. Drawing

- **SVG backend:** one `<text>` per line with runs as `<tspan>`s, `font-*` from the style, paint from
  `paint` (gradients and strokes apply to glyph outlines natively, `text.paint`); the browser shapes and
  renders. When `text-effects` is active on a line, glyph clusters get per-cluster `x`/`y`/`rotate` and
  (for scale/opacity) per-cluster `<tspan>`/`<text>` with transforms. Follow-path uses positions from the
  layout plus the path's tangent (core path measurement, internal); clipping/hidden overflow via the
  existing clip paths.
- **Canvas backend:** `fillText` / `strokeText` per run or per cluster with the same positions.
- **Bidi:** `direction` (`auto` | `ltr` | `rtl`) maps to the SVG/canvas `direction` attribute; the
  browser orders whole runs. Per-glyph effects on mixed-direction lines use logical order and are
  documented as such (`text.script-direction` is kept only if it costs ≤ 150 B; otherwise it returns to
  won't do with the measured cost, per the owner's follow-up).
- **Hit testing** (`text.script-hit-testing`, `host-api` and listeners): position → grapheme index and
  caret/selection boxes from the layout output.

## 6. Fonts and the CLI text-rendering choice (owner requirement)

**Decision: the CLI renders text with its own OpenType reader, not with headless Chromium.**

Why:
1. `anima sample`, `validate` and the conformance suite run without a browser today and must stay
   deterministic and fast; text layout must not make them depend on Chromium or vary with system fonts.
2. One reader serves four needs: metrics and kerning for layout, glyph outlines for CLI rendering and
   **text to outlines** (`anima flatten`, `text.flatten`), and **build-time subsetting** (glyphs used,
   custom, all). Chromium would cover only rendering.
3. It is tooling: no runtime bytes, no dependency (TrueType `glyf`, CFF outlines, `cmap`, `hmtx`,
   `kern` and GPOS pair adjustment, `OS/2`/`hhea` metrics, `fvar`/`gvar` for variable axes at named
   instances; WOFF via zlib and WOFF2 via Node's brotli).

Limits, recorded in the spec: complex-script shaping (Arabic joining, Indic reordering, mark
positioning beyond GPOS pairs) is not done by the tool reader; `anima render --browser-text` renders
those through the cached headless Chromium (already used for JPEG/WebP and audio), and the tool reader
reports `text-shaping-approximate` as a warning when a run needs it.

Runtime fonts (`fonts`): font assets load as `FontFace` from bytes or URLs (assets pipeline, same policy
as images); `host-decode-font`, `data.host-font`, `host-api.data-font` assign decoded fonts;
replacement scope as for images; fallback is the CSS family list plus host-supplied faces; variable
axes and features through CSS. Google Fonts import (`anima import-font --google "Inter:wght@400;600"`)
fetches the font files at build time (network, CLI only), stores them as local assets and subsets them.

## 7. Text input (heavy, DOM-backed)

A native `<input>` (single line) or `<textarea>` (multiline) sits transparently over the text box,
focused through the focus module; the browser handles typing, IME composition, dead keys, clipboard,
selection and the mobile keyboard. Anima draws the text, caret and selection from the field's value and
`selectionStart`/`selectionEnd` (styled caret and selection drawables, rounded selection), placeholder
and obscured masking; limits use `maxlength` plus a line limit; committed text writes to data
(`input.write-text`) and fires `on="text"` listeners; `select-on-focus`. Semantics: the native field
is the text-field element (multiline, obscured states), mirrored into the semantic tree. Headless:
script `type "<text>"`, `compose "<text>"`, `select <a> <b>` commands drive the same model.

## 8. Order of work

Wave 1 (parallel): 1. `text` core + SVG/canvas drawing + data/host/run rows (§3–5; owns `modules/text`,
the measurer contract, conformance); 2. the OpenType reader + tool measurer + CLI rendering + subsetting
+ flatten + Google Fonts import (§6, tooling; delivers the measurer to 1 through the contract and a
fixture font); 3. `fonts` runtime (§6, owns `modules/fonts`; builds against the `FontSpec` contract).
Wave 2: 4. `text-effects` (§5); 5. `text-input` (§7) with the text a11y rows; 6. hit testing, bidi,
`a11y.inferred-text`, `a11y.tree-bounds` (exact extents via the reader). Wave 3: benchmark (§9) and
parity closure.

## 9. Benchmarks

1. **Settings card rerun** (`docs/benchmarks/runs/2026-11-07-p3b/BRIEF.md`), both formats: item 1 must
   now be met (owner exit criterion).
2. **New P6 brief, "search card":** a title whose letters wave in on load (per-glyph translation and
   opacity over a word range), a search field with placeholder text, typing that filters a list of
   five labels bound to data, labels that end in an ellipsis when too long for their box, a result
   count bound to data, and accessibility of the field and labels; proof with the CLI's typing and
   accessibility commands.
