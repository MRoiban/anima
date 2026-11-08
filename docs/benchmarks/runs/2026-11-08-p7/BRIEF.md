# Benchmark brief (P7, layout): the reflow card

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

Fonts: no third-party font files may be added to the repository. Use the generated test font
`fixtures/fonts/anima-test.ttf` (simple geometric glyphs, original to this project) wherever a font
file is needed.

## The scene

A card on a 40 × 30 grid (Rive: a 480 × 360 artboard, 12 px per grid unit). Ink `#141413`, accent
`#d97757`, panel `#f0eee6`, chip `#e3dacc`.

- **Card**: a panel-coloured rounded box with 1.5 units of padding, its contents stacked vertically
  with 1 unit gaps.
- **Title**: text, size 2 units, from data.
- **Button**: an accent rounded box containing a text label (size 1.6 units) from data, with 1 unit
  of horizontal and 0.5 units of vertical padding. The box's width always equals the label's width
  plus its padding.
- **Chips row**: three chips side by side with 0.5 unit gaps, each a chip-coloured rounded box with a
  short text label. Chips 1 and 3 are as wide as their labels plus padding; chip 2 takes all the
  remaining width of the row. The row spans the card's inner width.

## Behaviour

All values below live in data the host page (or a test script) can read and write by name.

1. **Hugging button.** With label "Save", the button is exactly label width + 2 units wide.
2. **Animated growth.** Changing the label to "Save changes" makes the button grow to the new width
   smoothly over 0.3 s (no jump), and shrinking back animates too; if the label changes again
   mid-animation, the box continues smoothly from where it is.
3. **Filling chip.** Chip 2's width is the row width minus chips 1 and 3 and the gaps; when chip 1's
   label gets longer, chip 2 shrinks accordingly.
4. **Hidden chip.** A boolean in data hides chip 3; the row then has no empty space or extra gap where
   it was, and chip 2 takes the space.
5. **Host fit.** Shown in a 480 × 360 host the card fits with its aspect kept; in a host whose size
   changes (e.g. 600 × 300), a mode where the card's layout resizes to the host instead of scaling is
   used, and the chips row reflows to the new width.
6. **Proof.** Show items 1–5 with your tools: numeric box positions and sizes (or equivalent
   geometry) sampled before, during (at about 0.15 s) and after the animation, after the hide, and at
   both host sizes; rendered frames may be added but don't count as proof alone.

## Deliverable and report

Sources in your format, checked with its tools until they report no errors, plus `REPORT.md`:

```
Format:
Wall time (first command to done):
Check/validate/build/render runs: N  (errors seen, by code or message, with counts)
Source size: lines, characters (sources you wrote only)
Brief items met (1–6), each with how you checked it:
Items not met or approximated, and why:
What was hardest; what the docs or diagnostics got wrong or left out:
```
