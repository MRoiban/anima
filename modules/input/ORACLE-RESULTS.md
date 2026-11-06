# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

STATUS: Three original input findings resolved as **two verified / one intentional difference**.
Keyboard target listeners stop delivery by default; `propagate="true"` opts into passing on.
Capture ordering remains outermost ancestor to target. A consuming ancestor stops inner delivery.

VERIFY: Fresh full-path local native recapture of input-capture-phase, input-keyboard-bubbling,
and input-align-preserve. `node tools/oracle.ts --strict` exits 0: **106 completed cases / 300 samples**.
The two promoted cases retain tolerance zero and unchanged native scenes, commands and values.
The alignment pair remains outside cases.json, with failing observations retained.
Requested scoped tests, formatting, lint and browser results are recorded in docs/LOG.md.

METRIC: Original pending input 36 → **29 verified / 6 skip-noted / 1 intentional difference**.
Whole input module 54 → **39 verified / 14 skip-noted / 1 intentional difference**.
Focus remains **16 verified / 0 skips / 0 findings**. Findings **3 → verified 2 / intentional 1**.

Capture evidence correction: the existing runtime sorter already used ascending capture depth.
The original Anima probe ran a non-consuming parent followed by a consuming child, yielding 2;
native parent capture claimed the event and yielded 1. The paired Anima parent now explicitly
sets consume=true to map that native claim. This is a fixture/contract correction, not evidence
of a newly fixed sorting bug. Independent hand-authored conformance vectors retain both the
non-consuming outer→inner sequence and a consuming ancestor blocking the target.

Keyboard F13 now yields 1 on both sides (previous Anima 2, native 1); unmatched F12 still
reaches the ancestor and yields 2. Default consumption also crosses component boundaries.
Browser tests cover native Enter/Space activation, arrows, Tab and explicit propagation.

PROBLEMS: Preserve-offset is an intentional difference, never a pass: grab x=88 on origin x=80,
move to x=104 → Anima x=96 versus native x=80, absolute delta 16 at move and after release.
Its finding.json status is "intentional difference"; strict mode prints that status separately,
writes findings-metrics.json and retains pass=false for both differing samples. No tolerance,
reference timing or coordinates changed. Strict success certifies completed cases only.

DEVIATIONS: A verified row means the concrete probe is verified, not every host API or possible
parameter. Pointer and hit-query rows compare observable delivery, not the return shape of an
inaccessible native host query. Bounded-hit probes establish in-artboard geometry eligibility,
not the optional Anima `hitTest({bounded:true})` return API. Parent-chain probes establish
ancestor delivery, not all pointer-enabled inheritance combinations. Gamepad connected and
disconnected compare delivery; arbitrary device-index payloads remain unobserved. Wheel and
trackpad compare a single -24-unit gesture's native offset with Anima's supplied delta; no
claim of physics, accumulated offsets, raw timestamp/phase or latch equivalence is made.
The separate scroll-latching row remains skipped for that reason.

Focus scenes explicitly establish focus. The baseline changes c→a before capture to measure
focus/blur listeners after initialization; no initial-entry listener timing equivalence is claimed.
Keyboard navigation uses native FocusActionTraversal and Anima focusTraverse. Native pointer
focus uses an authored down FocusActionTarget; this compares the resulting pointer-driven focus,
not a host's automatic focus policy. Scope edge cases test a,b inside and c outside the scope.
Semantics focused bit (128) supplies an independent id check alongside numeric focus/blur writes.
No DOM focus, native browser Tab exit or component-internal traversal parity is claimed by these
three-item native scenes; existing browser/conformance tests retain those responsibilities.

Cursor comparisons observe requested intent strings, not visible OS cursors or computed CSS.
The independent native scene writes its configured cursor property on enter/exit. Anima's absent
request is normalized to the empty string used for the native default request, without converting
nonempty names. Browser tests retain responsibility for CSS/OS cursor application.
The separation follows docs/research/rive-web-runtime.md lessons 2, 5 and 6; fresh captures,
not research notes, provide the comparison evidence.


## Per-row decisions

