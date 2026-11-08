# Node accessibility

The fixed per-entry budgets are reported in REPORT.md. Root document `a11y` in SPEC §10 retains its
existing shape, validation and behavior. See REPORT.md for remaining gaps.

## Authoring

Every node can have `a11y`, declared with `requires: ["a11y"]`, or an AniML
`<a11y …/>` child. Registry entries in `core/registry.ts` own both spellings.

| JSON field | AniML attribute | Values |
|---|---|---|
| role | role | button, checkbox, switch, radio, radio-group, slider, tab, tab-list, link, list, list-item, group, dialog, alert-dialog, heading, text, img, none, progressbar, meter, status |
| label, hint, value | same | literal string or `$path` string data binding; slider/meter value requires a number input/path; progressbar value is optional and numeric when present |
| valueText | value-text | slider/progressbar/meter: literal string or `$path` string data binding; spoken value independent of numeric value |
| level | level | integer 1–6 or number input/data path; heading only; bound AniML values are JSON strings (`&quot;depth&quot;`) |
| href | href | string; link only |
| controls | controls | local id of another node with a non-none a11y role; maps to aria-controls |
| checked | checked | bool literal, bool input name or `$path` |
| checkedMixed | checked-mixed | bool literal/input/path; checkbox only; true overrides checked with `mixed` |
| pressed, selected, expanded, disabled, hidden, required, readonly, modal | same | bool literal/input/path |
| live | live | off (default), polite, assertive |
| activate | activate | trigger input (fire), or bool input (toggle) |
| min, max, step | same | min/max for slider/progressbar/meter, step for slider only; defaults 0, 100, 1; min < max, step > 0 |
| bounds | bounds | local [x,y,w,h]; nonnegative width and height; defaults to painted bounds |

Anima has no standalone string inputs: label, hint, non-slider value and valueText
bind strings through `$path`. This keeps mutable text in the typed data model, with
its existing instance scope, derived values and subscriptions, instead of adding a
second string-input system. Numeric slider values and heading levels, and boolean
states, may bind to number/bool inputs or data paths. Text matching a numeric or
boolean input name is diagnosed as input-type; other non-path text is literal; unknown `$path` and required action/state bindings are errors. Alternate
role spellings such as `radioButton` are rejected. Traits are derived, never authored:
checked implies checkable; pressed implies toggleable; selected implies selectable;
expanded implies expandable; required implies requirable; disabled implies enablable;
a focus target implies focusable. These states may be false without losing their trait.

`unknown-input`, `input-type`, `bad-value`, `undeclared-feature` carry their field's
JSON pointer. `a11y-role-state` rejects a role-incompatible state and its hint lists
allowed states. Checked is allowed on checkbox/switch/radio, pressed on button,
selected on tab/list-item/radio, expanded on button/link/group/list-item, required
on checkbox/switch/radio/radio-group/slider, readonly on checkbox/switch/slider,
modal on dialog/alert-dialog. Disabled and hidden apply to all roles.

## Shared tree and actions

`SemanticNode`, `SemanticAction`, `SemanticDiff` are exported as types from the core
entry. `semanticDiff` is exported as a function from `@anima-format/core/a11y-actions`. `test/fixtures/tree.json` is the tree contract, checked by
`test/core/semantics.test.ts`. The tree is an ordered forest. Every node has id,
role, states, world-grid bounds [x,y,w,h], actions and children; optional fields are
label, hint, value (string/number), valueText (string), level, href, controls, min, max, step. States include
checked (boolean or `mixed`), pressed, selected, expanded, disabled, required,
readonly, modal, focused, live (`polite`/`assertive`). No DOM objects are exposed.

