# Accessibility DOM overlay

The optional `@anima-format/web/a11y-dom` entry imports `a11y-actions` and maps the
`SemanticNode` forest to native elements in the icon's shadow root. It adds no
format fields: JSON and AniML use the existing node `a11y` registry and diagnostics
in [a11y/SPEC.md](../a11y/SPEC.md). It has no core runtime or renderer backend.
Root document accessibility (SPEC §10) retains its existing behavior. Without this
entry, neither the semantic DOM nor its observers and step wrapper are installed.

## Elements and state

| Semantic role | Native element / role |
| --- | --- |
| button, switch, tab | button; switch has role switch and aria-checked |
| checkbox | input type checkbox; checked=mixed sets indeterminate |
| radio | input type radio; name is the nearest radio-group id |
| radio-group | div role radiogroup |
| slider | input type range with min/max/step and numeric value; valueText sets aria-valuetext independently of numeric value |
| link | a with href |
| progressbar, meter | div with matching role and aria-valuemin/max/now/text; missing progressbar value omits aria-valuenow |
| status | div role status; aria-live polite by default |
| heading | h1–h6 according to level (default 1) |
| toolbar, grid, row, gridcell | div with matching role; gridcells are focusable |
| tab-list, list, list-item | div role tablist, list, listitem |
| group, dialog, alert-dialog, text, img | div role group, dialog, alertdialog, text, img |

Labels use aria-label; hint uses aria-description. Leaf non-input elements also
carry label text (including live region text). Checked, pressed, selected,
expanded, disabled, required, readonly, modal and live map to their ARIA attributes.
Native controls also receive disabled. Missing states remove stale attributes.
Hidden nodes are absent from the core tree and removed from the DOM with their
subtrees. Opacity does not remove nodes from the accessibility tree.

Every semantic element is absolutely positioned, transparent and has
`pointer-events: none`. Pointer hit testing reaches the drawing and its listeners;
semantic controls remain focusable and receive keyboard and assistive-technology
activation dispatched directly on the element. Native range appearance is removed;
thumbs and tracks have zero size and no border/background in Chromium and Firefox.
The drawing owns all visible control ink. World-grid
bounds map through the live SVG screen matrix relative to the host, including
viewBox origin, fit, alignment and resizing. Nested elements offset their bounds
by the semantic parent's world origin. For canvas output, the canvas entry exposes an internal `canvasBox(icon, bounds)` adapter to its
retained renderer's `nodeBox(bounds)`. It maps resolved world node boxes through the current
viewport and actual canvas client rectangle, removing backing-pixel ratio from CSS coordinates.
The overlay derives its world-to-host mapping from that adapter; the canvas entry is optional and
is not imported at runtime by the overlay. Fit, alignment, resize and pixel-ratio handling stay in
the canvas backend. This maps the current semantic geometry boxes; exact stroke extents remain an
open part of `a11y.tree-bounds`.

Native click/input/change events invoke semanticAction. Radios use change, so
activating an already-checked radio does not toggle it off. A range target is reached through
core increase/decrease actions until reached, clamped or no progress is possible;
there is no independent input write or toggle policy. Rejected readonly actions
restore the native displayed state. Native keyboard behavior handles buttons,
checkboxes, radios, ranges and links. Events within the semantic overlay do not
also trigger root-level keyboard or drawn pointer handlers.

Tabs use native buttons with role tab: Enter activates on key down and Space on
key up through the same tap action as assistive-technology clicks. Focus alone does
not select a tab (manual activation). An author can opt into automatic activation
by adding a node `focus` listener that fires the same selection trigger as
`a11y.activate` (requires `focus`), for example
`<listener on="focus" target="week" fire="pickWeek"/>`. Selection triggers can update
a shared selected-index data value and derive each tab's `selected` state; arrow
roving and selection remain independent.

Tab-list and radio-group supply keyboard roving: arrows move between enabled direct children,
wrapping at the edge, Home/End choose the first/last. Current DOM focus takes
precedence over selection for the one tab stop; otherwise the selected tab or checked radio, then first enabled
child is used. Radio arrows select through semanticAction; tabs retain manual activation. When focus is loaded, its item ordering participates; focusing the chosen tab
synchronizes logical focus directly without a second traversal. The host input
capture handler leaves semantic keys to these native controls, so each key has
one routing owner. A child control action does not also activate a semantic parent;
a noninteractive semantic child still delegates to its enclosing control.
This uses host routing guards; neither the overlay nor host stops
DOM propagation. Ancestor page listeners receive keyboard and pointer events, and
Anima calls `preventDefault()` only when its handling consumes the browser default.
Tab navigation is
left to the browser. Controls relations use unique semantic ids within the host shadow root,
matching the prefixed ids in the shared tree; hidden target nodes remain absent.

