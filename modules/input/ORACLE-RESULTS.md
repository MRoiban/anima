# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

STATUS: Original 36 pending input probes disposed; all 16 invalid focus skips replaced.
All 15 earlier input skips also revisited: seven cursor-intent comparisons captured, eight
browser-host limits retained with individual captures. Runtime code and parity statuses unchanged.

VERIFY: Final requested scoped suite: **1426 passed / 119 out-of-scope conformance skips**,
13 files, Chromium and Firefox. Prettier, ESLint, `npx tsc -p tools`, generated parity and
AniML corpus checks pass. Strict oracle exits **0**: **104 completed cases / 295 samples**;
three findings measured and printed separately. All references in this pass recaptured
with `python3 tests/oracle/capture.py --interaction` before final verification. Reproduction:
`python3 tests/oracle/capture.py --interaction` authors and recaptures only this pass;
`node tools/oracle.ts --build --strict` compares completed probes and prints findings separately.
`npm run test:scope -- input focus oracle`, `npx prettier --check .`, `npx eslint .`.
The capture script uses only full-path local headless commands and deletes generated .riv files
without reading them. No scaffold documentation was created or copied.

METRIC: Original input 36 → **27 verified / 6 skip-noted / 3 findings**.
Focus 16 → **16 verified / 0 skip-noted / 0 findings**.
Earlier input 15 skips → 7 cursor-intent verified / 8 host limits evidenced.
Whole input module 54 → **37 verified / 14 skip-noted / 3 findings**.
Two supplemental rendering probes compare Solo and collapse, with max channel delta 1,
zero pixels over 16, unchanged new axis-aligned budget max 2 / 0%.
The integer `times` in interaction cases label observation steps, not elapsed seconds; each
manifest script specifies the full equivalent command prefix.
All discrete input values, cursor requests and focus ids compare exactly, tolerance zero.

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

PROBLEMS: Three unresolved disagreements are findings, not skips, adjusted references or
expected failures. Completed cases remain in cases.json. finding.json carries the independently
captured failing pair; strict mode prints it and writes findings-metrics.json separately. Exit 0
means completed comparisons pass, not universal interaction parity. The evidence test preserves
the exact measured discrepancy so a changed result requires re-evaluation.

1. Keyboard bubbling: F13 ends at Anima n=2 versus native n=1, absolute delta **1**.
2. Pointer capture ordering: child capture/consume ends at Anima n=2 versus native n=1,
   absolute delta **1**. Parent capture wins in the native dispatch.
3. Preserve-offset alignment: on the first drag move and after release Anima n=96 versus
   native n=80, absolute delta **16**. Snap alignment agrees exactly. This probe grabs x=88
   on a node at x=80 and moves to x=104; no reference timing or coordinate was changed.

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
| input.align-preserve | finding | tests/oracle/input-align-preserve/finding.json |
| input.align-snap | verified | tests/oracle/input-align-snap/rive/commands.txt |
| input.bounded-hit-tests | verified | tests/oracle/input-bounded-hit-tests/rive/commands.txt |
| input.button-middle | skip | tests/oracle/input-button-middle/skip.json |
| input.button-secondary | skip | tests/oracle/input-button-secondary/skip.json |
| input.capture-phase | finding | tests/oracle/input-capture-phase/finding.json |
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
| input.keyboard-bubbling | finding | tests/oracle/input-keyboard-bubbling/finding.json |
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
