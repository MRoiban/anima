Format: Rive markup (RML), Rive CLI 1.9.0, offline headless capture.
Wall time (first command to done): 479 seconds (7.98 minutes).
First command: 2026-11-05 13:49:42 UTC. Finished authoring/report: 2026-11-05 13:57:40 UTC. Commit follows immediately. CLI log timestamps use local time (UTC+1).
Check/validate/build runs: 25 total: 13 Rive runs (9 headless builds/capture sessions, 4 inspect runs), 7 image-measurement attempts, 4 JSON/metadata checks, 1 final deliverable audit. Documentation/schema/help reads and scaffold creation are not checks. No standalone verify or forbidden build command was run.
Errors seen: 16 operational errors: 9 “could not write ../captures/…” screenshot errors (wrong working directory), 2 “data-dump: cannot write to stdout”, 2 “semantics: cannot write to stdout”, 1 Python ModuleNotFoundError for PIL, 1 cp “cannot stat” and 1 sed “can't read” (wrong working directory in an experiment). No RML compilation errors. One inspect warning: artboard-without-style, fixed by a linked LayoutComponentStyle. EGL depthStencil/4x MSAA fallback was informational, not a diagnostic error. Behavioural failures are listed separately below, not concealed in the zero-compile-error result.
Source size: 144 lines, 13024 characters (scene.rml only; ASCII, including whitespace/newlines). Hand-authored with shell text editing; no scene-generation script. Configuration, commands, report, and temporary pixel-analysis code excluded from source size as requested.

