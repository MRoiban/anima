# Node accessibility (P3b draft; partial implementation)

This chapter specifies the P3b design contract. Implementation is blocked on size:
its first measured registration entry adds 3,624 B versus the 2,048 B core limit.
The implementation below is a prototype, not a completed capability. Root document
`a11y` in SPEC §10 retains its existing shape, validation and behavior.

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

`SemanticNode`, `SemanticAction`, `SemanticDiff` are exported from the module's core
entry. `test/fixtures/tree.json` is the wave-2 contract, checked by
`test/core/semantics.test.ts`. The tree is an ordered forest. Every node has id,
role, states, world-grid bounds [x,y,w,h], actions and children; optional fields are
label, hint, value (string/number), level, href, min, max, step. States include
checked (boolean or `mixed`), pressed, selected, expanded, disabled, required,
readonly, modal, focused, live (`polite`/`assertive`). No DOM objects are exposed.

`player.semantics()` lifts descendants through nodes without semantics and through
role none. Hidden/invisible subtrees are excluded, opacity does not hide. A modal
sibling suppresses its siblings. IDs in component instances and repeated rows are
dotted. Intended bounds are transformed painted bounds, or an explicit local box.
The tree is cached across unchanged reads and steps; changed semantic inputs,
geometry or focus invalidate it. Hosts must treat returned snapshots as read-only.

`semanticDiff(previous,next)` and `player.semanticDiff` return added and removed ids
in tree order, and `{id,keys}` changes in next-tree order. Children compare immediate
child ids; a descendant's state change does not also mark its ancestors changed.

`semanticAction(id,action)` rejects missing ids or unavailable actions with false.
Tap fires activate or toggles its bool; absent activate it toggles the first bound
checked/pressed/selected field. Increase/decrease add/subtract step and clamp value
to min/max. Writes are queued for the next step. Disabled controls expose no actions;
readonly controls do not accept edits. Focus delegates to the optional focus module.
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

## Evidence and remaining gaps

No parity row is closed. Pending conformance/oracle probes retain `todo.json` and
never count as passing. Native CLI 1.9.1 supports `--semantics` and
`--semantic-action`; logical comparisons therefore require real captures, not skip
notes claiming the CLI cannot inspect semantics. Captures were not completed before
the budget stop.

Known unverified/incomplete areas: transparent modal scopes, focus conditions on
ancestors, repeated-row focus items, inactive Solo visibility, painted group bounds
and stroke/path extrema, data bindings, role/trait defaults, cache invalidation under
nested structural changes, and CLI flags combined with filtered snapshots. The
wave-2 overlay is not implemented. The shared shape is a draft until these are resolved.

Design follows `design/p3b/DESIGN.md` §3.1–3.3. Research context:
`docs/research/rive-format-and-graph.md` (registry discipline),
`docs/research/rive-animation-and-state.md` (deterministic queued actions),
`docs/research/rive-web-runtime.md` (separate core semantics and platform overlay).
No source algorithms or documentation text from Rive were copied.
