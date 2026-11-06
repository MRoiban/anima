Format: AniML, Anima CLI; base commit 629c031.
Wall time (first command to done): 311 seconds (5.19 minutes).
First command: 2026-11-06T12:07:02+01:00 (`date -Iseconds`).
Finished verification/report finalization: 2026-11-06T12:12:13+01:00.
Local commit bookkeeping follows this timestamp; within the 45-minute timebox.

Check/validate/build/render runs: 39, including sample/inspect.
Breakdown: validate 2, inspect 1, build 1, sample 32, render 3.
Every invocation and its stdout/stderr is retained in `evidence/checks.jsonl`.
CLI scene validation/build/render reported zero diagnostics. Five deliberate read-only-write
sample runs exited 1, each reporting exactly `script line 2: input "$players.0.label" takes a string`.
Those five errors are counted, despite being expected negative checks.

Other errors: two startup ERR_MODULE_NOT_FOUND errors, one each from --help and docs --list
before dependencies existed. Ran npm ci successfully, then retried both successfully.
One Python verifier AssertionError: expected `read-only-path`, received `takes a string`.
Corrected the expected diagnostic after observing it; the scene did not change.
Total reported errors across setup/checks/verifier: 8 (2 setup + 5 deliberate CLI errors + 1 harness error).
Verifier invoked three times: first failed at the diagnostic assertion, next two passed.
These Python invocations are not counted again as CLI checks; their child CLI runs are all counted.

Source size: scene 44 lines, 2,995 characters (UTF-8 ASCII, including final newline).
All authored deliverable sources: 421 lines, 38,175 characters: scoreboard.animl,
seven .sample scripts and two .py utilities. This includes expanded sample scripts, even though
I generated their repetitive commands myself. Built .ani, PNGs, reports and captured evidence
are excluded from source metrics. The AniML scene was written by hand, not decompiled.

Brief items met (1–6), each with how checked: 6/6.

1. Players as data: `defaults.sample` reads list length, all three names, scores, colours and
   computed labels from `$players` after `advance 0`, without any setup writes. Exact defaults
   Ada/1250/#d97757, Lin/980/#6a9bcc, Sam/40/#788c5d pass. The colour property is named `tint`.
2. Bars follow scores: `host.sample` writes every player's score through all 27 triples over
   0/1000/2000, then writes each colour, followed by a fractional score of 1234.25.
   Snapshots prove width = 30*score/2000 and both swatch/bar colours follow on the next frame.
3. Formatted labels: every snapshot reads the actual model `$players.N.label`, never a
   visual-node surrogate. Independent expectations check comma grouping and ` pts`, including
   default `1,250 pts`/`980 pts`/`40 pts`, zero, 2000 and a fractional score.
   `readonly.sample` deliberately attempts a label write and is rejected. `name-write.sample`
   proves the same quoted-string syntax can write a mutable name; its label remains score-derived.
4. Two-way slider: `drag.sample` uses real pointer down/move/up commands, covering intermediate
   scores, both out-of-track extremes, clamping, reversing direction, retained release value,
   host-set repositioning and an off-center grab preserving its offset. `fractional.sample`
   additionally checks x=24.501 -> score=1300.0666666667 -> width=19.501, before and after release.
   It reads explicitly named-instance `$main:players.0.score` and label paths.
5. Leader: every frame asserts all three stroke widths (exactly one is 0.5, others zero).
   The 27 ranking cases cover each winner, all-equal and pairwise ties; Python chooses the
   first maximum independently of the scene expressions. Three PNGs show the visible outline.
6. Milestone: `milestone.sample` checks event arrays after each write and step for
   1250/1499/1500/1501/1500/1499/1500/2000/0/1600/1600, plus a one-second hold.
   Exactly three signals fire on upward crossings; none on plateau, decrease or hold.
   Drag evidence separately produces exactly two milestone signals after dropping/re-crossing.
   `advance 0` precedes scripted sets as required, so this exercises state transitions correctly.

`verify.py` asserts 63 snapshots for each of source and compiled document (126 total),
plus one deliberate write rejection per document in its final run, and exact source/build
snapshot parity. Evidence summary: `evidence/verification.json`. Numeric tolerance 1e-8 is only
for ordinary floating-point coordinate arithmetic; colours, strings, outlines and event counts
are compared exactly. Successful positive sample checks finish without errors.

Reproduce from repository root:

```sh
python docs/benchmarks/runs/2026-11-06-p4e/animl-rerun/verify.py
```

The wrapper appends new invocations to the ledger on reruns; the 39-run metric describes this run.

Items not met or approximated, and why: none of the six brief behaviours is approximated.
Verification limits: no real browser embedding or DOM subscription was tested. Host access here
means the explicitly allowed sample-script writes, `$` reads and observable `events` arrays.
PNG evidence was rendered and visually inspected for default, changed Lin score/colour/leader,
and a fully dragged Ada score. The renderer makes square 960px PNGs with the 40x20 scene centered
and transparent margins; the document itself uses exact `viewBox="0 0 40 20"` geometry.
No text is drawn, as permitted. Sampling is finite evidence, not proof for every possible sequence.

What was hardest; what the docs or diagnostics got wrong or left out:
- The authoring data topic's computed-property and ranking examples are sufficient; no runtime
  implementation source was needed. The input example's parent-coordinate technique avoids a
  feedback converter: scaleX=.015 converts parent x directly to score, inverse knob scale keeps
  its radius one in scene coordinates.
- The readonly documentation promises `read-only-path`, but sample emits the misleading
  `takes a string` message even though the argument is a valid string. This was the only
  encountered format/tool diagnostic mismatch. The negative test records the actual output.
- Fresh checkout dependencies were missing; npm ci resolved the documented startup failure.

Resources and deviations: only CLI help/docs/schema, the task brief and allowed example files
were used to learn/author the scene. Per the supplied startup instructions I also read WORKLOG.md
and git log; they contain historical summaries including benchmark results, but I did not open
any other-run deliverable or implementation. No prohibited .riv file, other benchmark run,
fixtures/bell/rive-reference or tests/oracle directory was read. No rive command was executed.
No implementation changes, pushes, PRs or merges. One local branch commit only.
