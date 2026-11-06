# P4e-1 data implementation report

**Status: partial.** The implementation checkpoint covers 60/73 assigned rows. The no-regression
performance target remains unverified; final pinned readings include slower samples. Of those,
38 have exact native comparisons and 21 have evidenced native observation limits (59 complete
comparable/skip records); `input.data-listener` retains an internal-trigger finding.
Thirteen rows remain pending with `todo.json` reasons. Inventory parity statuses are unchanged.
Converter definitions and the public host API remain separate tasks.

Restored the saved WIP via merge commit `02c0007` (16 conflicts). Both paint and data cases were
preserved; generated files were regenerated rather than hand merged. Follow-up changes fix named
model instances in a lean browser without components, foreign parser diagnostics across separate
bundles, and repeated composed form construction. Converter dispatch/listener snapshot duplication
was removed to meet the unchanged data budget. The normative contract and hook interfaces are in
SPEC.md and INTERFACE.md; EVIDENCE.md explains independent expectations and capture provenance.

**Verification:**

| Command | Result |
|---|---|
| `node tools/modules.ts` / `--check` | Generated six merged wiring files; final check current |
| `npm run gen` | Schema regenerated |
| `node tools/parity.ts` | 1238 rows; statuses unchanged |
| `node tools/build-animl.ts` / `--check` | 334 sources built/checked; 13 pending data sources explicitly omitted |
| `node tools/build-web.ts` / `--check` | 22 browser entries; demo 68,964 B |
| `npm run test:scope -- data paint contour mix markup` | 1946 passed, 225 filtered, 13 TODO |
| `npm run test:scope -- data bind components machine markup conformance oracle` | 2485 passed, 45 TODO; 57 passed files, 13 files entirely TODO |
| `npx vitest run --project browser modules/data/test/web/browser.test.ts` | 4 passed: two orders each in Chromium and Firefox; also covered in the final required scope |
| `npm run test:scope -- core web --no-browser` | 1007 passed, 26 TODO; 94 passed files |
| `node tools/oracle.ts --strict` | Exit 0; 159 completed cases / 353 frames, all pass; 13 findings / 16 frames separately recorded |
| `npm run typecheck` | Exit 0 |
| `npx prettier --check .` | Exit 0; all matched files formatted |
| `npx eslint .` | Exit 0; clean |

The 39 data-native comparisons comprise 37 global cases (59 snapshots / 87 scalar observations)
and two exact module-owned trigger flags. One global case verifies only the numeric/host-trigger
variant of the finding row. There are sixty independent root conformance vectors and three
module-local converter/ordering vectors. Native evidence was restored from the saved captures;
no native scene was recaptured during this resumption. The shared size/perf/oracle tools, workloads,
and established thresholds are byte-identical to the starting branch. The WIP's oracle-tool
extension was removed and its exact comparisons retained in data-owned tests.

**Sizes and performance:** final measured lines and the main comparison are below. Raw reports are
retained under verification/. Budgets, inputs and tolerances were not changed. The aggregate size
comparison includes the paint/contour/mix work already merged into the starting branch.

Latest same-CPU (`taskset -c 7`) runs of the **unchanged** `node tools/perf.ts`:

| Metric | Main 49d418c, two runs | Current, two runs |
|---|---:|---:|
| Bell compile | 2.45 / 5.19 ms | 2.15 / 4.23 ms |
| 9040 prefixes | 569 / 962 ms | 713 / 1015 ms |
| Bell frame | 35.3 / 40.9 µs | 42.4 / 56.7 µs |
| Composite frame | 21.7 / 27.2 µs | 45.7 / 39.3 µs |
| Toolbar frame (four instances) | 24.3 / 30.0 µs | 57.2 / 44.6 µs |
| Toolbar compile | 3.86 / 4.21 ms | 7.21 / 6.75 ms |

**The no-regression performance target is not verified.** Prefix and frame measurements are slower
in these runs; this cannot be dismissed as passing evidence. Earlier unpinned runs overlap widely
(main bell frames 32.7–101.8 µs; current 32.5–71.2 µs). Machine load was 9.17/11.21/8.85 during
measurement and other workloads remained active. A controlled quiet-machine comparison and profiling
are still required. The cache avoids rebuilding forms but its timing benefit is unverified.
All unpinned, before-cache and final pinned results are retained in verification/.

`node tools/size.ts` exits **0**. Data **8181/8192 B**, bind **2046/2048 B**, components
**3167/4096 B**; every other module passes its unchanged budget (raw lines: verification/size.txt).
Core+web **20021 B** versus main **19831 B** (**+190 B**). Full-featured **81802 B (81.8 KB)**
versus main **69666 B (69.7 KB)** (**+12136 B**); Rive-class **86281/256000 B**.
Data has 11 B of remaining headroom and bind has 2 B, so convert/host integration must preserve
these ceilings or reduce/split implementation. Main was measured from an archive of `49d418c`
using the same tools and dependency installation, without creating or switching a checkout.