`player.semantics()` lifts descendants through nodes without semantics and through
role none. Hidden/invisible subtrees are excluded, opacity does not hide. A modal
sibling suppresses its siblings. IDs in component instances and repeated rows are
dotted. Intended bounds are transformed painted bounds, or an explicit local box.
The lean browser entry keeps explicit bounds or a geometry union; the optional P7-8 calculator below adds painted-stroke extents. Static bounds are propagated from visible children in reverse structural order. Explicit semantic bounds override that node's computed box. A node without measurable descendants falls back to its world-space origin as a zero-size box. Nested instances and repeat items are visited at their owning node, before its next authored sibling.
The tree is cached across unchanged reads and steps; changed semantic inputs,
geometry or focus invalidate it. Late registration of action/focus peers invalidates a cached static tree. A same-signature owner replacement refreshes action ownership while retaining the immutable tree snapshot. Hosts must treat returned snapshots as read-only. A retained dependency check covers each visited player's resolved geometry/transform/visibility
addresses, focus, semantic input/data bindings, focus-enabled inputs, nested owner identity/count,
list length/item-player identity and module generation. Unchanged reads return before scene
collection, bounds work or signature construction. Opacity/draw-order addresses do not affect the boxes. Paint addresses are excluded in the lean
browser entry and tracked when the optional painted-bounds calculator is installed. Unchanged list steps retain the
cache despite the renderer's revision advancing. A changed dependency recollects; equal resolved
signatures retain snapshot identity while refreshing owners. These are retained value readers,
not event subscriptions or a new host notification API. Hosts must treat snapshots as read-only.


With `a11y-actions` registered, `semanticDiff(previous,next)` and `player.semanticDiff` return added and removed ids
in tree order, and `{id,keys}` changes in next-tree order. Children compare immediate
child ids; a descendant's state change does not also mark its ancestors changed.

With `a11y-actions` registered, `semanticAction(id,action)` rejects missing ids or unavailable actions with false.
Tap fires activate or queues a bool toggle; repeated taps before a step compose in queue order; absent activate it toggles the first bound
checked/pressed/selected field. Increase/decrease add/subtract step and clamp value
to min/max, then to the numeric input/data property limits. Range writes evaluate against the committed value at their queue position, so repeated actions before a step compose. A per-owner/input prediction reports false at a narrower limit, including an already queued limit. Writes are queued for the next step. Disabled controls expose no actions;
readonly controls expose no edit actions, including when the binding names a read-only data input such as list length. They may still expose focus. Focus delegates to the optional focus module.
Focusable ancestors report focused; hidden focus retargets toward a focusable ancestor,
then the next focusable node in tree order, then clears. Focus/traversal stays in focus.
When focus and the companion are registered, eligible items exclude
semantic hidden, disabled and modal-suppressed nodes, including on the first read.
`focusItems(true)` still exposes structural items for cleanup. Machine focus
conditions include focusable semantic ancestors; focus-only documents retain their
existing behavior. Twelve module arrival orders are verified. Already compiled semantic
models keep inert focus configurations even without focus loaded; registering the
optional focus module invalidates the cached tree and makes them actionable.
Repeated row targets use `repeatId.index.localId`, with the same owner, world point,
pointer matrix and scope rules as component instances. To traverse beyond a child
row's edge, use `focus edge="parent-scope"` on the repeat, as on component instances.
Shrinking a repeat retargets before generic focus cleanup. Nested/repeated semantic
roots are refreshed after each step even when their host has no own semantic node.
Directional traversal uses semantic box centers for synthesized targets without explicit focus
bounds, and excludes ancestors of the current target from directional candidates. Explicit focus
bounds and scoped closed-loop behavior retain their existing policy. The native child → right
sibling → next outside sequence matches; see `spec/conformance/a11y-spatial-focus`.
Native ancestor-condition coverage matches six PNG marker stages in `oracle/p3c8-condition`: entry,
parent targeting, sequential and directional movement, departure and hidden-child retargeting. The
native comparator targets the node, and equal/notEqual choose focused/unfocused; its right-hand
boolean does not provide inversion. Native semantic bounds can lag animated paint and are retained
as a numbered finding rather than used as a substitute for the PNG comparison.

## Headless commands (SPEC §11.2 extension)

| Command | Effect |
|---|---|
| semantics [id] | One JSON line: forest, or the identified subtree; unknown subtree id is a script error |
| semantic id tap\|increase\|decrease\|focus | Queue the action, then step(0) |
| snapshot --semantics | Snapshot with an additional semantics tree |

`anima sample --semantics` requests semantic snapshots. The script integration is
one dispatch plus an import; the command implementation is tooling only.

