Format: AniML (`sync.animl`), compiled with the Anima CLI to `sync.ani`.
Wall time (first command to done): 5 min 10 s.
First command: 2026-11-06T00:36:55Z. Finished: 2026-11-06T00:42:05Z (final report/commit checkpoint, second precision).
The run directory uses the requested benchmark date; the environment clock is November 6.

Check/validate/build/render runs: **19** CLI invocations:
3 validate, 1 inspect, 2 build, 7 sample, 6 render (5 PNG, 1 SVG).
`checks.json` records all 19 invocations and exit codes. All returned 0, with no
animation diagnostics, script errors or failed numerical assertions. The first build
printed JSON to stdout; the second used `-o sync.ani` to save the required artifact.
`verify.py` collects CLI evidence and asserts numerical results; rerunning it adds 15
invocations to the historical ledger. Documentation/schema/help commands and installation
are excluded from the animation-check count, but their errors are recorded below.

Source size (sources written only): **144 lines, 5,485 characters** for the hand-written
AniML. Including 7 sample scripts and the CLI-only Python verifier: **390 lines,
11,221 characters**. Generated `.ani`, JSONL snapshots, ledger, report, SVG and PNG
outputs are excluded. No generator wrote the AniML.

Brief items met (strict): **4/6**.

1. **Met.** `turn` loops over 1.2 s with quantize=10 samples/s: 12 clockwise steps
   of 30 degrees per turn. `spin.script` verifies a hold from t=0 to .05, the first
   tick at .105, 330 degrees at 1.15, wrap to 0 at 1.2, and 30 at 1.305.
   `sweep.script` actually samples every step 0–330 and the next loop's zero;
   `verify.py` checks the independent expected sequence. `ticking.png` shows 90 degrees.
2. **Partial; not counted.** True→false triggers a real 0.6 s elastic check pop about
   (10,10): `stop.script` measures scale 0 at entry, 1.3535533905932737 at .09 s,
   and 1 at .6 s and 2.6 s. `elastic.png` shows the overshoot. However, arrows
   jump from 90 to phase's 0 immediately when stopped at .35 s. They do **not**
   finish their current tick or preserve the stopping angle. The stop sample records
   this failure explicitly rather than merely testing the elastic timeline in isolation.
3. **Partial; not counted.** Pointer enter/leave listeners work, scale to 1.1 about
   (10,10), and maintain continuity on leave. `hover.script` enters for .2 s (1.05),
   leaves (still 1.05), and samples 1.0375 at .1 s after leaving, 1.025 at .2 s,
   then 1 at .4 s; a full hover reaches 1.1. This uses symmetric pose crossfades,
   **not** playback of the same animation in reverse, and the return takes a fresh
   .4 s instead of the remaining .2 s. `hover.png` verifies full enlargement.
   `host-reverse.script` separately exercises the actual `peek-motion` timeline:
   play .2 s, speed -1, then .1 + .1 s gives 1.05→1.025→1 with no jump. That
   proves a host-control route exists, but does not satisfy automatic listener reversal.
4. **Met.** `phase.script` changes the number input while idle: .04→0, .12→30,
   .2→60, .5→180, .99→330, 1→360, then 0→0. `sweep.script` samples all twelve
   phase buckets and both endpoints. Changing phase to .9 while syncing still yields
   the clock's 30-degree tick at .105 s, rather than phase's 300-degree angle.
   Thirteen pose states implement floor(phase*12)*30 (the endpoint 360 is visually 0).
5. **Met for reduced motion selected before entering the states.** `reduced.script`
   actually starts/stops syncing in reduced mode, samples rotation 0 at entry and
   after .35 and 2.35 s, and scale 1 immediately on completion and afterward.
   `reduced.png` shows the resulting check with no overshoot. Live changes to the OS
   preference during an already-running state were not tested; no browser test was run.
6. **Met.** Initial snapshot (in `spin.jsonl`, `phase.jsonl`) has rotation=0,
   peek scale=1 and check scale=0; `rest.png` and `rest.svg` show only the two arrows.
   Rendered geometry uses the specified arcs, grid, ink/accent and stroke widths.
   Chevron legs are 2 units, rounded to .001 grid-unit coordinates; both 150-degree
   arcs have radius 6, round caps and clockwise-end chevrons. Check tips are exact.

Items not met or approximated, and why:
- Item 2's finish-current-step/frozen-angle handoff was not solved in declarative AniML.
  Documented `exit` is an elapsed source-distance gate since state entry, not a gate
  on every quantized tick, and I found no documented current-clock capture into a pose.
- Item 3 uses crossfades as the explicitly marked approximation. Listener actions in
  the served spec expose input writes, triggers and events, not timeline speed/seek
  controls. Host script controls demonstrate the correct reverse behavior separately.
- No runtime or CLI implementation was changed to fill those gaps. These are findings
  about this attempted authoring workflow, not proofs that every possible encoding fails.

What was hardest; docs/diagnostics gaps:
- There is no `anima docs motion` topic, even though `docs spec` and `docs markup`
  include motion chapters. Reading those chapters resolved the missing-topic obstacle.
- Scrubbing exists as an imperative timeline operation, but no documented expression
  binds an input to its clock; idle scrubbing needed thirteen explicit pose states.
- Accurate reverse playback exists imperatively but no documented listener action
  connects enter/leave to it. A pose crossfade is continuous but has different timing.
- Every reactive test begins with `advance 0` before changing inputs. Sample outputs,
  not just static source inspection, establish each claimed result and each deviation.

Errors seen (including setup/discovery, counted honestly):
- `ERR_MODULE_NOT_FOUND`: **2**, from the initial `--help` and `docs --list` calls
  before installation. Ran `npm ci` as instructed; later CLI commands worked.
- `no docs topic "motion"`: **1**, exit 2. Used `docs spec` / `docs markup` instead.
- `rg: modules/motion/examples: No such file or directory`: **1** discovery error;
  used allowed `examples/motion.animl` instead. No forbidden source was read.
- Animation check errors: **0**. Assertion failures: **0**.
- Installation advisories (not failed checks): npm reported **10 moderate severity
  vulnerabilities**, plus **1** uncovered install-script package (`esbuild`); no audit
  fix or dependency edits were made.

Evidence/reproduction:
`python docs/benchmarks/runs/2026-11-08-p4b/animl/verify.py` from the repo root.
The verifier invokes only the CLI and reads its own artifacts; no runtime source imports.
JSONL outputs and PNGs are committed alongside their scripts. Rest, ticking and elastic
PNGs were visually inspected. All CLI render/sample verification used the built `.ani`.
Only allowed CLI documentation, schemas and examples were used to learn the format;
required WORKLOG/git history/PLAN/ARCHITECTURE and the benchmark instructions were read
for task context. No other format materials, `.riv` files or prohibited source were opened.
No Rive command, push, PR or merge was performed. Final changes are committed locally.
