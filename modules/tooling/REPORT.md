# P3b-6 tooling follow-up

Implementation status: complete for the two P3b-2 leftovers. Parity statuses remain `planned`
under the unfinished-phase guard. No push or PR is authorized or performed.

| Row | Closure evidence |
|---|---|
| `tooling.seed` | Core-owned `random.ts`; player `seed` option, script `seed`, and CLI `--seed`; machine and converter draw order, legacy defaults, reseeding, independent players and dynamically created repeated machine players in `packages/cli/test/tooling-leftovers.test.ts`; independent exact `spec/conformance/tooling-seed`; executable example pair/script in `capabilities/tooling-seed`; native seed mismatch in `tests/oracle/tooling-random-source/skip.json`. |
| `tooling.data-breakpoints` | Tooling-only `script-writes.ts` instruments isolated instance setters and queued operations; tests trap same-value and transient overwritten writes and report the actual script line, listener pointer, state-machine action pointer, or reverse-binding write function. Live player and pending writes survive the stop. Executable example pair/script in `capabilities/tooling-data-breakpoints`; native protocol skip in `tests/oracle/tooling-data-breakpoints/skip.json`. |

The core LCG was implemented independently. No Rive source or algorithm was copied. The optional
random-capable modules install the shared core source on the active Player class, including
separately bundled registrations. The base only retains the constructor option; it does not
allocate streams. Unseeded runs preserve existing defaults, including per-document machineSeed.
Explicit seeds join machine/converter draws and nested stepping in evaluation order. Once/on-change
converter caches retain their specified policy when reseeding.

Write instrumentation adds zero shipped data/host bytes: only replay instances get setters and
queued provenance markers. The actual reverse-binding function is reported, rather than possible
writer candidates. Timeline-driven reverse writes therefore identify the binding that stores them.
Replay still costs O(history); this is a debug tool, not a per-frame production observer.

Native render/audio/inspect closure evidence lives in `docs/p3b/CLI.md`. Verification and final
size figures are appended below after the final checks. Earlier P3b-2 findings below describe the
starting point and are superseded by this follow-up.

# P3b-2 implementation report (historical baseline)

Status: partial. Script/session/benchmark tooling is implemented; shared random seeding and full
write-breakpoint instrumentation remain incomplete. No push or PR is authorized or performed.

## Scope and parity

No parity row is closed on this branch: `tools/parity.ts` accepts `done` only for finished phases,
and P3b is unfinished. These 13 implemented rows retain `planned` with completion evidence:

- `tooling.headless-command-session`
- `tooling.headless-data`
- `tooling.headless-data-dump`
- `tooling.headless-data-filter`
- `tooling.headless-data-stream`
- `tooling.headless-gamepad`
- `tooling.headless-key`
- `tooling.headless-pointer`
- `tooling.headless-touch`
- `tooling.headless-wheel`
- `tooling.test-assertions`
- `tooling.data-debugger`
- `tooling.benchmark`

`tooling.seed` remains partial: both `modules/machine/core/runtime.ts` and
`modules/convert/core/math.ts` draw random numbers using private LCG streams. No Math.random source
was found in core/runtime modules. `seed` / `--seed` validate uint32 values and retain default 0,
but explicitly reject documents containing random machine/converter features. Their runtime seeds
and sequence remain unchanged. A shared source needs a follow-up runtime refactor that satisfies the size guard; no browser source or budget is changed here.

`tooling.data-breakpoints` remains partial: isolated replay traps final value changes before the
live step and reports matching writer candidates or the last script operation. Same-value writes
and transient writes overwritten within one step are not detected. Replay cost grows with history.

## Implementation

The persistent interpreter in `packages/core/src/script.ts` owns events, timeline handles, watches,
breakpoints and an operation journal. Data writes/dumps use public typed host handles; default
aliases resolve to canonical instance paths without binding or altering data modules. Dumps walk
live values, so new list items appear and removed items disappear. Watches remember changes at each
step, including a value that changes back before the next snapshot.

Touch uses the existing multi-contact pointer API, including leave after up. Drag interpolates
coordinates with step(0) between deliveries. Wheel/key/gamepad dispatch uses the existing input API.
No module runtime source changes are needed. Assertions accumulate failures and make sample return
1; malformed script/CLI arguments return 2. Snapshots support static properties, persistent inputs,
component child values and semantics flag plumbing. The semantic tree itself is supplied by P3b-1;
missing methods cause a clear script error. Static values inside repeated list-owned child players are traversed through the loaded lists module.

Session reads text or JSON commands, replies once per input, keeps its player and restores compatible
data on reload. Invalid reload retains the live player. Benchmark times the renderer-neutral path
used by tools/perf.ts: compile/load once, then separate step and draw costs at 60fps, median/p95.
Compilation/loading includes the CLI source-read/validation callback; frame timing excludes I/O,
script setup, DOM work, rasterization and warm-up. Timings are descriptive, not a comparison gate.