### Native semantic keys

In scripts, `key down|up <key>` and input-module `key repeat <key>` on a focused
semantic control take the overlay's native route before generic focus traversal.
Slider ArrowRight/Up increase, ArrowLeft/Down decrease; Home/End reach the ends.
Button, switch and tab Enter activate on down; Space activates on release after a down
on the same control. Checkbox/radio use Space; an already checked radio stays
checked. Links use Enter. Arrows in a tab-list rove enabled direct tabs, wrapping;
Home/End choose its first/last tab. Focus order matches the loaded focus module.
Readonly/disabled action policy still applies. Shift is accepted; control/alt/meta
and explicit targets other than the focused node use the generic input route.
These events are handled once, using the semantic routing owner rather than drawn-node
key listeners. Other unmodified semantic keys are consumed without generic spatial
traversal; Tab/Shift+Tab use the focus module, including repeated child tab stops. Key translation lives only in core/commands.ts (tooling); browser
entries use native buttons for tab activation, adding no key emulation bytes.

The derived example `examples/slider-value-text.animl` uses numeric `$volume`
and read-only `$volumeText` via a template converter to speak "Volume 40 %".
`valueText` off a slider reports bad-value at its field; wrong type, missing data
and unknown path use input-type, undeclared-feature and unknown-input respectively.

## Traits, defaults and remaining gaps

Traits are descriptive consequences of the role and authored states, not fields in
`SemanticNode`. A checkbox/switch/radio is checkable; button `pressed` makes it
toggleable; tab and `selected` make it selectable. An authored `expanded`, `required`
or `disabled` state indicates the corresponding expandable, requirable or enablable
trait even when false. Focusability follows eligible focus items when the optional
focus module is registered; actions synthesizes focus for button, checkbox, switch,
radio, slider, tab, link and list-item. There are no authored trait flags.

Omitted bool states remain absent in the serialized tree; platform consumers treat
them as false. `live` defaults to off (absent from the tree). Slider defaults are
0, 100 and 1, exposed while enabled; a disabled slider retains the prototype's
omission of that metadata. An omitted activation binding does not make a static
literal checked/pressed/selected state writable. Explicit activate takes precedence
and may name a trigger or writable bool. Numeric input/data constraints still apply
after the semantic range clamp. The optional text consumer infers labels as specified in [TEXT.md](TEXT.md), without adding
fields to the shared tree contract.

Independent conformance now covers every role (including none/heading),
state changes through semantic actions, a legal role × state trait matrix, live
politeness during label changes, bound properties, range clamps and focus ancestry.
`test/core/closure.test.ts` covers filtered inspection and structural/reorder diffs.
Native captures compare states/values around tap/increase/decrease plus properties,
remaining states, heading metadata and the none/modal seams; see oracle/roles/.
See REPORT.md for per-row closure evidence and remaining gaps.

## Painted-bounds seam

The optional P7-8 calculator below is shared by tooling and the browser overlay. It uses geometric
extrema and stroke support instead of the earlier proposed DOM bounding-box inflation. The
installed Chromium ignores getBBox's stroke option while Firefox honors it, and a blanket
half-width inflation cannot reproduce butt caps or miter joins. A shared pure calculator avoids
that platform divergence, following the separation described in docs/research/rive-web-runtime.md.
Explicit authored boxes still win. The broader final-painted-extents row stays planned for the
unsupported combinations listed below; standard centered geometry now has independent tests.

Design follows `design/p3b/DESIGN.md` §3.1–3.3. Research context:
`docs/research/rive-format-and-graph.md` (registry discipline),
`docs/research/rive-animation-and-state.md` (deterministic queued actions),
`docs/research/rive-web-runtime.md` (separate core semantics and platform overlay).
No source algorithms or documentation text from Rive were copied.


## Module seam

`@anima-format/web/a11y` registers validation, registry shapes and the static semantic
forest. It installs only `player.semantics()`. Static snapshots have empty action
arrays and no derived focus state. Node slider min/max/step metadata remains in the base
tree, with the prototype's disabled-node omission retained.

