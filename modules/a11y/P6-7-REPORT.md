# P6-7 implementation report

P6-9a closure follow-up: [current report](../../tests/oracle/P6-9a-REPORT.md). This document
records the earlier implementation delivery.

Status: **partial**. Implementation is complete for the requested host/listener hit API,
inferred names, and measured text layout bounds. Two rows have unresolved parity gaps; the closure-ready hit row awaits phase promotion.
Branch: `t3/implement-p6-7`, base `0fd483b8`. Branch-only commit; no push or PR.

## Rows

- `text.script-hit-testing`: host/listener portion closure-ready, **planned**. No row was
  promoted: `tools/parity.ts` rejects `done` rows until phase P6 is finished. Pure grapheme hit, caret and
  selection APIs; optional `text-hit` browser entry; numeric `text-index` listener writes with
  existing `input-write` diagnostics; both syntaxes; independent metric/input conformance and
  generated-font examples. The script VM portion remains excluded. Its native host-only skip
  disposition is in `tests/oracle/text-script-hit-testing/SKIP.md`.
- `a11y.inferred-text`: implemented, **planned**. Explicit labels (including empty strings) win;
  otherwise visible resolved runs/descendant text are concatenated in order, including nested
  instances and repeated rows. Binding, host editing and pending-font names invalidate correctly.
  Both independent native captures leave unlabelled text/container labels empty. The specified
  Anima inference is retained, but native equivalence needs owner disposition. No passing
  comparison is claimed; see `oracle/text/README.md` and raw frames.
- `a11y.tree-bounds`: text-layout portion implemented, **planned**. Transform all four corners
  of measured cluster-advance/line-metric boxes, intersect hard clipping, union visible descendants
  and honor explicit boxes. Negative tracking keeps nonnegative extents. The older exact painted
  path/stroke requirement (including the P3c butt-line counterexample) remains missing. Native
  text y20 versus tool y20.5 also retains the existing generated-font line-gap policy difference.

The normative API, indexing, coordinate, overflow and inference contracts are in [TEXT.md](TEXT.md),
linked from SPEC and a11y docs. Geometry follows layout, not glyph ink outlines. API ids address
root-player text; direct core calls can use any owner player's layout. Effects/visual bidi remain
outside the logical-order geometry API. No new authoring key is needed for inferred labels/bounds;
listener write maps already have the shared registry form and both spellings.

## Seams outside owned runtime files

- `modules/text/core/index.ts`: five-line, marked `seam(P6-7)` adapter seam: optional `hitTest`
  type and tooling-only installation. The verbose build guard strips installation from the
  browser display entry; `text` remains 6,142 B.
- `modules/input/core/{types,index,runtime}.ts`: marked seams for the numeric event field,
  target diagnostic and inverse-world coordinate conversion before the ordinary write queue.
- `packages/core/test/helpers/module-order.ts`: marked measurer-bootstrap seam for each text
  document, using the same CLI tool measurer without importing `core/all` before the order check.
- `packages/markup/test/corpus.test.ts`: marked census seam, 531 → 533 compiled conformance cases.
- Required evidence/contract seams: appended SPEC linkage; the two conformance probes, their
  independently calculated expectations and compiled AniML; capability examples/notes, invalid
  diagnostic notes; new oracle probe/skip notes; three parity mappings and generated views;
  append-only WORKLOG entries. The existing completed tree-bounds probe was preserved.
- Generated only: core/web package exports and four adapters, browser all-modules and
  `tools/modules.generated.ts`. Regenerated with the standard tools, never hand-edited.

No edits to a11y field commands, text layout/measurement/drawing, text-effects, text-input,
markup implementation, measurement tools/existing canonical inputs, budgets of existing entries, oracle findings,
benchmark records, dependencies, licence files or Glyphy.

## Verification

Final commands/results are recorded in `verification/p6-7/checks.json` and associated logs.
The final Chromium scope passes **3,361 tests / 1 inherited TODO**, 41 files plus 1 skipped file.
The final Firefox overlay scope passes **58 tests**, all 4 browser files. Nine owned unit cases
cover grapheme ordinals, emoji/combining marks, wrapping and explicit/empty lines, fitting/origin,
source and font invalidation, explicit labels/bounds, hidden descendants, nested/repeated owners,
negative tracking, listener diagnostics and the retained native observations. Both browser engines
exercise opposite import orders, real pointers, host geometry, overlay names/bounds, teardown and
preservation of an independently installed `Player.step` wrapper during renderer rebuilding.

