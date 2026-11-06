Format: AniML (.animl), Anima CLI (Node 24)
Wall time (first command to done): 4 min 22 s.
First command: 2026-11-06T09:59:13Z. Finished artifact verification/report: 2026-11-06T10:03:35Z.
Timebox: 45 minutes; stopped when deliverables were complete. Local commit follows this timestamp.

Check/validate/build/render runs: 15 total: 14 CLI runs (3 validate, 1 inspect,
6 sample, 1 build, 3 render), plus 1 independent Python assertion run. All final runs pass.
Errors seen: 9 total error occurrences across all commands:
- ERR_MODULE_NOT_FOUND: 5 (initial --help and four batched docs calls before npm ci).
- bind-syntax "unexpected character": 3 diagnostics in the first validation, one per leader binding.
- no schema topic "data": 1 (the authoring guide explicitly recommends anima schema data).
The first validation was the only failed check run; it reported 3 errors. Documentation/setup
failures above are included in the error total but not in check-run count. npm ci passed,
reporting 10 moderate vulnerabilities and install-script warnings; these were warnings, not
additional command errors. No dependency files changed.

Source size: scoreboard.animl 62 lines, 3,754 characters (hand-written, no scene generator).
With the four sample scripts and verify.py: 331 lines, 13,194 characters.
Generated .ani, JSONL evidence, inspect output, PNGs and this report are excluded from source size.
rankings.script was generated from the Cartesian product of three independent score values.

Brief items met: 5/6 strictly (1, 2, 4, 5, 6).

1. MET. host.script first snapshot reads list length 3, all three names, scores and colours
   through $players.N paths without host initialization. Defaults match the brief exactly.
2. MET. host.script changes each player's score and colour, advances one frame (advance 0),
   and reads that bar's width and both fill colours. Initial widths are 18.75, 14.7 and 0.6;
   updated widths are 27, 28.5 and 30. verify.py asserts the arithmetic and colours.
3. PARTIAL, NOT COUNTED. Converter group number-format + template produces 1,250 pts,
   980 pts and 40 pts and updates after every tested host write/drag. These are sampled as
   ada.properties.label, lin.properties.label and sam.properties.label. They are node custom
   properties, NOT read-only string properties on the player data instances. No documented
   derived/read-only model-property declaration or binding target was found. The requested
   $players.N.label API is absent. Do not treat correct formatting as satisfying the whole item.
4. MET. drag.script grabs at x=23.75 and moves to 27.5, 20, 40 and 0: scores become 1500,
   approximately 1000, 2000 and 0. Host score 1000 returns the knob to x=20 in scene units.
   A second off-centre grab at 20.5 and move to 23.5 yields 1200, preserving grab offset.
   knob.x is in parent coordinates: scene x = 5 + 0.015 * knob.x. All samples independently
   assert score, knob coordinate, bar width and formatted label. Pointer up retains the value.
   Normal floating-point roundoff (1000.0000000000001) is accepted within 1e-8.
5. MET. host.script observes each leader and Ada's three-way tie win, then Lin's tie with Sam.
   rankings.script tests all 27 triples drawn from [0, 980, 1500], including every ordering and
   tie pattern. verify.py independently chooses the first maximum and asserts exactly one
   stroke width 0.5 and two widths 0. Stroke colour is the static accent.
6. MET. milestone.script reads the emitted events in every snapshot. Exactly four milestone
   events appear: host 1499→1500, host 1499→1600, drag 0→2000, drag 0→1500. Waiting,
   above-threshold updates, the 1500 boundary and pointer release do not duplicate a signal.
   Dropping below rearms the two-state machine. Initial advance 0 precedes all test writes.

Verification evidence:
- host.jsonl, drag.jsonl, milestone.jsonl, rankings.jsonl are raw anima sample output.
- built-host.jsonl exactly equals host.jsonl, independently asserted by verify.py.
- inspect.txt records the CLI's nodes/data inputs/bindings/state graph.
- default.png, lin-leads.png and dragged.png were rendered and visually inspected: rows,
  swatches, bar fills, moved accent outline, track and knob are present in their expected places.
  The CLI produces square PNGs with the 40×20 scene centred; transparent padding is retained.
- Re-run assertions from this directory with python3 verify.py. Recreate a sample with:
  node /absolute/path/to/repo/packages/cli/src/main.ts sample scoreboard.animl -s host.script

Items not met or approximated, and why:
Item 3 uses derived node properties instead of read-only player-model fields, as detailed above.
Actual browser/host callback execution was not tested; host writes and observable event records
were exercised through the permitted deterministic CLI sample scripts. No claim of a browser test.

What was hardest; what the docs or diagnostics got wrong or left out:
- Data model declarations expose ordinary mutable scalar properties; the permitted documentation
  did not provide computed/read-only string model fields. Node custom labels are the approximation.
- Bind expressions exclude comparisons, unlike transition guards. The initial leader bindings
  therefore failed. Three states with comparison guards resolve this without numerical tricks.
  The bind-syntax hint suggested writable paths/type matching, which did not explain the actual
  unsupported comparison. Reading anima docs bind clarified the grammar.
- anima docs authoring recommends anima schema data, but that schema topic is not implemented.
- The drag example's scaled parent gives event coordinates directly in score units, allowing
  data writes plus a one-way visual binding to implement the two-way interaction.

Resource compliance: read the task brief and benchmark overview, WORKLOG/git history as instructed,
then only CLI help/docs/schema and the listed data/input/convert examples for format learning.
No other run directories, .riv files, Rive commands, reference fixtures, tests/oracle, or runtime
source implementations were opened. The CLI's own docs contain links to those resources; none
were followed. No push, PR, merge, runtime/spec edits or dependencies added.
