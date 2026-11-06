# Pc-2 implementation verification

**All 338 cross-backend comparisons are within the original limits.** The corpus contains
59 visual documents / 169 authored frames per engine, hence 338 comparisons **total**, rather
than 338 per engine. `measurements.json` retains every frame's raw maximum and over-16 count/share.
No tolerance, test timeout, budget, screenshot size or measuring method was loosened.

Final default-concurrency `npm run check`: **60 files / 1442 tests passed**, no skips, in 98.30 s
(test phase). Typecheck, ESLint, Prettier, module generation, every size budget, all 14 browser
artifacts and 60 AniML artifacts pass. An earlier full check also passed 1440 tests before final
review added the clamped border-texel correction and its two browser regressions.
The development scope `canvas composite bind` passes **831 tests**; 31 excluded conformance
cases are scope selection, not source skips. The broader preceding `canvas paint composite assets
bind web` run passed its existing tests after attribute-expectation updates; its only remaining
failures were new probes overconstraining Firefox's byte quantization. Those probes now assert
exact half-pixel alpha/interior texels and exact source opacity 0/0.25 results. No corpus assertion
changed to accommodate those probes.

## Cross-backend comparison

| Engine | Before within / frames | Pc-2 within / frames | Worst channel delta | Worst share over 16 |
| --- | ---: | ---: | ---: | ---: |
| Chromium | 160 / 169 | 169 / 169 | 92 | 0.206597% |
| Firefox | 166 / 169 | 169 / 169 | 128 | 0.260417% |

Both backends render at 240×240. Each pixel uses the maximum raw RGBA channel difference;
counts are strictly over 16. Raw failure PNGs remain under ignored `artifacts/`; rerun
`npm run test:scope -- canvas` to regenerate measurements. Historical PNGs can remain after a
passing run; JSON from the current run is authoritative.

### Resolved causes

- **Dashes and trims (paint, bind-number, bind-over-state):** SVG's `pathLength="1"` normalized
  against engine-local primitive lengths, including Chromium's 49.941574 for an r=8 circle rather
  than core's 50.265482. Both live and static SVG now emit absolute grid lengths. Paint, SVG and
  Canvas share core's length function and one cached measurement per retained geometry owner;
  transforms/paint/trim changes reuse it, while path/radius/dimensions/corners invalidate it.
  Tests pin cache reuse, geometry invalidation, units and separately bundled bind/paint behavior.
- **Inverted luminance:** `luminanceToAlpha` ignores input alpha, losing source opacity and curved
  edge coverage. `feComposite operator="in" in2="SourceGraphic"` restores coverage before alpha
  inversion. The mask remains permanently attached and transforms stay on retained groups.
  The three formerly failing frames now have worst delta **14 Chromium / 1 Firefox**, with zero
  over-16 pixels. Source-opacity probes additionally cover invisible and quarter-opacity sources.
- **assets-image frame 1:** at width 15 the fitted image spans y=82.5..157.5 device pixels.
  Nearest `drawImage` snapped those outer edges; smoothing mode changes made no difference, and
  fit math and decode timing were correct. Canvas now extends the border texels into the antialias fringe and applies a geometric
  rectangle clip, preserving half-pixel alpha 128 in both engines without moving the fitted
  rectangle. The fringe is one device pixel, mapped through the inverse transform. Direct
  regressions check both edges, exact interior texels, and distinct red/blue borders at fractional
  coordinates. Image/viewport bounds intersect before clipping so coincident edges do not
  multiply coverage. A repeating-shader prototype was rejected because it sampled the opposite border
  outside the texel rectangle; nonrepeating shaders dropped that coverage. Chromium's former delta 129 / 300
  over-16 pixels becomes **1 / 0**. Firefox's remaining SVG raster edge difference is **128 /
  150 (0.260417%)**, within its unchanged limits. Bilinear sampling keeps its existing draw path.

