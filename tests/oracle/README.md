# P4a Rive frame oracles

17 paired scenes, 21 frames, 240×240 pixels, 20-unit grid, exactly 12 px/unit.
Every frame has an opaque white background. These are small capability probes,
not a claim that every setting or animation of each feature has been covered.
CI needs no Rive installation: `tools/oracle.test.ts` calls the same `anima render`
command implementation as the CLI on every case and compares to committed Rive PNGs.
It also recompiles AniML and rejects stale `.ani` files. No new dependencies.

## Reproduction

- `python3 tests/oracle/generate.py` authors both scene formats and the manifest.
- `python3 tests/oracle/capture.py` runs only `~/.rive/bin/rive . --commands=commands.txt`
  from each Rive project. It removes build-produced `.riv` files without reading them.
- `node tools/oracle.ts --build` rebuilds `.ani`, invokes `anima render --at <seconds>
  --size 240 --background #ffffff`, writes Anima frames/diff images and `metrics.json`.
- `node tools/oracle.ts --strict` checks all comparisons, exits nonzero on disagreement.
- `npx vitest run tools/oracle.test.ts` runs the oracle tests without mutating references.

Rive capture: local CLI 1.9.0, headless EGL device renderer, depthStencil with
4× MSAA (CLI reported no supported interlock mode). Anima: resvg via the CLI.
No account operation, interactive preview, `.riv` read/conversion, Rive source,
or documentation text is used in these fixtures. Build logs are ignored.

## Comparison and tolerances

At each pixel take the largest absolute RGBA channel delta (0–255). Report the
maximum over the entire frame and the fraction of all 57,600 pixels whose delta
is **strictly greater than 16**. Both maximum and percentage limits in `cases.json`
are enforced. No blur, translation, resampling, edge exclusion or alpha correction.
`anima/*-diff.png` encodes the raw largest channel delta in grayscale.

Gradients, flat overlap blends, axis-aligned miter strokes and multiple paints
have a 2-channel maximum and zero pixels over threshold. Curved/diagonal outlines
allow the measured MSAA-versus-resvg coverage difference plus small headroom;
AA budgets are 0.12–0.45% of the full frame, never a general 1% allowance.
Dash endpoints can differ by 95 levels at their thin boundary columns; their
budget is 110 levels and 0.30%. Diff images were inspected for contour confinement
(dashes and star), with pixel support checked for every case. These are rasterizer
budgets for these scenes, not a license to accept interior or geometry changes.
No current case disagrees beyond antialiasing. Never increase a tolerance to
hide a disagreement: report it, retain the failing frame, and investigate.

## Mappings and limits

- Rive shapes run front to back; AniML runs back to front. Scene siblings are reversed.
  Multiple paints within a shape run in the same order in both formats.
- Gradient coordinates are multiplied by 12. Radial uses coincident focal/centre;
  off-centre SVG focal gradients have no equivalent in the Rive radial parameters
  used here and are not claimed. Animated stop **position** is keyed at 0, 0.5, 1 s
  (Rive frames 0/30/60, linear, no transition duration). Stop-colour animation is
  not covered by this position probe.
- Absolute dash lengths are multiplied by 12. Percentage lengths are path fractions
  on each Rive `Dash`, rather than a flag on `DashPath`. The straight 16-unit line
  makes both dash fixtures intentionally equivalent. Offsets are zero in these probes.
- Star uses Rive innerRadius=0.5 versus Anima innerRadius=3.5 / radius=7.
- Anima polygon/rectangle corners are **quadratic cutbacks**, not Rive's native
  corner-radius algorithm. Their Rive scenes use explicit cubic vertices encoding
  the exact quadratic curves (control handles at two thirds of the control vector).
  This tests the specified Anima outline against an independently authored path;
  it does not claim native corner parameter equivalence. Native rounded-polygon and
  native rectangle-radius equivalence is unavailable under these semantics.
- Morph animates the last triangle vertex's x from 10 to 16 units in both scenes;
  Anima interpolates path strings, Rive keys the vertex at frames 0/60.
- Multiply/screen use a single paint on the source node, mapping node blend to paint
  blend without group/isolation ambiguity. Other blend modes are not covered here.
- Alpha mask uses LayerMask alpha/sourceDraws=false with a half-alpha ellipse, not
  a hard clip. Geometry clip uses ClippingShape and an unpainted Rive source;
  Anima's source has transparent paint. Both source outlines are identical.
- Inside/outside strokes use explicit miter joins on both sides. Initial outside
  capture had Anima's default round join versus Rive miter (max 190, 0.264% over 16);
  matching the authored joins reduced that to max 1 / 0%. This was a fixture error,
  not a tolerance increase or a runtime fix.

The explicit geometry and separated paint mappings follow the independent scene
construction approach in [format/graph research](../../docs/research/rive-format-and-graph.md)
and the renderer comparison cautions in [web research](../../docs/research/rive-web-runtime.md).

## Measured frames

Threshold is 16 for every row. Each `max / %` pair is one frame; animated rows list
0, 0.5, 1 seconds. Exact counts and unrounded percentages are in `metrics.json`.

| Case | Measured max / pixels over threshold (%) | Allowed max / % |
|---|---|---|
| linear | 1 / 0.0000% | 2 / 0.00% |
| radial | 1 / 0.0000% | 2 / 0.00% |
| animated-stop | 1 / 0.0000%; 1 / 0.0000%; 1 / 0.0000% | 2 / 0.00% |
| dashes-absolute | 95 / 0.2622% | 110 / 0.30% |
| dashes-percent | 95 / 0.2622% | 110 / 0.30% |
| ellipse | 71 / 0.3142% | 90 / 0.40% |
| polygon-rounded | 59 / 0.2691% | 80 / 0.35% |
| star | 59 / 0.3507% | 80 / 0.45% |
| rect-corners | 70 / 0.0764% | 90 / 0.12% |
| path-morph | 47 / 0.2500%; 47 / 0.3333%; 24 / 0.2083% | 65 / 0.40% |
| blend-multiply | 1 / 0.0000% | 2 / 0.00% |
| blend-screen | 1 / 0.0000% | 2 / 0.00% |
| clip | 71 / 0.3194% | 90 / 0.40% |
| alpha-mask | 36 / 0.1667% | 50 / 0.25% |
| stroke-inside | 1 / 0.0000% | 2 / 0.00% |
| stroke-outside | 1 / 0.0000% | 2 / 0.00% |
| multiple-paints | 1 / 0.0000% | 2 / 0.00% |

## Repository verification

Oracle Vitest: 17/17; strict oracle command: all 21 frames pass.
`VITEST_MAX_WORKERS=2 npm run check`: 863/863 tests (39 files), typecheck, lint and
format pass, then the inherited markup size budget fails: **9583/8192 B**.
Full `npm run check` is not green. Web/AniML generated checks and `tools/perf.ts`
pass separately. The first default-worker run had two existing browser failures;
both passed with two workers without assertion/timeout changes. No runtime source
or dependency manifest changed in this task.
