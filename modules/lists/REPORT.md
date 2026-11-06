# P5b-1 implementation handoff

Implemented the eight requested capabilities on `t3/lists-data-contexts-1`, based on `02d29cd`.
No push, pull request or merge was performed. Parity status fields remain unchanged.

The new `lists` module owns repeat reconciliation, per-item scopes, relative/index reads,
model maps, count identity and dynamic drawing. Components/data gained only the integration
hooks needed for those features, within their original budgets. Core/web, bind, host, host-edit,
assets, paint, canvas and CLI implementation files were not changed. Generated adapters, schema,
package exports and browser artifacts were rebuilt with their generators.

All eight capability rows have normative spellings, diagnostic fixtures in both forms, independent
conformance, compiled examples, CLI schema/inspect/sample/docs coverage and exact native observation
oracles. No row is skipped or pending. The standalone number-to-list converter retains its existing
behavior; repeat count normalization and retained index players are the new consumer.

| Row | Evidence |
| --- | --- |
| components.list | Reconciliation retains players, queued writes/triggers, machine states, clocks and DOM across reordering; insert/remove/duplicates tested. |
| components.list-map | Mixed Player/Header dispatch; enclosing shared graph metadata; missing-map diagnostics and runtime warnings. |
| components.list-size-override | Bounds override; native click (25,5), outside original width 10, inside override 30, changes clicked 0→1. |
| components.explicit-context | Named contexts and nested model references; model mismatch diagnostics. |
| components.inherited-context | Inherited children, independent public-model defaults and nested shared graph identity. |
| data.binding-relative | One/two parent levels, including parent changes and nested repeats. Parent reads are read-only. |
| data.property-symbol-list-index | Read-only current index after reordering; index/parent declarations are reserved-name. |
| data.converter-number-to-list | Retained indices across 2→3→1; conformance retains selected machine state; native indices 0/1/2 match. |

The implementation follows DESIGN §2 without a requested design deviation. Counts floor fractions,
map negatives to zero and reject values above the existing 256-instance limit; these boundary rules
are specified and tested. `size` changes local hit bounds without scaling geometry. Native capture
sources, raw dumps, PNGs, commands and CLI logs are under `oracle/`; normalization is reproducible
with `node modules/lists/build-oracle.ts`. No native binary animation or copied CLI documentation
is included. The graph/state research rationale is linked from SPEC.md.

**Sizes** (min+gzip)

| Bundle | Bytes | Limit |
| --- | ---: | ---: |
| core+web | 20,109 (unchanged) | 30,720 |
| lists | 4,501 | 6,144 |
| components | 3,551 | 4,096 (unchanged budget) |
| data | 7,462 | 8,192 (unchanged budget) |
| markup | 7,912 | 8,192 |
| full-featured | 98,059 | 102,400 |
| Rive-class | 102,816 | 256,000 |

The full bundle adds 4,484 B over the supplied 93,575 B baseline. The P5b phase allowance
leaves **1,660 B** for other work before its 99,719 B phase limit; the aggregate phase is not closed.

**Verification**

Final broad scope: **2,971 passed / 37 existing TODO**, 39 passing files, with both Chromium
and Firefox. Core/conformance follow-up: 396 passed / 12 existing TODO. There are nine new or
completed deterministic probes (eight capability cases and a count/inherited-context regression).
All requested static/artifact checks exit 0; strict oracle exits 0 with 224 cases / 418 samples.
No new findings are introduced. Final command results, sizes and counts are recorded in `verification/checks.json` and the adjacent
logs.

| Command | Result |
| --- | --- |
| `node tools/size.ts` | Exit 0; sizes above. |
| `node tools/perf.ts` | Exit 0; final bell 2.71 ms / 31.9 µs, composite 20.9 µs, toolbar 3.11 ms / 24.2 µs; comparison limitation below. |
| `node tools/oracle.ts --strict` | Exit 0; 224 cases / 418 samples, 8 new exact cases. |
| `VITEST_MAX_WORKERS=1 npm run test:scope -- lists components data markup conformance oracle` | Exit 0; 2,971 pass / 37 existing TODO; both engines. |
| `npm run typecheck` | Exit 0. |
| `npx prettier --check .` | Exit 0. |
| `npx eslint .` | Exit 0. |
| `node tools/modules.ts --check` | Exit 0. |
| `node tools/build-animl.ts --check` | Exit 0; 413 sources current. |
| `node tools/build-web.ts --check` | Exit 0; 27 browser entries current. |
| `node tools/parity.ts --check` | Exit 0; status fields unchanged. | Scope coverage includes both engines, active gradient/clip backends in separate bundles,
retained DOM after insert/remove/swap, and module registration order. The new count conformance
expectations are independently authored state/index formulas; no Anima output produces goldens.
The strict oracle adds eight exact cases (maxDiff 0, overPercent 0) to the existing 216 cases;
all existing completed metric records and all 1,238 parity statuses are unchanged.

**Performance limitation**

`node tools/perf.ts` exits 0 but is report-only. Baseline/current sources were measured without
changing the tool or its fixtures; baseline sources were temporarily restored from HEAD and then
restored byte-for-byte in a finally block. The first alternating pair was mostly flat:

| Measurement | HEAD | This branch |
| --- | ---: | ---: |
| Bell compile | 2.51 ms | 2.51 ms |
| All 9,040 prefixes | 693 ms | 680 ms |
| Bell frame | 38.9 µs | 37.5 µs |
| Composite frame | 25.0 µs | 24.2 µs |
| Toolbar frame | 27.8 µs | 28.4 µs |
| Toolbar compile | 4.00 ms | 4.02 ms |

A reverse pair under shared load moved dramatically (current bell 103.4 µs, later HEAD 49.3 µs;
current toolbar 50.0 µs, later HEAD 39.2 µs). Both raw pairs are retained. These runs cannot reliably
establish absence of a performance regression; that conclusion remains **unverified**. The base
runtime bytes are unchanged and documents without lists do not allocate dynamic player/draw trees.
The final frozen-source run is retained in verification/perf.txt. A quiet or pinned alternating benchmark is recommended before closing the phase performance item.

**Failures corrected and remaining integration work**

Initial scaffolding needed `npm ci`. Development found incorrect tuple descriptors, quoted component
round trips, inherited cache/model metadata, hook loss during registry replay, and stale static SVG
serialization. A fixed pool was discarded because it multiplied nested geometry; dynamic trees now
reuse freed slots. Separate-bundle gradient/clip testing found missing dynamic group world matrices
and detached retained SVG definitions; both are fixed, with insert/remove regression checks.
A parallel broad scope timed out the existing 5-second prefix robustness test under CPU contention;
limits were unchanged, and the final run uses one worker. Native CLI syntax retries used `--commands=`,
a seconds suffix and `pointer click@x,y`; final captures exit 0. A stale bundle check during ongoing
implementation was fixed by regeneration. No thresholds, tolerances, timeouts, budgets or prior oracle
findings were loosened.

The full P5b phase remains open. This branch consumes part of its +6 KB allocation; integration with
host-edit and assets must remeasure the combined page. The current 100 KB ceiling is unchanged.
