Format: Rive markup (RML), local Rive CLI project in `download/`.
Wall time (first command to done): 7 min 14 s. Finish: 2026-11-05 16:51:10 UTC (final report/commit bookkeeping). First command: 2026-11-05 16:43:56 UTC (host `date -u`; CLI log clock differs).

Check/validate/build/render runs: 11 command invocations (9 format/pixel checks + 2 repository hygiene checks):
- 3 `rive inspect ... --summary`: initial one warning, then two clean inspections.
- 4 headless capture launches: one argument-parsing failure, three successful builds (each 0 errors, 0 warnings). No separate build or verify command used.
- 2 custom pixel-check invocations: one unavailable-Pillow failure; one successful standard-library PNG analysis.
- 2 repository hygiene checks: artifact allowlist assertion and `git diff --cached --check`; both passed.
- Additionally, 19 individual image-view inspections. Counting these as inspect runs gives **30 total**. Successful capture sessions executed **37 screenshot commands** (13 + 13 + 11), leaving 24 final PNGs; the first 13 were replaced after fixing the scene. Six data-dump operations wrote temporary JSON outside the repo.

Errors seen, with counts:
- `no topic "animation"`: 1; `no topic "data-binding"`: 1 (documentation discovery; corrected using `docs --list`).
- `no Rive project in .../commands.txt (no rive.yaml)`: 1. Space-separated `--commands commands.txt` was parsed as a project directory; `--commands=commands.txt` worked.
- `ModuleNotFoundError: No module named 'PIL'`: 1. Replaced the check with standard-library PNG decoding; installed nothing.
- Warning `artboard-without-style`: 1. Fixed by explicitly linking the artboard's styleId.
- Silent visual defect: 1. The initial 1-D blend accumulated the previous frame's partial pose. Added a preceding baseline-pose layer. No tool diagnostic identified it; later pixel checks prove the held half-ring is stable.
- Informational GPU fallback `no interlock mode supports this frame, drawing it in depthStencil with 4x MSAA`: once per successful capture session (3); captures succeeded.

Source size (Unicode characters, newline included):
- Delivered `download/scene.rml`: **112 lines, 17,519 characters**.
- Temporary scene generator `/tmp/p4a-rive-generate.py`: **70 lines, 8,105 characters**. Not committed, per the deliverable allowlist.
- Combined scene + generator: **182 lines, 25,624 characters**. Commands, config, report, and temporary verification code excluded from this source metric.

Brief items met (1–6), each with how checked: **5/6 fully met; item 5 conditional/partial**.

