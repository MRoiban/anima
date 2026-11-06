# P4e-3 host API report

Status: implemented inside ownership; integration incomplete. No push, PR or merge.

The module owns core/web typed handles, reflection, instance creation/binding, batching,
post-step subscriptions, auto-bind, diagnostics, module spec/authoring text, a page and
AniML/compiled JSON example, conformance script and independent native evidence.
See ROWS.md for row-level implemented/pending scope and INTEGRATION.md for exact shared edits.

## Missing seams and integration

- Data has no exported diagnostic-code table. Host uses one local table matching data's codes;
  the requested single shared table remains unmet until data exports it. No data files changed.
- CLI docs topics require a host heading in shared spec/SPEC.md. The test requiring
  `anima docs host` is retained and fails, rather than being skipped/weakened. Module spec text
  is ready; shared authoring inclusion and optional examples/web placement are handed off.
- Runtime creation/rebind are adapted through dataState's public scope/ref/read and loader
  exports. No shared compiled defaults/refs/inputs are mutated. Binding requires the default
  model type; compound values use the same validated instance notation as data.

## Native evidence

16 initial/final scalar/nested/list values match exactly (difference 0); five changed scalar
paths match. Native idle dumps retain all five flags, while host idle delivery is 0: flags cannot
establish JS callback counts/order. A host trigger activates the native model listener (n=9).
Anima settles to the same n=9, but queues the authored listener for a second step: native first
advance n=9 versus Anima first n=0, second n=9 (one-step timing difference).

Native CLI probes reject image/font/list writes (3 failures) and instance create/bind commands
(2 unknown commands). Raw sessions/captures remain under oracle/. JS callback/batch/unsubscribe
comparisons are skipped with evidence. Anima order/batching expectations are hand-authored in
conformance/subscriptions.json, not copied from runtime output. Global strict oracle does not
include the new local probes because its protected manifest was not changed.

## Verification

| Command | Result |
| --- | --- |
| node tools/size.ts | Exit 0: host 3879/4096 B; core+web 20021 B (unchanged); data 8181/8192 B; bind 2046/2048 B. Full-featured 85387 B (83.4 KiB, baseline supplied as 81.8 KB); Rive-class 89862 B. |
| node tools/perf.ts | Exit 0: bell compile 2.44 ms; 9040-prefix sweep 675 ms; bell/composite frames 44.6/30.3 µs; toolbar frame 35.6 µs and compile 4.90 ms. Initial baseline: 3.49 ms/1088 ms, 64.1/43.2 µs, toolbar 40.3 µs/7.42 ms. No regression observed; these are fixed-workload machine timings. |
| node tools/oracle.ts --strict | Exit 0. Existing findings/pending cases retained. New host probes are tested separately, not in the protected global manifest. |
| npm run test:scope -- host data web conformance oracle | Exit 1: 4201 pass, 6 fail, 45 TODO; 33 passing/3 failing/13 skipped files. See failures below. |
| npm run test:scope -- host (final) | Exit 1: 30 pass, 1 fail; all four Chromium/Firefox separate-bundle cases pass, including paused and late host loading, callback-driven next frames and reload. The single failure is the retained CLI docs integration assertion. |
| npx vitest run --project browser modules/machine/test/web/browser.test.ts -t 'Chromium machine.*markup first=false' | Exit 0: the exact timed-out case passes (1 pass/3 filtered), with the unchanged 30 s test limit. |
| npm run typecheck | Exit 0. |
| npx eslint . | Exit 0. |
| npx prettier --check . | Exit 0 after generated ignored canvas metrics were preserved in /tmp/host-canvas-artifacts and cleaned from the working tree. No formatter configuration or numeric records changed. |
| node tools/modules.ts --check | Exit 0, 0 stale files. |
| node tools/build-web.ts --check | Exit 0, 23 entries. |
| node tools/build-animl.ts --check | Exit 0, 335 AniML files (existing pending sources retained). |
| npm run gen | Exit 0, no schema diff (host adds no document fields). |
| git diff --check | Exit 0. |

The broad run's failures are one host CLI docs assertion, four canvas asset-load failures
(data-property-asset-image, two snapshots in both browsers, /assets/first/source), and one
machine Chromium timeout. The canvas scene references first.bin/second.bin; neither is in that
fixture directory, and the browser harness provides no matching asset route/resolver. Those
files and the canvas code are outside ownership. The machine case passes its exact rerun;
its initial timeout remains recorded, not discounted. The broad run preceded the final
host-only edge-case fixes; the final host scope above covers those changes.

10 inventory rows have the decided API implemented, 6 have the decided subset with broader
inventory helpers/decoded-asset work pending, and 2 are outside §7 (global-name APIs and
artboard handles). See ROWS.md; no parity completion/status fields changed.

Host API access starts unbound. Authored scene bindings retain data's existing default behavior.
If “unbound” is intended to disable authored scene bindings too, that requires a data-owned
scope activation seam and is not implemented here. Asset handles select declared IDs; decoded
asset replacement is not implemented. No other decided document syntax was changed.

Development failures were fixed without loosening checks: missing tooling dependencies were
installed with npm ci; the synthetic validator scene and undefined metadata were corrected;
invalid test scenes/expectations were repaired; callback scheduling, graph cycles, list metadata,
late module hook attachment and typed errors were fixed in implementation. Native capture
retries needed a frames directory and the project working directory. Lint errors were fixed.

