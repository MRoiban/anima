# [P3c-8] Current carry-over result

Six of seven rows closure-ready; exact painted bounds remain open. All statuses stay planned. See [../a11y/P3C8-REPORT.md](../a11y/P3C8-REPORT.md) for the current seven-row table, measurements,
checks and numbered findings. The P3b material below is historical for those seven rows.

# P3b-8 browser overlay

Implementation is ready; final regression verification is recorded below. The
controlled performance comparison remains unverified under shared-machine load. Parity statuses remain
planned, as required for unfinished P3b. No PR, package publication or main push.

## Current closure evidence [P3b-9]

The one current row table is at the end of [a11y/REPORT.md](../a11y/REPORT.md).
It incorporates the browser test evidence from this report and the new core/native
probes. All parity statuses stay planned. The following sections are historical
P3b-8 implementation/verification records; P3b-9 did not change overlay runtime code.

No new format grammar, fields, registry entries, diagnostics or deterministic
Player.step behavior are introduced. The inherited `a11y` registry supports both
JSON and AniML spellings. Core diagnostics remain covered by its owned tests.
The browser-only `a11y` host attribute is not an `.ani` field. The included
`examples/mute.animl` and generated `.ani` compile through the existing registry;
CLI validate and sample semantic-action paths exercise this exact example.
The two half rows still require P3b-7's core closure; this report closes their DOM
halves only. Final phase promotion belongs to the orchestrator.

## Measurements and verification

Raw measurements and scaffold rejection are in verification/. All sizes are
minified gzip bytes from the unchanged size tool.

| Item | Before | After |
| --- | ---: | ---: |
| core+web | 20561 | 20561 (+0; no hooks) |
| a11y-dom | absent | 1893 / 2048 (over a11y-actions) |
| focus | 3925 | 4082 / 4096 |
| full-featured | 115192 | 117344 / 131072 |
| Rive-class | 120697 | 122860 / 256000 |
| protected data | 8025 | 8025 |
| protected bind | 2034 | 2034 |
| protected components | 4053 | 4053 |

The inherited components baseline is already 2 B above the brief's historical
4051 B. No data/bind/components sources or budgets were changed. The full page
adds 2152 B and has 13728 B below its fixed ceiling. The overlay exceeds its
aspirational 1500 B target by 393 B; native state restoration, exact positioning,
focus cooperation and lifecycle are retained within the fixed 2048 B limit.

Perf before → after (unchanged tools/perf.ts): bell compile 5.82 → 6.41 ms;
9040-prefix sweep 1473 → 1660 ms; bell frame 54.7 → 106.6 µs; composite frame
39.6 → 53.2 µs; toolbar frame 50.8 → 85.0 µs; toolbar compile 7.37 → 10.79 ms.
The before/after runs shared the machine with other worktrees' checks. These raw
numbers are slower and do **not** establish timing non-regression. The base web
entry, its core inputs, and the perf script's transitive code are unchanged;
without a11y-dom there is no new step hook or semantic observer. A controlled
performance acceptance check remains for the orchestrator.

### Final check results

- `VITEST_MAX_WORKERS=1 npm run test:scope -- a11y-dom focus`: **1039 passed**, 0 failed,
  432 filtered; six files. Includes **38 browser overlay tests** (19 per engine).
- `VITEST_MAX_WORKERS=1 npm run test:scope -- changed`: **7536 passed**, **1 failed**,
  45 existing TODOs; 227 files passed, one failed, 13 skipped. The failure is the
  unchanged assets CLI JPEG encoding test's 5000 ms timeout. This broad run began
  before the last activation edge fixes; the final owned run above rechecks them.
- Isolated `VITEST_MAX_WORKERS=1 npx vitest run --project unit
  modules/assets/test/cli/pipeline.test.ts`: **19 passed**, 0 failed, including JPEG.
  This recheck does not relabel the broad run as green.
- Module wiring (0 stale), full typecheck, final web-test typecheck, ESLint, formatting,
  browser artifact check (39 entries), AniML corpus (486 files), gen and parity: pass.
- Size: pass, all fixed budgets. Strict oracle: exit 0, **253 cases / 449 samples**;
  23 existing finding records retained. No oracle cases or findings changed.
- CLI validation and semantic-action sample: pass. Perf: both commands exit 0,
  raw comparison slower; controlled timing non-regression remains **unverified**.

## Design decisions and deviations

- Entry is `@anima-format/web/a11y-dom`, per the ticket's updated split, rather
  than DESIGN §3.4's original `web/a11y`. The latter remains registration-only.
- Zero hooks/bytes added to packages/web/src/index.ts. An optional per-host-player
  step wrapper observes manual and scheduled steps; loadModel/destroy wrappers own
  lifecycle. Existing interfaces therefore retain the exact base bundle size.
- The scaffolder rejects the hyphen in the requested name; all nine dry-run/run attempts were recorded, then the web-only
  manifest was created manually. No scaffolder/tooling changes.
- The overlay exceeds the aspirational 1500 B target; it must stay below its fixed
  2048 B budget. Focus stays below its unchanged 4096 B budget.
- Geometry uses the existing SVG viewBox mapping. Canvas-backed positioning is not implemented or verified; the existing private
  renderer mapping is not exposed to optional modules. Real browser accessibility is used instead of a local
  native-headless comparison; no native files were read or written.

## Problems and earlier failed checks

Initial measurements failed because dependencies were absent; npm ci restored
local tooling. Early tests used Playwright matchers with Vitest expect; changed to
locator reads and expect.poll. Further failures found cached-tree mutation through
the host getter (fixed with detached snapshots), readonly range drift (restored
after rejected actions), a test sharing/mutating its requires array, a synthetic
tree mutated in place rather than producing snapshots, an empty invalid nodes
fixture, and a paused root-control test that needed an explicit step to commit its
queued input. The example initially used JSON's center spelling in AniML; corrected
to cx/cy and rebuilt. An initial focus probe was 4100/4096 B; redundant listener
plumbing and duplicated item reads were removed without raising the budget.


Final activation edge coverage also checks already-selected radios (change rather
than click), nested noninteractive semantic children of buttons, and controls
whose own action hides/removes them before their event handler returns. These
use the current tree rather than stale captured state. Late-loading test bundle
compilation moved into beforeAll; its five-second interaction limit is unchanged.

The first default-worker changed-scope run was cancelled after several unrelated
browser timeouts under concurrent machine load. The one-worker run also hit the
existing JPEG encoding test's five-second timeout; final counts and isolated
recheck are recorded below. No timeout or comparison threshold was increased.
