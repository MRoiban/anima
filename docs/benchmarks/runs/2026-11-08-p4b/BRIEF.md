# Benchmark brief (P4b, motion): the sync button

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The icon

A 20 × 20 grid (Rive: a 240 × 240 artboard, 12 px per grid unit, same layout). Colours: ink
`#141413`, accent `#d97757`.

- **Arrows:** two curved arrows forming a circle of radius 6 around (10, 10) — two 150° arcs (from
  −165° to −15° and from 15° to 165°, 0° pointing right, clockwise positive), stroked 1.5 units in
  ink with round caps, each ending in a small arrowhead (a 2-unit chevron) at its clockwise end.
- **Check mark:** an accent check (tips at (7, 10), (9.2, 12.2), (13, 8)), stroked 1.5 units, hidden
  at rest.

## Behaviour

1. A boolean input `syncing`. While true, the arrows rotate clockwise about (10, 10) at one turn
   per 1.2 s, **in 12 discrete steps per turn** (a ticking motion, not smooth), looping.
2. When `syncing` turns false, the arrows finish the step they are in and stop, and the check mark
   pops in with an **elastic** overshoot (scale 0 → 1 about its centre (10, 10) in 0.6 s).
3. Hover plays a 0.4 s "peek" — the arrows' circle scales to 1.1 about (10, 10); leaving plays the
   same motion **in reverse** from wherever it is (not a separate animation).
4. A number input `phase` (0–1) **scrubs** the rotation while not syncing: the arrows' angle is
   `phase` × 360° (the same 12 steps).
5. Reduced motion: no ticking (arrows still), the check appears without the overshoot.
6. The rest frame (not syncing, no hover, phase 0) shows the two arrows only.

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