Brief items met (1–7), each with how you checked it:
1. MET. Boolean view-model input on defaults false. A transparent 240×240 hit shape toggles it. commands.txt dumps default false and post-release true. continuity.txt clicks (4,4) then (236,236), well outside the visible track; dumps show true then false. Captures 18/19 verify both visual endpoints. This is a modern view-model boolean, not a deprecated StateMachineBool.
2. MET for uninterrupted transitions. Off/on pose animations blend for 300 ms with cubic-bezier(0.42,0,0.58,1), including knob x and track opacity. Initial centre is (72,120), on centre (168,120), radius 31.2; track geometry is 192×96 at (120,120), radius 48, stroke 18. These equal the brief at 12× scale. Captures 11/12/13 show approximately x=72/78/94 at start/50/100 ms; 03 is near x=120 after 150 ms; 04 reaches on after 300 ms. Track centre RGB is (29,29,29) off (the preview background), (39,34,32) at 50 ms, and (217,119,87) on. Reverse reaches pixel-identical off at 300 ms (06 versus 00). Numerical easing beyond sampled frames is source-inspected, not exhaustively traced.
3. NOT MET. enableEarlyExit permits reversal but does not preserve the current mixed pose. In continuity.txt, capture 13 has knob ink interval x=63..124 (centre about 94); immediately after data on=false, 14 is x=92..153 (centre about 123): roughly a 29 px jump toward on. Actual pointer clicks also fail: captures 26/27 move from about x=94 to x=144 while reversing. Eventually returns off. No claim of continuous retargeting.
4. MET. 150 ms hover/exit transitions on independent scale layer. Captures 21/22 show intermediate/full growth after 75/150 ms; measured central ink diameter grows from 62 px at rest to 72 px (raster approximation of 62.4×1.15=71.76). Captures 05/25 and pointer exit confirm return to rest after 150 ms.
5. MET. down/up listeners and 80 ms press blend. Captures 23/24 show halfway/full press after 40/80 ms; full central ink diameter is 52 px (raster approximation of 62.4×0.85=53.04). Release returns to hover after 150 ms (03/04). Exit also clears down so the knob cannot remain pressed outside the hit area.
6. PARTIAL, not counted. Explicit reducedMotion boolean selects zero-duration transitions. Captures 07/08 are taken immediately after a data change with no explicit advance, and are pixel-identical to settled on/off (05/06). The CLI data command itself advances a frame. No automatic OS/browser reduced-motion preference integration is delivered or verified. Changing the preference while an existing transition is active was not verified.
7. PARTIAL, not counted under a literal reading. SemanticData has role switchControl (Rive's switch role), label Dark mode, and isToggled bound directly to on. Accessibility dumps have stateFlags 0 off / 16 on, bounds 0,0,240,240; semantic tap activates it (capture 20). This is a native toggled state, not a literal pressed state. Browser ARIA mapping, screen-reader speech, and an aria-pressed attribute were not verified; no web wrapper is delivered.

Strict items fully met: 4/7 (1, 2, 4, 5). Geometry and colours are authored exactly; screenshot measurements have antialiasing/pixel-centre tolerance. CLI screenshots include its dark preview background, not an authored background shape.

Items not met or approximated, and why:
- Item 3 fails visibly, even though inspect and the compiler report no errors.
- Item 6 requires host wiring for a system preference; item 7 uses the native switch/toggled semantics rather than literal pressed. Neither is counted as fully met.
- Tried pauseOnExit alongside enableEarlyExit: same reversal jump. Reverted.
- Tried DataConverterToNumber → DataConverterInterpolator → range mapping: compiled and inspected clean but continued forward after reverse before settling back. Reverted to the simpler state-machine implementation. This is an experiment result, not proof that all RML approaches must fail.
- Captures are finite headless samples, not exhaustive timing or platform verification. All committed screenshots were rerun from the final source after reverting experiments.

What was hardest; what the docs or diagnostics got wrong or left out:
- State-machine interruption: state-machines/easing docs describe enableEarlyExit and interpolation, but did not establish pose continuity. Zero-error builds and empty inspect problems did not catch this behavioural failure.
- Capture paths resolve relative to the process working directory. Stdout dumps advertised by flag help are rejected in command mode because stdout carries acknowledgements. The first attempt discovered both; later runs use named build JSON files and the project as cwd.
- Boolean toggling needs a negate converter plus read and write bindings. The allowed state-machines/data docs explained that wiring; the bell reference supplied the layer/pose pattern.
- Reduced-motion search found no preference hook in the allowed docs. Semantic docs explicitly document toggled state; literal pressed is not a SemanticData property.

Verification ledger (chronological Rive runs):
1 commands.txt: build clean, 13 command errors.
2 inspect: 1 artboard-without-style warning.
3 corrected commands.txt: clean.
4 inspect after style: problems [].
5 continuity.txt: clean compilation; reversal failure observed.
6 continuity.txt: accidental unchanged repeat after cp/sed path errors; clean compilation.
7 continuity.txt with pauseOnExit: clean compilation; reversal still fails.
8 continuity.txt with interpolation bindings: clean compilation; retarget still fails.
9 inspect interpolation experiment: problems [].
10 final commands.txt: clean.
11 final continuity.txt: clean.
12 final timing.txt: clean.
13 final inspect: problems [].
Supplemental: 1 failed PIL import + 5 successful pixel-measurement runs + 1 equality run; 4 JSON/metadata scripts; final whitelist/source audit. Final pixel equality confirms 00=06=08, 05=07, 05=18.

Reproduce from repository root (headless; no interactive window):
    cd docs/benchmarks/runs/2026-11-05-p1/rive/switch
    ~/.rive/bin/rive inspect .
    ~/.rive/bin/rive . --commands=commands.txt
    ~/.rive/bin/rive . --commands=continuity.txt
    ~/.rive/bin/rive . --commands=timing.txt
Capture commands write PNGs to ../captures and data/semantics JSON to build/. Only PNGs are committed per the deliverable whitelist; JSON evidence is summarized above and regenerated by the commands. No .riv was read or generated. Scaffold AGENTS.md, CLAUDE.md, and .gitignore removed. No owner account operations, push, PR, or merge. Root WORKLOG.md left unchanged because the task explicitly restricts committed files to this format's deliverables; this report records the checkpoint and known failures instead.
