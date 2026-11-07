# P3c-4 authoring seam

Status: complete; size target met, all affected tests pass in isolation, known check limitations below.
Branch: `t3/move-markup-hooks-authoring`, based on `9b69eea6`.

Runtime entries now register runtime modules/backends only. The new authoring entry
`@anima-format/web/markup-hooks` includes the lean compiler and the former runtime compiler
hooks. Browser authors replace their `markup` import with this entry; compiled `.ani` pages
use their existing runtime imports. Optional library support still uses `markup-libraries`.
Registration is synchronous for modules already present and arriving later, with a fixed
paint/focus precedence independent of arrival order. Explicit `markup-<name>` entries remain
available with the lean compiler.

The separation follows the optional-feature principle discussed in
[`docs/research/rive-web-runtime.md` §1](../../docs/research/rive-web-runtime.md).
No Rive implementation, CLI documentation or `.riv` files were used.

## Size evidence

The unmodified `node tools/size.ts` measured the untouched HEAD archive and the final worktree;
all totals are ordered union bundles, never sums of incremental sizes. The first baseline run
was stopped before its union measurements when source edits began, then discarded and rerun
in an untouched source archive with local package links.

| Gate | Before B | After B |
| --- | ---: | ---: |
| core+web | 20,622 | 20,622 |
| largest scene (29) | 55,313 | 52,427 |
| app-UI scene | 91,158 | 86,248 |
| runtime sum | 109,971 | 105,501 |
| authoring add-on | 11,944 | 14,440 |
| Rive-class (heavy) | 115,473 | 111,028 |

Runtime saving: **4,470 B** (ticket target ≥4,000 B). Authoring grows 2,496 B under the
explicit exception and stays 920 B below the ticket's 15,360 B limit.

Every touched module, including modules touched only through harness setup or import docs:

| Entry | Before B | After B |
| --- | ---: | ---: |
| paint | 4635 | 4218 |
| surface | 8017 | 7821 |
| components | 4049 | 3104 |
| bind | 2036 | 1867 |
| convert | 6782 | 6283 |
| events | 3789 | 3192 |
| focus | 4075 | 3067 |
| motion | 6645 | 5882 |
| data | 7983 | 6517 |
| markup | 8007 | 8007 |
| markup-hooks | new | 4123 |
| composite | 3885 | 3885 |
| componentpaint | 1974 | 1974 |
| data-host | 903 | 903 |
| derive | 2383 | 2383 |
| host | 3570 | 3570 |
| host-edit | 3663 | 3663 |
| lists | 4587 | 4587 |
| machine | 6293 | 6293 |
| nested | 4535 | 4535 |

`markup-hooks` is authoring-only, measured over `markup`, with a new 4,544 B budget
(4,123 × 1.10 rounded up to 64 B). `markup` remains 8,007/8,192 B. No existing budget
or measurement tool, flag or input changed. Existing hook-only authoring entries retain their
budgets and sizes.

**Known size-check failure:** `paint-sampling` 939 → 1,083 B against its unchanged 1,024 B
budget. Its subtraction baseline (`paint`) shrank; the sampling entry did not change. This is
the survey's anticipated context change; the orchestrator resets budgets after the round.

## Verification

- `npm run test:scope -- markup`: 2,725/2,725 pass (15 files).
- Existing hook browser suite: 18/18 pass with unchanged assertions, both engines.
- New cross-module browser suite: 8/8 pass, both engines, authoring before/after runtime
  modules and reversed runtime orders. Eight existing AniML/JSON pairs compile identically
  through sync/async paths; the component sample loads and evaluates its binding.
- New-test development failures: component address initially used `badge.dot.r` instead of
  `badge/dot.r`; corrected only the new test. A cold-cache targeted retry timed out in its
  30-second bundling hook under shared load; the cached suite passes 8/8 at the same limit.
- `node tools/oracle.ts --strict`: exit 0, 266 completed cases / 475 passing samples,
  24 retained findings. References/expectations unchanged.
