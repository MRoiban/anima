# Original mesh probe

Reproduce with `python3 modules/mesh/capture.py` from the repository root.
The generator writes original markup and copies the original 8×4 flag texture.
All coordinates use 12 px/unit, a 240×240 opaque white artboard, and bilinear sampling.
Animation keys move vertex 2; the constant bound vertex is independently evaluated to (2,12).
The command runner creates transient binaries; the generator deletes them without reading them.

Raw comparisons are in `modules/mesh/rigging-mesh-raw.json`.
`todo.json` remains until the orchestrator accepts measured AA budgets; none are set here.
