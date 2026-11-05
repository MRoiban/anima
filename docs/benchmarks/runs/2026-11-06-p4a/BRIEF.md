# Benchmark brief (P4a, paint): the download button

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The icon

A 20 × 20 grid (Rive: a 240 × 240 artboard, 12 px per grid unit, same layout).

- **Colours:** ink `#141413`, accent `#d97757`, accent-light `#f0b49c`.
- **Track:** a circle of radius 8 centred at (10, 10), stroked 1.5 units wide in ink at 25 %
  opacity, dashed: 24 dashes of equal length around the circle with gaps as long as the dashes.
- **Progress ring:** the same circle, stroked 1.5 units, with a linear gradient along its stroke
  from accent (top-left) to accent-light (bottom-right), round caps, starting at 12 o'clock and
  running clockwise. Empty at rest.
- **Arrow:** a downward arrow in ink (a vertical shaft from (10, 6) to (10, 13) and a chevron with
  tips at (7, 10.5) and (13, 10.5)), stroked 1.5 units, round caps and joins.

## Behaviour

1. A number input `progress` from 0 to 1 (default 0) draws the ring: the visible arc is
   `progress` of the circle, following the input with no lag.
2. A boolean input `done` (default false). When it turns true the arrow **morphs** into a check
   mark (tips at (6.5, 10), (9, 12.5), (13.5, 7.5)) over 0.35 s with an ease-out, and the ring
   fills completely in accent (the gradient blends to flat accent over the same 0.35 s).
3. Hover: a soft highlight sweeps across the icon once (a diagonal band of white at 40 % opacity,
   2 units wide, moving from left to right over 0.6 s), visible **only inside the circle** of
   radius 8 (clipped to it).
4. Click fires a trigger `start`; nothing else is required of it.
5. Reduced motion: the morph and the sweep jump to their end states.
6. The rest frame (progress 0, not done, no hover) shows only the track and the arrow.

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
