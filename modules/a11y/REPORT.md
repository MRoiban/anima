# P3b-7 current implementation report

Status: **partial — stopped at the fixed runtime budget guard**. Branch
`t3/complete-a11y-core`. No rows are closed; all parity statuses remain unchanged.
The shared `SemanticNode` types and `test/fixtures/tree.json` are unchanged.

## Bounded changes

- Visit nested component players and repeat items at their owning node, preserving
  authored forest/sibling order and dotted ids. Shrink/hide invalidates the tree.
- Union child world-space boxes for unpainted groups; preserve explicit overrides;
  use a world-origin point for an empty node. These are simple geometry bounds,
  not complete painted bounds for paths, strokes or semantic child overrides.
- Invalidate a cached static tree when `a11y-actions` first registers. Existing
  signatures reuse snapshots across unchanged reads/steps and unrelated changes.
- Suppress editing actions for semantic readonly and read-only input/data bindings
  (including list length). Keep eligible focus actions. Queue bool toggles, so
  two taps before one step toggle twice. Explicit activation still takes precedence.
- Gate computed diagnostic hints with `VERBOSE`; diagnostic codes/pointers and
  verbose tooling messages remain unchanged. No module dependencies were added.

## Measured stop and ownership

| Size (min+gzip B) | Before | Kept | Guard |
|---|---:|---:|---:|
| a11y | 1,983 | 2,038 | 2,048 |
| a11y-actions (over a11y) | 836 | 826 | 1,024 |
| markup-a11y | 971 | 971 | 1,024 |
| markup (test-only edits) | 8,008 | 8,008 | 8,192 |
| focus (source untouched) | 3,925 | 3,925 | 4,096 |
| core+web | 20,561 | 20,561 | 20,561 |
| data (source untouched) | 8,025 | 8,025 | must not grow |
| bind (source untouched) | 2,034 | 2,034 | must not grow |
| components (source untouched) | 4,053 | 4,053 | must not grow |
| full-featured | 115,192 | 115,229 | 131,072 |
| all renderer classes | 120,697 | 120,735 | 256,000 |

Measured rounds: baseline 1,983/836; ordering + late-registration + hint gating
1,961/839; action edges 1,961/820; simple group union 2,038/826. Adding just basic
centered-stroke padding to the latter measured **2,104/826**: base exceeded its
fixed budget by **56 B**. This probe did not yet handle exact cubic extrema,
miter joins or fixed strokes. It was reverted; no further behavior expansion was
made. No budgets/tools/measurement inputs/benchmark records/findings were changed,
and no third runtime module was added. Current base headroom is 10 B.

The canonical ticket listed components at 4,051 B, but this untouched checkout
measured 4,053 B both before and after. The absolute 4,051 B guard is already
exceeded by 2 B at HEAD; this change introduces no additional growth. The data and
bind starting measurements also differ slightly from the canonical numbers.

There is no exported runtime painted/path-extrema bounds helper. The private
`packages/cli/src/glyphs.ts` helper is tooling code; importing it would cross the
pure runtime/tooling seam. A shared extraction would require orchestrator ownership
and a fresh size round. This work reused `drawFrame`, `world`, `visible`, matrix
helpers, parse/flatten, `clamp` and the existing tree/cache registry seam.

## Evidence and verification

- `test/core/semantics.test.ts`: unchanged shared fixture, cached reads, checkbox/
  slider actions, basic ancestor retarget, diffs, root semantics and filtered
  `semantics mute` inspection.
- `test/core/edges.test.ts`: late companion registration after a cached static
  read (isolated process), real read-only list-length data binding, semantic
  readonly, two queued data taps, nested/repeated ordering and count shrink.
- `test/core/a11y-tree-bounds.test.ts`: independently calculated translated group
  union/override/empty point, negative box diagnostics in JSON and AniML.
- `spec/conformance/a11y-tree-bounds`: independent numeric bounds expectations.
- `spec/conformance/a11y-tree-visibility`: ordered nested/repeat ids before and
  after shrink/hide, observed through `snapshot --semantics`.