## Updates and focus

After each step of an attached host player, the module compares the old and new
forests with player.semanticDiff. Added elements are created; removed elements are
deleted; changed nodes update attributes/properties in place. A tag change replaces
the element; stable tags retain identity. Child order/parent changes move retained
elements only when needed. A parent's changed bounds also adjust descendant offsets.
An unchanged tree does not rebuild elements or dispatch a semantics event.

With focus loaded, existing semantic elements serve as focus targets. The focus
module creates its original small proxies only for targets without semantic nodes;
semantic nodes omitted from the active overlay have no duplicate proxy. Native
focus calls semanticAction(id, 'focus'); logical focus calls focus() on the same
element. Blur leaving the host clears logical focus. The focus module continues to
own inner-tab-stop and single-entry/exit policy. Topology and overlay-policy changes
refresh its target map through the internal anima:overlay event.

## Host API and lifecycle

- `icon.semantics`: read-only getter returning a detached SemanticNode forest.
- `icon.semanticAction(id, action)`: returns the core action result; accepted actions
  step(0) and repaint through the same host path as scheduled steps, dispatching all
  resulting `anima:event` (including dotted component events) and `anima:state` notifications. Unless explicitly paused, an accepted action also wakes the host
  so queued machine entry actions and ongoing animation can finish without the focus module. Unknown ids/unavailable actions return false.
- `anima:semantics`: CustomEvent whose detail is the actual SemanticDiff, emitted
  after a changed tree is applied, including while the overlay is disabled.
- `a11y="off"`: removes semantic elements. Logical APIs/events continue. Removing
  the attribute restores the current tree. This adds no document-format spelling.
- `icon.focusNext()` / `icon.focusPrevious()`: the optional focus web entry exposes
  these direct calls to focusTraverse(next/previous); return false without a player.

Reload/destroy restore the previous player step method and remove observers and
elements. Late module loading attaches existing icons; future loadModel calls also
attach, including asynchronous asset completion. A document without node a11y keeps
its existing host accessibility behavior.

## Evidence and rationale

The browser is the oracle for this layer: both engines exercise native events and
locator.ariaSnapshot() exposes actual browser accessibility roles/states. There is
no faithful local Rive headless counterpart to a shadow-DOM overlay, so its oracle
rows have explicit skip dispositions in REPORT.md. No Player.step output changes
are introduced: this module consumes the existing tree and action contract.

This independent implementation follows the browser-binding decision in
DESIGN §3.4 and the size/lifecycle observations in
[the web-runtime research](../../docs/research/rive-web-runtime.md) (§§2, 7, 8).
It uses browser controls and Anima's existing diff/focus policies; no Rive code or
CLI documentation text was copied.

With the optional `a11y-text` entry, the same overlay consumes inferred text labels and measured
layout bounds as specified in [a11y/TEXT.md](../a11y/TEXT.md). Renderer rebuilds restore the layer
without advancing the player.

## Optional toolbar and grid navigation

Import `@anima-format/web/a11y-navigation` (includes `a11y-dom`) for native roving
on these roles. This separate entry keeps the base overlay within its fixed budget.
A toolbar contains direct semantic controls; a grid contains direct semantic rows,
each containing direct gridcells. Hidden descendants are absent; disabled or
focus-ineligible controls/cells are skipped. Structural containers are not tab stops.
Each toolbar/grid has one tab stop: the currently focused enabled item, or the first
enabled item. Tab/Shift+Tab leave the composite using browser navigation.

Toolbar item order follows the focus module's ordering when installed, otherwise
semantic child order. Toolbar Left/Right and Up/Down move in item order and wrap, matching the tab-list
policy in both orientations. Home/End choose the first/last enabled item. Focus
does not activate a control. Grid Left/Right move among enabled cells in the current
row. Up/Down keep the authored column index in the immediately adjacent semantic
row; if that row or an enabled cell at that column is missing, focus stays put.
Home/End choose the first/last enabled cell in the row; Ctrl+Home/End choose the
first/last enabled cell of the whole grid. Gridcells are implicit focus targets
with the focus module, and remain native tab targets without it.

Horizontal row edges use the row's existing `focus.edge`: `stop` (default) retains
focus, `closed-loop` wraps within that row, and `parent-scope` delegates to the
focus module's existing spatial traversal in the enclosing scope. Vertical grid
edges retain focus. Handled navigation keys prevent the browser scrolling default.
Page Up/Down always bubble unprevented for page-owned calendar/month navigation.
Other modified shortcuts also pass through (except grid Ctrl+Home/End).

Focus availability is independent of semantic visibility. A disabled focus scope
keeps its role and semantic subtree in the accessibility tree; eligible descendants
still focus and rove. Only semantic hidden/invisible state removes the subtree.
