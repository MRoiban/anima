# Bind authoring

## Filtering a list by typed text

Use `text-input` to write committed field text to a string `$query`. Derive one bool per label
with `contains(lower($label0), lower($query))`, then derive a number `$count` by adding the
bools (each becomes 0 or 1). Bind row visibility to those bools. The empty query shows all rows;
matching ignores case, preserves spaces and uses Unicode default lowercase without normalization.
Both functions require strings; wrong argument types report `bind-type` at load time.

```xml
<anima version="0.1" name="filtering-list" grid="20" requires="text textinput a11y focus data bind derive convert">
  <model name="Search">
    <string name="query"/>
    <string name="label0" default="Sound"/>
    <string name="label1" default="Motion"/>
    <bool name="shown0" value="contains(lower($label0), lower($query))"/>
    <bool name="shown1" value="contains(lower($label1), lower($query))"/>
    <number name="count" value="$shown0 + $shown1"/>
    <string name="summary" value="$count" convert="results"/>
  </model>
  <instance name="main" model="Search" default="true"/>
  <converter name="results" type="template" text="{0} results"/>
  <text-style id="body" size="1"/>
  <text id="search" x="1" y="1" width="18" height="2" sizing="fixed">
    <run text="" style="body"/>
    <text-input placeholder="Filter labels" write-text="$query" label="Search labels"/>
  </text>
  <text id="row0" x="1" y="5">
    <run text="$label0" style="body"/>
  </text>
  <text id="row1" x="1" y="8">
    <run text="$label1" style="body"/>
  </text>
  <text id="total" x="1" y="12">
    <run text="$summary" style="body"/>
  </text>
  <bind target="row0.visible" value="$shown0"/>
  <bind target="row1.visible" value="$shown1"/>
</anima>
```

Typing `SO` selects Sound and produces `1 results`; clearing the field restores both rows and
`2 results`. A `$query` write updates the derived bools, count and visual bindings in the same
`Player.step`, including `step(0)`. Native field commit scheduling is owned by `text-input`.
For headless text sampling, supply a font with `--font sans-serif=fixtures/fonts/anima-test.ttf`.
Browser hosts load `/text`, `/text-input`, `/a11y`, `/focus`, `/data`, `/bind`, `/derive` and
`/convert` beside the base web entry. The complete example pair is
`modules/bind/examples/filtering-list.animl` and `.ani`; `anima docs bind` includes this recipe.
