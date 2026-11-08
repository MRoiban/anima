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

Round 1 reviewer token usage: not reported.