## Design deviations and limits

- Tool-only capabilities use a test/docs-only `modules/tooling/manifest.ts`, with no runtime entry,
  browser entry, registry fields or JSON/AniML spellings. The scaffolder was run for all 15 rows
  (both dry and real); its inert runtime skeleton was removed so tools do not ship to browsers.
- Seed and exact write breakpoints remain partial as above; no false completion/oracle claim.
- Native reload resets data; Anima preserves compatible data per DESIGN §5. The difference is
  explicitly observed and asserted. Native command-session filtering/stream verbs were rejected;
  limits and justified skips are in oracle/README.md. Five typed native comparisons cover data,
  key, gamepad, wheel and multi-touch; existing native inputs/thresholds/findings are unchanged.
- The broad browser-inclusive scope was interrupted after worker timeouts under high shared load.
  No successful browser coverage is claimed. Source changes are tooling-only.

## Verification

Final command results and size figures are recorded in `verification/` and the final checkpoint.
The independent conformance source is `spec/conformance/tooling-input-data`; every capability has
an AniML/.ani example pair and a script. No benchmark/oracle input, finding record, measurement tool,
threshold, budget, licence file or shipped runtime dependency was changed.

## Measured sizes and current checks

No runtime module source was changed. Tooling has no browser entry/budget (0 shipped bytes).
Core+web: 20,362 → 20,362 B; data: 8,034 → 8,034; bind: 2,038 → 2,038;
components: 4,051 → 4,051; full-featured: 111,723 → 111,723; Rive-class: 117,245 → 117,245.
The input, markup-components and motion standalone incremental bundles each shift +1 B
(6,172 → 6,173, 763 → 764 and 6,614 → 6,615), with unchanged runtime sources and total; generated variable names change when
tooling imports are tree-shaken/minified. All measured byte budgets pass. This tiny byte difference
is reported rather than described as exact per-entry byte identity.

`npm run test:scope -- tooling markup conformance` on final implementation: 17 files,
2,915 pass / 7 existing TODO, zero failures (includes canonical corpus and prefix robustness).
Real process stdin: 4 input lines → 4 JSON replies and exit 0. Strict oracle: 253 cases /
449 frames, zero failed passing-case frames, exit 0; inherited finding records remain unchanged.
Typecheck, ESLint, modules wiring, parity generation and 480 AniML build checks pass.

Performance command exits 0 under high shared load: bell compile 7.16 ms, prefix sweep 2164 ms,
bell frame 119.5 µs, composite 77.8 µs, toolbar 92.0 µs; toolbar compile 11.15 ms. These are
unpaired noisy observations; no ≤3% performance claim is made. See verification/perf.txt.

Final focused script/CLI/native tests: 50 pass (including the selected conformance case), zero failures.
The required broad `VITEST_MAX_WORKERS=1 npm run test:scope -- changed --no-browser` completed:
4,741 pass, 2 fail, 42 existing TODO. Failures: the existing compiler-prefix test exceeded 5 seconds
(it passes in the 2,915-test narrower run), and the scaffolder's nested Vitest process failed; the
latter passes all 4 tests in an isolated rerun. A failure-only child-output observer was installed
for that rerun (it produced no output); no test limits or code behavior were changed. Earlier three corpus failures were fixed by canonical
formatting and the fixture census update, and are green in the narrower run. Browser-inclusive
scope attempts were interrupted and are unverified. No deadlines or thresholds were raised.

Isolated scaffolder: `VITEST_MAX_WORKERS=1 npx vitest run --project unit tools/new-capability.test.ts`,
4/4 pass in 28.22 s (with the failure-only observer described above). Broad-suite timeout stability
under simultaneous phase-agent checks remains unverified; no complete-suite green claim is made.

## P3b-6 verification notes and boundaries

The starting checkout already measured components at 4,054 B (the brief's 4,051 B predates
P3b-5). Its source is untouched. Protected-module comparisons use the measured checkout baseline
and also report the brief's ceilings; no budget or measurement input is changed to hide drift.
Core seed storage adds a small base cost; source allocation, LCG and seeded nested-step propagation
live in core code installed by optional random-capable modules. The design's default 0 is
intentionally replaced by preserved legacy defaults, as explicitly required by the P3b-6 ticket.

An exploratory repeated converter fixture exposed an existing `runs.get(p.model) is not a function`
error when a repeated player uses a cloned model; the unchanged lookup precedes the random draw.
It is outside the authorized random-source edits in convert and is not fixed here. Evidence:
`verification/p3b6/tooling-sixth.txt`. Seeded dynamic-repeat evidence therefore uses machine random
states. Root machine/converter sharing, default sequences and standalone converter policies are
covered independently. This limitation must not be mistaken for successful repeated converter
coverage.

