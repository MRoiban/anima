# P3b-2 implementation report

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