**Failures and limits:** startup generation failed because dependencies were absent; `npm ci` fixed
that. An initial conflict-join script overmatched WORKLOG and was corrected by restoring the conflict
text and applying bounded matching before generation. Initial merge checks failed four strict census/order assertions; they now
retain the exact merged census (297 cases) and both modules' fields. The stronger browser probe
failed all four variants before the instance-routing fix. A new CLI test used the wrong `--json`
flag and now uses the documented `--format=json`. Initial data size was 8217/8192 B, then 8199/8192 B;
both were failures, fixed without raising the budget. Earlier scoped/type/lint/format checks were
green before the final form cache; final correctness/style/artifact/size results pass. A same-CPU performance
probe showed slower prefix compilation before the cache (912–1023 vs main 701–708 ms); all initial
and follow-up readings are retained, including noisy measurements under concurrent machine load.

The internal-trigger finding remains **Anima 9 vs Rive 0**, absolute difference 9 (100% observation
mismatch). Native reports `changed: true`; its internal trigger change listener leaves the numeric
destination at zero. The host-fired variant matches. This is not counted as verified trigger-listener
parity and needs an owner decision; the decided Anima after-step semantics were preserved.

No decided design was changed. Shared generic seams outside modules/data provide typed scopes,
pre-reference preparation, post-state bindings, signal/after-child hooks and composed expression
reuse. The compilation-local form cache is an implementation optimization, reset by each compiler
instance so late registration remains visible. Core remains DOM-free and shipped packages gain no
runtime dependencies. No push, PR, publication, merge into another branch, Rive source/docs copying,
.riv reading/conversion, threshold relaxation or Glyphy change occurred. No full `npm run check`
was run; scoped coverage and the requested standalone checks are reported explicitly.

Rows with complete comparable/skip evidence (59):

- `data.bind-conditions`
- `data.bind-instance-values`
- `data.binding-absolute`
- `data.binding-once`
- `data.binding-to-source`
- `data.binding-two-way-prefer-source`
- `data.binding-two-way-prefer-target`
- `data.component-public-data`
- `data.custom-property-boolean`
- `data.custom-property-color`
- `data.custom-property-enum`
- `data.custom-property-number`
- `data.custom-property-string`
- `data.custom-property-trigger`
- `data.default-instance`
- `data.enum-members`
- `data.global-model`
- `data.list-items`
- `data.model-definition`
- `data.named-instances`
- `data.operation-operand-view-model`
- `data.property-asset-blob`
- `data.property-asset-font`
- `data.property-asset-image`
- `data.property-boolean`
- `data.property-color`
- `data.property-enum-custom`
- `data.property-enum-system`
- `data.property-list`
- `data.property-number`
- `data.property-string`
- `data.property-trigger`
- `data.property-view-model`
- `data.state-action-trigger`
- `data.system-enum-horizontal-text-align`
- `data.system-enum-layout-alignment`
- `data.system-enum-layout-direction`
- `data.system-enum-layout-display`
- `data.system-enum-layout-flex-direction`
- `data.system-enum-layout-position`
- `data.system-enum-layout-position-units`
- `data.system-enum-layout-scale-type`
- `data.system-enum-layout-wrap`
- `data.system-enum-scroll-direction`
- `data.system-enum-semantic-check-state`
- `data.system-enum-text-box`
- `data.system-enum-text-overflow`
- `data.system-enum-text-trim-bottom`
- `data.system-enum-text-trim-top`
- `data.system-enum-vertical-text-align`
- `data.system-enum-word-wrap`
- `drawing-paint.gradient-channel-binding`
- `input.write-data-constant`
- `input.write-data-copy`
- `input.write-focused`
- `input.write-gamepad-axis`
- `input.write-gamepad-button-pressed`
- `input.write-gamepad-button-value`
- `input.write-gamepad-changed-value`

Pending rows (13):

- `data.bind-converter-options`: Live option lookup and registration hooks are tested; a named authored converter requires the parallel convert module, absent from this branch.
- `data.bind-keyframes`: The decided design specifies scalar key values only in existing tracks; no data-backed keyframe representation or resampling policy is decided.
- `data.bind-layout`: Layout consumers are P7; no layout dimensions/style target exists on this branch.
- `data.bind-script-inputs`: Script inputs require the P9 VM and typed script interface.
- `data.bind-text`: Text consumers are P6; no text-run target exists on this branch.
- `data.binding-relative`: Local/default and named absolute paths work; upward lookup across heterogeneous component model contexts is not implemented.
- `data.editor-preview-instance`: Preview naming metadata round-trips; the editor does not yet consume it.
- `data.instance-export`: Export naming metadata round-trips; runtime export filtering is not implemented.
- `data.property-artboard`: Artboard-reference is absent from the decided property type list; changing its consumer/representation needs a design decision.
- `data.property-symbol-list-index`: The contextual list-position property and list instantiation scope are not specified in the decided design.
- `data.property-text-style`: Text-style is absent from the decided property type list and depends on P6.
- `data.script-model-api`: The requested scripting API requires P9 and is outside the defined data runtime contract.
- `data.scripted-converter`: A script VM and forward/reverse scripting contract are not available; this also overlaps the parallel converter task.