Earlier failures included using scaffold placeholder JSON instead of the data fixture; an invalid
uppercase component name; invalid focus/action markup; treating an expected unreachable-state
warning as an error; symbol metadata accidentally visible to ordinary event equality tests; and a
VERBOSE/local-values name collision. Each was corrected, and the final checks cover the corrected
sources. The source-clock carry test caught the initial zero-time scheduling of target-interval
events; core/motion tooling metadata now normalizes those against the active step duration.
No test deadlines, limits, existing oracle findings or benchmark records were changed.

## P3b-6 final bytes and verification

All size budgets pass (`node tools/size.ts`). Values are min+gzip from the unchanged measurement tool.

| Module | Checkout before | After | Delta |
|---|---:|---:|---:|
| core+web | 20,556 | 20,592 | +36 |
| markup (tests only) | 7,942 | 7,945 | +3 |
| machine | 6,051 | 6,292 | +241 |
| convert | 6,566 | 6,772 | +206 |
| motion | 6,652 | 6,648 | -4 |
| events | 3,794 | 3,792 | -2 |
| data | 8,025 | 8,025 | +0 |
| bind | 2,036 | 2,035 | -1 |
| components | 4,054 | 4,054 | +0 |
| full-featured total | 112,330 | 112,661 | +331 |
| Rive-class total | 117,835 | 118,163 | +328 |
| tooling instrumentation | 0 | 0 | 0 |

The protected data/bind/components sources are unchanged; no data/host hook exists in shipped code.
Components remains at the measured inherited 4,054 B; the brief's 4,051 B is not silently substituted
for the actual checkout baseline. Current data/bind remain below the brief's 8,034/2,038 B.

Final requested `VITEST_MAX_WORKERS=1 npm run test:scope -- tooling cli conformance oracle`:
29 files, 1,153 pass / 30 existing TODO / 0 fail. Focused probes: 29/29.
Strict oracle: 261 cases / 457 samples, exit 0; all eight additions exact (maxDiff 0, over 0).
The 253 old case definitions and metric records remain byte-value-equivalent; 23 finding cases
(26 samples) remain recorded and unchanged. The native frame PNGs are unmodified.
Full typecheck, selected-source ESLint, formatting, wiring, schema generation, parity generation,
485 AniML artifact checks and web build succeed. Final browser-inclusive changed scope: **7,535 pass / 42 existing TODO / 0 fail**, 225 passing files
and 12 TODO-only skipped files out of 237, including 28 selected browser suites for both engines.
No failed or interrupted earlier run is included in that successful result.

Perf exits 0 under concurrent shared load: `compile: bell 7.18 ms; all 9040 prefixes 1951 ms; frame: bell 107.4 µs; composite 70.6 µs; frame: toolbar 84.8 µs (step + draw, 4 instances); compile: toolbar 11.27 ms`. These are
unpaired observations; no ≤3% regression claim is made. The new outer viewport background changes
two radial output pixels by at most one channel unit, within the existing oracle limits; the old
recorded max/over measurements are unchanged. Regenerated old output PNGs were restored so the
commit adds only new oracle output artifacts.

The final seed-source review adds labelled legacy streams: a document machineSeed of 1 must
not merge its unseeded machine stream with the converter default of 1. Explicit seeds still
use one unified stream. `tooling-legacy-random` independently asserts both first draws, and the
fixture census changes exactly 440→442 for the two new conformance sources. An intermediate
machine/convert/tooling scope had 2,812 passes and only that stale census failure; the corrected
corpus passes 953/953. A pre-fix broad changed run was interrupted (130), and the final-source
browser-inclusive run is recorded separately; no interrupted run is claimed as successful.

The first complete changed run passed 7,533 tests / 42 TODO and all browser work, but failed the
scaffolder's temporary pending probe because it collided with the new completed seed skip.
The completed skip now lives at `tests/oracle/tooling-random-source`, and the independent legacy
case at `spec/conformance/tooling-legacy-random`, keeping the scaffolder's reserved `tooling-seed`
probe isolated. No generator or oracle-test assertion was changed. An isolated follow-up hit
five-second WebP and scratch-copy load timeouts; each passes alone unchanged (1/1 each), and the
complete scaffolder then passes 4/4. See the failure and isolated-run logs in verification/p3b6.
The requested scope is green again at 1,152 / 30 TODO; the fresh full changed run follows below.

The post-separation broad run passed 7,532 / 42 TODO with only two standalone-demo failures:
the test manifest rename invalidated the browser fingerprint. The prescribed web generator
refreshes it; the unchanged demo checks pass 2/2 in Chromium and Firefox. The final broad run is
performed after that refresh. Final summary review also adds an independent named-default-instance
and comment fixture (29 focused probes); all source is frozen for that last run.

Final source is verified: requested scope 1,153 / 30 TODO / 0 fail; changed scope 7,535 / 42 TODO /
0 fail. These green runs follow all source, fixture and prescribed artifact repairs. No timeouts
occur in the final broad run. The earlier load timeouts and their unchanged-limit isolated passes
remain in the evidence rather than being erased. The commit is local to the milestone branch;
no push, PR, publication or Glyphy action was performed.
