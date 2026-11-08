# P3 / P3b / P3c Rottweiler ledger

Phase ranges: `b1941c9f..c1f12883` (PR #9, P3), `b97a2d54..38dd757e` (PR #19, P3b) and
`38dd757e..aca083b4` (PR #20, P3c), reviewed as the current code on a branch from `p8` (2c09c866).
Reviewers: GPT-6.1-sol, reasoning effort xhigh, one per round.

| id | severity | finding | outcome |
| --- | --- | --- | --- |
| R1-01 | major | focus web: a renderer rebuild (lists' repeat-growth refresh, `renderer` attribute) replaced the shadow content, removing the focus proxies; topology changes never rebuilt them, so new repeat rows had no DOM focus target and logical focus did not move DOM focus | fixed: `modules/focus/web/index.ts` rebuilds the proxies when the `focusItems(true)` ids change and re-appends a detached proxy box on the host `draw` hook; `modules/focus/test/web/rottweiler-p3.test.ts` |
| R1-02 | major | focus web: only `load()` installed the bridge, so `loadModel()` on a fresh host left `aria-hidden`, no proxies and no tab stop | fixed: `loadModel()` attaches too; `modules/focus/test/web/rottweiler-p3.test.ts` |
| R1-03 | major | input web: with assets, `loadModel()` returns before the player exists, so `attach()` saw no input requirement and never retried; browser keyboard/pointer listeners stayed off | fixed: `modules/input/web/index.ts` also attaches on that load's `anima:load`; `modules/input/test/web/rottweiler-p3.test.ts` |
| R1-04 | major | core random: an unrelated explicitly seeded root stepped re-entrantly during another seeded root's step drew from the other root's `RandomSource.current` (SPEC: an explicitly seeded root shares its source with nested stepping only) | fixed: `packages/core/src/random.ts` — a player with its own explicit seed always uses its own source (nested players are never constructed with a seed); `packages/core/test/rottweiler-p3.test.ts` |
| R1-05 | major | a11y-actions: focus items excluded semantic-hidden nodes only when the item had its own `a11y`, so a focus-only child of a hidden group stayed focusable (modules/a11y/SPEC.md: eligible items exclude semantic hidden nodes; hidden subtrees are excluded) | fixed: `modules/a11y-actions/core/index.ts` also excludes items with an invisible/hidden semantic entry on their ancestor chain; `modules/a11y-actions/test/core/rottweiler-p3.test.ts` |
| R1-06 | major | playground: scrubbing a timeline with data-bound keyframes threw (`sampleTrack` without a player) | fixed: `sampleTimeline(..., player)` passes the live player; `packages/playground/test/rottweiler-p3.test.ts` |
| R1-07 | minor | devtools: `anima:load` mark used module-registration time for icons connected after devtools loaded, because patching `prototype.connectedCallback` after `customElements.define` never runs | pushed back: reproduced, but custom-element lifecycle callbacks are captured at define time, so devtools cannot observe connection on its own; the fix needs a new base-host hook in `connectedCallback`, and the shared `eventHook` forwards unknown kinds to the events module as document events (behaviour change), while a base-bundle change shifts the full `markup-libraries` measurement (2,174/2,176 B, cf. P5 R4-01). Not a smallest fix for a minor timing mark |
| R2-01 | major | focus web (after R1-01): a host whose focus document starts with no items (repeat count 0) returned before installing `onFocusRefresh`, so growing the repeat never created proxies and `focusNext()` moved no DOM focus | fixed: the empty build installs a topology-only `onFocusRefresh`; `modules/focus/test/web/rottweiler-p3.test.ts` |
| R2-02 | major | core random (after R1-04): a root seeded by the script `seed` command (constructor `seed` unset) still borrowed another seeded root's source when stepped re-entrantly | fixed: `packages/core/src/random.ts` inherits only when the player's own source has no seed; `packages/core/test/rottweiler-p3.test.ts` |
| R2-03 | major | script: semantic commands (`semantic <id> tap`, semantic key routing, text commands) mutated the live player without journaling, so breakpoint probes never saw their pending writes (`data break` was bypassed and the write committed) | fixed: `packages/core/src/script.ts` journals a semantic command as one replayed operation (partial up to the stopped step on a breakpoint) and replays the running command on the probe before its trapped step; `packages/core/test/rottweiler-p3.test.ts` |
| R2-04 | major | machine: entering a blend under reduced motion captured `reduced` in the run data; turning reduced motion off resumed the core clock but blend children stayed frozen | fixed: `modules/machine/core/runtime.ts` clears the run's reduced flag in `prepare` once reduced motion is off; `modules/machine/test/core/rottweiler-p3.test.ts` and conformance `spec/conformance/machine-blend-reduced-restore` (corpus count 611 → 612) |
| R2-05 | major | CLI `render --frames N` (PNG/WebM sequences) returned before the `--audio` export, exiting 0 without writing the WAV | fixed: `packages/cli/src/cli.ts` mixes audio after the sequence; `packages/cli/test/rottweiler-p3.test.ts` |

## Rounds

### Round 1 (full)

Reviewer: GPT-6.1-sol xhigh, full review of the P3/P3b/P3c runtime and tooling source, prioritising
a11y, focus, the web host API, devtools, markup-hooks relocation and the `VERBOSE` diagnostic guards.
Token usage: not reported. Seven findings, all reproduced by the lead. Coverage reported: a11y/focus,
devtools and markup-hooks fully; host API, diagnostic guards (loading/error identities compared
across 1,148 documents with `VERBOSE` false, no defect found; step-output equivalence incomplete)
and remaining runtime/tooling (script replay/writes, motion timing, input paths, size/perf tools)
partly.

### Round 2 (focused)

Reviewer: GPT-6.1-sol xhigh: the round-1 fix diff plus guards, host lifecycle, script/motion/input/
data-host and CLI. Token usage: not reported. Five findings, all reproduced by the lead; two (R2-01,
R2-02) were gaps in round-1 fixes. The reviewer compared all 611 completed conformance cases (every
step result, values, states and script snapshots) with `VERBOSE` true vs false: zero differences,
so the P3c diagnostic guards preserve step output. Pushbacks carried forward: R1-07; the R1-04
residual (an unseeded unrelated root stepped re-entrantly inside a seeded root's step still
inherits that source: nested players have no parent link to tell them apart).
