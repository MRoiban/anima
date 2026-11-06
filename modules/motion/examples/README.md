# Declarative sync button

`sync.animl` implements the six items in the P4b sync-button brief. The benchmark records
under `docs/benchmarks/runs/` remain historical and unchanged. Build the paired runtime file:

```sh
node packages/cli/src/main.ts build modules/motion/examples/sync.animl -o modules/motion/examples/sync.ani
python modules/motion/examples/verify.py
```

The verifier invokes only the CLI. It checks independently calculated scalar expectations,
validates both source forms, checks geometry and writes the seven `evidence/*.jsonl` files
only after every assertion passes. The CLI test also replays each script against the committed
runtime file and compares its evidence. No host timeline operations occur in the scripts.

1. `spin.txt` checks no smooth drift between ticks, 30° at .105, 330° at 1.15 and wrap at 1.2.
   `sweep.txt` checks every step through a full turn and every idle phase bucket.
2. `stop.txt` requests stop at .35, stays at 90° through .399, reaches 120° at .4, then holds
   through the pop and two more seconds. Check scale is 0 at the boundary, 1 + √2/4 at .09
   after it and 1 at .6. A changed phase takes over afterward; a new run hides the old check.
3. `hover.txt` checks .2 forward gives 1.05, leaving keeps 1.05, .1 reverse gives 1.025,
   entering again keeps 1.025 and turns forward; a .2 reverse returns to 1 and settles.
   Both states play `peek-motion`; no separate reverse animation or pose crossfade is used.
4. `phase.txt` checks the quantized input clock and that changing phase during syncing does
   not override playback. Phase 1 samples the looping endpoint as 0° (visually 360°).
   A synced entry into `idle` captures the stopping angle until the expression changes;
   writing its existing value is deliberately not a seek. The sweep explicitly changes
   phase away and back when it needs to reset that captured clock.
5. `reduced.txt` enters states in reduced mode: rotation stays 0, completion appears at
   scale 1 immediately, with no overshoot. As in SPEC §10, preference changes apply on entry.
6. `rest.txt` checks angle 0, peek scale 1, check scale 0. The verifier also checks the 20-unit
   grid, colours, arc centres/radius/angles, round 1.5-unit strokes and exact check tips.
   Chevron paths retain the benchmark's 2-unit legs rounded to .001 grid-unit coordinates.

The source is 64 lines / 2,931 characters. Rotation uses two states; the complete example
uses eight states, three visible-motion timelines and a matching quantized completion clock.
No state ladder, per-frame host code or runtime dependency is required.

Clock forms and their exact event, boundary, carry and reduced-motion rules are specified in
[SPEC: Declarative timeline control](../../../spec/SPEC.md#declarative-timeline-control), with
[AniML syntax](../../../spec/ANIML.md#declarative-clock-controls). See `anima docs motion`.
These are local Anima conformance/acceptance proofs; they do not claim new native-oracle parity.