- `npm run typecheck`, changed-TypeScript ESLint, `node tools/modules.ts --check`,
  `node tools/build-web.ts --check`, `npm run gen`: exit 0.
- Repository-wide `npm run lint`: fails on 10 pre-existing errors in untouched
  `design/p3c/survey/measure.ts`; no ticket-owned lint errors.
- `node tools/size.ts`: six gates satisfy this ticket; exit 1 only for the anticipated
  paint-sampling subtraction-context failure described above.
- `node tools/perf.ts`: exit 0 before and after, but the shared-load comparison does **not**
  verify ≤3% timing non-regression. Bell frame 105.1 → 152.3 µs; composite 55.3 → 103.0 µs;
  toolbar frame 68.4 → 102.5 µs; bell compile 6.21 → 11.02 ms, toolbar 11.30 → 12.41 ms;
  all-prefix compile 1,538 → 2,629 ms. Timing acceptance remains unverified.
- `VITEST_MAX_WORKERS=2 npm run test:scope -- paint surface components bind convert events
  focus motion data web playground`: exit 0, **6,349 pass / 251 skipped or filtered / 12 TODO**;
  110 files pass / 12 skipped (122 selected), including the 31 declared Chromium/Firefox
  browser suites and playground. Duration 897 seconds under shared load.
- Final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **8,049 pass / 3 failed /
  4 skipped / 40 TODO**; 241 files pass / 3 fail / 13 skip (257 selected), 984 seconds.
  Failures: data-host Chromium bundle hook at 10 s, registry-order test at 30 s,
  scaffolder rejection test at 5 s, and the scaffolder's nested Vitest command.
  Every affected file passes standalone with unchanged time limits:
  - registry-order **1/1** (all 12 arrival orders), 18.70 s;
  - scaffolder **4/4**, 46.34 s, with `VITEST_MAX_WORKERS=1` inherited by its nested runner;
  - data-host Chromium/Firefox **8/8**, 10.55 s.
  The initial scaffolder-only retry passed 3/4 but its default-worker nested runner still
  failed. Reproducing that nested probe at one worker passed **904 tests / 30 TODO**,
  then the complete scaffolder file passed 4/4. The original nested child failure detail
  was not exposed by the test; its precise internal cause remains unverified.
  Existing test assertions, time limits and runner code are unchanged; only authorized
  browser import/setup lines changed. Shared-load evidence
  and both failed/passing runs are retained.

Raw command outputs and the strict-oracle count summary are in [verification/](verification/).
The initial baseline attempt was discarded, and all reported baseline sizes are from the
untouched source archive. Measurement tools, ceilings, flags, inputs and existing diagnostic
text are untouched. Existing harness setup edits were explicitly authorized by the user. The user also authorized
updates confined to the browser-import paragraphs in `spec/ANIML.md` §9 and
`docs/ARCHITECTURE.md`, so the spec documents the same import contract in this commit.
Their fenced syntax examples and text outside those sections are unchanged.

## Existing browser harness setup changes

Only bundle/import setup changed; existing assertions and expectations remain byte-identical.
The library-enabled setup uses a test fixture bundling the same two authoring imports an author
page uses (`markup-hooks` and the already optional `markup-libraries`).

- `modules/componentpaint/test/web/sources.test.ts`
- `modules/components/test/web/components.test.ts`
- `modules/composite/test/web/paint-composite.test.ts`
- `modules/convert/test/web/convert.test.ts`
- `modules/data-host/test/web/browser.test.ts`
- `modules/data/test/web/browser.test.ts`
- `modules/derive/test/web/browser.test.ts`
- `modules/host-edit/test/web/browser.test.ts`
- `modules/host-edit/test/web/components.test.ts`
- `modules/host-edit/test/web/seams.test.ts`
- `modules/host/test/web/browser.test.ts`
- `modules/lists/test/web/lists.test.ts`
- `modules/machine/test/web/browser.test.ts`
- `modules/motion/test/web/browser.test.ts`
- `modules/nested/test/web/nested.test.ts`
- `packages/web/test/browser.test.ts`
- `packages/web/test/markup-hooks.test.ts`
