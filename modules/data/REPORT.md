STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

**STATUS:** Partial P4e-1 checkpoint. 60/73 assigned rows have implementations and deterministic evidence;
59 rows have complete comparable/skip evidence (38 verified, 21 evidenced native CLI skips).
`input.data-listener` has passing numeric/host-trigger observations and a separate internal-trigger
finding; it is not counted as complete. Thirteen rows remain explicitly pending. Parity inventory
statuses are unchanged. No push, PR, merge, publication or Glyphy change.

**VERIFY:** Latest broad scope: `npm run test:scope -- data bind components machine input events
conformance oracle` — 60 files, 2540 pass, 39 TODO. Both Chromium and Firefox run; data's own four
browser tests pass, including both separate-bundle registration orders. Final typecheck, ESLint,
Prettier and generated wiring checks are recorded in WORKLOG.md. The full `npm run check` was not run.
A prefix-compile test timed out once under concurrent load (5418/5000 ms); subsequent scoped runs
passed with the unchanged limit. No tolerance, budget, timeout or measuring method was loosened.

**METRIC:** 60 root conformance cases plus two module-owned ordering vectors; 39 native cases,
61 observation snapshots / 89 scalar observations (including two exact signal flags); 21 documented
CLI skips; one preserved trigger-listener mismatch (9 versus 0). The raw native commands, scenes,
sessions and dumps are retained under `oracle/` and the completed global cases under `tests/oracle/`.
Final byte/performance lines appear below.

**DEVIATIONS:** No decided property/type syntax was replaced. Shared generic seams were necessary
outside `modules/data/`: module preparation before references compile; typed input scopes;
post-state bindings; signal and after-child-step hooks; component context binding. Components now
use bind's shared evaluator instead of bundling a separate parser, preserving registration across
separate browser bundles and recovering its size budget. Core, machine, motion, web and playground
input getter/scope types accommodate string/color data. Runtime implementation remains DOM-free in
core and dependency-free. `tools/oracle.ts` adds exact boolean signal-flag observations; existing
comparison thresholds and methods remain unchanged. All implementation is independent of Rive;
no Rive source or .riv contents were read, and no Rive source or CLI documentation text was copied. No NOTICE addition applies.

**PROBLEMS:** The internal state/custom-trigger listener variant needs an owner decision. The native
trigger has `changed: true`, but its change listener leaves `n=0`; Anima's after-step listener sets
`n=9`. The mismatch is retained in `tests/oracle/input-data-listener/internal-trigger-difference/`
and separately asserted by the finding runner, never counted as a passing oracle. This also limits
any phase-completion claim. The data runtime is close to its 8192-byte ceiling; preserve that ceiling
when integrating convert/host work. `INTERFACE.md` documents shared converter, math-function and host
state hooks. Named converters/formulas and public host handles belong to the parallel/follow-up tasks.

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
