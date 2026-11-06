Format: AniML, hand-authored `volume.animl`, compiled by the Anima CLI.
Wall time (first command to done): 3 min 17 s.
First command: 2026-11-06 05:11:06 UTC. Finished: 2026-11-06 05:14:23 UTC (report/commit bookkeeping immediately afterwards).
The machine clock is November 6; the benchmark directory's November 10 date is retained as requested.

Check/validate/build/render runs: 19, all successful, zero scene/script diagnostics.
Breakdown: validate 2 (source and built), inspect 1, build 1, sample 10
(5 source + 5 built), render 4, independent assertion verification 1.
Help/docs/schema queries and image views are not included in those 19.
Before installation, six CLI help/docs attempts each reported ERR_MODULE_NOT_FOUND
for @anima-format/core: 6 errors total. `npm ci` fixed this. It also reported
10 moderate dependency vulnerabilities and an esbuild install-script warning;
those are installation warnings, not scene errors. No other errors were reported.

Source size: 66 lines, 3365 characters of AniML. All authored executable sources:
249 lines, 9131 characters (AniML + 9 sample/render scripts: 119 lines / 2954
characters + verify.py: 64 lines / 2812 characters). Generated .ani, JSONL, PNG,
report and work log excluded. UTF-8 character counts include final newlines.

Brief items met (1–6), each with how checked: 6/6.

1. `inputs.script` checks default 0.5 and values 0, 0.165, 0.33, 0.495, 0.66,
   0.83, 1. Knob local x and fill trim equal volume. The authored rail transform
   maps the knob to world x = 12 + 24 × volume, y = 6. Default/full PNGs show it.
2. `drag.script` grabs at x=25 with knob center 24, moves to 31 and observes
   volume 0.75 (center 30, retaining offset -1). Outside-track moves clamp to
   1 and 0; return to x=19 yields 0.25, retained after release. A second grab
   0.5 left of center and move to 23.5 yields 0.5, retained after release.
3. `keys.script` sends arrows without an explicit target: before focus, Right
   leaves 0.5; focus target knob then Right gives 0.6, Left 0.5, repeated Left
   0.4. Right at 0.95 clamps to 1; Left at 0.05 clamps to 0. After focus clear,
   Right leaves 0. These exercise logical focus, not merely target-addressed keys.
4. `inputs.script` verifies all wave endpoints and each fade midpoint: 0.165,
   0.495 and 0.83 give 0.5 for their respective wave. An actual 1D machine blend
   combines four constant timelines at thresholds 0, 0.33, 0.66, 1.
5. `pulse.script` checks scale 1 at increase, 1.08 after 0.1 s, 1 after 0.2 s;
   decrease while idle stays 1. Increase during pulse restarts at 1; decrease
   during pulse retains the current 1.08 and finishes normally. Unchanged volume
   stays idle. Pivot (5,6) is authored; pulse-peak.png shows speaker expansion.
6. `mute.script` uses actual pointer clicks on body and cone, checks muted,
   waves parent opacity 0 and slash opacity 1; changes volume while muted then
   unmutes and observes restored wave levels 1,1,0.5 for current volume 0.83.
   muted.png shows the slash and hidden waves.

Verification: run from repository root:
`python3 docs/benchmarks/runs/2026-11-10-p4c/animl-rerun/verify.py`.
It independently checks expected numbers with 1e-10 tolerance, replays five
scripts on volume.ani, and compares every snapshot against the saved source
samples. This run passed 370 comparisons. All transition tests initialize with
advance 0 before changing inputs. Samples and built samples are committed.

Items not met or approximated, and why:
No behavioral item is approximated. The cone is the quadrilateral implied by the
four coordinates in the brief (which calls it a triangle). Thresholds use the
brief's literal 0.33/0.66 rather than exact mathematical thirds. Verification is
CLI/headless only; browser DOM focus and physical hardware interaction were not
tested. PNG output uses a square 960px canvas with letterboxing around the 40×12
viewBox; this is evidence framing, not extra scene geometry. Default, muted and
pulse-peak renders were visually inspected; full was generated but not separately
opened. Pixel-perfect geometry was not measured independently of the authored
coordinates and renders.

What was hardest; what docs or diagnostics got wrong or left out:
Drag coordinates need normalization to write volume directly; the permitted
modules/input/examples/drag-slider.animl demonstrated the scaled parent and
inverse-scaled circle. The current input/focus/bind/machine docs were sufficient.
The blend-pulse example supplied the increase-gated any-state pulse recipe.
No blocking documentation gap or scene diagnostic occurred. The only setup
failure was missing workspace dependencies, resolved with the requested npm ci.
No implementation source, forbidden benchmark run, oracle, .riv file or Rive
command was accessed. No push, PR or merge was performed.