The standalone-demo test rebuilt/minified all **14** browser entries separately inside each
engine's unchanged **15 s** timeout. It now validates the source fingerprint, bundle hash and
exact template/bell/runtime bytes, then runs the same browser assertions. `pretest` and the full
check still rebuild/check every artifact. No stale output is accepted. The bind module registration
wait now polls wall time, since polling its deliberately stopped fake rAF clock could deadlock;
its next-frame input assertions and timeout are unchanged.

## Static compatibility and costs

**0.1 static SVG byte-identical: yes.** Bell, moon and trash retain all three original SHA-256
expectations (default and `staticLengths` output at rest and three stepped times). No 0.1 output
or byte expectation changed. `staticLengths` remains an accepted compatibility option; all SVG
now uses absolute lengths. Extended dash/trim and mask output changes are correctness fixes
documented in SPEC and LOG. No runtime dependency was added.

Browser frame costs below use the same harness on baseline **4bed807** and Pc-2 runtime source,
with the same bundler/minifier: 600 frames at 1/60 s, one warm-up, median of three, sequential
browsers/revisions with no test suite running. SVG measures retained attribute diff/order; Canvas
measures raster submission. Host scheduling, events/a11y, presentation and vsync are excluded.
These are observations, not completed GPU timings or a general speedup claim.

| Engine | Workload | SVG before → after (µs/frame) | Canvas before → after (µs/frame) |
| --- | --- | ---: | ---: |
| Chromium | bell | 87.5 → 80.7 | 292.8 → 254.2 |
| Firefox | bell | 90.0 → 71.7 | 388.3 → 285.0 |
| Chromium | animated paint / relative dashes | 45.5 → 41.8 | 55.3 → 36.3 |
| Firefox | animated paint / relative dashes | 55.0 → 35.0 | 291.7 → 260.0 |

The retained-geometry length cache removes repeated path subdivision from the animated paint
workload. Bell timings vary; it exercises neither percentage dashes nor trims. Full-suite browser
perf observations are retained separately in `measurements.json`, since contention is different.
Full-suite bell observations (different contention): SVG/Canvas **244.7/649.2 µs Chromium** and
**150.0/498.3 µs Firefox**. Node's unchanged `tools/perf.ts`: bell compile **1.84 ms**, all 9040
prefixes **547 ms**; bell/composite/toolbar step + draw **31.7/20.8/23.6 µs**; toolbar compile
**2.93 ms**. Pc-1's separately logged Node line was 2.29 ms / 686 ms; 43.7/28.1/32.6 µs;
4.37 ms. These are different session/load observations, not a controlled speedup claim.

Final min+gzip sizes (unchanged measuring method): core+web **18452/30720 B**, versus **17963 B**
at Pc-1 (**+489 B**, the shared natural-length path now ships in live SVG); canvas **3991/8192 B**
versus **4114 B**; paint **3935/5120 B**, composite **3904/4096 B**, bind **1554/2048 B**,
assets **1513/2048 B**, surface **7536/8192 B**, components **4000/4096 B**, markup **7358/8192 B**.
All remaining markup hook/library budgets pass. SVG full-featured total **44639/102400 B**;
Rive-class total **48796/256000 B**. No ceiling or measuring method changed.

Implemented groups remain **21/24**, with the same explicit partial modes: fixed-stroke partial
trims; local feather under nonuniform/sheared transforms; world feather under nonuniform viewport
scaling. These emit `unsupported-render`; no new mode is silently accepted. SVG stays the default.
The original design/reference rationale remains the repository's
[web runtime research](../../../../docs/research/rive-web-runtime.md#lessons-for-anima) and
[retained-SVG architecture](../../../../docs/ARCHITECTURE.md).

Actual implementation branch: `t3/svg-canvas-renderer-parity`, based on `pc-canvas` at 4bed807.
Local commit only; no push, PR, merge, Rive command, Rive source or binary reading.
