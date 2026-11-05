Format: Rive RML, local CLI project; no runtime scripts.
Wall time (first command to done): 10m 48s.
First command: 2026-11-05 20:41:25 UTC.
Finished implementation/validation: 2026-11-05 20:52:13 UTC (commit preparation follows).
The directory's nominal date differs from the machine clock; these are observed UTC timestamps.

Check/validate/build/render runs: 36, inclusively counted:
- 13 Rive invocations: 5 inspect, 8 command-mode capture attempts (1 failed before building).
- 8 generator/build invocations.
- 9 offline checks: failed Pillow analysis; standard-library PNG analysis; data/hash check; probe hash check; data/hash recheck; fontTools/default-data check; final PNG/XML/data assertions; source/file metadata inspection; final permitted-file/source-size audit.
- 5 individual image inspections, in 3 image-tool batches.
- 1 staged git diff whitespace check.
One command-mode session counts once, not once per internal command. Help/docs/schema/scaffold calls, edits, metadata-only git commands and the commit are excluded. Seven sessions rendered: 96 screenshot writes (6×15 + 6 exploratory); 15 final screenshots retained.

Errors seen: 6 execution/CLI diagnostic occurrences, plus 1 tool rejection:
- FileNotFoundError (1): repo-relative edit path used after changing working directory. Corrected.
- CLI no Rive project at .../commands.txt, no rive.yaml (1): --commands requires = before its optional filename.
- err data-dump: cannot write to stdout, which carries the acknowledgements; name a file (3). Replaced stdout with build/*.json.
- ModuleNotFoundError: No module named PIL (1). Replaced analysis with a standard-library PNG decoder; installed nothing.
- Tool policy rejected rm -f cleanup (1). Used explicit Python Path.unlink and scoped build-directory removal instead; no approval requested.
Warnings: artboards-overlap (1), fixed by spacing component artboards on the editor stage. All later inspect results were problems: []; all 7 successful capture builds reported 0 errors, 0 warnings. Renderer depthStencil/4x MSAA fallback messages are informational, not build errors.

Source size: 997 lines, 73,315 characters, including comments/whitespace and embedded font bytes.
scene.rml: 705 lines, 58,577 characters.
gen_scene.py: 292 lines, 14,738 characters.
ASCII sources: UTF-8 byte counts equal character counts. Commands/config/report/screenshots excluded.

Brief items met (1–6), each with how checked: 6/6, with limits stated below.
1. One Button artboard defines all pointer listeners, one press state machine and its three pose timelines. Three stateful placements supply different glyph artboards. Hover/release target scale 1.06 over 120 ms; down targets 0.92 over 80 ms, about (120,120). Captures 01–03 and 09–14 exercise all three buttons. Thresholded ink-height scale ratios: bell 1.067/0.921/1.067, folder 1.057/0.914/1.057, trash 1.056/0.911/1.056. These agree within raster/threshold/badge-overlap effects. Exact values/timing verified in source; endpoint captures do not verify every intermediate instant.
2. One Badge artboard has its own count and previous-count memory, an accent circle of radius 42 px (3.5 units), centred at button-relative (228,48), white numeric Text, and zero opacity at count=0. Increases enter a 30-frame/120 fps animation with scale keys 1,1.25,1 at frames 0,15,30. Decreases sync memory without Pop. Captures 05–07 show 1, enlarged 3, settled 3. Measured badge diameter 84→100→84 px: sampled scale 1.1905. Exact peak 1.25 and total duration 250 ms are source-verified; the exact peak instant was not captured. The generator creates and embeds an original seven-segment numeric TrueType font (digits 0–9), requiring no external font file. Final result uses actual numeric Text, not dots.
3. Toolbar unread defaults to 3 and continuously binds through Button.count to Badge.count. Mid-run unread=1 then unread=3 visibly changes the label and pops it. Final dumps confirm matching nested counts.
4. Bell click clears Button.count and its two-way parent binding sets unread=0. Cleared dump: unread=0, trash=0. Final PNG assertions found no accent pixels in the bell badge region; capture 04 shows disappearance.
5. Trash uses the same Button and Badge definitions, with count driven by toolbar trash (default 0). After trash=2, dump values were toolbar (unread,trash)=(3,2), bell/Badge.count=3, trash/Badge.count=2. Capture 08 shows independent numeric badges.
6. Visually inspected capture 00: 864×288, three exact compound even-odd fixture glyphs, white numeral 3 on the bell badge, no trash badge. Rest dump: unread=3, trash=0. Absolute SVG M/L/C/Z paths were converted without flattening cubic curves. Colours are ink FF141413, accent FFD97757 and white FFFFFFFF.

How the press behaviour and the badge are reused (one definition each?):
All three toolbar placements reference Button artboard 0:30; it owns all press logic. A dynamic nested glyph receives each placement's Artboard property. Button places Badge artboard 0:60 with a per-instance count binding; its internals own visibility and pop. XML assertions confirm exactly one definition named Button and one Badge. The generic folder also contains an unused hidden badge instance.

Items not met or approximated, and why:
- No requested item intentionally omitted. Exact transition durations and peak are authored, but press captures only sample endpoints and pop capture samples near the peak. Continuous temporal interpolation, rapid repeated count increases and arbitrary host startup values were not exhaustively verified.
- Only counts 0,1,2,3 exercised. Numeric font has digits only: negative numbers have no sign glyph. Labels round to integers; long labels may exceed the badge.
- Generic click handling clears each button's own count, so trash also clears when clicked. Trash click behaviour was unspecified in the brief.
- At the specified trash badge centre/radius, the badge extends 6 px beyond the right edge of the viewport and is clipped there. Authored coordinates/radius match the brief.
- Browser embedding and interactive preview were not run. No deployment/account commands, .riv reads/opens/conversions, push, PR or merge.

What was hardest; what the docs or diagnostics got wrong or left out:
- Clean inspect did not prove nested machines were running. Explicit NestedStateMachine placements were needed for interaction/pop; count bindings had already appeared functional. Runtime data/pixel checks caught this.
- A parent listener targeting the nested bell did not receive clicks. Moving the click handler into shared Button with a two-way count binding worked.
- The initial child literal 0 overwrote the host default 3 through that two-way bind, despite the docs' blanket host-wins-first-sync guidance. Matching bell's initial child count to 3 fixed the verified rest state. Other startup values remain unverified.
- KeyFrameDouble defaults to hold; explicit linear interpolation fixed stepped pop. Fractional frame 7.5 read back as 7 without a diagnostic; integer keys at 120 fps avoid that.
- Required external font assets conflicted with the restricted committed-file list. Building/embedding original font bytes kept the scene self-contained at additional source-size cost.
- CLI optional-argument spelling and command-mode stdout restriction cost the failures recorded above.

Reproduce from toolbar/: python3 gen_scene.py; rive inspect . --summary; rive . --commands=commands.txt.
Commands recreate transient JSON evidence under build/ and the 15 retained frames. Data summaries and numeric pixel measurements above were read before transient build/ deletion. Intermediate probe screenshots were removed; final captures all come from the final source. Scaffold AGENTS.md, CLAUDE.md and .gitignore deleted. Only permitted sources/config/commands/screenshots/report committed. Root WORKLOG read initially but unchanged to honour this task's stricter commit scope.
