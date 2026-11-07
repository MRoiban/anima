# [P3b-9] Current accessibility closure report

Status: **partial**. Parity statuses stay **planned**; the final phase promotion
belongs to the orchestrator. This is the shared current row table for both a11y
and a11y-dom. Historical measurements remain in their verification folders.

## Kept changes

- 35 independent conformance/example pairs: 18 roles (16 plus none/heading),
  10 mutable states, bound data properties, role × state trait matrix, range
  actions, live regions, bound heading level and focus policy/conditions.
  `verification/p3b9/evidence.py` computes expectations without executing Anima;
  the normal compiler generates the `.ani` files. `closure.test.ts` adds filtered
  inspection and add/remove/change/reorder diff checks; CLI tests use real sample.
- Bind heading level to a numeric input/data path through the shared registry;
  JSON and AniML diagnostics cover missing/wrong-type bindings. Bound values must
  remain integers 1–6. A separate native binding probe matches level 2→4 after semantic tap; a native
  data dump independently confirms its source value is 4.
- In a11y-actions, filter focus targets by semantic hidden/disabled/modal policy,
  including the first read, and expose focused semantic ancestry to machine
  conditions. The wrappers install in either module arrival order. No source changes in focus,
  a11y-dom or protected runtime modules. The tooling-only decompiler now emits
  JSON for structural unions such as bound heading level, preserving round trips.
- Three authored native probes: 64 ordered nodes around tap/increase/decrease,
  plus seven before/six after roots for property/state projections. Existing 48-node
  references are unchanged. Labels/hints/text values, checked/mixed, toggle,
  selected, expanded, disabled, required, readonly, hidden and static heading
  metadata have native evidence; a third probe verifies dynamic heading level 2→4. Native trait masks remain stable over all four
  action captures. No native action-list equivalence is claimed.

## Measurements and checks

The first baseline size process overlapped editing and is discarded as a mixed-source
measurement. The before column is a clean tracked HEAD archive with its own workspace
package links. Both columns use the unchanged `node tools/size.ts`.

| Entry (min+gzip B) | Before | After | Guard |
|---|---:|---:|---:|
| core+web | 20,585 | 20,585 | 20,585 |
| a11y | 2,038 | 2,045 | 2,048 |
| a11y-actions | 826 | 960 | 1,024 |
| markup-a11y | 970 | 970 | 1,024 |
| a11y-dom (source unchanged) | 1,900 | 1,897 | 2,048 |
| focus (source unchanged) | 4,081 | 4,081 | 4,096 |
| markup (tooling-only serializer changed) | 8,007 | 8,007 | 8,192 |
| data / bind / components (source unchanged) | 7,982 / 2,036 / 4,053 | 7,982 / 2,036 / 4,053 | must not grow |
| full-featured | 118,861 | 119,005 | 131,072 |
| all renderer classes | 124,422 | 124,568 | 256,000 |

Shared-load perf, clean HEAD → changed source (not a controlled paired run): bell
compile 5.80 → 2.89 ms; 9,040-prefix sweep 1,390 → 1,118 ms; bell/composite/toolbar
frame 102.3/77.6/86.3 → 53.7/33.4/31.4 µs; toolbar compile 11.43 → 4.52 ms.
Commands exit 0; ≤3% non-regression remains unverified. No-a11y runtime sources and
base bytes are unchanged.

