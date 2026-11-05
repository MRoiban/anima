# Head-to-head brief: the dark-mode switch

The same brief goes to three fresh agents, one per authoring format: AniML (`.animl`), hand-written
`.ani` (JSON), and Rive's markup (a Rive CLI project). Nothing below names a format's constructs.

## The icon

A toggle switch on a 20 × 20 grid (Rive: a 240 × 240 artboard, 12 px per grid unit, same layout).

- **Colours:** ink `#141413`, accent `#d97757`.
- **Track:** a rounded rectangle from (2, 6) to (18, 14), corner radius 4, outlined in ink with a
  1.5-unit stroke. Off: no fill. On: filled with accent (the outline stays).
- **Knob:** a circle of radius 2.6 filled with ink. Off: centred at (6, 10). On: centred at (14, 10).

## Behaviour

1. A boolean input `on`, default false. A click anywhere on the icon toggles it.
2. Off → on: the knob slides to (14, 10) in 0.3 s with an ease-in-out curve, and the track's accent
   fill fades in over the same 0.3 s. On → off is the reverse.
3. Toggling again while the knob is still moving turns it around from where it is: no jump.
4. Hover: the knob scales to 1.15 in 0.15 s; leaving returns it to 1 in 0.15 s.
5. Press: while the pointer is down the knob scales to 0.85 in 0.08 s; on release it returns to the
   hover scale.
6. Reduced motion: toggling jumps straight to the end state.
7. Accessibility: role switch, label "Dark mode", pressed state follows `on`.

## Deliverable

The source file(s) in your format, checked with your format's tools until they report no errors,
plus `REPORT.md` (template below).

## Report template

```
Format:
Wall time (first command to done):
Check/validate/build runs: N  (errors seen, by code or message, with counts)
Source size: lines, characters (sources you wrote only)
Brief items met (1–7), each with how you checked it:
Items not met or approximated, and why:
What was hardest; what the docs or diagnostics got wrong or left out:
```
