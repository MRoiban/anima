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

| R2-08 (size) | — | The first R2-08 compile-side fix put `markup-hooks` 21 B over budget | reworked: guard rewriting now transforms only the segments between quoted literals (same semantics for literal-free guards); `markup-hooks` 4,540/4,544 B |
| R3-01 | major | Backend order is stale when a backend registers before its module | pushed back: every shipped entry (all web bundles, `core/all.ts`) registers the module first, so this needs out-of-order public API calls. Sorting at `sceneTree` instead fixed it but cost 2–7 B in the full `markup-libraries`/`markup-hooks` delta budgets in every variant tried, and the first version hung componentpaint (it mutated the map during a nested hook loop). Kept R2-06's registration-time sort |
| R3-02 | minor | The once `anima:load` listener accumulated on failed/superseded loads and survived destroy | fixed: one permanent listener per icon (`WeakSet`) in `modules/input/web/index.ts`; `modules/input/test/web/p4-review.test.ts` |
| R3-03 | major | Re-registering base paint (e.g. via surface's bundle) replaces the sampling backend | deferred to the P5b lead: the base/sampling backend split is P5b code (`2db307f0`), not P4 |
| R3-04 | major | Bind `==`/`!=` compared colour RGBA arrays by identity (`#fff == #ffffff` false) | fixed: `modules/bind/core/expression.ts` compares components; `modules/bind/test/core/p4-review.test.ts` |
| R3-05 | major | Data path scan read `$x` inside quoted expression literals (outside guards) as paths | fixed: `modules/data/core/compile.ts` strips quoted literals from every scanned string; data test file |
| R3-06 | major | `calculate` `random: always` never marked the player active, so it froze | fixed: `modules/convert/core/converters.ts` calls `ctx.active()` like formula `random()`; `modules/convert/test/core/p4-review.test.ts` |
| R3-07 | major | Pointer focus inside a component picked the back-most overlapping child | fixed: `modules/focus/core/index.ts` ranks by placement, append sequence and inner rank; `modules/focus/test/core/p4-review.test.ts` |
| R3-08 | major | Surface's paint split dropped contour's per-paint paths (clockwise winding + feather rendered nothing) | fixed: `modules/surface/core/svg.ts` (P5 file, minimal) keeps contour's matching path inside each leaf; `modules/contour/test/core/p4-review.test.ts` |

| R4-01 | major | A random state's weighted pick included any-state edges, defeating their priority | fixed: `modules/machine/core/{types,index,runtime}.ts` mark any-state edges and keep them out of the pick; machine test file |
| R4-02 | major | Pointer focus ranks by authored order, ignoring composite `drawOrder` | deferred: input's hit order (its spec's "foremost first") is also authored order, so fixing focus alone would make pointer focus disagree with pointer listeners on the same click; composite exposes only flat-list ranks, not a global paint order. Needs a coordinated input + focus + composite change, beyond a smallest fix |
| R4-03 | major | The host's `#aria()` on every state change removed focus's `role="group"` and set `aria-hidden="true"` | fixed: `modules/focus/web/index.ts` re-applies its host attributes on `anima:state`; `modules/focus/test/web/p4-review.test.ts` (Chromium + Firefox) |
| R4-04 | minor | Reduced motion lost an instance's negative direction when the authored timeline speed is 0 | fixed: `modules/motion/core/api.ts` `reduce()` uses `speed || 1` like its caller; motion test file |

Reviewer token usage: not reported (rounds 1–4).
