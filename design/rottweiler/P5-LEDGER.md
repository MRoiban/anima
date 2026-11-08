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
| R1-05 | major | lists: the 256-instance budget skipped construction, so nested initial expansion (20×20 → 420 players) allocated unbounded and failed only on the first step | deferred (round-1 fix reverted in round 2): a child's initial expansion runs on model defaults before its placement context binds, so a construction count rejects valid trees (R2-01) and couples independent roots (R2-02); a correct bound needs context-before-expansion across components and lists (same init-order gap as R2-07) — more than a smallest fix. The step-time budget is unchanged |
| R2-01 | major | round-1 R1-05 fix: a row bound to `{n:0}` whose model defaults `n` to 256 threw `limit-exceeded` at construction | fixed by reverting the R1-05 construction count; `modules/lists/test/core/rottweiler-p5.test.ts` |
| R2-02 | major | round-1 R1-05 fix: an independent root built re-entrantly during another tree's step shared that tree's global budget | fixed by the same revert; `modules/lists/test/core/rottweiler-p5.test.ts` |
| R2-03 | major | CLI importers emitted SVG/Lottie ellipses as `center:[x,y]`, which fails validation (`unknown-key center`, missing `cx`/`cy`) | fixed: `packages/cli/src/import-svg.ts`, `import-lottie.ts` emit `cx`/`cy`; `modules/assets/test/cli/rottweiler-p5.test.ts` |
| R2-04 | major | componentpaint: paint sources were loaded without the enclosing asset catalog, so a source image naming a root asset failed with `unknown-asset` (SPEC assets scope) | fixed: source document gets `{...enclosing, ...local}` assets; `modules/componentpaint/test/core/rottweiler-p5.test.ts` |
| R2-05 | major | markup-libraries: library expansion does not rewrite repeat model maps (`component="Row:row"`), so a library board fails with `list-map`/`data-type` | deferred: the rewrite needs well over the 2 B left in `markup-libraries` (2,174/2,176 B); AGENTS requires splitting a full entry into an optional entry first and the brief forbids raising budgets |
| R2-06 | major | CLI `render` embedded and decoded only the root asset catalog; component-local images rendered blank | fixed: `packages/cli/src/assets.ts` walks component catalogs; `modules/assets/test/cli/rottweiler-p5.test.ts` |
| R2-07 | major | motion: a component keyframe `[0,'$parent.peak']` threw `data-keyframe` from the constructor because the parent context binds after construction | fixed: an unbound `$parent.` key samples the rest value until the first step; `modules/motion/test/core/rottweiler-p5.test.ts` |

## Rounds

### Round 1 (full)

Reviewer: GPT-6.1-sol xhigh, full review of the P5/P5b runtime and tooling source. Token usage: not
reported. Five majors, all reproduced here (Node scripts / Chromium) before fixing; each regression
test fails on the old code and passes after. Not reached by round 1: CLI asset processing/import/export
and build tooling; paint geometry, composite masks/clips, surface slicing, Canvas renderer; AniML
library reuse and compile/decompile; data converters/keyframes, motion; optional-module import orders.

R1-05 was first fixed by counting construction; round 2 showed that regressed valid trees, so it
was reverted and deferred (see the table).

### Round 2 (round-1 fixes + uncovered areas)

Reviewer: GPT-6.1-sol xhigh. Token usage: not reported. Seven majors, all reproduced here. R1-01–R1-04
held up; the R1-05 construction budget did not (R2-01, R2-02), so it was reverted rather than reworked.
R2-05 is deferred on the full `markup-libraries` budget. While reverting, the R1-02 snapshot moved
inside the step's `try` so a throw cannot leave the global step depth raised. Not reached: exhaustive
mask/blend/slice pixel checks, Canvas wrap/recursive sources, browser load-order permutations,
malformed media and converter/host-write edge cases.
