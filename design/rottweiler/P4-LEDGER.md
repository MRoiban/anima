# P4 Rottweiler ledger

Phase P4: P4a paint/composite (PR #10), Pc canvas backend (#12), P4b motion (#13), P4d events (#14),
P4c interaction (#15), P4e data (#16). Lead: Opus; reviewers: GPT-6.1-sol xhigh, one per round.

| id | severity | finding | outcome |
| -- | -------- | ------- | ------- |
| R1-01 | major | Blend children sampled data-bound keyframes without the player → constructor throws | fixed: `modules/machine/core/runtime.ts` passes `this.p`; test `modules/machine/test/core/p4-review.test.ts` |
| R1-02 | major | Blend states interpolated discrete channels (int → 1.5, string → path parser crash) | fixed: discrete addresses replace at any positive weight (spec mix-discrete); same test file |
| R1-03 | major | Zero exit threshold at zero speed carried `0/0` → target clock NaN | fixed: `modules/motion/core/api.ts` carry subtracts 0 for a zero threshold; `modules/motion/test/core/p4-review.test.ts` |
| R1-04 | major | Machine action groups rejected string/colour data destinations (`input-type`) | fixed: `modules/machine/core/index.ts` validates against the input's own type; machine test file |
| R1-05 | major | Pointer-disabled descendants supplied their group's hit area | fixed: `modules/input/core/runtime.ts` skips `pointerEnabled=false` children; `modules/input/test/core/p4-review.test.ts` |
| R1-06 | major | Nodes using ordered `paints` were never hit | fixed: `packages/core/src/player.ts` hit test reads fill/stroke paints; `modules/composite/test/core/p4-review.test.ts` |
| R1-07 | major | Data custom string tracks went through paint's path interpolator → crash | fixed: `modules/data/core/index.ts` installs a hold sampler for data string tracks; machine test file |
| R1-08 | minor | Data path scan treated string event-payload literals spelling `$x` as paths | fixed: `modules/data/core/compile.ts` skips payload string `value`; `modules/data/test/core/p4-review.test.ts` |
| R1-09 | major | Input's listener extension dropped focus's `of` names (focus+input without events/components) | fixed: `modules/input/core/registry.ts` builds the preserved pattern from `old.of`; input test file |

| R2-01 | major | Hidden paints (`fill.visible`/`paints.N.*.visible` false) still hit; contour's clockwise `fillContains` too | fixed: `packages/core/src/player.ts` and `modules/contour/core/winding.ts` skip hidden paints; `modules/composite/test/core/p4-review.test.ts` |
| R2-02 | major | Data path scan rejected literal custom properties (`"$price"`) and embedded run text (`"Price $total"`) | fixed: `modules/data/core/compile.ts` skips node `properties` and run text not starting with `$`; `modules/data/test/core/p4-review.test.ts` |
| R2-03 | major | Asynchronous (asset) loads never attached input DOM handlers | fixed: `modules/input/web/index.ts` attaches on `anima:load`; `modules/input/test/web/p4-review.test.ts` (Chromium + Firefox) |
| R2-04 | major | Disconnect left pressed contacts alive (stale `held`, later stale click) | fixed: input chains the host `cleanup` hook to `cancel()`; same browser test |
| R2-05 | major | Gamepad polling stops for good after a detach longer than a frame | deferred: needs a host connect signal; lifecycle callbacks are captured at `define`, and a new `connect` event hook would surface as a public `anima:connect` DOM event through events. Workaround: reassign `inputOptions`. Not a P4-local smallest fix |
| R2-06 | major | SVG backend hooks ran in load order; `paint,mix,contour` lost a stroke-blend trim | fixed: `packages/core/src/svg.ts` keeps backends in module dependency order; `modules/mix/test/core/p4-review.test.ts` |
| R2-07 | major | Canvas clamped oversized `rx` uniformly; SVG clamps per axis | fixed: `modules/canvas/web/renderer.ts` passes `{x,y}` radii; `modules/canvas/test/web/p4-review.test.ts` (Chromium + Firefox) |
| R2-08 | major | AniML guard rewriting corrupted quoted literals (`"A&&B"` → `"AandB"`; compile re-spaced `<=`, split `and`) | fixed: `packages/markup/src/decompile.ts` and `modules/markup-animation/markup/index.ts` (owned outside P4; minimal) skip quoted literals; `modules/data/test/markup/p4-review.test.ts` |

Round 1 reviewer token usage: not reported. Round 2: not reported.
