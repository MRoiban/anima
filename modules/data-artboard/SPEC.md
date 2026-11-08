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


## Browser resource ownership

Import `@anima-format/web/data-artboard` for browser values. Its smaller
`data-artboard-values` entry provides only the core value/selection API; the full
entry includes that entry and the resource bridge. Both entry load orders are safe.
The split keeps the existing artboard entry's byte ceiling; neither entry adds a
runtime dependency.

Acquire browser values using `icon.component(source.player.model, name)` after the
source's `ready` promise resolves. A source player's model identifies its resource
load even when two hosts share the same compiled declarations. Values capture that
load's resolved image records (absolute sources, intrinsic dimensions, self-contained
Blob data) and decoded font faces, including unused component definitions and nested
placements. They retain lexical component definitions without retaining the source
host's resolver. The destination does not re-resolve those resources using its own
resolver, base URL or same-named assets. A destination may have no authored assets.

The destination installs resources on each selected child player. Fonts retain their
own references in the browser font set; image records are scoped to the instance.
Sibling destinations and host loads remain isolated. Reloading or destroying a source
does not mutate an acquired value. Clearing/replacing a selection releases the old
instance's font references on the next destination draw; destination cleanup releases
all adopted faces. A retained value can be assigned again after every source and
previous destination releases its faces. Retired image slots are ignored during the
retained SVG refresh. SVG and canvas consume the same adopted records and text layout.

## Cross-document model contract

For an external selection, an artboard property's optional `model` names its expected
model in the destination data document (JSON `model: "Card"`, AniML `model="Card"`).
Otherwise inherited source data uses the placement's explicit `data` instance model,
or the parent's default model. A component with its own independent data keeps it
unless the placement supplies data; an explicit property model still checks its
contract.

Before rebinding a selected external child, the schemas must be structurally
compatible: the destination supplies every source property with the same scalar
kind, asset kind, numeric bounds and enum members (enum order does not matter).
Model references and list element models are checked recursively. Matching named
instances that the placement shares (including globals) are checked as well, so a
source binding cannot silently consume a differently typed destination instance. Destination-only
properties and different default values are allowed. Document-local component and
text-style names are not schema identities. Model names may differ when their
structures match; no model/property-name remapping is performed.

An incompatible or absent required model throws `artboard-model` during the step
that instantiates the queued selection. The diagnostic points to `/data/` plus the
escaped bound property path, explains the incompatible placement model, and hints
at matching property types, enum members and referenced models. It happens before
binding the source instance to the destination's data. The previously selected
child is not replaced. Correct the selection before stepping again. Generic host
metadata continues to report the component storage alias for source-spelled artboards.
