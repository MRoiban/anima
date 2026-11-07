# BF-5 — B16 page event bubbling

Status: **done**. Branch `t3/bubble-host-events`, baseline `faa33ede`.

The host, input adapter and semantic overlay leave DOM propagation intact.
Root accessibility activation ignores semantic-origin keys. A WeakSet on the active
host class shares event ownership across separately built browser modules: input marks
pointer events before any option filter, and legacy routing skips marked or semantic
pointer events. Leave/cancel carry the original event through the same guard. Semantic
controls retain native key ownership, so generic focus navigation cannot run again.

Removing stops also exposed a nested-control regression: one child click activated
its semantic parent. A new Chromium test reproduced that failure. Semantic action
handlers now share the event marker, retaining activation through noninteractive
children while preventing parent reactivation. Clicks still reach page bubble listeners.

No core behavior changed. This keeps the browser/core boundary described in
[the runtime research](../../docs/research/rive-web-runtime.md#lessons-for-anima)
(recommendations 2, 5 and 6), using Anima's existing controller and native controls.
Browser tests provide the independent event evidence; existing conformance cases
remain unchanged because no `Player.step` output rule changes.

## Verification

- Chromium development scope: `VITEST_MAX_WORKERS=2 npm run test:scope -- input a11y-dom focus web --browser=chromium`: **4,299 passed, 0 failed, 1,912 filtered/skipped**, 47 files, exit 0. The nested-action guard was added afterward and separately verified by the next command.
- Nested-control regression: before the guard **1 failed**; after the guard `npx vitest run --project browser modules/a11y-dom/test/web/overlay.test.ts -t 'Chromium.*(bubbles a child control|noninteractive semantic child)' --maxWorkers=1`: **2 passed**, exit 0.
- Final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **8,369 passed, 0 failed, 1 skipped, 63 inherited TODOs**, 265 passing files plus 13 skipped files, exit 0; includes Chromium and Firefox. The B16 coverage passes **21 tests per engine** (42 total), with no expected failures.
- `npm run typecheck`, owned-file ESLint, `node tools/modules.ts --check`: pass, exit 0.
- `node tools/oracle.ts --strict`: **266/266 cases, 475/475 samples pass**, exit 0; inherited findings remain findings. No reference, threshold, finding or metric edits.
- `node tools/perf.ts`: pass, exit 0. Bell 111.9 µs, composite 71.2 µs, toolbar 73.8 µs. Shared-load observations only; no non-regression claim or benchmark-record changes.
- `node tools/build-web.ts`: regenerated browser artifacts and `examples/web/index.html`.
- Changed-file formatting: pass. Branch-only delivery; commit SHA in final handback.

The former expected-failure B16 repros are ordinary tests, expanded to fresh pages for
every overlay/input/focus combination (eight per engine). They check ancestor Escape
and pointerdown/move/up delivery, Escape remaining unprevented, and one pointerdown
causing one toggle. Additional tests check consumed tab-list arrows with input/focus
absent or present, semantic pointer/click ownership, disabled listeners, and one
leave/cancel delivery. Existing native/root Enter, BF-2 trigger/tab, BF-4 radio and
drag tests are retained in the final changed scope.

## Size

Official unchanged `node tools/size.ts` on a clean HEAD source snapshot and final
sources; min+gzip level 9. All module budgets and all six gates pass.

| Entry | Before B | After B | Ceiling B |
| --- | ---: | ---: | ---: |
| input | 6,651 | 6,610 | 7,104 |
| a11y-dom | 2,098 | 2,071 | 2,176 |
| focus | 3,089 | 3,092 | 3,456 |
| core + web | 21,077 | 21,136 | 24,576 |
| largest scene (30) | 53,086 | 53,129 | 65,536 |
| app-UI | 88,245 | 88,260 | 131,072 |
| runtime sum | 107,392 | 107,412 | 163,840 |
| authoring add-on | 14,783 | 14,787 | 16,384 |
| heavy | 112,972 | 112,999 | 256,000 |

Core+web growth is **59 B**, within the task's 60 B limit. Individual baseline
module deltas differ from the brief's older numbers because the shared base changed;
the clean snapshot reproduces the orchestrator's six baseline gates exactly.
A marking method measured +63 B and was replaced by the smaller shared static WeakSet.

## Deviations and problems

- `spec/WEB.md` does not exist. Updated the actual `docs/WEB.md`, normative `spec/SPEC.md`
  and overlay contract in the same change as behavior.
- The host renamed the branch from `t3/c7244ceb` to `t3/bubble-host-events`; HEAD remained `faa33ede` before the final commit.
- B16 edits appeared during initial reading without any agent spawned by this session.
  The orchestrator confirmed no other assigned writer and authorized treating them
  as the candidate. Reviewed and corrected them: the original test variants still
  loaded the overlay, specs repeated the same paragraph, and leave/cancel lacked
  their ownership guard. The source of those edits remains unknown.
- First baseline measurement failed on missing esbuild; `npm ci` restored locked
  tooling. A measurement that overlapped the unattributed edits was discarded;
  `/tmp/bf5/base` is a clean HEAD source snapshot with its own workspace links.
- An early Chromium run was stopped when the marker implementation changed; it is
  not counted as verification. No timeout limit or measurement input was changed.
- Downstream app read only at the pinned commit; protected work-in-flight source
  paths unchanged. No dependency, licence, publish, push, or PR changes.

Raw local evidence: `/tmp/bf5/clean-baseline-v2.txt`, `size-frozen.txt`,
`chromium-final.txt`, `nested-repro.txt`, `nested-fixed.txt`, `changed-final.txt`,
`typecheck-frozen.txt`, `lint-frozen.txt`, `modules-check.txt`, `oracle.txt`, `perf.txt`.
