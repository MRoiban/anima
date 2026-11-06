# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

P4c-1 implementation complete: 26/26 requested behaviors (25 inventory rows plus previous-value conditions).
Inventory statuses remain unchanged for the phase owner; no push, PR or merge.

## Verify

- `npm run test:scope -- machine conformance oracle`: **937 passed, 36 files**; includes both Chromium and Firefox (four module browser checks), all conformance and oracle runners, and shared markup compile/decompile/format/corpus tests.
- Broader core/markup scope: 1323 passed, 32 failures in the independent structural reader, which initially treated new JSON-valued attributes as strings. Reader extended independently; all 366 targeted structural/format/extension tests then passed. Final machine scope includes those tests. Core module-order, 0.1 SVG compatibility, player, loader and prefix-compile checks passed in the broader run.
- Typechecks: core, core tests, markup, web. Prettier, ESLint, module generation, parity generation, AniML artifacts and browser artifacts checked. Full `npm run check` intentionally left to phase CI.
- 37 new independent conformance cases; the vectors in `test/generate.py` never read player output. Total normative corpus: 118 cases; 136 AniML corpus builds.
- 18 new native oracle cases / 45 frames, observed maximum channel difference **1**, zero pixels over 16; existing limit remains 2 and 0%. Eight documented skips below; no pending probes or expected-failure exceptions.
- CLI `schema state`, validate, sample (arbitrary count increases, including any-state self re-entry), and `docs machine` exercised directly.

## Metric

| Measurement | Result |
|---|---:|
| machine incremental min+gzip | **5736 / 8192 B** |
| core + web | **19048 B**, +36 B over 19012 |
| markup | **7643 / 8192 B** |
| full-featured SVG total | **56311 / 102400 B** |
| Rive-class total | **60558 / 256000 B** |

`node tools/perf.ts` final output (same unchanged measuring method; machine-local observations):

```text
compile: bell 1.92 ms; all 9040 prefixes 535 ms
frame: bell 30.4 µs; composite 19.5 µs
frame: toolbar 22.2 µs (step + draw, 4 instances)
compile: toolbar 2.99 ms
```

## Extension points and deviations

The owner authorized the narrow shared extension: non-node AniML fields on **state, transition (`on`), layer, timeline and listener** now derive from registry shapes and `markup` aliases in compile, decompile and layout. New compounds (object/map/array/union) use JSON-valued attributes; existing listener set/fire/toggle keep their forms. Scalar document module fields are root attributes. Unknown fields remain `unknown-attribute`. Core only adds layer/listener registry targets and resets them during recomposition. See MODULES §3 and `packages/markup/test/module-fields.test.ts` (five targets, aliases, compounds, unknown attributes and late registration).

Focus handoff: install `player.machineFocus = (nodeId: string) => boolean` and call `player.onChange?.()` after ownership changes. Missing reader means false. Machine validates node IDs and typed equality/inequality, but owns no DOM focus. Browser tests use separate bundles; core tests inject a live true/false reader. The companion focus module still needs to supply this reader when branches are integrated.

Data sources are numeric input names or `{bind: "numeric expression"}` requiring bind, until P4e. RNG is a per-player 32-bit LCG, default seed 1831565813, multiplier 1664525, increment 1013904223; no Rive source/algorithm copied and no NOTICE addition needed.

Motion combinations are explicit: child animations honor autonomous speed/work/quantization, plus per-child reduced-motion entry policy. Held/expression-controlled blend primary clocks and incoming synchronization are rejected with `machine-clock`; continued sources likewise reject hold/time/sync. Positive relative timing rejects zero-speed sources. No existing 0.1 behavior changes. Terminal states retain outgoing keyed samples and stop their clocks. Actions use the existing next-step input queue; native-style immediate mutation is not claimed.

Native 1D scenes use `reset=true`: without it repeated native applies drift (an initial x=4 became 5 on the next advance). References include a repeated-apply frame with reset enabled; Anima starts from rest each frame. Relative-duration and terminal probes preserve the native capture's exact step partition through existing oracle scripts; snapshot-on-exit is step-sequence dependent by SPEC §7. No tolerance, budget, timeout, comparison or performance method changed.

## Requested rows

