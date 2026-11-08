# Font inspection and derived outlines (normative, P7-8)

Import `@anima-format/core/fonts-info` for `decodeFont(bytes)` and `FontInfo`, or
`@anima-format/web/fonts-info` to add `await icon.fonts.info(source)` to the font controller.
`source` is an ArrayBuffer, an asset-policy-resolved URL, or a FontFace returned by
`icon.fonts.decode` **after** the info entry was installed. FontFace does not expose its
source bytes; external or earlier faces require explicit bytes. Their missing source produces
`font-source` (pointer `""`, message and repair hint). Decoding snapshots bytes and never reads
system fonts. Introspection accepts SFNT TTF/OTF; compressed WOFF/WOFF2 resources still load
through the resource entry, but must be normalized with `anima import-font` before inspection.
No second font parser or Node compression implementation ships with the base text/font entries.

A decoded `FontInfo` provides:

- `metrics`: immutable `unitsPerEm`, `ascent`, positive `descent`, `lineGap`, `capHeight`,
  `xHeight`, and `glyphCount`, in font units. These are face-table metrics, not a measurement
  of one string or a browser fallback font. Variable MVAR metrics are not evaluated.
- `hasGlyph(codepoint | string)`: cmap coverage, including astral scalars; a string queries its
  first codepoint. A missing glyph maps to glyph zero and returns false.
- `options`: immutable effective `axes` (defaults included, authored values clamped to fvar)
  and `features` (supported default substitutions/kern plus explicit values).
- `derive({axes?, features?})`: a new option view sharing the decoded face; it never changes
  its source or another view. Unknown/nonfinite axes produce `font-axis`; unknown feature
  tags, negative or fractional values produce `font-feature`, all with pointer `""` and a hint.
- `glyphPath(glyphIndex, size = unitsPerEm)`: SVG path commands, baseline zero, +Y down.
  `glyphs(text)` returns `{glyph,start,end,advance,path}` for the supported context-free
  GSUB substitutions with those options applied. Offsets count UTF-16 units; advances and
  paths use font units. Pair positioning is not folded into these individual glyph advances.

The same bounded OpenType reader supplies headless `FontInfo(new Font(bytes))`, browser
introspection, CLI outlines and CLI shaping. TrueType composite/gvar/avar outlines and CFF1
retain their existing supported subsets and `font-unsupported` diagnostics, including HVAR.
This is an outline/options API, not a full script/language shaping engine or a new FontFace
resource: derive affects the returned paths; use existing text style axes/features for browser
text rendering. No Player state or scheduling changes are introduced by inspection.

These deliberate explicit-byte/format requirements keep resource-only pages small, following
`docs/research/rive-web-runtime.md` §1's separation of heavy text processing. No Rive source or
file format is used. The permitted native headless surface has no decoded-face metric/path API;
its authored text raster comparisons remain the independent drawing evidence.
