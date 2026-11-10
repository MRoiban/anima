# P8 parity closure

P8 (rigging, plus the `a11y.tree-bounds` carry-over) audited: **26 of 26 rows done**. In scope: **886/886 done (100 %)**, up from 860/886 (97 %) at the end of P7. The carry-overs without rows are merged too: pointer hits and pointer focus follow the painted order (R4-02), and pre-load `toggle()` is queued like `set` and `fire`.

Evidence rule as in `docs/parity/P6-closure.md`: implementation, tests and conformance, plus a completed native comparison (strict oracle; budgets from measured anti-aliasing only), an evidenced skip where the Rive CLI cannot observe the behaviour headlessly, or an intentional difference recorded in the spec with its reason. Every P8 oracle probe draws rectangles, not circles (D44): Anima's circle and Rive's ellipse differ by construction and hide position errors. Every budget was set only after classifying the over-16 pixels as edge or interior (no interior pixel remained in any case).

Budgets (threshold 16; max / % over): rig unrotated, pose pads, scroll 2 / 0; rotated rig frames and follow-path 65 / 0.12; IK and skin 65 / 0.25; mesh 70 / 0.40 and mesh animation 100 / 0.45 (seams and outer edge only; an undivided-image control is exact). Evidenced skips: `a11y.tree-bounds` (native semantic rectangles omit painted strokes) and the direct native list-follow-path constraint (it does not distribute headless; its spacing matched Rive per-child follow-path at max 1 / 0 %).

Decisions D1–D48 are in `design/p8/DECISIONS.md` (owner may revisit). Notable: bones keep Anima's grid coordinates and act by their motion from rest; skins bind to the rest pose; meshes draw on canvas, and the browser SVG renderer shows the undeformed image with `unsupported-render`; rig adds nothing to core checks (D47); core grew only by point tuples (+16 B, D40). Optional heavy entries keep the base entries small: `posepad-handle`, `rig-origin`, `rig-distance`, `skin-auto`, `skin-mesh`, `skin-dash`, `skin-values`, `canvas-mesh`.

## Done in P8, by area

- **rig core (bones, constraints, distance)** (11): `rigging.bone-chains`, `rigging.constraint-order`, `rigging.constraint-strength`, `rigging.distance-closer`, `rigging.distance-exact`, `rigging.distance-further`, `rigging.root-bones`, `rigging.rotation`, `rigging.scale`, `rigging.transform`, `rigging.translation`
- **IK** (2): `rigging.ik`, `rigging.ik-bend`
- **path following** (2): `rigging.follow-path`, `rigging.list-follow-path`
- **skin and weights** (3): `rigging.cubic-weights`, `rigging.skin`, `rigging.weights`
- **meshes** (2): `rigging.mesh`, `rigging.mesh-animation`
- **pose pads** (4): `animation.joystick-handle`, `animation.joystick-invert`, `animation.joystick-two-axis`, `rigging.joystick`
- **scroll** (1): `rigging.scroll`
- **accessibility** (1): `a11y.tree-bounds`

## Benchmark

Reaching arm (`docs/benchmarks/runs/2026-11-10-p8/`): AniML 6/6 in 9 min 59 s with a 70-line scene on native bones, IK, skin and constraints; Rive 6/6 in 10 min 5 s with 314 lines, the arm computed in a Luau controller. The AniML run exposed one bug (IK `strength` between 0 and 1 broke the chain), fixed in P8-2b before the PR. The P4c volume control (touched by R4-02) was replayed: its five proof scripts reproduce byte for byte.
