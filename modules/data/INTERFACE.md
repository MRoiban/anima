# P4e integration hooks

`data` exposes `registerConverter(name, fn)` on its composed Module object and as a core export.
`fn(value, options, ctx) => value`; `ctx` contains `{player, dt, direction, get(path), state}`.
`state` is a player-local Map; optional `key` identifies the stable binding target. Convert namespaces its binding-local maps inside `state`; `direction` is `forward` or `reverse`.
Registration is idempotent replacement by name. A binding's `convert` selects this name.
Named authored converter dispatch may register a function under each declared name; `options`
is the binding's `options` object. `$` option strings resolve against the current scope.
Converters must return a value acceptable to the destination; reverse conversion is explicit.
The shared runtime registry is `(registry.get('data') as DataModule).registerConverter` in `init`.

`bind` exposes `registerFunction(name, arity, (...numbers) => number)` on its composed Module
object and its core expression export. Only registered calls are accepted by the parser.
Functions may carry an optional `enabled()` predicate; the parser rejects an unavailable call. Convert uses this to require its feature during document loading, preserving bind-only syntax. Functions take fixed numeric arity; nonfinite results retain bind's zero rule.

Data paths are exposed as typed model inputs and player scopes. Binding objects are owned by
data; legacy string bindings continue through bind. Runtime data state is accessed with
`dataState(player)` (also on the composed data Module for separate bundles), the future host API's internal seam (not a completed host API).

`model.afterStep(player)` runs after child steps and before settlement. Data change listeners use it;
the host API can chain it to deliver subscriptions against the complete resolved step.


`derive` composes after data/bind/convert. The active data module exposes `compiled` (model metadata),
`dataState` and the converter registry; consumers must obtain these from the active runtime registry
so separate bundles share identities. `Compiled.modelOf` and `DataState.modelTypes` retain instance
model identity across detached default graphs and host-created/replaced lists. Derive wraps only
models declaring computed properties, marks their scalar refs read-only before action compilation,
and runs before data's post-state snapshot. `DataState.initial` is an optional initialized-value
snapshot for first-step change listeners. Without it, ordinary data listeners retain their original
literal-default baseline.

Data expressions call the active bind parser; the data bundle no longer embeds a duplicate parser.
Direct scalar/opaque `$` path reads remain available without that parser. Arithmetic, comparison and
logical expressions need the bind bundle; unavailable expression parsing is a load diagnostic.

P5b context seam: `DataModule.prepareContext(model, diagnostics)` runs after local refs are
flattened and before authored paths are scanned. Lists supplies synthetic read-only index and
ancestor refs. The callback belongs to the active composed module, including separate browser
bundles. Data scopes clone model identity metadata along with values into `modelTypes`.
Components exposes `ComponentModule.placements`, `componentKey`, `placementContext` and `loadComponent` to compile
inherited templates under their actual parent context without importing lists into components.

Lists forks each player's model draw cache; components `forkModel` copies compiled instance metadata,
and `externalDrawing` delegates drawing only for lists documents. Pure compiled nodes stay shared.
