# P5 / P5b Rottweiler ledger

Phase ranges: `e0957cbd..dfbfcfc6` (PR #11, P5) and `912b6c77..33e8d21b` (PR #17, P5b), reviewed as
the current code on a branch from `p8` (1acdaf0). Reviewers: GPT-6.1-sol, reasoning effort xhigh, one
per round.

| id | severity | finding | outcome |
| --- | --- | --- | --- |
| R1-01 | major | lists: recycled repeat slots without a child order table took recycled destination indices as sibling ranks, reversing paint order (red/blue swap after count 2→0→1); `spec/MODULES.md` draw-tree rank rule | fixed: `modules/lists/core/index.ts` ranks absent child orders by child index; `modules/lists/test/core/rottweiler-p5.test.ts` |
| R1-02 | major | lists: a repeated child writing inherited shared data left the parent `settled: true` with stale bindings (SPEC "Inherited data context") | fixed: repeat step compares `$` inputs before/after its item steps, as components do; `modules/lists/test/core/rottweiler-p5.test.ts` |
| R1-03 | major | media: `icon.asset()` cache keyed by compiled model, so hosts sharing a model got the first host's resolver bytes | fixed: cache per player, image lookup prefers the player catalog; `modules/assets/test/web/pipeline.test.ts` ("caches media bytes per host…") |
| R1-04 | major | surface: image paints ignored player-local catalogs, so a static image paint kept the old image after `data.image().set()` (host-edit SPEC legacy per-player replacement) | fixed: `modules/surface/core/index.ts` looks up `resolvedAssets.get(p)` first; `modules/host-edit/test/web/rottweiler-p5.test.ts` |
| R1-05 | major | lists: the 256-instance budget skipped construction, so nested initial expansion (20×20 → 420 players) allocated unbounded and failed only on the first step | fixed: construction counts against the same per-pass budget (each list player once per outermost construction/step, so new items are not double counted); `modules/lists/test/core/rottweiler-p5.test.ts` |

## Rounds

### Round 1 (full)

Reviewer: GPT-6.1-sol xhigh, full review of the P5/P5b runtime and tooling source. Token usage: not
reported. Five majors, all reproduced here (Node scripts / Chromium) before fixing; each regression
test fails on the old code and passes after. Not reached by round 1: CLI asset processing/import/export
and build tooling; paint geometry, composite masks/clips, surface slicing, Canvas renderer; AniML
library reuse and compile/decompile; data converters/keyframes, motion; optional-module import orders.

Note on R1-05: a list-budget overrun now throws `limit-exceeded` from the `Player` constructor instead
of the first `step`; `<anima-icon>` constructs and immediately steps, so hosts see the same error.
