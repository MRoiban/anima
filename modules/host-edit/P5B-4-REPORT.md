# P5b-4 host seam closure

Status: P5b-4 complete; all requested checks pass. Local branch
`t3/split-host-shared-queue` only; no push, PR or merge. Parity status fields are unchanged.

## Delivered

- Split value construction/validation, model identity indexing and detached copying into
  `host-values` (2048 B budget). Web host imports it automatically; core host retains its existing
  registration API through a factory fallback. Host remains at its existing 4096 B budget,
  measured over its automatically loaded companion. Generated wiring comes from tools/modules.ts.
- One host enqueue/wake/busy/batch mechanism for ordinary writes, list helpers and image commits.
  Object/property projections account for whole-list replacement, shared aliases and queued global
  replacement. Callback writes wait for the next step. Ordinary reads remain committed snapshots.
- Host-owned atomic rebindInstance updates records, bound/named scalar routing, shared component
  and repeat scopes and model identity metadata. Newly constructed repeat scopes synchronize their
  named globals from their parent context before binding. Host-edit adds globals()/setGlobal();
  models() exposes global: true. Foreign records, wrong models and unknown names are typed errors.
- Runtime sourceLoader hook and explicit loadModel(model) lifecycle path. Host-edit caches source
  fetch/parse by URL, resolver identity, policy, component selection and registration generation;
  concurrent consumers share initial image decoding. Asset records stay local. Asset-free icons
  reuse the compiled Model; asset-bearing icons reuse parsed data and decode results, constructing
  a local compiled model when an already-used model is instantiated again. No cross-module model
  fork protocol or protected asset-module changes are needed.
- Independent core/browser repeat contract: add, insert, swap and remove preserve surviving item
  players, machine state and a running timeline. The expected position is computed as 8*t: 2 at
  0.25 s and 3 at 0.375 s, with the item orders independently enumerated. Chromium and Firefox use
  icon.data; core uses player.data. Core also covers shared global aliases, existing and new repeat
  scopes, subscriptions and standalone host registration.

## Rows

| Row | Result |
| --- | --- |
| data.host-global-instance | Implemented; global replacement, model/ownership diagnostics and shared child contexts tested. Native attachment commands are an evidenced skip. |
| host-api.global-models | Implemented; detached global-name records, global model reflection and typed replacement. |
| host-api.reuse-loaded-file | Implemented; concurrent browser consumers parse/decode once and retain isolated values/images; policy and resolver identity partition caches. |

Four existing component-value rows remain pending: data.host-artboard, host-api.data-artboard,
host-api.bindable-artboards, components.host-artboard-reference. Data/components own their required
property type and consumer. No capability status field or shared oracle input is changed.
These host APIs add no document fields, so registry entries and CLI syntax remain unchanged; the
existing CLI validation/inspect/sample/docs tests cover the same authored data/global fields.

## Decisions and limits

The split follows the graph/storage boundary in docs/research/rive-format-and-graph.md §6;
source/instance lifecycles follow docs/research/rive-web-runtime.md §4. The decided P5b design is
unchanged. The existing runtime registration-name workaround remains: hostvalues/hostedit runtime
keys, host-values/host-edit public entries. Core/scaffolder naming validators are outside ownership.

Asset-bearing consumers validate/compile cached parsed objects into local models rather than
assuming that all modules support compiled-model forks. They still share source parsing and initial
decoding, and the explicit runtime Model path itself never parses or compiles. The cache lives for
the page lifetime. Resolver functions shared by identity must resolve consistently for consumers
using the same source/policy. Set resolver/policy before src.

Fresh Rive 1.9.1 evidence: oracle/seams/session.txt records rejection of data-global,
data-set-global, data-bind, data-create, data-add and data-swap. Browser document caching/JS queues
have no command-runner counterpart; no native parity is claimed for them. Existing native scalar
comparisons and all inherited oracle findings retain their original measurements.

## Verification

Final results and raw evidence are in verification/p5b4/. No test, timeout, budget, tolerance,
oracle threshold, measurement tool or measurement input was relaxed.

| Check | Result |
| --- | --- |
| Requested scope, Chromium + Firefox | Exit 0; 5579 passed / 59 existing TODO, 61 passing / 13 skipped files; 541.77 s, including Chromium and Firefox. |
| Focused host/host-edit core + CLI + conformance + native | 62 passed, 12 files. |
| Strict oracle | Exit 0; 245 cases / 441 samples; 24 inherited findings / 27 samples retained, raw numbers saved. |
| Size | Exit 0; every module and aggregate budget passes. |
| Perf | Exit 0; bell compile 6.40 ms, 9040 prefixes 1198 ms; bell/composite/toolbar frames 80.0/54.5/63.3 µs; toolbar compile 12.10 ms. Concurrent load; comparative non-regression is unverified. |
| Typecheck / ESLint / modules --check | Exit 0 each; wiring has zero stale files. |
| Prettier | Exit 0; all matched files formatted. Raw generated metrics preserved unchanged before ignored-output cleanup. |
| Generated artifacts | 31 browser entries built; 451 AniML files checked; schema regenerated with no diff. |
| Ownership / parity | No protected-source or measurement-tool/input changes; 1238 status fields unchanged. |

Min+gzip sizes: host **3424/4096 B** over its companion; host-values **1154/2048 B**;
host-edit **3409/4096 B**; bind **2047/2048 B**. Core+web **20150 B**, **+41 B** from
20109; full-featured **103330 B**, **+1061 B** from 102269 (ceiling 131072 B).
Rive-class **108310 B**. No existing budget was raised.

## Development failures

- Missing dependencies were restored with npm ci; the first split used unsupported TypeScript
  parameter properties and was changed to erasable field assignments.
- Initial cache fixture used source instead of AniML src, an image element instead of asset-ref,
  and omitted paint; corrected fixture syntax/declaration without changing assertions or limits.
- Standalone fixture omitted fill and produced no-paint; supplying the intended fill fixed it.
- Early runtime hook layouts shifted bind compression to 2050–2052 B. Keeping compiled-model
  instantiation together at the start of the class retained the unchanged 2048 B gate; bind was
  never edited. The final size report records the actual values.
- The first broad run used the stale generated standalone demo and failed its two browser artifact
  assertions. That run was stopped after the cause was fixed; final browser artifacts were rebuilt
  with tools/build-web.ts before the full requested scope was rerun.

- The initial whole-repository format check saw a generated, ignored Canvas metrics JSON and the
  new native skip JSON. The skip file was formatted; raw generated measurements are preserved
  unchanged at `/tmp/anima-p5b4-raw-artifacts/` before cleanup of ignored outputs and the final format check.
