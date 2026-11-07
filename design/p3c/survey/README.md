# Reproducing the survey

Run from the repository root, after `npm ci`, on baseline `24d437e9`. Node 24.22.0;
`bundle()` uses the repository's locked esbuild/Terser versions and gzip level 9.
No change to the measurement implementation, entry inventory, budgets, gzip options,
property mangling, or compiler flags is used.

```sh
python design/p3c/survey/prepare.py /tmp/p3c-survey-fresh
SURVEY_SCRATCH=/tmp/p3c-survey-fresh node design/p3c/survey/measure.ts diagnostics
```

Other modes: `attribution`, `tables`, `duplicates`, `shapes`, `hooks`, `tickets`.
Each run writes `<mode>.json` here. Use a different scratch directory for concurrent
runs. Source files are restored in `finally`; extra scratch-only helper files are
unreferenced after restoration. `prepare.py` refuses to overwrite a directory.
The `@anima-format/*` workspace symlinks **must** point inside the scratch archive;
symlinking the whole real `node_modules` invalidates source-edit measurements.

For the combined diagnostic-guard and positive helper-sharing trial:

```sh
SURVEY_SCRATCH=/tmp/p3c-survey-fresh SURVEY_GUARDED=1 node design/p3c/survey/measure.ts duplicates
```

This also runs the unchanged `tools/size.ts` in scratch and saves `proposed-gates.txt`.
`baseline.txt` is the real checkout's unchanged `node tools/size.ts` output.

`attribution` replaces the bodies of the four largest source functions/methods per
owner with inert stubs, preserving exports, then minifies the browser entry with
`bundle()`. `tables` similarly probes the two largest object/array candidates. These
are **excision costs**, including any dependent code that becomes unreachable, not
behavior-preserving savings. Candidates can contain callbacks and methods; an
object containing an entire module is a subsystem bound, not a literal-table cost.
Manifest-only candidates and unused renderer paths can legitimately measure zero.
`hooks` removes browser authoring registration to bound that cost; it deliberately
breaks AniML integration and must not be shipped as a size fix.

`diagnostics` adds `VERBOSE` guards at diagnostic helper argument positions. This
broad mechanical trial is not a typechecked implementation: coders must preserve
empty-string normalization, public exception contracts, diagnostic codes/pointers,
and verbose Node diagnostics, and verify independent conformance/browser tests.
Its figures are opportunity estimates. `shapes` uses factories, rather than singleton
objects, to retain fresh allocation and avoid changing mutable registry identities.
All reported savings are baseline minus trial gzip bytes; negative means growth.

For the authoring relocation failure probe (all size gates are still run):

```sh
SURVEY_SCRATCH=/tmp/p3c-survey-fresh SURVEY_RELOCATE=1 node design/p3c/survey/measure.ts hooks
```

`sizeReport` records nonzero size-tool status without losing its stdout/stderr.
The corrected combined sweeps touch only the non-authoring module owners; they
leave core/web and the authoring module source untouched. The rejected broader
sweep and the isolation/setup failures are described in the survey.