- `spec/conformance/a11y-action-edges`: readonly descriptions/actions, data edits
  and rejected readonly dispatch, observed through semantic snapshots.
- `examples/painted-groups.animl` + `.ani`, existing contract example, capability
  bounds example pair; registry spellings remain in `core/registry.ts`.
- `oracle/roles/` + `test/core/oracle.test.ts`: authored native RML and raw
  captures, 16 roles × 3 snapshots = **48 projected nodes**, exact roles/labels/
  bounds and seven state projections (bounds maximum difference 0). Initial
  state-entry focus on button, idempotent target, then next to checkbox. State
  projections include mixed, toggled/pressed, selected, expanded and readonly.
  This is module-owned because the frozen central oracle has no semantic-tree
  comparison adapter. Native dumps have no action list; no native tap/increase/
  decrease equivalence is claimed. No existing finding was edited.

Frozen-source verification:

| Command | Result |
|---|---|
| `VITEST_MAX_WORKERS=2 npm run test:scope -- a11y a11y-actions focus conformance oracle` | 1,847 pass / 0 fail / 33 TODO; 12 files pass / 1 skip; both focus browser engines |
| `VITEST_MAX_WORKERS=1 npm run test:scope -- changed` | **7,530 pass / 0 fail / 45 TODO**; 230 files pass / 13 skip; 1,300.78 s |
| `VITEST_MAX_WORKERS=2 npm run test:scope -- markup --no-browser` | 2,463 pass / 0 fail; 15 files |
| isolated browser rechecks, one worker | 24 pass / 0 fail / 96 filtered; 3 files |
| `node tools/oracle.ts --strict` | exit 0; existing 253 cases / 449 samples / 0 failed completed samples; findings retained |
| `node tools/size.ts` | exit 0; every tool-enforced budget passes; canonical components discrepancy documented above |
| `node tools/perf.ts` | exit 0; shared-load measurements only |
| `npm run typecheck` + final `tsc -p packages/markup/test` | exit 0; all nine projects, followed by the amended independent-reader check |
| targeted ESLint / Prettier | exit 0 |
| `node tools/modules.ts --check` / `node tools/parity.ts --check` | exit 0; no stale wiring/views |
| AniML / browser artifact `--check` | exit 0 after explicit rebuild; 488 AniML sources / 38 browser entries |

Evidence: `verification/p3b7/`. No failing test/expectation was removed and no
limit changed. The 45 TODOs remain pending; no row is promoted because a scope passes.

## Per-row closure evidence

Each entry below remains **open/planned**. Evidence is scoped, not a completion
claim. The complete definition of done (including independent conformance/native
coverage) is not yet satisfied for any newly touched row.

