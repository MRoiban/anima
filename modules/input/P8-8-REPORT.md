# P8-8 report

## Checkpoints

- 2026-11-09: resumed after the usage-limit pause; final serial reruns were complete and all
  five remaining files/selections passed (101 tests). Preserved original failures and both
  rerun passes; finalized this report for the branch commit.

- 2026-11-09 12:24: read the shared brief, DESIGN §6, DECISIONS D31/D33, R4-02,
  WORKLOG, PLAN, spec and module contracts; created `p8-8` from the supplied HEAD and ran `npm ci`.
- 2026-11-09 12:33: saved failing regressions for painted order (six unit tests and two
  conformance cases) and the pre-player toggle FIFO (Chromium).
- 2026-11-09 12:36: six unit regressions and both new conformance cases pass. Composite
  supplies per-player paint ranks through the existing construction factory; nested factories
  remain chained. No runtime seam was added to core. Toggle uses the existing host FIFO.

## Decisions

The paint key is a pre-order index of the tree after applying the existing authored sibling rules.
The same resolver supplies draw-frame sibling ranks and the input/focus key, with independent
per-player revision caches. No change to capture, keyboard or gamepad ordering; normal pointer
listeners at equal depth in draw-order models use paint rank before listener order so a consuming
listener on the foremost overlapping sibling runs first. Cursor choice also follows paint rank.

This follows D31/D33 and the graph-versus-drawing distinction in
`docs/research/rive-format-and-graph.md` §3.2/3.5. The host FIFO follows the lazy pre-load API
recommendation in `docs/research/rive-web-runtime.md`, “Lessons for Anima” item 13. No external
runtime source or algorithm is used.

## Scope and seams

No parity inventory rows (both changes are carry-overs). R4-02 is fixed; toggle completes the
issue #24 queue contract. The one source-file seam outside the ticket's owned files is
`packages/markup/test/corpus.test.ts`: add the two new conformance documents to its fixed count
(619 → 621), marked `seam(P8-8)`. `tools/modules.generated.ts` is regenerated from the owned
input/composite manifests so scoped tests select both conformance cases. The optional Player
type augmentation lives in composite's owned file.

## Verification

- New red/green evidence: `design/p8/proof/P8-8-draw-order-{before,after}.txt`
  (6 unit failures → 6 passes; 2 conformance failures → 2 passes), and
  `design/p8/proof/P8-8-toggle-{before,after}.txt` (1 Chromium failure → 2 passes,
  Chromium and Firefox).
- `node tools/oracle.ts --strict`: exit 0; 324 cases / 540 frames passed, no threshold,
  reference, manifest or finding changes.
- `npm run typecheck`, `npm run lint`, `node tools/modules.ts --check`,
  `node tools/build-animl.ts --check` (679 sources), `node tools/parity.ts --check`
  (1,238 capabilities): exit 0. Four existing pending AniML probes remain pending.
- `node tools/size.ts`: exit 0 before and after; every entry and all gates pass.
- `node tools/perf.ts`: exit 0. Shared-load measurements: bell compile 7.41 ms,
  prefix sweep 1,786 ms, bell/composite/toolbar step+draw 122.2/76.2/83.9 µs,
  toolbar compile 13.73 ms. These are not an isolated A/B or evidence of the ≤ 3 % guard.
- `npm run test:scope -- input focus composite web conformance oracle --browser=chromium`:
  6,313 passed, 2 failed, 1,713 skipped, 22 TODO (99 files). The two failures were canonical
  formatting in the new AniML fixtures; corrected with the registered-module formatter.
  `npx vitest run --project unit packages/markup/test/corpus.test.ts`: 1,345/1,345 passed
  after correction (an initial formatter invocation without registered modules still failed
  the two cases; the final registered-module invocation passed).
- `npm run test:scope -- changed` (both engines): exit 1, 10,284 passed / 32 failed /
  4 skipped / 34 TODO; 382 passed / 20 failed / 12 skipped files. There was also one
  failed Firefox data-host setup suite. The machine reached load average ~130 on 12 CPUs.
- First serial isolated rerun of all 20 failed files (one Vitest process/file, one worker):
  15 files passed. CLI authoring, asset CLI, component-paint sources and host-edit retained
  timeouts; canvas passed 1,297 Chromium tests but Firefox's 60 s setup timed out, skipping
  its 1,297 cases. Original limits and thresholds remained unchanged.
- Final serial retry: all five remaining files/selections passed, 101 tests / 0 failures:
  CLI authoring 59/59, asset CLI 19/19, Firefox canvas selection 7/7 (the original six
  failures plus one matching case), component-paint sources 12/12, host-edit 4/4. The canvas
  retry used `-t 'Firefox canvas.*(assets-svg-import|assets-replacement-scope-image|measures canvas step)'`;
  its other cases were skipped by this selection, not newly verified in that retry. Combined
  with the original broad run and the full isolated Chromium canvas run, every originally
  failed test/suite subsequently passed. There was no clean all-at-once broad run.
- Isolated commands used `npx vitest run --maxWorkers=1 --no-file-parallelism <file>`;
  full transcripts are `design/p8/proof/P8-8-{changed,isolated,final-isolated}.txt`.
  The targeted toggle proof passed in Chromium and Firefox; the broad changed scope ran both
  engines as well. No new diagnostics or parity rows were introduced.

- Final exact Chromium acceptance rerun on the finished tree: 6,314 passed / 1 failed /
  1,713 skipped / 22 TODO (96 passed / 1 failed / 2 skipped files). The sole failure was
  existing asset pipeline case “Canvas bilinear clamp … box 8”, `page.evaluate: Array(1)`
  during page setup, before its pixel comparison. An immediate isolated full-file rerun in
  both engines passed 24/24, exit 0. Transcripts are
  `design/p8/proof/P8-8-acceptance-chromium.txt` and `P8-8-assets-isolated.txt`.
- Final targeted refresh on the committed implementation: six painted-order unit tests and
  both new conformance cases passed. Final lint, generated module/AniML/parity checks and
  Prettier checks passed. Every reported test failure subsequently passed in isolation;
  the combined acceptance/changed commands themselves retain their nonzero results.

## Sizes (min+gzip bytes)

| Entry | Before | After | Growth | Ticket limit |
| --- | ---: | ---: | ---: | ---: |
| input | 6,696 | 6,787 | +91 | +96 |
| focus | 3,374 | 3,399 | +25 | +64 |
| composite | 3,809 | 3,873 | +64 | +160 |
| core+web | 22,782 | 22,787 | +5 | +32 |

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core+web | 22,782 | 22,787 | 24,576 |
| largest scene (30) | 57,781 | 57,903 | 65,536 |
| app-UI scene | 107,899 | 108,086 | 131,072 |
| runtime sum | 135,579 | 135,800 | 163,840 |
| authoring add-on | 15,017 | 15,017 | 16,384 (P8 cap 15,872) |
| Rive-class | 155,805 | 156,041 | 256,000 |

## Deviations and problems

Status: done (implementation and per-case verification complete; combined-run limitations below).

No semantic deviation from D31/D33. Composite chains the existing model construction factory
(`nesting`) rather than adding a core construction hook. `examples/web/index.html` is regenerated
by the required browser build. No package publication, push or PR. No new parity rows or diagnostics.
All reported test failures were resolved by serial reruns without runtime changes or test-limit
changes. The combined run itself remains a recorded failure under shared load; performance's
≤ 3 % guard remains unverified because this was not an isolated A/B. The requested before/after
proofs, all six size gates, strict oracles and static checks are complete.
