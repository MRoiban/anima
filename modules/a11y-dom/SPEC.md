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
| button, switch | button; switch has role switch and aria-checked |
| checkbox | input type checkbox; checked=mixed sets indeterminate |
| radio | input type radio; name is the nearest radio-group id |
| radio-group | div role radiogroup |
| slider | input type range with min/max/step and numeric value; string value sets aria-valuetext |
| link | a with href |
| heading | h1–h6 according to level (default 1) |
| tab, tab-list, list, list-item | div role tab, tablist, list, listitem |
| group, dialog, alert-dialog, text, img | div role group, dialog, alertdialog, text, img |

Labels use aria-label; hint uses aria-description. Leaf non-input elements also
carry label text (including live region text). Checked, pressed, selected,
expanded, disabled, required, readonly, modal and live map to their ARIA attributes.
Native controls also receive disabled. Missing states remove stale attributes.
Hidden nodes are absent from the core tree and removed from the DOM with their
subtrees. Opacity does not remove nodes from the accessibility tree.

Every semantic element is absolutely positioned and transparent. World-grid
bounds map through the live SVG screen matrix relative to the host, including
viewBox origin, fit, alignment and resizing. Nested elements offset their bounds
by the semantic parent's world origin. This module currently uses the SVG mapping;
canvas-backed positioning is not specified by this ticket.

Native click/input/change events invoke semanticAction. Radios use change, so
activating an already-checked radio does not toggle it off. A range target is reached through
core increase/decrease actions until reached, clamped or no progress is possible;
there is no independent input write or toggle policy. Rejected readonly actions
restore the native displayed state. Native keyboard behavior handles buttons,
checkboxes, radios, ranges and links. Events within the semantic overlay do not
also trigger root-level keyboard or drawn pointer handlers.

Only tab-list supplies keyboard roving: arrows move between enabled direct children,
wrapping at the edge, Home/End choose the first/last. Current DOM focus takes
precedence over selection for the one tab stop; otherwise the selected, then first
child is used. When focus is loaded, its item ordering and sequential traversal
participate; boundary fallback targets the corresponding tab. Tab navigation is
left to the browser.

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
  step(0) and repaint. Unknown ids/unavailable actions return false.
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
