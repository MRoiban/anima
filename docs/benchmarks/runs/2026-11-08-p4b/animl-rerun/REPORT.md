Format: AniML, hand-written; Anima CLI via `node packages/cli/src/main.ts`.
Wall time (first command to done): 4 min 46 s.
First command: 2026-11-06T01:08:12+00:00; finished: 2026-11-06T01:12:58+00:00 (UTC, actual environment date).
The benchmark directory's 2026-11-08 date differs from the environment's 2026-11-06 clock.

Check/validate/build/render runs: 32 total = 30 CLI invocations and 2 independent
Python assertion runs. CLI breakdown: validate 3, inspect 2, build 1, sample 14,
render 10. All these returned exit 0; zero document diagnostics. Every CLI check's
arguments, output, stderr and status are in runs.jsonl, including superseded attempts.
Two earlier setup commands (`--help`, `docs --list`) each failed with
ERR_MODULE_NOT_FOUND for @anima-format/core: 2 errors total. `npm ci` fixed setup;
it reported 10 moderate vulnerabilities and an esbuild install-script warning.
Documentation/schema/help lookups and installation are excluded from the 32 checks.
Semantic findings: one resolved scrub boundary error and one unresolved active
reduced-motion error, described below. verify.py explicitly identifies the known
failure; its successful exit is not evidence that item 5 is fully met.

Source size: sync.animl = 64 lines, 2936 characters.
All authored executable sources (AniML, seven .script files, check-cli.py,
verify.py) = 396 lines, 11782 characters. Generated .ani, logs, report,
snapshots, inspect output and PNGs excluded. No icon generator used.

Brief items met (1–6), each with how checked: 5/6 strict.

1. MET. ticks.script: 50 snapshots over 2.45 seconds, twelve distinct 30-degree
   orientations, held between ticks, two observed loop wraps. A 12-second clock
   played at speed 10 gives one turn/1.2 s; quantize 1 gives 12 steps. Geometry:
   20-grid, arcs centred at (10,10), radius 6, exact specified angle ranges,
   1.5-unit ink strokes/round caps, two 2-unit chevron legs (coordinates rounded
   to four decimals). rest.png and ticking.png exercise the geometry; rest.png
   and overshoot.png were visually inspected.
2. MET. stop.script: request at 0.237 s holds 60 degrees through 0.299 s; exactly
   0.300 s reaches 90 degrees and starts the check at scale 0. At 0.390 s its
   elastic scale is 1.3535533905932737; at 0.900 s (0.6 s after start) it is 1
   and settled, and remains at 90 degrees two seconds later. overshoot.png shows
   the accent check. edge.script additionally checks cancellation of a pending
   stop and large-dt carry after a loop. Built .ani stop output equals AniML.
3. MET. hover.script uses pointer enter/leave. At 0.16 s scale is 1.04, stays
   1.04 on leave, reverses to 1.025 after 0.06 s, stays 1.025 on re-enter, reaches
   1.1 at the forward endpoint, then returns to 1 after a full 0.4 s reverse.
   Same peek-motion timeline in both directions, synced clocks; hover.png.
4. MET for circular orientation, including all eleven interior exact n/12
   boundaries, intermediate inputs, backward seeks and phase 0/1. scrub.script
   has 20 snapshots; stop.script also changes phase after completion, moving
   from captured 90 degrees to 240 degrees at phase 0.67. At phase 1 a looping
   timeline reports 0 degrees, visually equivalent to the requested full turn
   (360 degrees); this is a numeric representation difference, not literal 360.
5. PARTIAL, NOT COUNTED. reduced.script sets reduced motion before entry: arrows
   stay at 0, stop completes immediately, check is exactly scale 1 with no
   overshoot, settled throughout; reduced.png exercises this. But edge.script
   switches motion to reduce during an active spin: angle 60 becomes 300 after
   two seconds and the subsequent stop stays pending. No host workaround added.
6. MET. rest.script at t=0 and t=2: angle 0, check scale 0, peek scale 1,
   syncing false, phase 0, settled. rest.png shows only the two ink arrows.

Items not met or approximated, and why:
- Item 5 is partial because changing the motion policy during active playback
  does not freeze the current states; documentation describes entry-time policy.
- Phase 1 uses circular 0-degree representation; mathematical 360 is not retained.
- Arrowhead vertices rounded to four decimals (sub-0.001 grid-unit geometry
  error); no original reference raster comparison was available or attempted.
- Browser integration/OS preference changes were not tested; the CLI motion
  command explicitly exercises an active policy switch and demonstrates failure.

What was hardest; what the docs or diagnostics got wrong or left out:
- The obvious 1.2-second quantized clock with time="phase * 1.2" sampled phase
  1/12 as 0 instead of 30 degrees due to floating point rounding. The final
  integer clock avoids this at every exact n/12 input tested. Earlier logs
  preserve the bad sample. Boundary rounding for arbitrary accumulated dt is
  still subject to ordinary floating point representation; interior ticks and
  loop period were checked independently, without claiming exact real arithmetic.
- Completion needs a second matching wait clock to start its pop at the same
  boundary as the rotation stop. The docs clearly explain exitNext and sync,
  but do not give a direct cross-layer completion signal for this use.
- The docs' entry-time reduced-motion wording does not promise active-state
  freezing. The brief needs that stronger behavior; the CLI provides no
  diagnostic when changing motion leaves ticking active.
- Initial reverse hover would start at its endpoint; caught during authoring
  before sampling and corrected with an explicit rest pose.
- Motion and bind docs plus schema were sufficient; no runtime source, forbidden
  benchmark directories, reference sync solution, .riv files or rive commands
  were accessed. Required WORKLOG/history and benchmark policy reads exposed
  existing summary claims, not the other runs' sources. No push/PR/merge.

Evidence/reproduction:
Run from repository root. For each of rest/ticks/stop/hover/scrub/reduced/edge:
`python <this-directory>/check-cli.py sample <this-directory>/sync.animl -s <this-directory>/<name>.script`
The saved <name>.jsonl files contain 98 final-source snapshots in total.
`python <this-directory>/verify.py` reads those retained observations and the
built-stop.jsonl trace, asserts satisfied behavior and prints the known failure.
check-cli.py appends to runs.jsonl when replayed; the counts above describe this run.
