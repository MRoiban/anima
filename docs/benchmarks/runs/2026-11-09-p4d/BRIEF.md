# Benchmark brief (P4d, events): the share button

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The icon

A 20 × 20 grid (Rive: a 240 × 240 artboard, 12 px per grid unit). Ink `#141413`, accent `#d97757`.
A share glyph: three circles of radius 2 at (5, 10), (15, 5) and (15, 15), filled ink, joined by two
lines from (5, 10) to each of the others, stroked 1.5 units in ink.

## Behaviour

1. A number input `count` (default 0). Each click increases `count` by 1 and the three circles pulse
   (scale 1 → 1.3 → 1 about their own centres, 0.3 s, staggered 0.05 s apart).
2. Every click also **reports an event** named `shared` carrying a number field `count` (the new
   count) and a string field `channel` with the value `"button"`, at the moment the pulse starts.
3. When the pulse animation **finishes**, report a second event `pulse-done` (no fields).
4. Every fifth click (count 5, 10, …) reports an event `milestone` that carries a URL
   `https://example.org/thanks` meant to be opened by the host in a new tab (the icon itself must not
   navigate).
5. A click plays a short sound from an audio asset (any short sound you include; it must be your own
   file, e.g. a generated tone).
6. The rest frame (count 0, nothing playing) shows only the glyph.

## Deliverable and report

Sources in your format, checked with its tools until they report no errors, plus `REPORT.md`:

```
Format:
Wall time (first command to done):
Check/validate/build/render runs: N  (errors seen, by code or message, with counts)
Source size: lines, characters (sources you wrote only)
Brief items met (1–6), each with how you checked it (show the reported events with their fields
and times):
Items not met or approximated, and why:
What was hardest; what the docs or diagnostics got wrong or left out:
```
