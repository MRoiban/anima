Format: Rive markup (RML), local Rive CLI project.
Wall time (first command to done): 418.311 seconds.
First command: 2026-11-06T10:50:28.789345+01:00 (`date -Ins`, repository task state/history and supplied brief).
Finished scene/evidence/report: 2026-11-06T10:57:27.100400+01:00. Commit follows immediately.

Check/validate/build/render runs: 26, counting 9 format-tool/launch attempts,
5 supplementary Python JSON/metric readbacks, 1 raw JSON inspection, and 11
individual image inspections. Research/help/schema calls, source generation,
source editing, and git/file hygiene commands are excluded. The 9 attempts were:

1. inspect1.json: one warning, artboard-without-style.
2. Initial capture launch: shell redirection failed (evidence/ absent at cwd);
   Rive never started (launch-error.log).
3. Space-separated --commands smoke.commands: CLI treated smoke.commands as
   the project, reported no Rive project there, and returned status 0 (smoke.log).
4. --commands=smoke.commands: successful capture session (smoke2.log).
5. inspect2.json: no problems.
6. --commands=smoke.commands after label implementation: successful (labels.log).
7. --commands=verify.commands: successful (verify.log).
8. inspect-final.json: no problems.
9. --commands=final.commands: successful (final.log).

All four successful capture sessions built once, each with 0 errors / 0 warnings.
They issued 28 screenshots, 26 data dumps and 1 semantics capture (55 capture
commands within those four sessions), all answered ok. Early smoke filenames
were overwritten by the labels session; final-* files are the final source.
Errors seen: 3 distinct reports, 1 each: missing output directory, no project at
smoke.commands, and unknown schema type StateMachineFireViewModel (research
lookup, recorded in schema-error.log). Inspection warnings: artboard-without-style
once, fixed with linked LayoutComponentStyle. The renderer reported its depth /
4x MSAA fallback in successful sessions; this was not a build warning/error.

Source size: 205 lines, 32,878 characters (scene.rml 128 / 24,193;
generate.py 77 / 8,685). Counts include both generator and generated source;
configuration, commands and evidence excluded. ASCII sources: characters=bytes.

Brief items met (1–6), each with how checked: 5/6 strictly.

1. MET. final-default.json contains a players list of three Player instances,
   with Ada 1250 FFD97757, Lin 980 FF6A9BCC, Sam 40 FF788C5D. Named ada/lin/sam
   references point to the same instances; list and named scores changed together
   in the earlier smoke dumps. Default data needs no host initialization.
2. MET. Native Rectangle.width binds score via 0..2000 -> 0..360; swatch and
   bar SolidColor bind each player's color. Captures show defaults, host score
   changes and all three color overrides (05-host-colors.png). final-color.png
   shows Lin's green bar and swatch on the frame advanced by data itself.
   Geometry: 480x240, row centers 36/96/156, swatches (24,y) radius12,
   left-anchored bars (60,y-12), height24; score2000 gives width360.
3. APPROXIMATED, NOT MET strictly. Live template converters plus score-number
   formatting, arithmetic, zero padding and two template states produce grouped
   strings with suffix: 40 pts, 999 pts, 1,000 pts, 1,001 pts, 2,000 pts, tested
   in final-*.json. They update after score changes, including drag. However,
   these are ordinary writable VM strings: final-readonly.json proves a host
   can replace label with HOST OVERRIDE. No enforced read-only declaration was
   found in the property schema. Marking this complete would be inaccurate.
4. MET. Knob x binds two-way to Ada through range mapper 0..2000 -> 60..420.
   Drag uses ListenerAlignTarget and translation limits lock y216 and x60..420.
   final-middle/upper/lower/quarter.json report scores 1000/2000/0/500 from
   real pointer moves. Captures show the knob remaining on the track despite
   pointer y170, and host score1800 placing it at x384. Initially preserveOffset
   true lost the first movement and biased subsequent coordinates; false fixes it.
   Knob grabs near an edge snap its center to the pointer on first move.
5. MET. A three-state layer compares live scores, with strict comparison against
   earlier rows and inclusive comparison against later rows. Keyed stroke widths
   are 6px on precisely one bar, 0 on the others. final-lin.png, final-sam.png,
   final-lin-tie.png, final-ada-tie.png visually confirm each winner and both
   earlier-player tie rules. Ada's accent fill matches its outline, but the
   outline's extra 3px extent remains visible.
6. MET. A below/above1500 state layer emits Event milestone only on entering the
   above state. verify.log has exactly two events for the two explicit threshold
   crossings, and a third later when Ada goes from1000 to2000. final.log has
   four: initial host1800, drag to2000 after1000, then two explicit1499->1500
   crossings. Writes remaining above threshold and repeated1500 do not add events.
   Evidence is native host-facing event log output, not an authored counter.

Items not met or approximated, and why:
- Item3 lacks enforced read-only access. Host writes survive until the next
  score/template update. No host wrapper or extra runtime script was added.
- Integer labels are verified in the specified 0..2000 score range. Fractional
  scores are formatted to integer strings; above1000 the remainder uses floor,
  below1000 ToString rounds. General decimal/grouping/negative-score semantics
  and scores above999999 are unverified. The brief gives integer label examples.
- Named references ada/lin/sam are supplied because CLI data paths cannot write
  list-index paths; the real players list is still present and shares instances.
- Verification is CLI-native, including real pointer dispatch, data, PNGs and
  host event logs; no web host integration was built or verified. The semantics
  dump is recorded only as evidence, not an accessibility claim.

What was hardest; what docs or diagnostics got wrong or left out:
- Label derivation requires model template strings, custom-property bridges,
  template arguments, converter groups, formula tokens, pad and state layers.
  There is no thousands-grouping/read-only option on the inspected string types.
  DataConverterStringTemplate is discoverable by schema, but was absent from
  the data documentation converter catalogue read during this run.
- The docs recommend preserveOffset=true, but native drag alignment here
  establishes its offset on the first drag move, losing the requested delta.
  Center-snapping false worked. Inspection did not diagnose that behavior.
- No-project invocation returned success despite the diagnostic; tool exit code
  alone would have incorrectly counted a successful capture.
- Front-to-back source draw order initially put the track over the knob; swapping
  their declarations fixed it. Pixel inspection was necessary.

Scope/resources: supplied BRIEF.md, root WORKLOG.md and git history (required
startup task state), Rive --help/docs/schema/create/inspect/headless commands,
and the allowed bell RML reference. No Anima format docs/spec/examples/oracles
read; no .riv file read/opened/converted; no forbidden CLI command invoked.
No subagents, network publication, push, PR or merge. Generated scaffold docs
and ignore file were deleted immediately; build logs removed before commit.
Task checkpoint is here rather than changing the root WORKLOG outside the
user's explicitly allowed output scope.
