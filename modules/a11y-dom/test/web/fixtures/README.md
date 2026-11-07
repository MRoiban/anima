# BF-2 small scenes

`downstream.test.ts` loads each document in separately bundled base/overlay/input
entries and runs Chromium and Firefox. These are independent reductions informed
by read-only `git show f1373fd:<path>` from the downstream kit.

- `bf2-tabs.json`: three tabs reveal capture-phase spatial traversal plus tab-list
  roving (two tabs can hide the bug by wrapping). `focus` is added only in the focus
  variants. Arrow/Home/End movement and Enter/Space manual activation are separate.
- `bf2-buttons.json`: a trigger button and a boolean button, with no focus module
  by default. The trigger Enter/Space report did not reproduce, either before or
  after this patch. The frozen kit has tabs with activation triggers but no
  semantic + button; its stepper has a semantic slider and pointer listeners.
- `bf2-pointer.json`: the semantic overlay covers a drawn rectangle. A no-input
  variant checks legacy hover/press routing; the input variant also checks drag.
  Real browser hit testing must reach the drawing. Keyboard activation and clicks
  dispatched directly on the semantic element still invoke semantic actions.
- `bf2-range.json`: a range over a solid rectangle. Its default opacity already
  hides native range paint on this checkout. Removing opacity exposes native
  appearance before the fix. With the fix, both screenshots remain identical,
  including zero native thumb/track paint, and ArrowRight still writes 40 → 45.

B8 uses `bf2-buttons.json` for the 24×7 document and a selected component in a
square library. Default height, authored width, authored height and component
selection are asserted. Only the SVG host sizing changes; existing viewport/grid-offset mapping remains
unchanged, including SVG/canvas input equivalence for bleeding viewBoxes.

`spec/conformance/a11y-manual-tabs` independently specifies manual activation for
headless keys. Its expected bool values are handwritten; browser behavior supplies
the platform counterpart. No new Player.step algorithm is introduced.
