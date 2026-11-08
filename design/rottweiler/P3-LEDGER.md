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
| R2-04 | major | machine: entering a blend under reduced motion captured `reduced` in the run data; turning reduced motion off resumed the core clock but blend children stayed frozen | fixed: `modules/machine/core/runtime.ts` clears the run's reduced flag in `prepare` once reduced motion is off; `modules/machine/test/core/rottweiler-p3.test.ts` and conformance `spec/conformance/machine-blend-reduced-restore` (corpus count 611 → 612); mechanism replaced by R3-05 |
| R2-05 | major | CLI `render --frames N` (PNG/WebM sequences) returned before the `--audio` export, exiting 0 without writing the WAV | fixed: `packages/cli/src/cli.ts` mixes audio after the sequence; `packages/cli/test/rottweiler-p3.test.ts` |
| R3-01 | major | web host: `reset()` reloaded `player.model`, which after repeat growth is a runtime fork whose draw tree names repeat entries the new player lacks; drawing threw (`reading 'transform'`) | fixed: `packages/web/src/index.ts` keeps the model passed to `loadModel()` and resets from it; `modules/focus/test/web/rottweiler-p3.test.ts` |
| R3-02 | major | web host: `info.inputs[].default` returned the model's color array, so editing the "detached summary" changed the live player and other hosts sharing the model | fixed: array defaults are copied; `modules/host-edit/test/web/rottweiler-p3.test.ts` |
| R3-03 | major | a11y-dom (with R2-01): after a renderer rebuild the draw hook updated the overlay while its box was detached, so the `anima:overlay` focus rebuild could not resolve semantic elements and reattaching dispatched nothing; repeats grown from zero had no focus targets | fixed: `modules/a11y-dom/web/index.ts` reattaches the box before updating; `modules/focus/test/web/rottweiler-p3.test.ts` |
| R3-04 | major | script (after R2-03): a semantic command that threw after mutating (e.g. `instance-time` during its step) was not journaled, so later breakpoint probes missed its write | fixed: `packages/core/src/script.ts` journals semantic commands on any outcome, counts attempted live steps, and the replay swallows the recorded failure at that boundary; `packages/core/test/rottweiler-p3.test.ts` |
| R3-05 | major | machine (after R2-04): clearing the run's reduced flag rewound a completed `once` child (20 → 12.5) under a looping primary, while a frozen `once` primary kept looping children frozen | fixed: R2-04's `prepare` change reverted; `held()` keeps a child frozen while reduced motion is on or, after restoring, only for `once` timelines (blend sampling and settled check); conformance `spec/conformance/machine-blend-reduced-mixed` (refined by R4-02) |
| R3-06 | major | nested source clocks: restoring full motion computed the resumed origin from the already advanced source, so the first delta after restoring was lost (0 instead of 2.5) | fixed: `modules/nested/core/time.ts` resumes from `before`; conformance `spec/conformance/reduced-motion-source-restore` |
| R3-07 | major | host-edit: a pending URL/Blob image replacement overwrote a later direct asset-name write once it decoded | fixed: direct asset-name/empty writes bump the property's pending revision through a `hostEdit.assigned` hook (`modules/host-edit/core/index.ts`, `web/index.ts`); `modules/host-edit/test/web/rottweiler-p3.test.ts` |
| R3-08 | minor | CLI `render -e/--script` ignores script diagnostics (failed `expect` still exits 0) | pushed back: pre-existing — before P3b `render` used `runScript(...).player` and discarded diagnostics the same way; P3b only swapped in a session. SPEC does not define render's script-diagnostic exit behaviour, so changing it is a CLI behaviour change outside this phase |
| R3-09 | minor | web host: `invalidate()` on an empty/destroyed host called `#order()`, which threw with composite loaded (`drawFrame(undefined)`) | fixed: `invalidate()` does nothing without a player; `modules/host-edit/test/web/rottweiler-p3.test.ts` |
| R4-01 | major | host (after R3-07): `data.at(path)` built a raw image handle, bypassing host-edit's image setter, so an asset-name write through `at()` did not cancel a pending URL replacement | fixed: `modules/host/core/api.ts` returns image handles from `at()` through `image()`; `modules/host-edit/test/web/rottweiler-p3.test.ts` |
| R4-02 | major | machine (after R3-05): a looping blend child released after reduced motion sampled the whole state age, including time spent frozen (b.x 7.5 instead of 2.5 under a frozen `once` primary) | fixed: `modules/machine/core/runtime.ts` records the state time when full motion is restored (`resumed`, cleared on entry and while reduced) and released children sample from it; conformance `spec/conformance/machine-blend-reduced-mixed` now advances while frozen |
| R4-03 | major | motion: restoring full motion rebased a time-expression/hold-controlled clock with autonomous arithmetic (`time - elapsed × rate`), so the sample depended on state speed and stayed wrong until the expression changed (SPEC: speed does not affect a controlled clock) | fixed: `modules/motion/core/control.ts` leaves a controlled clock's start alone in `resume`; conformance `spec/conformance/motion-controlled-reduced-restore` (corpus 614 → 615) |
| R4-04 | minor | playground: the scrub document kept root `bind`, so a bound address showed the binding instead of the sampled timeline (SPEC §11 scrubbing samples the timeline over the rest pose) | fixed: `sampleTimeline` drops root `bind`; `packages/playground/test/rottweiler-p3.test.ts` |
| R4-05 | minor | playground: a file poll answered after a save completed reported the old revision as an external change (Save disabled, Reload shown) | fixed: `packages/playground/src/app.ts` discards a poll answer when the revision changed while it was in flight; `packages/playground/test/rottweiler-p3.test.ts` |
| R4-06 | minor | a11y commands (tooling): slider Home/End repeat `increase`/`decrease`; with a step too small to change the value (`1e-20` at 50) End stops at once, and large range/step ratios cost one step per increment | deferred: a correct endpoint write needs a new semantic endpoint action in a11y-actions (API and SPEC change); the existing bound and early stop prevent hangs on unchanged values. Not a smallest fix |

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

### Round 3 (focused)

Reviewer: GPT-6.1-sol xhigh: the round-2 fix diff plus host lifecycle, a11y-dom, data-host/host,
motion/nested clocks, input and the remaining CLI/tools. Token usage: not reported. Nine findings, all
reproduced by the lead; three (R3-03, R3-04, R3-05) were gaps in round-2 fixes. R3-08 pushed back.
Noticed while writing the R3 browser test (not P3 code, not fixed): on an `about:blank` page the
asset loader rejects with an `Error` rather than a diagnostics array, `#fail` then throws on
`d.map` and `icon.ready` never settles; the test sets a document base instead. Owner: the assets/
assetio phase (P5).

### Round 4 (focused)

Reviewer: GPT-6.1-sol xhigh: the round-3 fix diff plus playground app/server, player, input write
sources, data-host, motion, a11y commands/validation and CLI session/project/doctor. Token usage: not
reported. Six findings, all reproduced by the lead; two (R4-01, R4-02) were gaps in round-3 fixes.
R4-06 deferred.
