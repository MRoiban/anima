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
| R3-01 | major | componentpaint: paint-source players render authored image URLs; the browser asset loader never visited source models, so a resolver replacement (red→blue) was ignored in SVG and Canvas | fixed: componentpaint exposes `sources` (its per-model plan map) and `assetio`'s loader walks it like component placements, recursively; `modules/componentpaint/test/web/rottweiler-p5.test.ts` (+ `assets-entry.ts` one-bundle fixture) |
| R3-02 | major | motion: the R2-07 rest fallback is never resampled for a `paused` instance (components skips its step), and `values()` before the first step shows rest | deferred: resampling without stepping (no clock advance, no queued actions) needs the placement context installed before construction — the R1-05 init-order gap. Unpaused placements resample on their first step; before R2-07 the constructor threw |
| R3-03 | major | motion: the R2-07 fallback also masked bound `$parent.` paths whose live value became undefined (list item removed), skipping the `data-keyframe` error (data SPEC "Data keyframe values") | fixed: fallback only while lists has not bound the player's parent (`lists.parents`); `modules/motion/test/core/rottweiler-p5.test.ts` |
| R3-04 | major | host-edit: list `insert`/`add` treated any map with `name` and `model` keys as an instance record (rejecting valid property maps, accepting forged/foreign records by name); `remove` resolved unowned records by name | fixed: `HostData.owns()` exposes the existing ownership set; list editors take only owned handles as instances and reject foreign records on remove (`data-instance`); `modules/host-edit/test/core/rottweiler-p5.test.ts` |
| R3-05 | major | tooling: the browser bundle cache fingerprint omitted `modules/*/capabilities/**`, which runtime entries import, so a registry edit left tests on a stale bundle | fixed: `tools/browser-cache.ts` fingerprints capability sources; `tools/browser-cache.test.ts` |
| R4-01 | major | componentpaint: with separate module bundles the paint backend builds sources with its own bundled `sceneTree`, whose backend map lacks the active backends, so a source `<image>` loses its `href` (also gradients/compositing tree hooks) | deferred: the fix (pass the active `sceneTree` to `SVGBackend.tree`, as `attrs` already receives the active renderer) changes the base bundle, which moves `markup-libraries` (gzip delta over web+markup, 2,174/2,176 B) to 2,178–2,183 B in every spelling measured (tree-hook arg, `forEach`, tree property, `AnimaIcon.sceneTree` static); budgets may not be raised. Needs the `markup-libraries` split. Works in one bundle |
| R4-02 | major | componentpaint (after R3-01): paint-source players read the mutable model-level catalog, so a second host loading the same document with another resolver changed the first host's source image on its next step | fixed: the componentpaint player extension exposes `sources`; the web host's per-player resource pass (`#resources`) visits them like nested and repeated players; `modules/componentpaint/test/web/rottweiler-p5.test.ts` |
| R4-03 | major | composite SVG: an ordered `paint` entry first received aggregate attributes of all paints, so a fill entry kept an earlier entry's stroke and redrew it on top (SPEC ordered paints) | fixed: `key === 'paint'` renders only the selected paint; `modules/composite/test/core/rottweiler-p5.test.ts` |
| R4-04 | major | surface SVG: loading `surface` before `composite` split an ordered-paint shape into fill/stroke leaves first, so composite duplicated that group and every entry drew the first fill (red instead of blue) | fixed: surface skips the split for nodes with ordered paints; `modules/surface/test/web/rottweiler-p5.test.ts` (both orders, Chromium + Firefox) |
| R4-05 | minor | CLI build: the image-kind check used the declared data-URI MIME, so `data:image/svg+xml` with WAV bytes or plain text built as an image | fixed: the check uses the inspected MIME (SVG only when the bytes contain `<svg`); `modules/assets/test/cli/rottweiler-p5.test.ts` |

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

### Round 3 (round-2 fixes + uncovered areas)

Reviewer: GPT-6.1-sol xhigh. Token usage: not reported. Five majors, all reproduced. Two (R3-02, R3-03)
were gaps in the R2-07 fix; R3-03 is fixed, R3-02 deferred with R1-05. Observed while testing R3-01
(not a reviewer finding, handed to round 4): with **separate** module bundles, a component paint
source's `<image>` is emitted without `href` (also on the pre-round code), so the R3-01 test uses one
bundle. Not reached: exhaustive mask/clip/blend/slice pixels, all import-order permutations, nested
transition/scrubbing, hostile converter inputs, generator/oracle/size tools.

### Round 4 (round-3 fixes + uncovered areas)

Reviewer: GPT-6.1-sol xhigh. Token usage: not reported. Four majors and one minor, all reproduced. R4-01
is the separate-bundle `href` loss observed in round 3; it is deferred on the `markup-libraries` budget
(measurements in the table). The round-3 host-edit change had lost a type narrowing (`npm run
typecheck` failed); fixed here with a cast, together with a type-only fix in the round-1 host-edit test.
`examples/web/index.html` is regenerated by `tools/build-web.ts` (the base bundle changed). Not
reached: exhaustive mask/clip/blend/slice pixels, Canvas wrap and recursive-source permutations, nested
transition/scrubbing, hostile converter/media fuzzing, generator/oracle/size/scope tools.
