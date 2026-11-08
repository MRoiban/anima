# P6 Rottweiler ledger (text on the browser)

Phase range: `git diff aca083b4 95e3c618` (PR #21). Reviewed as the code stands on the lead branch
(from `p8` at 1acdaf0). Reviewer: GPT-6.1-sol, reasoning effort xhigh, one per round.

| id | severity | finding | outcome |
| -- | -------- | ------- | ------- |
| R1-01 | major | SVG retained text skipped rebuilds when only resolved paint changed (animated `fill.color` left the `<tspan>` red) | fixed: `modules/text/web/index.ts` keys the rebuild on layout + serialized paints; test `modules/text/test/web/rottweiler-p6.test.ts` (Chromium, Firefox) |
| R1-02 | major | Soft-wrapped line start kept the kerning measured against the previous line's last glyph (`AV` → line 2 width 10, drawn 12) | fixed: `modules/text/core/layout.ts` remeasures the first glyph of a soft line; test `modules/text/test/core/rottweiler-p6.test.ts` |
| R1-03 | major | `fit-font-size` with no fitting factor called `build(0)`, a zero-size font (tool measurer throws `font-invalid`); spec forbids it | fixed: `modules/text/core/overflow.ts` reports no lines and zero sizes; test `modules/text/test/core/rottweiler-p6.test.ts` |
| R1-04 | minor | `hidden`/`ellipsis` tested line fit before the top trim | fixed: `modules/text/core/overflow.ts` subtracts `topTrim`; test `modules/text/test/core/rottweiler-p6.test.ts` |
| R1-05 | minor | Collapsed caret just before a paragraph separator drew on the next line | fixed: `modules/text-input/core/index.ts` resolves caret line by logical line range and separator; test `modules/text-input/test/core/rottweiler-p6.test.ts` |
| R1-06 | minor | Caret/selection boxes ignored `layout.scale` for ascent/descent under uniform fit | fixed: same file, boxes scale like hit/a11y bounds; test `modules/text-input/test/core/rottweiler-p6.test.ts` |
| R1-07 | major | Native editing surface used authored `raw.width/height`, not animated/bound values | fixed: `modules/text-input/web/index.ts` uses `p.prop`; test `modules/text-input/test/web/rottweiler-p6.browser.test.ts` (Chromium, Firefox) |
| R1-08 | major | Creating an animation slot for an omitted range `end` made its rest value 0 instead of unbounded | fixed: `modules/text-effects/core/index.ts` rest `Number.MAX_SAFE_INTEGER` (finite so crossfades from rest stay NaN-free; `Infinity` would give `Inf + (b−Inf)·w = NaN`); test `modules/text-effects/test/core/rottweiler-p6.test.ts` |
| R1-09 | major | Host disconnect released named font faces/aliases; reconnect never restored them | fixed (text consumer): `modules/fonts/web/consumer.ts` (`fonts-text`) parks a snapshot on cleanup and restores it on the same player's next `forModel`/`cssFont`; reload discards it; spec sentence in `spec/SPEC.md` (fonts). The base `fonts` entry is at 2,008/2,048 B and even the barest in-entry fix costs ≥ 69 B, so hosts using only `fonts` and calling `cssFont` themselves keep the old behaviour (deferred: needs an owner budget call). Test `modules/fonts/test/web/rottweiler-p6.test.ts` (Chromium, Firefox) |
| R1-10 | minor | `glyphs:"used"` subsetting omitted the U+2022 mask of obscured fields | fixed: `packages/cli/src/font/document.ts` adds `•` for `obscured: true`; test `modules/text-input/test/cli/rottweiler-p6.test.ts` |

Round 1 reviewer tokens: not reported. Noted, not filed: `modules/data-artboard/web/index.ts`
(P7) fully clears adopted-player font controllers on `cleanup`, so data-artboard font assignments
also do not survive a reconnect — P7's code, left to its lead.