`@anima-format/web/a11y-actions` imports the base web entry and registers its
companion afterward (`after: ['a11y']`). It adds action descriptions, semanticAction,
semanticDiff, synthesized focus configuration, ancestor focus states and retargeting.

`@anima-format/web/markup-a11y` registers the registry-driven structural forms so that
in-browser AniML can use `<a11y …/>` children, as `markup-paint` does for paint. Pages that
load compiled `.ani` do not need it.
The runtime registry key is `a11yactions`, following the existing `host-values` /
`hostvalues` convention: core's current module-name grammar rejects hyphens. Core
consumers register both modules; either arrival order is supported. Initialization
defers until the base is present. The browser entry loads its dependency.
Root document a11y behavior is unchanged.

The base module exposes an internal `runtime` seam on the active registry entry.
The companion reads this seam during init; it does not import a second runtime cache
into a separately bundled entry. A post-build callback decorates the tree and may
request a rebuild after changing focus. Both tree traversal and diffs use one shared
flatten helper; actions reuse core's clamp. Headless commands remain tooling-only and
are imported by neither browser entry. The companion's 1,024 B budget is incremental
over its imported base entry, as with other layered module entries.

This split follows the platform separation described in
`docs/research/rive-web-runtime.md` and the shared-registry discipline described in
`docs/research/rive-format-and-graph.md`; no external algorithm is ported. The phase statuses remain planned. See REPORT.md for the 2,104 B centered-stroke
probe that exceeded the fixed budget and was reverted. Remaining work and measured limits are recorded in REPORT.md; no additional runtime module was added.

## Additional Anima roles and relations (BF-4)

`progressbar`, `meter`, `status` and `controls` are Anima extensions; the parity inventory
has no corresponding rows. No inventory status or new row is inferred. Progressbar and meter
expose numeric min/max (0/100 by default), and a bound number value; meter requires value,
progressbar without value is indeterminate. Neither range role synthesizes range-edit or focus actions. Explicit activate bindings retain the
ordinary authored action policy.
`valueText` may supply independent spoken text on these roles. Numeric values use the ordinary
input/data constraints; metadata does not install additional clamping. `status` defaults to
`live: polite`; an authored polite/assertive live priority overrides that default.
`controls` is a local node id, never a data binding. Its target must have a non-none semantic
role in the same component; invalid targets produce `bad-value` at the controls field with a hint.
The shared tree prefixes the relation with the same instance/repeat path as its owning node.
A hidden target may be omitted from the tree/overlay; controls does not force it visible.

Headless keys mirror radio-group arrows/Home/End: move to the enabled radio in focus order,
then tap it unless already checked. Group exclusivity belongs to authored selection state,
just as for pointer activation; a shared selected index with derived checked values or selection
triggers can express it. Browser Tab entry uses the checked enabled radio, else the first;
arrow movement wraps and selects. Tabs retain manual activation. This extends the existing
`a11y.roving-focus` policy rather than introducing a new focus system.

## Optional text consumer (P6)

[TEXT.md](TEXT.md) specifies grapheme host/listener access, inferred labels, and measured
text layout bounds. Exact path/stroke bounds remain open as recorded above.

### Painted geometric bounds (P7-8)

Tooling automatically installs the painted-geometry calculator. Browsers opt into
`@anima-format/web/a11y-bounds`; the overlay and headless `player.semantics()` then use the same
world-space result. Explicit semantic bounds still win. Cubics use derivative roots instead of
control hulls/chords; standard centered strokes include butt/round/square caps, bevel/round/miter
joins (the SVG/Canvas default miter limit of 4), transformed circles and rounded rectangles.
Stroke/paint changes now invalidate the semantic cache while this calculator is installed.

This is geometry before masks/clips. Dash/trim gaps, non-scaling strokes, feather/filter support
and text ink-outline bounds are not yet fully represented. Existing text semantics keep their
measured logical layout boxes. Consequently `a11y.tree-bounds` remains planned as a broader row;
this module does not advertise exact final painted extents for unsupported paint combinations.
Native semantic JSON reports the uninflated rectangle. In the new explicitly linear control,
animation lag does not reproduce. The capture and measured difference are retained under `tests/oracle/p7-8-semantic-bounds/`.