`VITEST_MAX_WORKERS=2 npm run test:scope -- changed` finished **8,683 passed / 3 failed / 89 TODO**,
275 files passed / 2 failed / 13 skipped. Two failures were unchanged 5-second Firefox asset-test
timeouts. A file-only retry passed **22/22**, both engines, without changing those limits.
The third failure reproduced in an isolated registration-order retry: text semantics need a tool
measurer, but the helper had never installed one because older text snapshots did not draw.
The marked helper seam installs the per-document tool measurer before scripts, preserving the
schema/model check before tooling imports `core/all`; all **12 orders / 1 test** now pass at the
unchanged 30-second limit (24.19 s). Follow-up core-test typecheck and helper ESLint also pass.
There was no additional all-green broad rerun after this test-helper-only fix; no such claim is made.

Full typecheck and changed-source ESLint pass. Module wiring, generated schema/AniML/parity/browser
artifacts and formatting are checked. CLI schema exposes `text-index`; validate/sample exercise the
paired hit and semantic scenes. `node tools/oracle.ts --strict` exits 0 for the unchanged 266 completed cases / 475 samples,
retaining the existing findings. New inferred-text native observations remain explicitly pending,
and the host/listener-only hit counterpart has an explicit skip note.

Earlier checks are not hidden: an unrestricted-worker Chromium scope had **3,349 pass / 10 fail**
with browser/hooks and prefix-test timeouts; another early probe exposed a real semantic cache
version collision, fixed and covered by existing late-registration tests. The first new browser
file accidentally inherited Vitest's 5-second default, failed 4/4 under load even in a file-only
retry, and was set to the adjacent text suite's 30-second convention. No inherited deadline changed.
Subsequent superseded broad/size runs were stopped after review found the external-step-wrapper and
pending-font sentinel cases. Only final frozen measurements are used below. The first archived
baseline incorrectly shared workspace package symlinks and was discarded; the corrected frozen
HEAD archive uses its own workspace links and reproduces the owner's six baseline values.

## Sizes (minified + gzip bytes)

Unchanged `node tools/size.ts`, corrected frozen HEAD baseline → final frozen source:

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core + web | 21,136 | 21,136 | 24,576 |
| largest scene (30) | 53,201 | 53,773 | 65,536 |
| app-UI | 94,697 | 94,866 | 131,072 |
| runtime sum | 114,121 | 115,617 | 163,840 |
| authoring | 15,226 | 15,226 | 16,384 |
| Rive-class | 119,760 | 121,266 | 256,000 |

| Entry | Before | After | Budget |
| --- | ---: | ---: | ---: |
| text | 6,142 | 6,142 | 6,144 |
| text-hit (new, over web) | 0 | 983 | 1,024 |
| text-host | 355 | 355 | 1,024 |
| markup-text | 529 | 529 | 1,024 |
| a11y | 2,360 | 2,329 | 2,496 |
| a11y-text (new, over a11y) | 0 | 448 | 576 |
| a11y-dom (over a11y-actions) | 2,071 | 2,131 | 2,176 |
| a11y-actions (incidental shared-bundle delta) | 1,060 | 1,067 | 1,216 |
| markup-a11y | 1,036 | 1,036 | 1,088 |
| input | 6,610 | 6,703 | 7,104 |

All six gates, all scenes and every module budget pass. Aggregate gzip deltas do not add.
The fixed app-UI input is unchanged and does not explicitly include the two new optional entries;
the runtime sum and relevant per-feature scenes include them. Adding them to that reference belongs
to the orchestrator; this ticket never changes measurement inputs.

## Deviations and problems

- As the ticket allows, text semantics live in a separate **448 B** optional `a11y-text` entry
  (576 B allowance), preserving the small base a11y entry. Headless composition installs it
  automatically; browser clients import it explicitly. The display text entry cannot grow.
- DOM recovery restores its retained semantic layer after renderer rebuilds, rather than replacing
  player wrappers or advancing the player. Pending host inputs keep their queue boundary.
- Native inferred-label and line-gap observations remain unresolved; exact nontext painted bounds
  are still unimplemented. Neither is promoted as parity.
- Final `node tools/perf.ts` exits 0: bell compile 6.01 ms, prefix sweep 1,663 ms, bell frame
  105.1 µs, composite 71.3 µs, toolbar frame 80.3 µs / compile 10.69 ms. Shared-machine load and
  absence of a controlled paired baseline make the ≤3% non-regression guard **unverified**.
- Final broad-test retry results are recorded above; no general green CI or completed P6 claim.
  The parity promotion guard leaves the closure-ready host/listener row planned until P6 finishes.
  No PLAN phase checkbox is changed. The orchestrator retains integration, benchmark, PR and merge.
