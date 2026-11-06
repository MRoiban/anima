# P4c-2 input handoff

The implementation is confined to `modules/input/`; shared edits are generated wiring, scaffolder
outputs, spec/host documentation, oracle evidence and work logs. No shared implementation or
shared tests were edited. No push, PR or merge. No runtime dependencies. No .riv read/conversion,
Rive source or Rive documentation text copied. All 54 requested rows were scaffolded with dry
runs before implementation. `rows.json` records the exact requested set and evidence state.

## Required shared integration

`git apply modules/input/integration.patch` adds three small call sites plus updated exact
registry/corpus expectations. It changes:

- `packages/core/src/script.ts`: imports `inputCommand`; the default switch case delegates and
  performs step(0) when handled. This is tooling-only and does not enter the base web bundle.
- `packages/markup/src/compile.ts`: applies `inputCompiler.form` to non-node forms, then
  `inputCompiler.listener` after building a listener. Generated module-hooks already declares it.
- `packages/markup/src/decompile.ts`: applies `inputCompiler.layout` to listeners.
- `packages/markup/test/names.test.ts`: adds new exact group attribute/static key entries.
- `packages/markup/test/corpus.test.ts`: updates the exact completed-case census 81 → 84 (three new
  drag probes). No runtime/test limit, timeout, byte budget or comparison method changes.

The patch was applied in a temporary source copy and verified with
`node modules/input/verify-integration.ts` (compile/decompile + commands + drag writes + key filter),
Prettier, ESLint, and `npm run test:scope -- input conformance oracle`: **460 passing, 87 pending**,
including both browser engines. The real checkout retains the shared-code ownership boundary:
**457 passing, 3 failing, 87 pending**. Its only failures are the two registry lists and the corpus
census. Pending probes are never counted as successful.

## Focus/machine integration

- The controller exposes `keyTarget?: string`; the focus module can set a local node ID. Explicit
  `key(...,{target})` wins. Native Enter/Space behavior remains in the base host.
- Input captures DOM pointer events and stops the legacy pointer handler, preventing duplicate
  delivery. A focus module relying on a later DOM pointer handler must hook into input routing or
  attach before input. The current web module does not assign scene focus itself.
- Rich keyboard/gamepad routing across a focused component boundary is not implemented here;
  pointer IDs/buttons do route through the components extension's `players` map, with inverse
  world transforms, ancestor gating and occlusion. Concurrent contacts can share an instance without
  reducing IDs to the legacy pointer.
- Components rejects non-legacy input event names during its resolve pass. Input refines only
  that exact unknown-event diagnostic for its recognized names. Unknown dotted component events
  retain their errors. A future generic event registry would remove this narrow compatibility step.
- `solo` and `collapsed` contribute renderer-neutral visibility and ancestor dependencies; they
  do not change machine clocks. Animated nonintegral Solo selections select no child.

## Remaining evidence and limitations

Strict completed rows: 3/54 (`input.pointer-drag`, `input.pointer-drag-start`, `input.pointer-drag-end`).
The broad controller/host implementation exists for the other rows, but the per-row capability
checklists remain incomplete: 51 standard conformance probes and 36 oracle probes are pending;
15 host/OS-only oracle skips are documented with browser evidence. There are also 11 completed
module golden-vector cases and 44 deterministic unit tests, plus 56 browser tests across both
engines. Do not promote all 54 inventory rows or tick P4c-2 based on the scaffold.

The controller tracks one pressed button per contact ID, not simultaneous buttons on one ID.
Native touch-page scrolling is checked through touch-action, not physical gesture automation.
Canvas coordinate fallback supports axis-aligned viewports; SVG uses the actual screen matrix.
Opted-in browser gamepad polling stops after disconnect; re-enable it after reconnect. All batch
records are scene-wide; focused descendant gamepad routing still needs focus integration.

## Measurements and remaining checks

`tools/size.ts`: core+web 19012 B (+0 from daa54a7); input 6056/8192 B; full-featured 57405 B;
Rive-class 61538 B. All budgets pass. Final `tools/perf.ts` lines:

```
compile: bell 2.70 ms; all 9040 prefixes 805 ms
frame: bell 52.5 µs; composite 35.2 µs
frame: toolbar 66.6 µs (step + draw, 4 instances)
compile: toolbar 5.23 ms
```

The same-session baseline archive measured bell 2.65 ms/1054 ms, frames 50.6/30.2/33.8 µs,
then toolbar compile 4.21 ms. Values varied during concurrent builds/tests; these are observations,
not a claim of a measured speedup or absence of a frame-cost regression. Browser base bytes are exact.

Type checks passed for core, core tests, markup, markup tests, web, web tests, CLI and tooling.
`npx prettier --check .`, `npx eslint .`, `node tools/modules.ts --check`,
`node tools/build-animl.ts --check`, `node tools/build-web.ts --check`, `git diff --check`,
module-arrival-order corpus checks and parity checks pass. Schema regenerated with the registry.
No full npm run check was substituted for scoped development tests.
