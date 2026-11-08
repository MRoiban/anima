# Bindable artboards (`dataartboard`)

This optional entry adds `artboard` as a source spelling for a component-valued model
property. It compiles to the existing component data representation; empty string
clears the placement. Declare `data`, `components`, `nested`, `host`, and
`dataartboard` in `requires`. Bind an instance with `component="$content"`.
AniML spells a model property `<artboard name="content" default="front"/>`; JSON
spells it `{ "type": "artboard", "default": "front" }`. Browser authoring imports
`markup-data-artboard` after the runtime entries (it includes the complete authoring hooks).

`player.data.artboard(path)` returns a queued typed handle. Strings name local
components. `icon.component(loadedModel, name)` (also the core `component` helper)
produces a value for a component in another successfully loaded document. External
values retain the source's lexical component definitions. An empty slot can receive
an external component without any authored local definitions. Assignments instantiate
fresh players; assigning the same component preserves the current instance.
Animation clocks restart when the selection changes. The existing `data` placement
and list-item context rules apply. The host data getter exposes an opaque internal
string for an external component; callers should retain the assignable value.

Wrong property types use `data-type`. Invalid selections use `unknown-component`;
an external value lacking its loaded document uses `artboard-document`. Each has
a JSON pointer and a repair hint. Recursive host assignments exceeding eight active
component levels use `limit-exceeded`. External selections cannot introduce new scoped
input names into an already loaded parent; use the common authored interface.

The implementation reuses Anima's nested-player machinery rather than a native
runtime algorithm. See `docs/research/rive-format-and-graph.md` (lexical graph
references), `docs/research/rive-animation-and-state.md` (instance state and update
order), and `docs/research/rive-web-runtime.md` (host ownership). No native source
or binary format is used.


## Remaining resource ownership work

This entry is partial for external browser resources. It transfers component models,
not the source host's image resolver/base-URI catalog or font-face ownership. In
particular, font controllers belong to the source icon and source cleanup clears
its retained faces; the destination does not acquire those faces through a model
reference. Cross-document components requiring those resources need resource-context
initialization and destination lifetime management before the four parity rows close.
The cross-document browser proofs here use vector content; their source reload/detach
proof must not be read as an image/font lifecycle guarantee.

Source and destination data schemas must be compatible for inherited/explicit data
contexts. Compiled source bindings are reused; cross-document schema compatibility
validation and schema remapping are not supplied by this entry. Generic model
metadata still reports the component storage alias for source-spelled artboards.
