# Native accessible controls

Import `@anima-format/web/a11y-dom` (which imports `a11y-actions` and `a11y`).
Use node `<a11y>` elements or JSON `a11y` objects as described in
[the core authoring guide](../a11y/AUTHORING.md). No `a11y-dom` format feature is
needed: the module is browser-only. Import `@anima-format/web/focus` and declare
`requires="a11y focus"` for logical focus, shared focus targets and manual traversal.

```xml
<anima version="0.1" name="mute" grid="20" requires="a11y focus">
  <bool name="muted"/>
  <circle id="mute" cx="10" cy="10" r="8" fill="#000">
    <a11y role="checkbox" label="Mute" checked="muted" bounds="2 2 16 16"/>
  </circle>
</anima>
```

Paint the control yourself; the overlay stays transparent. Bounds are world-grid
rectangles transformed through the live SVG viewBox mapping, including fit,
alignment and host resizing. Native buttons, checkboxes, radios, sliders and links
supply browser keyboard behavior. Give radios a semantic `radio-group` parent.
Tab lists add arrows and Home/End; disabled tabs are skipped. The focus module's
policy participates when loaded. Controls with `readonly` reject actions in core;
the overlay restores their displayed native value after a rejected action.

`icon.semantics` returns a detached tree. `icon.semanticAction(id, action)` invokes
core and steps/repaints when accepted. `anima:semantics` carries the actual diff
(`added`, `removed`, `changed`) after a tree change. Manual
`icon.focusNext()` / `icon.focusPrevious()` invoke the focus module's traversal
policy and return whether focus changed. The `focus` module must be loaded.

For a host-owned interface, set `a11y="off"`; tree APIs and diff events continue
working. Removing the attribute restores the overlay from the current tree.
Root document `a11y` remains the existing host-level API; node semantics do not
rewrite its label, role or activation configuration.
