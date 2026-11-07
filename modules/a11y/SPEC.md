# Node accessibility (P3b draft; partial implementation)

This chapter specifies the P3b design contract. The bounded implementation is partial:
`a11y` measures 2,038 / 2,048 B, `a11y-actions` 826 / 1,024 B and
`markup-a11y` 971 / 1,024 B. Root document `a11y` in SPEC §10 retains its
existing shape, validation and behavior. See REPORT.md for remaining gaps.

## Authoring

Every node can have `a11y`, declared with `requires: ["a11y"]`, or an AniML
`<a11y …/>` child. Registry entries in `core/registry.ts` own both spellings.

| JSON field | AniML attribute | Values |
|---|---|---|
| role | role | button, checkbox, switch, radio, radio-group, slider, tab, tab-list, link, list, list-item, group, dialog, alert-dialog, heading, text, img, none |
| label, hint, value | same | literal string or string input name; `$path` reads data when declared and loaded; slider value requires a number input/path |
| level | level | integer 1–6; heading only |
| href | href | string; link only |
| checked | checked | bool literal, bool input name or `$path` |
| checkedMixed | checked-mixed | bool literal/input/path; checkbox only; true overrides checked with `mixed` |
| pressed, selected, expanded, disabled, hidden, required, readonly, modal | same | bool literal/input/path |
| live | live | off (default), polite, assertive |
| activate | activate | trigger input (fire), or bool input (toggle) |
| min, max, step | same | slider numbers, defaults 0, 100, 1; min < max, step > 0 |
| bounds | bounds | local [x,y,w,h]; nonnegative width and height; defaults to painted bounds |

A literal text equal to an input name resolves as that input. Other strings stay
literal; unknown `$path` and required action/state bindings are errors. Alternate
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
entry. `semanticDiff` is exported as a function from `@anima-format/core/a11y-actions`. `test/fixtures/tree.json` is the wave-2 contract, checked by
`test/core/semantics.test.ts`. The tree is an ordered forest. Every node has id,
role, states, world-grid bounds [x,y,w,h], actions and children; optional fields are
label, hint, value (string/number), level, href, min, max, step. States include
checked (boolean or `mixed`), pressed, selected, expanded, disabled, required,
readonly, modal, focused, live (`polite`/`assertive`). No DOM objects are exposed.

`player.semantics()` lifts descendants through nodes without semantics and through
role none. Hidden/invisible subtrees are excluded, opacity does not hide. A modal
sibling suppresses its siblings. IDs in component instances and repeated rows are
dotted. Intended bounds are transformed painted bounds, or an explicit local box.
Static bounds are propagated from visible children in reverse structural order. Explicit semantic bounds override that node's computed box. A node without measurable descendants falls back to its world-space origin as a zero-size box. Nested instances and repeat items are visited at their owning node, before its next authored sibling.
The tree is cached across unchanged reads and steps; changed semantic inputs,
geometry or focus invalidate it. Late registration of the action companion invalidates a cached static tree. Hosts must treat returned snapshots as read-only. This currently compares resolved signatures after collecting entries, rather than using dependency subscriptions.

With `a11y-actions` registered, `semanticDiff(previous,next)` and `player.semanticDiff` return added and removed ids
in tree order, and `{id,keys}` changes in next-tree order. Children compare immediate
child ids; a descendant's state change does not also mark its ancestors changed.

With `a11y-actions` registered, `semanticAction(id,action)` rejects missing ids or unavailable actions with false.
Tap fires activate or queues a bool toggle; repeated taps before a step compose in queue order; absent activate it toggles the first bound
checked/pressed/selected field. Increase/decrease add/subtract step and clamp value
to min/max. Writes are queued for the next step. Disabled controls expose no actions;
readonly controls expose no edit actions, including when the binding names a read-only data input such as list length. They may still expose focus. Focus delegates to the optional focus module.
Focusable ancestors report focused; hidden focus retargets toward a focusable ancestor,
then the next focusable node in tree order, then clears. Focus/traversal stays in focus.

## Headless commands (SPEC §11.2 extension)

| Command | Effect |
|---|---|
| semantics [id] | One JSON line: forest, or the identified subtree; unknown subtree id is a script error |
| semantic id tap\|increase\|decrease\|focus | Queue the action, then step(0) |
| snapshot --semantics | Snapshot with an additional semantics tree |

`anima sample --semantics` requests semantic snapshots. The script integration is
one dispatch plus an import; the command implementation is tooling only.

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
after the semantic range clamp. These rules do not infer text labels or add fields
to the shared tree contract.

No parity row is closed. Completed independent conformance probes cover simple
painted group bounds, dotted component/repeat ordering through shrink/hide, and
read-only semantic/data action descriptions and dispatch. The native roles probe
compares 16 roles, labels, simple bounds and seven state projections across three
focus snapshots. It does not establish semantic action availability, exact path
bounds or all focus policies. Pending oracle markers stay pending.

Remaining work: exact path/stroke bounds and curve extrema; painted-group bounds
independent of child semantic overrides; nested/repeated focus ordering and dotted
targets; semantic hidden/disabled/modal restrictions in traversal; ancestor machine
conditions; dependency-driven collection and identical-signature owner replacement;
late focus registration on already compiled models; Solo visibility; complete
role/trait/default evidence; native tap/increase/decrease and remaining state/focus
captures. Filtered `semantics <id>` works and is tested. The DOM overlay is owned
by P3b-8 and is outside this implementation.

Design follows `design/p3b/DESIGN.md` §3.1–3.3. Research context:
`docs/research/rive-format-and-graph.md` (registry discipline),
`docs/research/rive-animation-and-state.md` (deterministic queued actions),
`docs/research/rive-web-runtime.md` (separate core semantics and platform overlay).
No source algorithms or documentation text from Rive were copied.


## Module seam (P3b-1b; markup entry split by the orchestrator)

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
`docs/research/rive-format-and-graph.md`; no external algorithm is ported. No public
capability is closed by the split. See REPORT.md for the 2,104 B centered-stroke
probe that exceeded the fixed budget and was reverted. Completion requires further
budget/ownership work by the orchestrator; no additional runtime module was added.