1. **Met.** `progress` defaults to zero and is clamped to 0–1. Frames 01–04 follow 0.25/0.5/0.75/1 immediately after setting data, with no explicit advance. PNG circumference samples put the round-cap outer ends at 95.5/185.5/275.5 degrees clockwise from noon, consistent with 90/180/270-degree arcs plus the 9 px cap radius. Frames 13 and 14 differ by **0 pixels** after holding 600 ms; reset frame 15 is pixel-identical to rest. Gradient endpoints and stroke thickness are explicit in source; inspected the full-gradient capture.
2. **Met.** Frames 05–07 show onset, 100 ms, and 350 ms. The same five vertices move continuously: the shaft collapses into the elbow and the three chevron vertices become (78,120), (108,150), (162,90), i.e. the specified check coordinates scaled by 12. This is geometric morphing, not a crossfade between drawings. The shared transition is 350 ms with cubic ease-out (0,0,0.58,1), filling the trim and blending the light gradient stop to accent. Endpoint verified visually; exact easing trajectory was checked in source, not independently fitted from pixels.
3. **Met.** The sweep is a 24 px perpendicular-width diagonal band with transparent edges and 40% white centre, clipped by a radius-96 ellipse. Frames 16/17/18 change **692/1382/702 pixels** relative to rest; **0 changed pixels** lie beyond radius 97 (one-pixel allowance for edge antialiasing). Frame 19 at 600 ms is identical to rest. Frames 09 and 10 are identical after holding hover a further 600 ms, so it does not loop. Frame 20 confirms a new sweep on re-entry. Geometry and opacity checked in source; inspected frame 08 visually.
4. **Met.** Pointer click sets the view-model trigger `start`. Temporary `/tmp/p4a-click.json` reported `start` type `trigger`, `changed: true`. An independent observer state consumes that trigger and emits `event start-observed`, seen in both full capture-session logs. The extra event is diagnostic instrumentation, not a substitute for the trigger.
5. **Partial/conditional.** A boolean `reducedMotion` input defaults false. With it set true before `done`, frames 11 and 22 jump directly to the final check; frame 22 is **pixel-identical** to normal completion frame 07. Frame 23 is unchanged after 600 ms. Hover skips to its end; changing the input during the sweep also ends it immediately (frame 21 equals rest). **No OS preference integration was implemented or verified. Changing this preference during the active 350 ms morph is not handled.** A host must set the input before starting the morph. Therefore this is not counted as an unconditional pass.
6. **Met.** Frame 00 visually contains only the track and arrow on a white presentation background. Circumference sampling counts **24 separate dashes**. Progress is empty and the offscreen highlight contributes no pixels. Reset frame 15 matches frame 00 exactly.

Items not met or approximated, and why:
- Reduced motion needs explicit host input; automatic OS preference detection and interruption of an already-running morph are not delivered.
- Circle paths use four standard cubic Bézier quarters (53.019335984 px handles on a 96 px radius). They approximate a mathematical circle; maximum radial error is about 0.027 px. The clipping ellipse is parametric.
- White artboard fill added so ink and the 25%-opacity track can be inspected against white. The CLI otherwise captured them against a dark background. No background colour was specified by the brief.
- Capture timing uses the CLI's frame stepping; data/pointer commands also advance the runtime internally. The named screenshots follow explicit advances, not independently measured subframe timestamps.
- Clipping was checked with a one-pixel raster-edge allowance, not a proof of exact continuous geometry. Sweep alpha/width and easing were verified in source, not independently reconstructed from images.

What was hardest; what docs or diagnostics got wrong or left out:
- The silent accumulation in the blend state was the main issue. Keying every property in both blend poses, as advised by the easing topic, did not by itself give stable fraction-of-circle output; a baseline layer was necessary here. Clean inspection/build output did not expose that error.
- Public property wiring uses numeric keys (e.g. boolean 634, number 636, trigger 686); the schema and worked bell example helped resolve the wiring.
- Optional command-file syntax needs the equals sign in this CLI invocation.
- Searching the available CLI docs for reduced motion found no applicable host-preference mechanism. This run does not claim one is impossible, only that it is not implemented here.

Resources consulted: benchmark BRIEF.md; `rive --help`, `create --help`, `inspect --help`; `rive docs` index/list/search and drawing, data, state-machines, easing, format topics; schemas for TrimPath, Dash, GradientStop, StateTransition, BlendStateTransition, Artboard, BlendState1DViewModel, BlendAnimation1D; the permitted bell scene and commands file. Read WORKLOG.md and git history only to comply with the supplied startup instructions; did not use Anima specs/docs/examples for implementation. No Rive source, documentation prose, or .riv content was copied/read. Scaffold documentation was deleted without opening it.

Reproduce (from `download/`):

```
~/.rive/bin/rive inspect . --summary
~/.rive/bin/rive . --commands=commands.txt
~/.rive/bin/rive . --commands=verify-commands.txt
```

Final hygiene: only scene.rml, rive.yaml, commands files, PNG captures, and this report are committed. No push, PR, merge, account operation, interactive preview, or forbidden CLI command was run. Root WORKLOG.md was left untouched to respect the explicit commit allowlist; this report records this benchmark's state instead.
