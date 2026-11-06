# P4e-8 implementation report

Status: all three format fixes implemented and locally verified. Fresh native follow-up
on 2026-11-06 now captures computed model outputs and bind logic with CLI 1.9.1:
**9 exact cases; read-only parity is an evidenced skip**. See the final section. This is
not a claim of complete native parity. Implementation branch: `t3/computed-bind-expressions`,
starting at `27407a1`. Main implementation commit: `85409b0`; bounded-scalar follow-up is committed
separately. Local commits only; no push, PR or merge.

## Behavior

- Optional `derive` provides computed number/string/bool/color/enum model properties, typed
  expressions, named converters/groups, local instance-relative `$` paths and absolute named
  paths. Independent instances/players, nested/list instances, host creation/replacement,
  computed dependencies, initial values and post-step notifications are covered.
- Computed targets reject set/copy/toggle/input-write/reverse bindings and instance initializers.
  Host `.set()` throws `DataError` with the same `read-only-path` code. Cycles are load errors.
- Bind expressions support comparisons and short-circuit `and/or/not`, with typed operands and
  bool → 0/1 for number destinations. Scalar guard expression comparisons use the same parser
  and comparison evaluator; specialized trigger/time guard terms keep their original behavior.
- `schema data` exists. The authoring tests extract and execute the guide's explicit schema/docs
  topic commands and compile every XML example. The guide and module include a compiled list of
  players exposing formatted labels. CLI validate/inspect/sample/schema/docs are tested in both
  authoring syntaxes.
- A components resolver bug misclassified dotted `change:$players.0.label` as a component event;
  the resolver now recognizes registered scene event kinds before applying that rule.

The source/instance metadata seam is documented in data/INTERFACE.md. Ordinary documents retain
`createScope` and allocate no derived instance index, initialized-value snapshot or compute
wrapper. Data no longer embeds a duplicate bind parser: it uses the active runtime's registered
parser. Direct path reads still work without it; expressions need the bind bundle, as documented.

This does **not** close `data.binding-relative`: upward component lookup remains absent. No
inventory or benchmark sources were changed. No measurement tools/inputs, thresholds, tolerances,
timeouts or budgets were changed. The corpus expectation increased from 362 to 364 to require
both new independently calculated conformance cases; no rejection assertion was removed.

## Sizes

All sizes are minified gzip bytes; every existing budget and both total ceilings pass.
See verification/size.txt for the complete measurement output.

| Bundle | Before | After | Limit |
| --- | ---: | ---: | ---: |
| core + web | 20,055 | 20,107 | 30,720 |
| markup | 7,884 | 7,912 | 8,192 |
| bind | 1,858 | 2,048 | 2,048 |
| data | 8,191 | 7,420 | 8,192 |
| derive | — | 2,117 | 4,096 |
| convert | 6,161 | 6,327 | 8,192 |
| host | 3,924 | 4,042 | 4,096 |
| full-featured | 91,462 | 93,573 | 102,400 |
| Rive-class | — | 98,306 | 256,000 |

Bind has zero remaining byte headroom. Markup is 12 B above the historical P5-7 7,900 B target; its unchanged 8,192 B module budget passes. Core/web's 52-byte increase is the shared scalar guard
expression path; derive itself remains opt-in.

## Verification

- Requested scope: **3,365 passed / 43 existing TODO / 0 failures**, 82 files passed and 13 pending
  files. Includes Chromium and Firefox for bind, data, derive, convert, host and machine.
- Final bounded/coercion regression + conformance run: **389 passed / 15 existing TODO**.
- Final converter-reference hardening: **35/35** derive/core/CLI and convert integration tests.
  Includes a new rejection test preventing a missing authored converter from borrowing another
  document's previously registered name. Shared core/module-generator checks: **9/9**.
- Isolated cold-start host + derive browser rerun: **8/8** across both engines and arrival orders.
- Strict oracle: exit **0**, **216 cases / 410 samples / 0 failing strict samples**. All **18**
  existing findings remain findings, with their original measured values/thresholds unchanged.
- Typecheck, Prettier, ESLint, module wiring (0 stale), generated schema, browser bundles and
  AniML build checks pass; **406** authored AniML sources checked (pending probes retained).
- Unchanged performance tool, two alternating runs versus a temporary archive of `27407a1`:
  bell compile current **1.86–2.33 ms**, baseline **2.03–3.12 ms**; 9,040-prefix sweep
  **531–562 ms** versus **621–707 ms**. Bell frame **30.5–33.6 µs** versus **30.8–42.7 µs**;
  composite **20.3–21.0 µs** versus **21.5–23.2 µs**; toolbar **22.6–24.9 µs** versus
  **23.0–24.1 µs**. No consistent regression observed; timings are noisy and are not a new gate.
  Complete raw timings are in verification/perf.txt.

## Diagnostics and evidence limits

