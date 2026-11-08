# Layout comparisons

Fifteen completed native cases / sixteen frames use independent native LayoutComponent styles,
with direct native LayoutParticipant shape measurement in the circle probes. Capture:
`python3 modules/layout/capture-oracles.py`. Only local headless commands run. The script deletes
native binary output without reading it. Captures use a white 240×240 artboard and 12 px/grid unit.

| Probe | Measured largest channel delta / pixels over 16 |
| --- | --- |
| containers, reverse direction, justify, cross alignment, positional alignment, spacing, fixed sizing, hug, fill, fixed min/max, visibility, numeric data binding (both values) | 0 / 0 |
| container paint | 1 / 0 |
| intrinsic and direct circle participant | 96 / 101 (0.175347%); every changed pixel is within 0.495 px of the analytic circle boundary |

Integer geometry uses max 2 / 0%. The two curved probes use max 100 / 0.18%, based only on the
measured boundary coverage difference; their size and placement agree. Existing oracle cases,
thresholds, metrics and findings are unchanged. Per-frame measurements are in
`verification/native-metrics.json`. `node tools/oracle.ts --strict` verifies the completed manifest.

Two deliberate semantic differences retain raw native scenes, frames and capture sessions with
explicit `skip.json` records: per-child alignment (`layout-self-alignment`, a native setting
accepted but ineffective in this CLI) and signed-total freezing of mixed fill bounds
(`layout-fill-bounds-difference`, native 10.5/2.5 vs Anima 9/4). The normative reasons are in
[SPEC.md](SPEC.md); neither has been accepted as a pixel oracle or given a tolerance. The original
mixed-bound capture is retained independently of the main fixed-bound probe. Baseline is checked
with independent Anima vectors, and is not claimed equivalent to the native positional picker.

The generated font used by the button example is original project data. The native layout
probes need no font or third-party asset. No Rive source, CLI text or binary is copied into the
implementation. The capture method follows `tests/oracle/README.md` and the independent-renderer
cautions in `docs/research/rive-web-runtime.md`.