| Row | Disposition | Evidence |
| --- | --- | --- |
| host-api.coordinate-mapping | skip | tests/oracle/host-api-coordinate-mapping/skip.json |
| host-api.dom-listener-control | skip | tests/oracle/host-api-dom-listener-control/skip.json |
| host-api.gamepad | skip | tests/oracle/host-api-gamepad/skip.json |
| host-api.low-level-pointer | verified | tests/oracle/host-api-low-level-pointer/rive/commands.txt |
| host-api.low-level-scroll | verified | tests/oracle/host-api-low-level-scroll/rive/commands.txt |
| host-api.manual-gamepad-batch | skip | tests/oracle/host-api-manual-gamepad-batch/skip.json |
| host-api.multitouch | verified | tests/oracle/host-api-multitouch/rive/commands.txt |
| host-api.pointer-exit | verified | tests/oracle/host-api-pointer-exit/rive/commands.txt |
| host-api.scroll-hit-policy | skip | tests/oracle/host-api-scroll-hit-policy/skip.json |
| host-api.scroll-latching | skip | tests/oracle/host-api-scroll-latching/skip.json |
| input.align-preserve | intentional difference | tests/oracle/input-align-preserve/finding.json |
| input.align-snap | verified | tests/oracle/input-align-snap/rive/commands.txt |
| input.bounded-hit-tests | verified | tests/oracle/input-bounded-hit-tests/rive/commands.txt |
| input.button-middle | skip | tests/oracle/input-button-middle/skip.json |
| input.button-secondary | skip | tests/oracle/input-button-secondary/skip.json |
| input.capture-phase | verified | tests/oracle/input-capture-phase/rive/commands.txt |
| input.cursor-arrow | verified | tests/oracle/input-cursor-arrow/rive/commands.txt |
| input.cursor-hidden | verified | tests/oracle/input-cursor-hidden/rive/commands.txt |
| input.cursor-intent | verified | tests/oracle/input-cursor-intent/rive/commands.txt |
| input.cursor-pointer | verified | tests/oracle/input-cursor-pointer/rive/commands.txt |
| input.cursor-resize-horizontal | verified | tests/oracle/input-cursor-resize-horizontal/rive/commands.txt |
| input.cursor-resize-vertical | verified | tests/oracle/input-cursor-resize-vertical/rive/commands.txt |
| input.cursor-text | verified | tests/oracle/input-cursor-text/rive/commands.txt |
| input.disable-listeners | skip | tests/oracle/input-disable-listeners/skip.json |
| input.gamepad-axis | verified | tests/oracle/input-gamepad-axis/rive/commands.txt |
| input.gamepad-button | verified | tests/oracle/input-gamepad-button/rive/commands.txt |
| input.gamepad-button-phases | verified | tests/oracle/input-gamepad-button-phases/rive/commands.txt |
| input.gamepad-connected | verified | tests/oracle/input-gamepad-connected/rive/commands.txt |
| input.gamepad-disconnected | verified | tests/oracle/input-gamepad-disconnected/rive/commands.txt |
| input.gamepad-host | skip | tests/oracle/input-gamepad-host/skip.json |
| input.gamepad-index-mapping | skip | tests/oracle/input-gamepad-index-mapping/skip.json |
| input.hit-occlusion-query | verified | tests/oracle/input-hit-occlusion-query/rive/commands.txt |
| input.hit-parent-chain | verified | tests/oracle/input-hit-parent-chain/rive/commands.txt |
| input.hit-shape-geometry | verified | tests/oracle/input-hit-shape-geometry/rive/commands.txt |
| input.hit-test-host | verified | tests/oracle/input-hit-test-host/rive/commands.txt |
| input.key-down | verified | tests/oracle/input-key-down/rive/commands.txt |
| input.key-filter | verified | tests/oracle/input-key-filter/rive/commands.txt |
| input.key-modifiers | verified | tests/oracle/input-key-modifiers/rive/commands.txt |
| input.key-repeat | verified | tests/oracle/input-key-repeat/rive/commands.txt |
| input.key-up | verified | tests/oracle/input-key-up/rive/commands.txt |
| input.keyboard-bubbling | verified | tests/oracle/input-keyboard-bubbling/rive/commands.txt |
| input.multi-touch | verified | tests/oracle/input-multi-touch/rive/commands.txt |
| input.multi-trigger-listener | verified | tests/oracle/input-multi-trigger-listener/rive/commands.txt |
| input.opaque-targets | verified | tests/oracle/input-opaque-targets/rive/commands.txt |
| input.pointer-cancel | skip | tests/oracle/input-pointer-cancel/skip.json |
| input.pointer-drag | verified | tests/oracle/input-pointer-drag/rive/commands.txt |
| input.pointer-drag-end | verified | tests/oracle/input-pointer-drag-end/rive/commands.txt |
| input.pointer-drag-start | verified | tests/oracle/input-pointer-drag-start/rive/commands.txt |
| input.pointer-enable | skip | tests/oracle/input-pointer-enable/skip.json |
| input.touch-page-scroll | skip | tests/oracle/input-touch-page-scroll/skip.json |
| input.trackpad-scroll | verified | tests/oracle/input-trackpad-scroll/rive/commands.txt |
| input.wheel-scroll | verified | tests/oracle/input-wheel-scroll/rive/commands.txt |
| transforms.collapse | verified | tests/oracle/transforms-collapse/rive/commands.txt |
| transforms.solo | verified | tests/oracle/transforms-solo/rive/commands.txt |
| input.focus-clear | verified (data + semantics) | tests/oracle/input-focus-clear/rive/commands.txt |
| input.focus-down | verified (data + semantics) | tests/oracle/input-focus-down/rive/commands.txt |
| input.focus-edge-closed-loop | verified (data + semantics) | tests/oracle/input-focus-edge-closed-loop/rive/commands.txt |
| input.focus-edge-parent-scope | verified (data + semantics) | tests/oracle/input-focus-edge-parent-scope/rive/commands.txt |
| input.focus-edge-stop | verified (data + semantics) | tests/oracle/input-focus-edge-stop/rive/commands.txt |
| input.focus-enabled | verified (data + semantics) | tests/oracle/input-focus-enabled/rive/commands.txt |
| input.focus-left | verified (data + semantics) | tests/oracle/input-focus-left/rive/commands.txt |
| input.focus-next | verified (data + semantics) | tests/oracle/input-focus-next/rive/commands.txt |
| input.focus-previous | verified (data + semantics) | tests/oracle/input-focus-previous/rive/commands.txt |
| input.focus-pointer | verified (data + semantics) | tests/oracle/input-focus-pointer/rive/commands.txt |
| input.focus-right | verified (data + semantics) | tests/oracle/input-focus-right/rive/commands.txt |
| input.focus-target | verified (data + semantics) | tests/oracle/input-focus-target/rive/commands.txt |
| input.focus-traverse | verified (data + semantics) | tests/oracle/input-focus-traverse/rive/commands.txt |
| input.focus-up | verified (data + semantics) | tests/oracle/input-focus-up/rive/commands.txt |
| input.listen-focus | verified (data + semantics) | tests/oracle/input-listen-focus/rive/commands.txt |
| input.listen-blur | verified (data + semantics) | tests/oracle/input-listen-blur/rive/commands.txt |