New codes, each tested with pointer/message/hint: `read-only-path`, `derive-cycle`, `derive-type`,
`derive-converter`. Parser errors retain bind codes; syntax hints identify the token and allowed
operators. Computed malformed-string parser errors also become complete load diagnostics.

**Historical implementation-time block (resolved by the follow-up below):** fresh native
capture could not start. Permitted local `schema` and `docs` commands both refuse
installed Rive 1.9.0 because 1.9.1 is required. The task prohibits updating. Existing converter
observations are linked in oracle/README.md, but are **not** evidence for computed model storage.
No new native comparison or evidenced skip is claimed. No `.riv` or CLI scaffold/docs text was
created or committed. A permitted native installation and a fresh benchmark agent remain parent
follow-ups.

Development failures: missing local npm dependencies required `npm ci`; bind initially exceeded
its unchanged limit and data duplicated its parser, both fixed in code. A formatter attribute-order
regression and the corpus's fixed count failed the first broad run and were corrected without
rewriting existing corpus documents. One cold Chromium host test exceeded its unchanged 30-second
limit while other builds ran; isolated unchanged tests and the subsequent full requested scope
passed. An early event test used a string literal instead of the specified `input` field and was
corrected; the actual computed event payload is now asserted. None of these failures is hidden by
a looser assertion, timeout, budget or oracle threshold.


Follow-up edge review: computed numbers with positive minima originally reached stored-default
zero validation before their expressions ran; they now bypass that fallback check. Computed bool
results for number properties now coerce to 0/1 before scalar validation/clamping, matching bind
semantics. Both fixes have unit coverage and independently calculated snapshots in the existing
scoreboard conformance case. A final stale generated derive bundle was also detected after the
reference validation change, regenerated, and rechecked before commit. Final broad scope is
3,365 passed with unchanged limits.


## Fresh native follow-up, 2026-11-06

Rive CLI 1.9.1 now runs permitted local queries and headless command dumps. The
follow-up owns only oracle fixtures, derive evidence/tests and this work log;
no runtime, tool threshold, budget, parity status, push, PR or merge changes.

Added **9 completed cases** to `tests/oracle/cases.json`: `derive-score-label`,
`derive-list-relative`, and `bind-logic-{lt,le,eq,ne,and,or,not}`. Across **75
snapshots / 186 typed observations**, all values agree exactly (zero tolerance).
Two derive cases cover grouped score labels, clamped formula values, three
independent list items and changes to every item's source. Seven logic cases each
drive both a number and bool destination across nine boundary/truth vectors.

The native equivalent is a converter result bridged through a scene custom
property into model storage. Logic uses transition comparators, conjunction of
conditions and alternative transitions; formula tokens have no comparison/logic
operators in the local catalogue. Native captures sample settled values after
explicit advances. This does not establish expression syntax, short-circuiting,
precedence, per-step latency or arbitrary float64 equivalence.

**Evidenced skip, not a decided intentional difference:** native read-only parity
for this composition. Native accepts `label=manual` (**1 accepted write; Anima
0**), retains it after one more frame, then recomputes `1,501 pts` when score
changes to 1501. The skip references raw dumps and the test requiring Anima's
`read-only-path` rejection. It is excluded from completed cases. No new numerical
mismatch finding was found; all 18 inherited findings remain unchanged.

Sources, reproduction, exact mappings and evidence boundaries:
[oracle/README.md](oracle/README.md), [schema investigation](oracle/SCHEMA-NOTES.md).

Follow-up branch: `t3/derive-bind-oracle-captures-1`. Final verification:

- `node tools/oracle.ts --strict`: **exit 0**, **225 cases / 419 samples**, no
  failing completed samples; **18 inherited findings unchanged**.
- `npm run test:scope -- derive bind oracle --no-browser`: **exit 0**, **2,446
  passed / 367 filtered skips / 15 existing TODO**, 15 files passed.
- `npx prettier --check .`, `npx eslint .`, `npm run typecheck`: **exit 0**.
- Native capture driver and source-only regeneration: **exit 0**. All 216
  inherited manifest entries and metric records are unchanged; `tools/oracle.ts`
  and `findings-metrics.json` are byte-identical to the starting branch.

Development failures: the initial Prettier check flagged three new/edited files;
formatting fixed them. The staged whitespace check also caught extra trailing
blank lines in capture logs and one source; normalized their final newline in the
driver and fixtures. Bare `npx tsc --noEmit` printed help and exited 1 because
there is no root tsconfig; the declared `npm run typecheck` subsequently passed.
The schema query for `DataConverterCondition` was rejected (unknown type), which
motivated the evidenced transition-comparator mapping rather than inventing a
converter. No oracle mismatch was repaired by adjusting an expectation or limit.
Machine-readable results: [verification/native-follow-up.json](verification/native-follow-up.json).
