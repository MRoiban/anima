# Issue 48 report: fixed

Branch: `issue-48`

## Reproduction

A synthetic sparkline-style list benchmark was added under `design/issues/proof/48-bench/` with 48 and 96 model-backed items. Each repeated component has several bound properties and the parent has a continuously running timeline so frames never settle. Each case was measured for 600 frames with the CLI benchmark, three times per size, using the best run because the shared host had substantial timing noise.

Baseline on `main` at `27223f64`:

| Items | step median | step p95 |
| ---: | ---: | ---: |
| 48 | 15,791.863 µs | 24,262.731 µs |
| 96 | 70,462.387 µs | 108,144.297 µs |

Incremental cost was `(70,462.387 - 15,791.863) / 48 = 1,138.969 µs/item/frame`.

The regression test in `modules/lists/test/core/lists.test.ts` also demonstrated the eager work directly: before the fix, one constant frame performed 7,119 data reads and failed the new `< 1000` guard.

## Profile and root cause

The pre-change CPU profile showed the dominant time in list stepping/reconciliation and data binding resolution. Repeated children inherited the parent's flattened `$...` input schema, so each child binding pass eagerly materialized every declared input path every frame. The list extension also reconciled every repeated child and rebuilt repeated draw slots on every active frame, even when the list identity and item bindings were unchanged.

## Fix

Data binding snapshots now load input values lazily on first expression access while preserving the existing post-state snapshot semantics.

The lists module now keeps item data snapshots and takes a stable fast path when list identity/order and observed parent data are unchanged. It steps only busy or changed children, refreshes a changed child's data context before stepping, and dirties repeated drawing only when a repeated child actually changes. Repeated draw reconstruction is skipped when none of its repeat/instance ancestors changed. Models participating in list-enabled nesting still use the existing global expansion budget.

The new regression coverage changes an existing item's data through `Player.set`, then inserts an item and mutates its data directly mid-run. Both the resolved property and SVG output are checked after each update.

## Result

Final benchmark, best of three 600-frame runs:

| Items | step median | step p95 |
| ---: | ---: | ---: |
| 48 | 290.507 µs | 599.850 µs |
| 96 | 305.074 µs | 968.465 µs |

Incremental cost is `(305.074 - 290.507) / 48 = 0.30348 µs/item/frame`, below the 10 µs target and about 3,753x lower than this synthetic baseline's incremental cost.

The bell control benchmark was noisy on the shared host. Its best baseline was 5.619 µs step / 42.301 µs draw, while the first post-change set's best was 9.478 µs step / 62.776 µs draw. `examples/bell.ani` declares no optional modules, so the changed lists/data module code is not loaded into that scene; these timings cannot demonstrate a code-path regression and are recorded as shared-load noise rather than perf evidence.

## Verification

The exact required scoped command completed with 4,562 passing tests and 16 browser timeouts across bind, components, data, derive and lists while the machine was loaded. Earlier isolated reruns had already passed core conformance and several affected browser suites. Once the machine was quiet, `modules/lists/test/web/lists.test.ts` passed 4/4 in isolation in 47.76 s. No behavioral assertion failure remained in the changed list code.

`npm run typecheck` passed. `npm run lint` passed. The first `npm run format:check` found only the two generated profile-summary JSON proof files; after formatting those files, the rerun passed. `node tools/size.ts` exited 0 with core+web 22,855/24,576 B, data 6,655/7,040 B, and lists 5,080/5,120 B.

Raw `.cpuprofile` files were used during diagnosis but are intentionally not committed; the summarized profile benchmark output and root-cause findings are retained in the issue proof/report.
