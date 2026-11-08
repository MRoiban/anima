# P7-2 implementation report

## Status

Done for this ticket. The optional layout entry implements the decided single-line subset,
including initial boxes, nested sizing, intrinsic participants, binding/timeline addresses,
previous-step guard reads, cached container arrangement and neutral drawing geometry. The button
example hugs its data-bound label plus padding. Reflow animation remains P7-4's separate entry.

## Branch and head

Branch: `t3/p7-2-implement-ticket`, based on `049f5d66`. This report is committed with the
implementation; the handoff message supplies the resulting head SHA. No push or PR was made.

## Rows closed and left

Closed: `layout.containers`, `layout.flex-direction`, `layout.flex-justify`,
`layout.flex-align-items`, `layout.self-alignment`, `layout.alignment`, `layout.spacing`,
`layout.fixed-sizing`, `layout.hug-sizing`, `layout.fill-sizing`, `layout.size-bounds`,
`layout.visibility`, `layout.participants`, `layout.intrinsic`, `layout.paint`, `data.bind-layout`.
No ticket rows remain planned. Each has registry metadata, both syntaxes, examples, conformance
and a completed native comparison or an evidenced intentional difference.

## Seams outside module ownership

All handwritten seams are marked `seam(P7-2)` in the affected files.

- `packages/core/src/load.ts`: permit an initializer-only nesting wrapper to return undefined;
  layout initializes boxes without changing base runtime code.
- `packages/markup/src/compile.ts`: compile registered container children, preserve their source
  origins, accept nested nonpaint fields, and share the disjoint node/structural field cache to
  keep the shared entry from growing. The cache still clears between compilations.
- `packages/markup/src/names.ts`: optional module-owned layout field enumeration and safe nested
  nonpaint attribute lookup.
- `packages/markup/test/{compile,corpus,decompile,names}.test.ts`: independent layout attribute
  census, registered-container recovery, spacing/scalar-corner/compound-guard recovery, and the
  updated completed corpus count (579 → 600).
- `modules/machine/core/{types,runtime}.ts`: optional layout operand reader. Layout extends the
  registered machine guard schema and validates its targets in its own module.
- `modules/paint/core/geometry.ts`: rectangle corners belong to paint's rectangle outline;
  another node type may independently own a corners property.
- `modules/canvas/web/renderer.ts`: draw children after a painted container; isolate its combined
  background and children for opacity, and avoid traversing empty child lists.
- `modules/data/manifest.ts` and its obsolete `data-bind-layout` capability/test/invalid scaffold:
  relocate that ticket-owned row to layout, removing its pending duplicate. The spec marker is
  relocated to the layout section as well.

Module adapters, all-entry imports, package exports, markup hooks, module tables and JSON Schema
were regenerated. Parity inventory/views record the sixteen completed rows. No measurement tool,
measurement input list, old oracle threshold, finding, benchmark record or module ceiling changed.

## Verification

The committed `verification/` files contain the size/performance records and test summary.

