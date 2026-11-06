# Benchmark brief (P4c, interaction): the volume control

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The scene

A 40 × 12 grid (Rive: a 480 × 144 artboard, 12 px per grid unit). Ink `#141413`, accent `#d97757`.

- **Speaker** at the left: a speaker body (a 3 × 4 rectangle at (2, 4)) and a cone (a triangle from
  (5, 4) / (5, 8) to (8, 2) / (8, 10)) filled ink, and three sound-wave arcs centred at (8, 6) with
  radii 2, 3.5 and 5 (from −45° to 45°), stroked 1 unit in ink.
- **Slider** to the right: a track from (12, 6) to (36, 6), stroked 1 unit in ink; an accent fill
  along the track from (12, 6) to the knob; a knob — a circle of radius 1.5 filled accent — at
  x = 12 + 24 × `volume`, y = 6.

## Behaviour

1. A number input `volume` (0–1, default 0.5) positions the knob and the accent fill.
2. **Dragging the knob** horizontally sets `volume` continuously (clamped to the track), keeping the
   offset at which the knob was grabbed.
3. When the slider has keyboard focus, **Left/Right arrows** change `volume` by 0.1 (clamped).
4. The waves follow the volume as a **blend**: at 0 none is visible, by 0.33 the first is fully
   visible, by 0.66 the second, by 1 the third (each fades in over its third of the range).
5. Each time `volume` **increases**, the speaker pulses once (scale 1 → 1.08 → 1 about (5, 6),
   0.2 s); decreases do not pulse.
6. Clicking the speaker toggles a boolean `muted`: muted hides all waves and draws a diagonal
   accent line across the speaker; unmuting restores the waves for the current volume.

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
