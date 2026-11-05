# Benchmark brief (P5, reuse): the toolbar

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The scene

A toolbar 72 × 24 grid units (Rive: an 864 × 288 artboard, 12 px per unit) holding three 20-unit
icon buttons at x = 2, 26 and 50 (top-left corners, y = 2): **bell**, **folder** and **trash** from
`fixtures/glyphs/` (`bell.svg`, `folder.svg`, `trash.svg`; each a 20 × 20 glyph drawn in
`currentColor`, filled even-odd). Colours: ink `#141413`, accent `#d97757`, white `#ffffff`.

## Behaviour

1. **One shared press behaviour.** Every button reacts the same way: hover scales it to 1.06 about
   its centre in 0.12 s; pointer down scales it to 0.92 in 0.08 s; release returns to the hover
   scale. This behaviour must be **defined once** and reused by all three buttons (not copied per
   button). State how you reused it.
2. **A reusable badge.** A badge — an accent circle of radius 3.5 showing its number in white, and hidden entirely
   when the number is 0 — sits at the top-right
   corner of the bell (centre (19, 4) relative to the button). The badge is **defined once** with
   its own `count` input and its own small animation: when `count` increases it pops (scale 1 →
   1.25 → 1 over 0.25 s).
3. A number input `unread` on the toolbar (default 3) drives the badge's `count` continuously.
4. Clicking the bell sets `unread` to 0 (the badge disappears).
5. A second badge instance on the trash button (same definition), driven by a number input `trash`
   (default 0).
6. The rest frame (unread 3, trash 0, no hover) shows the three glyphs and the bell's badge
   with "3".

If your format cannot render text for the number, show `count` dots instead (one 1-unit white dot
per unit up to 3) and say so.

## Deliverable and report

Sources in your format, checked with its tools until they report no errors, plus `REPORT.md`:

```
Format:
Wall time (first command to done):
Check/validate/build/render runs: N  (errors seen, by code or message, with counts)
Source size: lines, characters (sources you wrote only)
Brief items met (1–6), each with how you checked it:
How the press behaviour and the badge are reused (one definition each?):
Items not met or approximated, and why:
What was hardest; what the docs or diagnostics got wrong or left out:
```
