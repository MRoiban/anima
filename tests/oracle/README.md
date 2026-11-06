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

## Pending capability scaffolds

The capability scaffolder creates `todo.json`, `case.animl` and `rive/README.md` without adding an
entry to `cases.json`. Tests and `node tools/oracle.ts` report the marker's reason as pending.
Replace the scene, author/capture independent references, build `.ani`, set explicit comparison
limits, remove the marker and add the completed manifest entry. A pending case in `cases.json`
is an error, so an empty scaffold cannot count as a successful oracle.

## P4b motion probes

Seven additional independently authored native Rive scenes cover value-cubic,
elastic-in, elastic-in-out, quantized sampling, reverse, work areas, and exit time in
source-animation seconds with a state speed multiplier. They add 25 frames, using
axis-aligned integer rectangles: every measured frame has max delta 1 and 0% of pixels
over 16. Their new budgets are max delta 2 and 0%; existing budgets/methods are unchanged.
Regenerate with `python3 modules/motion/capture-oracles.py` and
`python3 modules/motion/capture-exit-oracle.py`, then `node tools/oracle.ts --build`.
The scripts only author RML and invoke local headless commands; they delete generated
binary outputs without reading them. Rive CLI 1.9.0, EGL device / 4x MSAA as above.

Quantization uses 2 samples/second and off-grid samples 0.75 and 1.25 seconds. The
first attempt omitted Anima's quantize attribute; adding it fixed those samples.
At nominal 2 seconds, the native runner's accumulated float clock remained just below
the final quantization boundary (rendering the 1.5-second pose). The native command
therefore advances an additional 1 ms before the final screenshot, testing the
clamped once endpoint; Anima renders the exact endpoint at 2 seconds. This adjustment
is confined to reference capture timing, not a tolerance or runtime change. Exit-time
capture initially used a numeric flags attribute that did not enable the RML flag;
using `enableExitTime="true"` made all four frames match, without changing Anima.

The elastic probes use amplitude 1 and period 0.5. They do not establish equivalence
for Rive's amplitude-below-one ramp or period-zero fallback: Anima keeps the existing
specified elastic formula and rejects zero periods. The remaining 15 probes are now disposed in [MOTION-PROBES.md](MOTION-PROBES.md):
seven verified comparisons and eight no-faithful-counterpart skips. There are no
pending motion markers or expected failures. The uint probe compares fresh dumps at
0/0.5/0.8/1.1/2 s: both sides report 0/7/42/2147483520/2147483520, tolerance 0.
A fresh attempt at 2147483647 yielded a number dump of 2147483648 (delta 1);
2147483520 is the nearest lower float32-representable integer to 2^31.
The former full-range observation is retained only as a note: at 0/0.5 s both
reported 0; at 1.1/2 s Anima reported 4294967295 and Rive's number dump reported -1
(absolute difference 4294967296). Anima's value is correct for uint; the number dump's
signed conversion is an observation-path limit and says nothing about Anima's
behaviour. The full maximum is tested independently in Anima conformance and the
typed-channel round-trip test. See MOTION-PROBES.md for details and reproduction.
New data comparisons are exact; existing image budgets are unchanged. Native
fractional origins are not claimed equivalent to Anima pivots: the new pivot scene
uses independently keyed parent/child translations to express the same transform.

## P4c input and focus observations

See [the interaction oracle report](../../modules/input/ORACLE-RESULTS.md) for all row outcomes,
reproduction commands, observation boundaries and the disposition of the three original disagreements. The new
completed discrete comparisons use tolerance zero; the two axis-aligned render probes use
max 2 / 0% without changing existing limits. Focus is compared through both semantics and
view-model data. Cursor data observes intent, not OS cursor rendering.

`finding.json` holds a separately classified failing pair and its numerical observations.
It is excluded from successful cases, measured by strict mode into `findings-metrics.json`,
and printed with its status (finding or intentional difference). Its evidence test preserves the observations, without test.fails or
changing a reference. Strict exit 0 certifies completed cases only.

The capture-phase and keyboard-bubbling probes are completed, tolerance-zero cases. Capture
maps native parent claiming to explicit Anima consume=true; the runtime was already outer-first.
Preserve-offset retains status "intentional difference" with Anima 96 versus native 80 (delta 16)
at the move and after release. It is never counted as a passing comparison.

## P4d events re-audit

Ten event cases now compare ordered reports at exact 60 fps frame indices, including
observed typed payload fields. Reproduce with `python3 tests/oracle/capture.py --events`.
The native CLI reports plain events and URLs in session logs. Outward custom-property
bindings expose payload source values in data dumps at the firing frame. URL targets
and browser host callbacks remain outside that observation surface.

After the SPEC §5 `1e-9` second boundary rule, the 0.5-second transition boundary
probe is verified: exit/start at frame 30, completion at 45 in both runtimes. Of the two
boundary probes, **1/2** matches Rive exactly. The key boundary probe remains a finding:
Anima 15/30/60 versus freshly recaptured Rive 15/30/61 for 0.25/0.5/1-second keys.
The capture establishes the final one-frame difference, not the cause of Rive's frame 61.

Two explicitly classified disagreements are printed separately by the strict command
and recorded in `findings-metrics.json`; their tests preserve the exact observed mismatch.
The listener case is an **intentional difference**, with Anima responses at 14/29 versus
Rive 13/28 (sources 13/28 in both): a step cannot re-enter itself. These two findings are
excluded from the completed `cases.json` set; the listener case is never a parity pass.
Strict exit 0 means the 41 completed cases pass, not that those findings match. Retained skip evidence can be recaptured with
`python3 tests/oracle/capture.py --skip-evidence`. See
[the full per-row report](../../modules/events/ORACLE-RESULTS.md) for all 33 decisions,
comparison mappings, payload limitations and the one-frame timing disagreements.

## P4d-3 action expressions

Four additional exact post-click probes resolve the listener-action pending marker:
104 count/event observations, 25 shared reports and 5 modulo-gated reports. See
[ACTION-EXPRESSIONS.md](ACTION-EXPRESSIONS.md) for reproduction, native extra-advance
boundary, payload observation limits, and the separately retained immediate timing
finding. Strict now checks 45 completed cases, with three findings reported separately.


## P4e derive and bind logic: fresh native follow-up

Nine new CLI 1.9.1 data-dump cases compare 75 snapshots / 186 typed observations
exactly: formatted/clamped computed values, three independent list instances and
seven comparison/logic operations each driving number and bool targets. The native
logic mapping uses transition comparators and compares settled results. Read-only
parity is separately an evidenced skip: native accepts a manual destination write
and retains it after an advance; Anima rejects it. See the
[derive evidence report](../../modules/derive/oracle/README.md) for reproduction,
raw dumps, mappings and explicit limits. Existing findings and limits are unchanged.
