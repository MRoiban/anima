Format: AniML (.animl), compiled to .ani with Anima CLI
Wall time (first command to done): 5 min 12 s
First command: 2026-11-05 17:35:42 UTC
Finished authoring/checks/report: 2026-11-05 17:40:54 UTC
The machine clock is November 5 despite the November 6 run-directory name.
Commit follows this timestamp in the same final shell invocation.

Check/validate/build/render runs: 35 total
- 31 CLI checks: validate 6, inspect 5, sample 10, render 9, build 1.
- 3 assertion-suite invocations: verify.py twice, pixels.mjs once.
- 1 git diff --check (passed; benchmark files were still untracked).
- 9 failed CLI runs, 22 successful CLI runs. No failed assertion suites.
- Docs/help/schema discovery and npm ci are excluded from the 35; their failures are listed below.

Errors seen (including repeats):
- misplaced-element: 3 (<clip> inside <group>).
- bad-attribute: 3 (path string in a pose; parser expects number, boolean or colour).
- missing-attribute: 3 (clip rule is required).
- bad-condition: 3 (@after 0; fixed to @after(0)).
- ERR_MODULE_NOT_FOUND: 1 (initial --help before npm ci).
- Unknown schema topic: 1 (schema pose).
- ModuleNotFoundError: 1 (optional Pillow availability probe; used existing pngjs instead).
Total: 12 document-error occurrences + 3 tooling/probe errors = 15.
Warnings: no-paint 3 (invisible clip source, fixed with fill="ink").
npm ci also reported 10 moderate dependency vulnerabilities and an esbuild install-script warning;
these are installation findings, not document diagnostics. No dependency files were changed.
Final .animl and .ani validate with zero errors and zero warnings.

Source size (sources written only):
- download.animl: 101 lines, 4668 characters.
- All authored executable/sample sources (download.animl, run.py, verify.py, pixels.mjs,
  behavior.txt, reduced.txt): 253 lines, 10404 characters.
- Excludes generated .ani, reports, logs, JSON evidence and PNGs.

Brief items met (1–6), each with how checked:
1. NOT MET. Number input progress has range 0..1/default 0, but maps to five nearest-quarter
   buckets without animation lag. behavior.txt explicitly demonstrates progress=0.37 -> trimEnd=0.25.
   Continuous input binding is reserved/deferred per anima docs spec §12. No host workaround.
2. MET. done defaults false. A 0.35 s ease-out transition morphs compatible path commands into
   the specified check, fills from the current resolved progress and blends the second gradient
   stop to accent. The first stop remains accent. Samples at 0/.175/.35 s assert start/mid/end;
   at halfway trimEnd=.8423215937 from .5, colour=#e08a6d; final trimEnd=1, colour=#d97757.
   mid-morph.png and done.png inspected visually. The former shaft collapses to a zero-length
   segment at the check's middle vertex; its round dot is covered by the check's round join.
3. MET. Pointer-enter listener starts one 0.6 s sweep. The diagonal band has perpendicular width
   2 (coordinates rounded to six decimals), white alpha 0/.4/0 gradient for soft edges, and
   a radius-8 geometry clip. Samples assert x=0 then 24 at .3 s, hidden at .6 s and still hidden
   after another second while hover remains true. Pixel check at .3 s finds 2262 changed pixels,
   zero outside radius 129 pixels (r=128 plus one pixel edge tolerance).
   hover.png inspected visually. Pixel confinement checked at one frame, not every time.
4. MET. Click listener fires start. The observer layer emits start-fired when it consumes that
   trigger; behavior.jsonl asserts the event after pointer click.
5. MET. Reduced-motion script enters completed morph/ring immediately and ends sweep immediately.
   Sample assertions pass; reduced.png is byte-identical to done.png.
6. MET. Rest has empty ring, hidden band and clip source, track and exact arrow coordinates.
   rest.png inspected visually. Pixel check counts 24 track dashes. Track uses ink at .25 opacity,
   width 1.5 and explicit butt caps; default round caps obscured the gaps in the first render.

Strict score: 5/6.

Items not met or approximated, and why:
- Item 1 is a discrete nearest-quarter approximation, maximum trim error .125; no continuous binding.
- Six-decimal parallelogram coordinates approximate sqrt(8) to below 0.000001 grid units.
- Softness is a feathered alpha gradient, not blur (the brief does not require blur).
- CLI SVG/PNG and sample behavior verified; no browser-host or keyboard test was performed.
- No claim of full animation-frame pixel coverage or tests across every progress/done combination.

What was hardest; docs/diagnostics wrong or missing:
- Binding is explicitly deferred despite being central to this brief; five buckets cost 37 lines
  of states. Exact progress cannot be claimed.
- AniML pose attributes reject path strings even though the normative path-morph text describes
  state blending. A constant destination timeline plus transition blend works and was sampled.
- Composite docs show structural children but do not clearly state that group clips are rejected.
  Attaching the clip to the painted path works; the hidden source's geometry still clips.
- Omitting rule from clip fails; documentation examples include it but do not explain requiredness.
- schema pose is unavailable; its diagnostic lists the supported topics.
- @after 0 was my syntax mistake; diagnostic correctly gave @after(s).
- Default round caps made the tiny dashed track look nearly solid; explicit butt caps fixed it.
- Runtime workspace links were absent initially; requested npm ci repaired them.
- No package implementation source, other-format materials, .riv files or rive commands used.
  No push, PR or merge.

Evidence/reproduction (from repository root):
- python3 docs/benchmarks/runs/2026-11-06-p4a/animl/verify.py
- node docs/benchmarks/runs/2026-11-06-p4a/animl/pixels.mjs
- CLI invocation logs: runs.jsonl (22 successful calls); prior-runs.json (9 failed calls,
  reconstructed from terminal outputs, not full raw stdout/stderr).
- behavior/reduced .txt are sample scripts; corresponding .jsonl are snapshots.
- compiled-behavior/reduced .jsonl match AniML snapshots exactly.
- Rerunning verify.py appends four more sample invocations to runs.jsonl.
