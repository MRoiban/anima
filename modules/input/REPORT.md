Oracle follow-up: the original 36 pending probes and all earlier skips are now disposed in
[ORACLE-RESULTS.md](ORACLE-RESULTS.md). The implementation handoff below records the earlier state.

# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

## STATUS

P4c-4 integration complete on `t3/integrate-input-focus-machine`. Input commit `0dd104a` merged
at `55df681`; final implementation is in the following local integration commit. No push, PR or
remote merge. Inventory statuses unchanged. No Rive commands, source copying, `.riv` access or
runtime dependency additions. The separate native oracle pass is still required.

Input implementation evidence: **54/54**. Strictly complete: **18/54**, up from 3 — the three
retained captured drag rows plus 15 documented host/OS-only oracle skips. The other **36** retain
pending oracle probes with real scenes; they are not counted as complete. `rows.json` gives the
exact set and evidence paths. All 51 pending standard conformance scaffolds were replaced;
two additional independent cases cover focus/machine/collapse and component key capture/consume.

## VERIFY

- `npm run test:scope -- input focus machine components conformance --no-browser`: **1471 passed,
  42 files**, final run after registry fixes. The unchanged prefix timing test passes.
- `npm run test:scope -- core markup cli --no-browser`: **2000 passed, 101 files**. Includes
  all 12 module arrival orders, strict schema checks, 0.1 SVG compatibility, player/loader,
  compiler/decompiler, CLI and conformance checks.
- `npx vitest run --project browser --maxWorkers=2 modules/input/test/web modules/focus/test/web
  modules/machine/test/web modules/components/test/web packages/web/test`: **180 passed, 7 files,
  zero skips**, Chromium and Firefox. Includes **16 integration checks**: both engines and both
  separately bundled registration orders, one key route, arrows/Tab/exit/re-entry, native
  Enter/Space, actual pointer capture plus focus, focus/blur waking settled machine guards,
  focused component keys with capture/consume and unknown dotted event rejection.
- Original focus decompile regressions: **17/17** pass with independent structural recovery and
  exact compile/decompile comparisons. The new focus/machine integration also round-trips.
- All 54 row examples: paired compile/decompile, strict Ajv schema, independent script snapshots
  and diagnostics. CLI `sample` run on all 54 AniML examples matches their exact expected
  snapshots; `schema listener` includes input fields. `node modules/input/verify-integration.ts`
  also passes.
- `npm run typecheck`, `npx prettier --check .`, `npx eslint .`,
  `node tools/modules.ts --check`, `node tools/parity.ts --check`,
  `node tools/build-animl.ts --check` (**209 files**), `node tools/build-web.ts --check`
  (**18 entries**) and `git diff --check`: pass. Standalone demo rebuilt.
- Full `npm run check` and native oracle capture were not run; no claim of either.

## METRIC

All bytes use the unchanged `tools/size.ts` min+gzip measurement and existing budgets.

| Item | Bytes | Budget / comparison |
| --- | ---: | --- |
| input | 5978 | 8192 |
| focus | 3846 | 4096 |
| machine | 5736 | 8192 |
| components | 4039 | 4096 |
| markup | 7663 | 8192 |
| core + web | 19048 | **+0 from edf9eec**; +36 from main's 19012 (machine's earlier hooks) |
| full-featured SVG | 64848 | 102400 |
| Rive-class total | 68961 | 256000 |

Final `node tools/perf.ts`, unchanged workload and measuring method:

```text
compile: bell 4.22 ms; all 9040 prefixes 1204 ms
frame: bell 64.9 µs; composite 37.6 µs
frame: toolbar 39.8 µs (step + draw, 4 instances)
compile: toolbar 5.80 ms
```

Same-session archived `edf9eec`, then integration, using each tree's unchanged `tools/perf.ts`:

```text
baseline compile: bell 7.01 ms; all 9040 prefixes 2016 ms
baseline frame: bell 82.9 µs; composite 32.7 µs
baseline frame: toolbar 40.9 µs (step + draw, 4 instances)
baseline compile: toolbar 4.65 ms
integration compile: bell 4.96 ms; all 9040 prefixes 1321 ms
integration frame: bell 59.5 µs; composite 32.5 µs
integration frame: toolbar 45.5 µs (step + draw, 4 instances)
integration compile: toolbar 5.33 ms
```

Host load varied during these observations, including work in another checkout. These numbers
are not evidence of an overall speedup or absence of a frame-cost regression. In particular the
comparison toolbar frame/compile values are higher. No performance limit or method was changed.

## DEVIATIONS

- The reported focus drop was in the independent structural test reader and its element
  allowlist. Production decompile already emitted `<focus>` and compiled it exactly. The reader
  now independently recovers every focus field and its two aliases; it still compares every
  value. Node objects without structural descriptors now use the generic JSON attribute path,
  covered separately. No focus-specific compiler/decompiler hook was added.
- Generic listener compounds use JSON, so `write='{"x":"dragX"}'` replaces the hand patch's
  assignment syntax. Empty `set=""` represents the normalization of a write-only listener.
  The obsolete hand patch and input hook slot are removed; the public markup adapter is an
  empty compatibility export. Shared handwritten implementation changes are only the sample
  dispatcher and narrow generic compiler/decompiler handling (see MODULES §3 and ANIML).
- Input now returns a composed listener declaration instead of mutating the base array's `of`;
  broader arrival-order testing found and verifies this fix. Components owns a fresh event-kind
  registry per composition; focus/input extend it rather than removing diagnostics.
- Exact expectations were extended only for new items: conformance census **135 → 191**
  (+3 input drag, +51 completed input probes, +2 integration cases); group attribute list adds
  `opaque`, `cursor`, `pointerEnabled`, `collapsed`, `solo`; static circle list adds `opaque`,
  `cursor`; independent emitted-element allowlist adds `focus`. The fixture still checks every
  node attribute, now with an actual input attribute fixture. No existing limit, budget,
  timeout, oracle comparison, numeric tolerance or coverage assertion was weakened.
- During development combined browser/build load exceeded the existing prefix timeout. Final
  unit and browser runs were separated with the CI worker bound, and the unchanged limit passes.
  The first seam browser failures were new-test issues: `load` returns diagnostics, and Firefox
  screen matrices have fractional rounding; assertions use the actual diagnostic contract and
  the existing 1e-6 conformance scale. The first full browser run also caught the stale demo;
  rebuild plus the complete rerun is green.

## PROBLEMS

No known failing requested check. Native oracle completion remains **36 pending**, intentionally
reserved for the separate pass; 15 existing skips describe host/OS behavior with no faithful
headless comparison. Existing focus oracle notes remain for the phase owner to revisit.

Retained input limits: one pressed button per contact ID; physical page touch scrolling is
verified through touch-action rather than real device gestures; canvas coordinate fallback is
axis-aligned; gamepad batches are scene-wide rather than routed to a focused descendant.
Phase-wide benchmark, CI and oracle completion remain with the orchestrator.