| Row | Current evidence | Remaining reason |
|---|---|---|
| `a11y.ancestor-focus` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.check-checked` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts`; `oracle/roles` matching checked/mixed/toggled/selected/expanded states | Complete before/after state-action conformance/native captures pending. |
| `a11y.check-mixed` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts`; `oracle/roles` matching checked/mixed/toggled/selected/expanded states | Complete before/after state-action conformance/native captures pending. |
| `a11y.check-unchecked` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts`; `oracle/roles` matching checked/mixed/toggled/selected/expanded states | Complete before/after state-action conformance/native captures pending. |
| `a11y.focus-action-target` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.focus-action-traversal` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.focus-condition` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.focus-retarget` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.headless-inspection` | `semantics.test.ts`; `test/cli/sample.test.ts`; semantic conformance snapshots | Complete filtered-output conformance and native command/action coverage pending. |
| `a11y.property-heading-level` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Complete dynamic-property/heading conformance and native captures pending. |
| `a11y.property-hint` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Complete dynamic-property/heading conformance and native captures pending. |
| `a11y.property-label` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Complete dynamic-property/heading conformance and native captures pending. |
| `a11y.property-value` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Complete dynamic-property/heading conformance and native captures pending. |
| `a11y.role-alert-dialog` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-checkbox` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-dialog` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-group` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-link` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-list` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-list-item` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-none` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-radio-button` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-radio-group` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-slider` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-tab` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-tab-list` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.role-text` | Registry/diagnostics; `test/core/oracle.test.ts`, `oracle/roles` for the 16 captured roles | Role-specific conformance/actions/defaults incomplete; none/heading native probes pending. |
| `a11y.semantic-diffs` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Structural/reorder and native diff evidence pending. |
| `a11y.spatial-focus` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.state-disabled` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Dedicated conformance/default/native coverage pending. |
| `a11y.state-expanded` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts`; `oracle/roles` matching checked/mixed/toggled/selected/expanded states | Complete before/after state-action conformance/native captures pending. |
| `a11y.state-focused` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.state-hidden` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Dedicated conformance/default/native coverage pending. |
| `a11y.state-live-region` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Core native/conformance evidence incomplete; DOM half belongs to P3b-8. |
| `a11y.state-modal` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Dedicated conformance/default/native coverage pending. |
| `a11y.state-read-only` | `semantics.test.ts`, `edges.test.ts`; conformance `a11y-action-edges` | Native tap/range actions; repeated range writes and narrower-clamp no-op reporting pending. |
| `a11y.state-required` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Dedicated conformance/default/native coverage pending. |
| `a11y.state-selected` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts`; `oracle/roles` matching checked/mixed/toggled/selected/expanded states | Complete before/after state-action conformance/native captures pending. |
| `a11y.state-toggled` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts`; `oracle/roles` matching checked/mixed/toggled/selected/expanded states | Complete before/after state-action conformance/native captures pending. |
| `a11y.tab-focus` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.trait-checkable` | `SPEC.md` traits/defaults; fixture; native role/state projection | Complete role/trait/default/action matrix and independent conformance pending. |
| `a11y.trait-enablable` | `SPEC.md` traits/defaults; fixture; native role/state projection | Complete role/trait/default/action matrix and independent conformance pending. |
| `a11y.trait-expandable` | `SPEC.md` traits/defaults; fixture; native role/state projection | Complete role/trait/default/action matrix and independent conformance pending. |
| `a11y.trait-focusable` | `test/core/semantics.test.ts`; existing focus unit tests; `oracle/roles` target/next projection | Dotted repeat focus, traversal restrictions, ancestor conditions and full native focus policies pending. |
| `a11y.trait-requirable` | `SPEC.md` traits/defaults; fixture; native role/state projection | Complete role/trait/default/action matrix and independent conformance pending. |
| `a11y.trait-selectable` | `SPEC.md` traits/defaults; fixture; native role/state projection | Complete role/trait/default/action matrix and independent conformance pending. |
| `a11y.trait-toggleable` | `SPEC.md` traits/defaults; fixture; native role/state projection | Complete role/trait/default/action matrix and independent conformance pending. |
| `a11y.tree-bounds` | `a11y-tree-bounds.test.ts`; conformance `a11y-tree-bounds`; paired example | Exact path/stroke/native bounds pending; centered-stroke probe exceeds budget. |
| `a11y.tree-visibility` | `edges.test.ts`; conformance `a11y-tree-visibility` | Solo/native visibility and full semantic traversal/modal evidence pending. |
| `host-api.low-level-semantics` | `test/core/semantics.test.ts`; registry and `diagnostics.test.ts` | Core native/conformance evidence incomplete; DOM half belongs to P3b-8. |
| `input.semantic-decrease` | `semantics.test.ts`, `edges.test.ts`; conformance `a11y-action-edges` | Native tap/range actions; repeated range writes and narrower-clamp no-op reporting pending. |
| `input.semantic-increase` | `semantics.test.ts`, `edges.test.ts`; conformance `a11y-action-edges` | Native tap/range actions; repeated range writes and narrower-clamp no-op reporting pending. |
| `input.semantic-tap` | `semantics.test.ts`, `edges.test.ts`; conformance `a11y-action-edges` | Native tap/range actions; repeated range writes and narrower-clamp no-op reporting pending. |
| `tooling.headless-semantic-actions` | `semantics.test.ts`, `edges.test.ts`; conformance `a11y-action-edges` | Native tap/range actions; repeated range writes and narrower-clamp no-op reporting pending. |
| `tooling.headless-semantics` | `semantics.test.ts`; `test/cli/sample.test.ts`; semantic conformance snapshots | Complete filtered-output conformance and native command/action coverage pending. |

## Remaining implementation and deviations

- Exact curve/stroke bounds; painted group unions independent of child semantic
  overrides; clipping/paint extents and Solo visibility remain partial.
- Nested/repeated dotted focus and traversal ordering, semantic disabled/hidden/modal
  traversal restrictions, transparent modal scope evidence, focus retarget edge cases,
  ancestor machine focus conditions and structural diffs need completion.
- Collection still computes entries/geometry/signatures on reads; dependency-driven
  invalidation is not implemented. A replacement owner with identical resolved
  signature may retain old action entries. Late first action registration is fixed;
  late focus registration on an already compiled model remains open.
- Bool taps compose correctly; multiple queued range increments still read the same
  committed value, and a narrower input clamp may make a reported edit a no-op.
- Native actions and the remaining state/focus/property cases are not complete.
  `tests/oracle/a11y-tree-bounds/todo.json` stays pending. No skip claims that the
  local CLI cannot dump semantics.
- P3b-8 owns overlay/policy/focus-sync/roving/host DOM rows and DOM halves of live
  region and low-level semantics. This ticket did not touch `a11y-dom` or focus core.
- Shared corpus census changed 440→443 solely for the three active conformance
  probes. Its independent decompile reader now decodes node semantic children;
  those test-only changes are necessary to validate the new corpus documents. Adapters/tables were regenerated; no generated file was hand-edited.
- Design not completed because the user required a stop at the measured fixed
  budget. The core/action seam remains as decided. Research rationale remains
  `docs/research/rive-format-and-graph.md` (registry ownership),
  `rive-animation-and-state.md` (queued actions), and `rive-web-runtime.md`
  (core semantics versus platform overlay). No external algorithm was ported.

## Failures and limits

The initial size run failed because dependencies were absent; `npm ci` restored
local tooling. First new unit tests had three authoring/expectation mistakes
(`register` versus `registerModule`, `<use>` versus `<instance>`, and omitted eligible
focus actions on readonly controls); all are corrected, and the rerun passed.
The first native attempt had no state machine and used unsupported command-file
`focus`; the second had inert keys without initial focus. An explicit entry-state
focus target and typed key listeners fixed the capture. Earlier failed sessions are
saved in verification, never counted as passing. The audit helper initially hit
Node's default stdout buffer while reading the inventory; a 4 MiB buffer fixed
the read-only audit. Native reference JSON whitespace was formatted without
changing values; no existing references or findings changed.

`node tools/perf.ts` exits 0: bell compile 6.53 ms, prefix sweep 1,740 ms;
bell/composite/toolbar frames 102.8/70.3/80.3 µs; toolbar compile 11.08 ms.
These are shared-load measurements, not paired quiet evidence for the ≤3% target.
Pages without a11y have unchanged runtime sources and the same core+web bytes;
strict performance non-regression remains unverified. No push/PR/publication.


The first broad changed run was interrupted after finding two stale browser-cache
assertions, one 5-second asset timeout, a 30-second markup-hook startup timeout,
and three genuine independent-reader omissions. The artifacts were explicitly
rebuilt (a `--check` prints “Built” but does not replace stale existing files), and
the reader now decodes semantic children. The complete markup scope then passed
2,463/2,463 tests; isolated browser rechecks passed 24/24 (96 filtered), including
the unchanged asset test and all markup-hook cases. The timeout classification is
supported by these isolated passes; no limits were raised. The fresh one-worker
changed scope passed 7,530 tests with 45 pending TODOs and zero failures. First-run failure logs are retained.