Verification logs are in `verification/p3b9/`. The requested scope passed 2,038
checks with 31 existing TODOs and no failures, including both browser engines.
Full markup verification passed 2,677 tests after the serializer fix. Twelve-order
module composition passes after fixing late wrapper installation. Typecheck,
ESLint, generation/wiring and strict oracle pass. Final
`VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **7,918 passed / 0 failed /
43 existing TODOs**, 239 files passed / 13 skipped, 483.30 s. Strict oracle:
**258 completed cases / 467 samples / 0 failed samples**, exit 0; existing findings
are retained. The final native heading test also passes in the owned recheck
(1,128 pass / 1 existing TODO). No load-only timeout remains unresolved.

The earlier changed run had 7,912 pass / 5 genuine failures / 43 TODOs: four
heading-union round-trip failures and one registration-order failure. These were
fixed, then markup, module-order and the entire changed scope passed. Earlier
formatting/census and TypeScript failures are retained in the verification excerpts.

## Findings and explicit limits

`oracle/roles/P3B9.md` records observed numbers without changing any finding record:
three focus-state differences in the action probe; native none wrappers remain
while Anima lifts children; native modal siblings remain while Anima prunes them.
The properties probe's control keeps native focus, so a universal native activation
focus policy is not inferred from the first probe.

Exact painted bounds are **not implemented**. Installed Chromium ignores
`getBBox({stroke:true})`: a round-stroked segment expects `[8,8,14,4]`, but returns
`[10,10,10,0]`; Firefox's stroke-inclusive bbox returns the expected box. The CLI
helper solves cubic centerline extrema but has no exact stroke-outline helper;
resvg bbox is conservative even for butt caps. No approximation is called exact.
The decided browser/tooling seam and why it stays out of the nearly full core are
specified in SPEC.md. Overlay/CLI continue to consume the existing core boxes.

Dependency-driven collection, same-signature owner replacement and repeat focus
remain open. A minimal owner-cache refresh raised the base from 2,045 to 2,050 B
(2 B over its 2,048 guard), so it was reverted. No budget was raised. The focus
source remains 4,081 B; a spatial split was not implemented, since retaining the
existing focus entry's behavior requires a backwards-compatible loading seam.
Module arrival order is verified across twelve permutations. Late focus on an
already compiled model still needs focus-configuration synthesis and cache invalidation.

Range actions still read committed values: two increases queued before one step
can collapse to one; a narrower input range can clamp a reported change away.
`verification/p3b9/gap-probes.txt` independently reproduces queued value 45 vs
expected 50, a false-positive change at the narrower maximum, missing repeat focus
items, and an unchanged cache after late focus registration.
String-property data bindings work, but the authorable input grammar remains
bool/number/trigger, so independent standalone string-input probes cannot be
claimed. These are explicitly open rows, not waived requirements.

No benchmark directory, oracle finding, measurement tool/input/budget, protected
module source, package publication, main push or PR was changed. Existing
components measures 4,053 B, already 2 B above the historical 4,051 B brief; the
before/after comparison must show no further growth. Performance numbers are
shared-load observations, not controlled ≤3% evidence.

## Current per-row closure evidence [P3b-9]

All statuses remain planned. **Ready** means the specified evidence is present,
subject to final phase-wide verification; **open** names a remaining technical gap.
Every active conformance directory above includes runnable AniML + generated ANI.
Native dispositions are in `oracle/SKIP-P3B9.md` and `oracle/roles/P3B9.md`;
DOM-only rows use `../a11y-dom/oracle/SKIP.md`. Registry and diagnostic coverage is
shared in `core/registry.ts` and `test/core/diagnostics.test.ts`.

44 closure-ready; 18 open; 62 unique rows. No status promotions.

| Row | Evidence (paths relative to this module / spec/conformance) | Disposition |
|---|---|---|
| `a11y.ancestor-focus` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.check-checked` | `a11y-state-checked[-mixed]` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.check-mixed` | `a11y-state-checked[-mixed]` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.check-unchecked` | `a11y-state-checked[-mixed]` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.focus-action-target` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.focus-action-traversal` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.focus-condition` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.focus-retarget` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.focus-sync` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `a11y.headless-inspection` | Filtered `semantics item` CLI and subtree inspection tests; all semantic snapshots | **Ready** (planned phase gate). |
| `a11y.overlay-policy` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `a11y.property-heading-level` | `a11y-properties-data`, `a11y-property-heading-level`; CLI `sample.test.ts`; native properties and dynamic heading captures | **Ready** (planned phase gate). |
| `a11y.property-hint` | `a11y-properties-data`, `a11y-property-heading-level`; CLI `sample.test.ts`; native properties and dynamic heading captures | **Open:** Dynamic data paths pass; standalone string input declarations do not exist in the current input grammar. |
| `a11y.property-label` | `a11y-properties-data`, `a11y-property-heading-level`; CLI `sample.test.ts`; native properties and dynamic heading captures | **Open:** Dynamic data paths pass; standalone string input declarations do not exist in the current input grammar. |
| `a11y.property-value` | `a11y-properties-data`, `a11y-property-heading-level`; CLI `sample.test.ts`; native properties and dynamic heading captures | **Open:** Dynamic data paths pass; standalone string input declarations do not exist in the current input grammar. |
| `a11y.role-alert-dialog` | `a11y-role-alert-dialog` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-checkbox` | `a11y-role-checkbox` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-dialog` | `a11y-role-dialog` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-group` | `a11y-role-group` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-link` | `a11y-role-link` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-list` | `a11y-role-list` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-list-item` | `a11y-role-list-item` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-none` | `a11y-role-none` example/conformance pair; `oracle/roles`/properties | **Ready** (planned phase gate). |
| `a11y.role-radio-button` | `a11y-role-radio` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-radio-group` | `a11y-role-radio-group` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-slider` | `a11y-role-slider` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-tab` | `a11y-role-tab` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-tab-list` | `a11y-role-tab-list` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.role-text` | `a11y-role-text` example/conformance pair; `oracle/roles` | **Ready** (planned phase gate). |
| `a11y.roving-focus` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `a11y.semantic-diffs` | `closure.test.ts`: add/remove/change/reorder; native snapshots (diff API skip) | **Ready** (planned phase gate). |
| `a11y.spatial-focus` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.state-disabled` | `a11y-state-disabled` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-expanded` | `a11y-state-expanded` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-focused` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.state-hidden` | `a11y-state-hidden` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-live-region` | `a11y-state-live-region` before/after; native actions/properties; inherited overlay tests | **Ready** (planned phase gate). |
| `a11y.state-modal` | `a11y-state-modal` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-read-only` | `a11y-state-readonly` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-required` | `a11y-state-required` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-selected` | `a11y-state-selected` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.state-toggled` | `a11y-state-pressed` before/after; native actions/properties | **Ready** (planned phase gate). |
| `a11y.tab-focus` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.trait-checkable` | `a11y-traits-matrix` false→true; native 64-node stable trait masks | **Ready** (planned phase gate). |
| `a11y.trait-enablable` | `a11y-traits-matrix` false→true; native 64-node stable trait masks | **Ready** (planned phase gate). |
| `a11y.trait-expandable` | `a11y-traits-matrix` false→true; native 64-node stable trait masks | **Ready** (planned phase gate). |
| `a11y.trait-focusable` | `a11y-focus-policy`, `a11y-focus-condition`; `closure.test.ts`; native roles focus captures | **Open:** Dotted repeat targets and late focus registration remain unsupported; native ancestor policies incomplete. |
| `a11y.trait-requirable` | `a11y-traits-matrix` false→true; native 64-node stable trait masks | **Ready** (planned phase gate). |
| `a11y.trait-selectable` | `a11y-traits-matrix` false→true; native 64-node stable trait masks | **Ready** (planned phase gate). |
| `a11y.trait-toggleable` | `a11y-traits-matrix` false→true; native 64-node stable trait masks | **Ready** (planned phase gate). |
| `a11y.tree-bounds` | Existing `a11y-tree-bounds`; measured Chromium/Firefox API stroke discrepancy | **Open:** Exact stroke/path extents absent in overlay and CLI; browser stroke measurement differs by engine. |
| `a11y.tree-visibility` | `a11y-tree-visibility`, `a11y-state-hidden/modal`; native properties | **Open:** Hidden/modal and existing collapse probes pass; Solo/native visibility matrix incomplete. |
| `a11y.web-overlay` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `host-api.keyboard-focus` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `host-api.low-level-focus` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `host-api.low-level-semantics` | `semantics.test.ts`, `closure.test.ts`; native actions; inherited DOM API tests | **Open:** Dependency-driven collection and same-signature owner replacement remain. |
| `host-api.semantic-overlay` | `a11y-dom/test/web/overlay.test.ts` both engines; inherited mute example; DOM oracle skip | **Ready** (planned phase gate). |
| `input.semantic-decrease` | `a11y-action-edges`, `a11y-actions-range`; native before/tap/increase/decrease | **Open:** Basic steps, semantic clamps and readonly no-ops pass; queued repeated range writes and narrower input-limit no-op reporting remain. |
| `input.semantic-increase` | `a11y-action-edges`, `a11y-actions-range`; native before/tap/increase/decrease | **Open:** Basic steps, semantic clamps and readonly no-ops pass; queued repeated range writes and narrower input-limit no-op reporting remain. |
| `input.semantic-tap` | `a11y-action-edges`, `a11y-actions-range`; native before/tap/increase/decrease | **Ready** (planned phase gate). |
| `tooling.headless-semantic-actions` | `a11y-action-edges`, `a11y-actions-range`; native before/tap/increase/decrease | **Open:** Basic steps, semantic clamps and readonly no-ops pass; queued repeated range writes and narrower input-limit no-op reporting remain. |
| `tooling.headless-semantics` | Filtered `semantics item` CLI and subtree inspection tests; all semantic snapshots | **Ready** (planned phase gate). |
