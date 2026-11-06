# P5b-10 — benchmark format and tooling fixes

Status: all six requested fixes implemented; requested scope, owned browsers and verification pass.
Branch: `t3/p5b-format-tooling-gaps`. No push, PR or merge. The fresh benchmark rerun belongs to
another agent; this report does not rescore the existing benchmark.

## Changes and cause

1. The browser audio handler walked only `player.nested.players`. Repeat children instead live in
   `lists.listState(player).runs[].items`, with two event path segments (`rows.1`). The handler
   therefore stayed at the root, failed to find a component-local clip and returned without a
   fetch, decode or error. It now traverses ordinary and repeated players at every nesting level.
   Decode caches use asset declaration identity, protecting same-name clips through list moves.
   Chromium/Firefox trusted clicks observe the real `AudioBufferSourceNode.start` call with
   `[0, 0.2, 0.8]`, both directly in a row and in an ordinary component inside a row. AudioContext
   decoding/output is stubbed; actual acoustic output is not claimed.
2. Build traverses component asset catalogs and uses the compiler source map for each asset's
   declaring file, including imported libraries and HTML. A regression removes the source library
   and image folder, then renders the embedded output and checks pixels. Asset failures retain
   the complete component/source JSON pointer.
3. Count validation uses readable numeric inputs instead of only declared model properties, so
   list `.length`, named/relative numeric paths and derived string lengths work directly.
4. Component asset catalogs merge from enclosing documents, nearest declaration first. Component
   cache keys include the enclosing catalog, so a shared leaf under two parents can use distinct
   same-name assets. Image/audio asset-ref declarations validate against that scope; audio is now
   an accepted asset-ref kind. Invalid defaults identify the property/default pointer. Image hit
   testing now supplies a rectangular outline instead of falling through to circle geometry.
   Browser image loading traverses reachable component catalogs and preserves resolved resources
   across lists' model clones, including component-only relative images.
5. Inspect retains only currently existing repeated input slots (including triggers), also inside
   ordinary components. Authoring/docs no longer call data keyframes pending; the missing page link
   points to `examples/web/index.html`.
6. Derive supplies read-only string `.length` paths, including computed strings, model/list/named
   paths and cycle detection, with no bind change. Length means UTF-16 code units: empty string 0,
   `A😀` 3. This removes the need to maintain `titleChars` separately for the benchmark's titles.

The asset browser IO split is `assetio`, imported automatically by `assets`; authors add no
feature token. It follows the optional host-consumer boundary in
[web research](../../docs/research/rive-web-runtime.md) §1. Scoped catalog metadata and player-local
resolution follow [graph research](../../docs/research/rive-format-and-graph.md) §6 and
[state research](../../docs/research/rive-animation-and-state.md) §C. No native code or documentation
was copied, and no native animation file was read or emitted.

## Verification

| Check | Result |
|---|---|
| `VITEST_MAX_WORKERS=1 npm run test:scope -- lists media events assets data derive cli markup conformance oracle` | exit 0; 3,729 passed, 44 existing TODOs, 68 files passed/12 browser files skipped by scope configuration |
| Explicit browser project, all six owned files, `--maxWorkers=1` | exit 0; 68/68 tests, Chromium and Firefox |
| `node tools/oracle.ts --strict` | exit 0; 253 cases/449 samples, zero failing samples; 23 inherited findings/26 samples retained |
| `node tools/size.ts` | exit 0; all budgets below |
| `node tools/perf.ts` | exit 0; bell compile 2.63 ms, 9,040 prefixes 1,693 ms; bell/composite/toolbar frames 106.9/68.9/78.9 µs; toolbar compile 8.31 ms |
| Typecheck, ESLint, Prettier | all exit 0 |
| Modules, AniML and browser artifact `--check` | all exit 0; 476 authored AniML files, 33 browser entries |

Full command output and structured results are in [verification/p5b10](verification/p5b10/checks.json).
The registration-order/schema follow-up also passes: 18/18 tests across two files, including
all twelve module arrival orders. Performance is a current
shared-machine measurement; a quiet paired regression comparison is unverified.

| Entry | Bytes min+gzip | Unchanged budget |
|---|---:|---:|
| core+web | 20,362 | 30,720 |
| assets (over assetio) | 1,713 | 2,048 |
| assetio (new split) | 659 | 2,048 new entry |
| media | 2,665 | 3,072 |
| events | 3,793 | 4,096 |
| lists | 4,573 | 6,144 |
| data | 8,034 | 8,192 |
| derive | 2,360 | 4,096 |
| bind (unchanged source and size) | 2,038 | 2,048 |
| full-featured | 109,889 | 131,072 |
| all renderers | 115,174 | 256,000 |

All existing oracle records and thresholds are untouched. Retained relevant findings include
JPEG/JPG max 40 with 57,600 pixels over threshold per case; bilinear max 27/1,017 over; fractional
clamp max 164/956 over; nested quantize delta 1; boundary event target delta 1. The raw oracle log
records every finding with its numbers. No new native-parity claim is made by these host/tool fixes.

## Failures and limits

- Initial development fixtures used incorrect rect field names, empty node arrays and pointer
  command spelling; these were corrected. New AniML fixtures were canonically formatted using
  `anima fmt`; the corpus census increases by two rather than weakening checks.
- The previous root-only missing-file assertion now checks build's more precise
  `/assets/photo/source`; render retains its existing `/assets` diagnostic. No assertion was
  removed, skipped or widened to accommodate the change.
- Cold bundles inside the new browser test's unchanged 5-second limit timed out. Bundle creation
  moved to beforeAll. Broad concurrent runs later timed out in Firefox image setup; reducing
  setup round trips and one-worker execution passed the requested scope. No timeout, tolerance,
  budget, oracle threshold or measurement input was relaxed.
- Parity statuses, benchmark files, protected measurement tools/inputs and the other agent's
  nested/canvas/paint/component-paint/bind/host runtimes remain untouched.
