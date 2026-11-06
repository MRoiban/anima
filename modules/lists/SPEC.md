# Lists and data contexts

Declare `lists`, `components` and `data`; expressions also need `bind`. A repeat node is
`{id,type:"repeat",list:"$items",component:"row",dx?,dy?,size?}` or uses `count:"$n"` instead
of `list`. Exactly one source is required (`list-source`). List sources must be model lists;
count sources may be any readable numeric data path, including `$items.length`, `$main:n`,
`$parent.n` and (with `derive`) `$title.length`. A nonnumeric path is `list-source` at the
`count` property, with accepted source forms in its hint. Count uses `number-to-list`: floor, clamp negatives to zero,
and preserve identity by index. More than 256 live instances is `limit-exceeded`.

AniML: `<repeat id="rows" list="$items" component="row" dx="2" dy="4" size="20 4"/>`.
`component` also accepts a model map, JSON `{Player:"row",Header:"header"}` or AniML
`component="Player:row Header:header"`. Missing mappings for fixed list models are `list-map`
load errors; unknown runtime models are skipped with a `list-map` warning retained in
`listState(player).warnings`. Item model mismatch is `data-type`. `size` overrides local hit
bounds, without scaling component geometry.

A component declaring `data="Model"` reads that model. A repeat supplies each item's object
as its child context. An instance's `data="$team"` supplies a model reference, while
`data="main"` shares a named instance. A component without a data declaration inherits its
parent context. `$index` is the current repeat index, read-only; outside repeats it is zero.
`$parent.name` and `$parent.parent.name` read enclosing contexts. `parent` and `index` are
reserved model property names (`reserved-name`). Context errors retain code, pointer,
message and corrective hint. A component with its own model retains local storage when no
explicit placement context is provided.

Repeats reconcile before their child steps, after parent bindings. Duplicate references are
matched in occurrence order. Inserting/removing/reordering items retains surviving players,
clocks, pending actions, converters and machine states. Removing an item releases its player;
reinserting it after removal constructs a fresh player. Count repeats retain indices below
the new count. Instances step and emit events in current item order. Scoped snapshots use
`rows/0/dot.r`, writes use `rows.0.input`. Each root player owns independent state.

Rendering uses per-player draw trees; released drawing slots are reused. Allocation follows the
high-water mark of rendered content instead of multiplying reserved slots through nested templates. Child resources are remapped through the same draw contract as ordinary component
instances. Documents without lists do not allocate dynamic trees or run reconciliation. The graph/metadata split follows
[graph research](../../docs/research/rive-format-and-graph.md) §6; the single child update pass
follows [state research](../../docs/research/rive-animation-and-state.md) §C. No native source or
binary animation file is used.

Canonical decompilation may spell `component` as a JSON-valued attribute (a quoted name or
an object). Bare component names and the whitespace-separated `Model:component` form compile
to the same document. The web module refreshes SVG structure through the host renderer and
retains matching DOM; it uses the host's active paint/compositing backends across separate bundles.