| Command | Result |
| --- | --- |
| `npm run test:scope -- layout --browser=chromium` | 3,219 passed; 588 filtered/skipped; 8 files passed |
| `npm run test:scope -- layout --browser=firefox` | 3,219 passed; 588 filtered/skipped; 8 files passed |
| `npm run test:scope -- layout --no-browser` after the final guard fixture | 3,217 passed; 586 filtered/skipped; 7 files passed |
| Final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed` | 9,507 passed; 0 failed; 51 inherited TODO; 306 files passed, 12 skipped; both engines |
| Earlier complete `npm run test:scope -- changed --no-browser` | 6,421 passed; 51 inherited TODO; 257 files passed, 12 skipped |
| `node tools/oracle.ts --strict` | exit 0; 324 completed cases / 540 samples pass; 309 legacy manifest entries unchanged |
| `npm run typecheck`; changed-file ESLint | exit 0 |
| `npm run gen`; module/parity/AniML/web artifact checks | pass; 654 AniML files checked |
| `node tools/size.ts` | exit 0; every entry and all six gates pass |
| `node tools/perf.ts` | exit 0; controlled ≤3% comparison unverified under shared load |

The first mixed changed run had 9,453 passes, 32 failures and 52 inherited TODO. Twenty failures
were missing independent-reader/census support, corrected and verified (1,851 tests in the two
files). Twelve Firefox timeouts across eight files passed unchanged-limit isolated retries
(105 tests). A subsequent unit run had three load-sensitive failures in scaffolding/raster tests;
isolated retries passed 4/4 and 2/2, then the complete unit run passed. No timeout or assertion
limit was raised. Removing the superseded pending data-layout scaffold explains 52 → 51 TODO.

Fifteen new native cases / sixteen frames are completed. The two circle probes measure max
channel delta 96 and 101 pixels above 16 (0.175347%), all within 0.495 px of the analytic boundary;
new budgets are max 100 / 0.18%. Other new cases use max 2 / 0%, with measured max 0 (paint max 1).
Raw independent captures, evidence-backed skips and the measured values are retained; no old
limits or findings were altered. See [ORACLES.md](ORACLES.md).

## Sizes before → after

Bytes are minified+gzip, measured from clean `049f5d66` and the finished implementation. Negative
incremental sizes represent compression interaction in an entry's declared subtraction context.

| Changed or affected entry | Before → after | Budget |
| --- | ---: | ---: |
| layout | absent → 3,429 | 4,096 |
| markup-layout | absent → 84 | 512 |
| markup | 7,341 → 7,337 | 8,192; ticket requires no growth |
| markup-libraries | 2,176 → 2,175 | 2,176 |
| paint | 4,042 → 4,045 | 4,416 |
| surface | 7,660 → 7,665 | 8,192 |
| canvas | 5,379 → 5,386 | 5,888 |
| machine | 6,131 → 6,145 | 6,720 |
| markup-hooks | 4,511 → 4,502 | 4,544 |
| markup-animation | 934 → 931 | 1,536 |
| paint-sampling | 1,098 → 1,103 | 1,216 |
| markup-text | 532 → 529 | 1,024 |
| markup-text-input | −44 → −43 | 192 |
| data (scaffold relocation only) | 6,470 → 6,470 | 7,040 |
| text (read-only integration) | 6,144 → 6,144 | 6,144 |

| Gate | Before → after | Ceiling |
| --- | ---: | ---: |
| core+web | 21,136 → 21,136 | 24,576 |
| largest scene (30 existing inputs) | 53,857 → 53,857 | 65,536 |
| app-UI | 98,890 → 98,906 | 131,072 |
| runtime sum | 120,281 → 123,698 | 163,840 |
| authoring | 14,742 → 14,839 | **15,360 ticket cap**; 16,384 owner gate |
| Rive-class | 130,077 → 133,417 | 256,000 |

The existing app-UI measurement input list excludes the new layout entry; it was not edited.
A supplementary union with layout measures **102,217 B**. The new button scene measures
**42,999 B**. P7-4 and host-fit must be added by the orchestrator when measuring the phase union.
The clean base's measured authoring value is 14,742, correcting the stale 14,717 in DESIGN/Now.

## Deviations and reasons

- No change to the decided algorithm or scope. It follows CSS's signed-total bound-freezing
  rule with independent Anima vectors; it does not port the native engine.
- Native child self-alignment was accepted but ineffective in the permitted CLI; its raw result
  is an evidenced unavailable counterpart. A mixed min/max fill probe yields native 10.5/2.5
  versus Anima 9/4; the intentional algorithm difference is normative and retained as a skip.
  Baseline is tested independently, without claiming equivalence to native positional alignment.
- As explicitly allowed in the brief, the local adapter uses the existing measured text box
  until P7-1 installs `measureText(player, nodeId, maxWidth?)`. That future merged-hook path is
  unverified here; explicit width/maxWidth are already passed by the adapter. It reads the hook
  from the registered text module, preserving optional and separately bundled registration.
- Image participants retain the assets module's required authored viewport as their default
  intrinsic size; explicit `hug` selects declared asset dimensions, falling back to that viewport.
  This compatibility choice is explicit in the normative contract and tested independently.
- Boxes initialize from the initial pose so paused icons are laid out before their first draw.
  Bindings still settle through `step(0)`, and guards observe the previous completed boxes.

## Problems and integration notes

No known failing implementation checks remain. The controlled performance guard and the final
P7 aggregate measurement are orchestrator work. Current perf timings were collected under shared
load and establish no ≤3% claim. The phase milestone/PR has not been closed by this ticket.

Initial missing development dependencies were restored with `npm ci`. The scaffolder initially
chose the existing markup formatter's filename; it was restored immediately and the generated
layout adapter moved to `packages/markup/src/markup-layout.ts`. That formatter has no diff.
No native binary/build folder, scaffold documentation or third-party font is included.
