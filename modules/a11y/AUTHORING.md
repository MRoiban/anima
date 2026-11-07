# Node semantics (prototype)

P3b-1 is blocked on the 2 KB budget. This example describes the intended authoring
contract and currently supported basic headless path; it is not a parity completion.

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
