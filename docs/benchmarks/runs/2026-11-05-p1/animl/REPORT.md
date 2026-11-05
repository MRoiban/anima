Format: AniML (.animl), Anima 0.1
Wall time (first command to done): 3m 28s; first command 2026-11-05 13:49:28 UTC; finished 2026-11-05 13:52:56 UTC (recorded immediately before local commit).
Check/validate/build runs: 16 total (12 anima commands, 1 browser-runtime bundle build,
1 Chromium assertion run, 2 git diff --check runs). Errors on these runs: 0.
Separate startup attempts: 3 failed CLI discovery commands, each reporting ERR_MODULE_NOT_FOUND
for @anima-format/core (3 errors total). npm ci then succeeded; its audit reported 10 moderate
vulnerabilities and an esbuild install-script warning. No dependency fixes attempted.
Source size: 51 lines, 1,997 characters (switch.animl, UTF-8, including comments and final newline).
The generated switch.ani and this report are excluded from authored-format source metrics.

Brief items met (1–7), each with how you checked it:

1. Met. Explicit boolean on defaults false; click listener toggles it across the full 20×20 hit rect.
   CLI samples start off, click (1,1) turns on, click (19,19) turns off. Chromium clicks at those
   coordinates independently confirm the bound boolean via aria-checked.
2. Met. Interruptible 0.3 s inOut pose blends animate knob.x 0→8 and track-fill.opacity 0→1.
   Sample at 0.15 s gives x=4, opacity=0.5; at 0.3 s x=8, opacity=1 and settled=true.
   Reverse gives x=4/opacity=0.5 halfway, x=0/opacity=0 at the end. At 0.075 s the forward
   translation is 1.0332954483785555, confirming non-linear easing. Separate outline stays opaque.
3. Met. After 0.075 s, reversal preserves x=1.0332954483785555 and opacity=0.12916193104731943
   exactly at the toggle; another 0.075 s gives x=0.8998330129235754 (moving back).
   At midpoint, two more immediate toggles preserve x=4 and opacity=0.5, then finish on.
4. Met. Pointer move then 0.075 s yields scale=1.075, and 0.15 s yields 1.15.
   Leaving gives 1.075 halfway and 1 at 0.15 s. Translation and scale use separate layers.
5. Met. Starting hovered, pointer down gives scale=1 after 0.04 s and 0.85 after 0.08 s.
   Pointer up restores scale=1 at 0.075 s and 1.15 at 0.15 s. The up also toggles normally.
6. Met. --reduced-motion sample: corner clicks yield x=8/opacity=1 then x=0/opacity=0,
   all at time=0 and settled=true. No animation step is needed after the pointer events.
7. Met for the stated checks. Real Chromium with the built web runtime finds role=switch,
   accessible name="Dark mode", aria-checked=false initially, true after one corner click,
   false after the next. Assertions pass and pageerror list is empty. "Pressed" for this role
   is represented by aria-checked, as documented by anima docs spec §10.

Geometry verification: inspected CLI-rendered off/on SVGs and a seven-frame PNG contact sheet.
The SVG has viewBox 0 0 20 20; both track rects are x=2/y=6/width=16/height=8/rx=4;
outline is #141413, width=1.5; fill is #d97757. Circle is cx=6/cy=10/r=2.6, fill=#141413;
x translation of 8 places its on centre at (14,10). The hover scale is applied about its centre.
Compiled .ani also validates and samples correctly, including x=8, opacity=1, scale=1 after leaving.

Items not met or approximated, and why:
None of the seven literal brief items are approximated or left unverified. Browser motion timing
was not measured; timing and interruption were checked using deterministic CLI samples instead.
Keyboard activation is not implemented: a11y.activate accepts a trigger, while the toggle is a
boolean and this format exposes no state-entry input-write action. The brief's item 7 only asks
for role, label and state binding; this is not a claim of complete keyboard accessibility.
Release-to-hover uses 0.15 s and feedback uses linear easing; the brief does not specify either.
Interrupted toggle blends take a fresh 0.3 s from their current position, as allowed by the brief.
No screen-reader session or cross-browser accessibility check was performed.

What was hardest; what the docs or diagnostics got wrong or left out:
Dependency setup was the only failure: help/docs could not start until npm ci linked the workspace.
No authoring diagnostics occurred and no source corrections were needed. Markup docs, state/listener
and motion-check topics, schema rect, spec via anima docs, and bell.animl sufficed. The startup
Node error did not suggest npm ci; the task instructions supplied that recovery. The trigger-only
keyboard activation interface cannot directly reuse the boolean toggle action. No other format's
materials, runtime implementation source, or .riv files were read.

Run inventory (each listed command was executed once unless a count is given):
- anima validate: switch.animl and compiled switch.ani (2).
- anima inspect: switch.animl (1).
- anima sample: basic forward/reverse, interruption/repeated toggles, hover/press/leave,
  reduced-motion, compiled-output parity (5).
- anima render: off SVG, on SVG, seven-frame PNG sheet (3).
- anima build switch.animl -o switch.ani (1).
- esbuild bundle of the documented @anima-format/web entry for the browser harness (1).
- Playwright Chromium harness using cached chromium_headless_shell-1248 (1).
- git diff --check, then git diff --cached --check before commit (2).
Discovery commands (--help, docs and schema) are excluded from the 16 check/build runs;
their three failed startup attempts are disclosed separately above.

Reproduction (from repository root; anima means node packages/cli/src/main.ts):

```sh
anima validate docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl
anima inspect docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl
anima sample docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl -e 'snapshot; pointer click 1 1; advance 0.15; snapshot; advance 0.15; snapshot; pointer click 19 19; advance 0.3; snapshot'
anima sample docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl -e 'pointer click 10 10; advance 0.075; snapshot; pointer click 10 10; snapshot; advance 0.075; snapshot'
anima sample docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl --reduced-motion -e 'pointer click 1 19; snapshot; pointer click 19 1; snapshot'
anima render docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl -o /tmp/switch.png --sheet 7 --over 0.3 -e 'pointer click 10 10'
anima build docs/benchmarks/runs/2026-11-05-p1/animl/switch.animl -o /tmp/switch.ani
```

The browser harness was temporary (/tmp/animl-browser-check.mjs); it bundles the documented web
entry, inserts the compiler-generated JSON into an anima-icon's application/vnd.anima+json script,
uses reduced motion, asserts the switch's accessible name and aria-checked before/after two clicks,
and closes Chromium. Render outputs were temporary, not deliverables. No push, PR or merge.
