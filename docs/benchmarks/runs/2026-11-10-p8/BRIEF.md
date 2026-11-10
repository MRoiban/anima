# Benchmark brief (P8, rigging): the reaching arm

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs. At the start of wave 3 the
orchestrator copies this file to `docs/benchmarks/runs/<date>-p8/BRIEF.md` unchanged.

Rules for both formats are in `docs/benchmarks/agent-native.md` (local tooling only, no account
commands, no `.riv` reads, scaffold files with Rive documentation text deleted). Same model and
effort, one fresh agent per format, timebox 20 minutes.

## The scene

A 40 × 30 grid (Rive: a 480 × 360 artboard, 12 px per grid unit, origin top-left, y down). Ink
`#141413`, accent `#d97757`, panel `#f0eee6` background.

- **Shoulder** fixed at (8, 20).
- **Arm**: an upper segment 9 units long and a forearm 8 units long, joined at an elbow. At rest the
  arm points straight right (shoulder (8, 20), elbow (17, 20), hand (25, 20)).
- **Sleeve**: one accent-filled shape, 2 units thick, that covers both segments and bends smoothly
  at the elbow: at a 90° elbow its outline has no gap, crack or overlap spike at the joint
  (it is one deforming shape, not two rectangles).
- **Hand**: an ink circle of radius 1.2 at the end of the forearm, moving rigidly with it.
- **Eye**: an ink ring (radius 2, stroke 0.3) centred at (32, 6) with a pupil (radius 0.6).

## Behaviour

1. **Reach.** While the pointer is over the scene, the hand's centre goes exactly to the pointer
   position whenever that point is within reach (distance from the shoulder ≤ 17) and the upper
   segment and forearm keep their lengths.
2. **Elbow side.** The elbow always bends to the same side: walking on screen from the shoulder to
   the hand, the elbow is on the right-hand side (so it hangs downward while the arm reaches right),
   for every reachable pointer position, including positions below and to the left of the shoulder.
3. **Out of reach.** Beyond reach, the arm is straight and points at the pointer (hand on the
   shoulder–pointer line at distance 17).
4. **Release.** When the pointer leaves the scene, the arm returns to its rest pose over 0.4 s,
   continuously (halfway through, the hand is between the reached and the rest positions; no jump at
   any sampled step of 1/60 s larger than the motion's maximum speed allows).
5. **Eye.** The pupil moves toward the pointer but its centre never leaves a circle of radius 1
   around the eye centre; at the eye centre it is centred.
6. **Proof.** Show items 1–5 with your tools as numbers: elbow, hand and pupil positions, and at
   least four outline points of the sleeve near the elbow, for pointer positions (22, 12), (14, 26),
   (39, 2) and (2, 20); after a leave at 0, 0.2 and 0.4 s; and at rest. Rendered frames may be added
   but don't count as proof alone.

## Success checks (orchestrator re-check, strict)

| Item | Check |
|---|---|
| 1 | hand within 0.01 of the pointer at (22, 12), (14, 26) and (2, 20); both segment lengths within 0.01 |
| 2 | cross(hand − shoulder, elbow − shoulder) > 0 (y down) at the three reachable positions |
| 3 | at (39, 2) hand at distance 17 ± 0.01 from the shoulder, collinear within 0.01 |
| 4 | hand at 0.2 s strictly between the reached and rest positions; at 0.4 s at rest within 0.01 |
| 5 | pupil-to-centre distance ≤ 1 + 1e-6 at every sampled pointer position; 0 at (32, 6) |
| 6 | the agent's own script reproduces its numbers when the orchestrator reruns it |

An item met only by host code outside the scene (page JavaScript, a Luau controller) counts as met
but is recorded as friction. "Approximated" counts as not met.

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

## Scoring (recorded in `docs/benchmarks/agent-native.md`)

Items met (strict), check/render iterations, wall time, source size and every friction point, one
row per format. Gate: AniML ≥ Rive on items met; any friction that blocks an item is a bug fixed
before the P8 PR merges, then AniML is rerun. Earlier briefs are not rerun unless P8 touched their
modules (R4-02 touches input, focus and composite: rerun the P4c volume control in AniML only).
