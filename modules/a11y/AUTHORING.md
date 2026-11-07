# Node semantics (partial P3b implementation)

Static labels, explicit boxes, simple painted groups, state bindings and queued actions
are available. Exact path/stroke bounds and several focus policies remain unfinished;
see REPORT.md. The fixed budgets pass after the bounded fixes.

```xml
<anima version="0.1" name="mute" grid="20" requires="a11y focus">
  <bool name="muted"/>
  <rect id="mute" x0="2" y0="2" width="16" height="16" fill="#000">
    <a11y role="checkbox" label="Mute" checked="muted" bounds="2 2 16 16"/>
  </rect>
</anima>
```

Use `anima validate`, `anima schema circle.a11y`, and
`anima sample file.animl --semantics -e 'semantic mute tap\nsnapshot'`.
For a slider bind value to a number input and set min/max/step. Bind text or states
to `$path` only when data is declared and loaded. Semantic tap toggles a bound
checked/pressed/selected bool unless activate explicitly names a bool or trigger.
Traits follow from role/states; do not write trait bits. Root `<a11y>` is unchanged.

See [SPEC.md](SPEC.md) for the draft tree contract, diagnostics and remaining gaps.


For static labels/roles load only `@anima-format/web/a11y` (add `@anima-format/web/markup-a11y` when the page compiles AniML in the browser). For interaction and
focus policy load `@anima-format/web/a11y-actions` (which imports that base entry),
plus the optional focus module when needed. The runtime key for the companion is
`a11yactions`. The CLI registers both automatically. Core hosts import `a11y` and
`a11yActions` from their respective entries and register both. `semanticDiff` is now
exported by `@anima-format/core/a11y-actions`.

Read-only semantic controls and bindings to read-only data (for example list length)
expose focus when eligible, but no edit actions. Multiple taps before a step queue
multiple toggles. A group without explicit bounds unions its visible child boxes;
use explicit bounds for paths/strokes until their exact extents are implemented.

`semantics mute` prints only that subtree. `snapshot --semantics $path` combines
semantic inspection with a filtered values snapshot. Omitted bool states are false
for platform consumers; traits are derived and are never authored or serialized.