| Behavior | Implementation | Native evidence |
|---|---|---|
| `state-machine.any-state` | complete; [example](capabilities/state-machine-any-state/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-1d-data` | complete; [example](capabilities/state-machine-blend-1d-data/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-1d-input` | complete; [example](capabilities/state-machine-blend-1d-input/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-additive` | complete; [example](capabilities/state-machine-blend-additive/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-direct` | complete; [example](capabilities/state-machine-blend-direct/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-exit-clock` | complete; [example](capabilities/state-machine-blend-exit-clock/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-weight-constant` | complete; [example](capabilities/state-machine-blend-weight-constant/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-weight-data` | complete; [example](capabilities/state-machine-blend-weight-data/example.animl), independent conformance and diagnostics | verified |
| `state-machine.blend-weight-input` | complete; [example](capabilities/state-machine-blend-weight-input/example.animl), independent conformance and diagnostics | verified |
| `state-machine.condition-artboard` | complete; [example](capabilities/state-machine-condition-artboard/example.animl), independent conformance and diagnostics | verified |
| `state-machine.condition-component` | complete; [example](capabilities/state-machine-condition-component/example.animl), independent conformance and diagnostics | verified |
| `state-machine.condition-focus` | complete; [example](capabilities/state-machine-condition-focus/example.animl), independent conformance and diagnostics | skip-noted |
| `state-machine.continue-on-exit` | complete; [example](capabilities/state-machine-continue-on-exit/example.animl), independent conformance and diagnostics | verified |
| `state-machine.entry-state` | complete; [example](capabilities/state-machine-entry-state/example.animl), independent conformance and diagnostics | verified |
| `state-machine.exit-state` | complete; [example](capabilities/state-machine-exit-state/example.animl), independent conformance and diagnostics | verified |
| `state-machine.exit-time-relative` | complete; [example](capabilities/state-machine-exit-time-relative/example.animl), independent conformance and diagnostics | verified |
| `state-machine.state-entry-actions` | complete; [example](capabilities/state-machine-state-entry-actions/example.animl), independent conformance and diagnostics | skip-noted |
| `state-machine.state-exit-actions` | complete; [example](capabilities/state-machine-state-exit-actions/example.animl), independent conformance and diagnostics | skip-noted |
| `state-machine.state-random` | complete; [example](capabilities/state-machine-state-random/example.animl), independent conformance and diagnostics | skip-noted |
| `state-machine.state-reset` | complete; [example](capabilities/state-machine-state-reset/example.animl), independent conformance and diagnostics | verified |
| `state-machine.transition-actions` | complete; [example](capabilities/state-machine-transition-actions/example.animl), independent conformance and diagnostics | skip-noted |
| `state-machine.transition-disabled` | complete; [example](capabilities/state-machine-transition-disabled/example.animl), independent conformance and diagnostics | verified |
| `state-machine.transition-duration-relative` | complete; [example](capabilities/state-machine-transition-duration-relative/example.animl), independent conformance and diagnostics | verified |
| `state-machine.transition-end-actions` | complete; [example](capabilities/state-machine-transition-end-actions/example.animl), independent conformance and diagnostics | skip-noted |
| `state-machine.transition-random-weight` | complete; [example](capabilities/state-machine-transition-random-weight/example.animl), independent conformance and diagnostics | skip-noted |
| previous-value / on-change (`changed`, `increased`, `decreased`) | complete; `machine-change-*` cases, one any-state transition for arbitrary counts | skip-noted: no matching native primitive |

## Problems / oracle limits

No known failing requested checks. The eight skip notes are intentional observation/semantic limits, not native parity:

- `state-entry-actions`, `state-exit-actions`, `transition-actions`, `transition-end-actions`: Anima's queued compound listener transaction has next-input-stage visibility; native fire actions and an end-of-advance dump do not expose that same queue/barrier. Independent conformance covers ordering, initial entry, completion and interruption.
- `state-random`, `transition-random-weight`: native state selection exposes no seed/PRNG matching Anima's specified LCG; CLI `--seed` affects scripts' math.random. Exact deterministic sequences cannot be compared to uncontrolled native choices.
- `condition-focus`: native commands cannot install the arbitrary host reader with the same document IDs. Actual DOM/key ownership parity belongs to focus integration, not this pure condition hook.
- Previous-value primitive: no faithful native single-edge comparator; a state ladder or script would test a substitute.

All skip files name independent tests and the specific limit. Native component comparison maps a named scoped numeric input to a native component numeric property; it verifies comparison, not identical component namespaces. Native artboard comparison uses corresponding grid/pixel units.
