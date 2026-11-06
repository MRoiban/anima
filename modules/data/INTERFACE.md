# P4e integration hooks

`data` exposes `registerConverter(name, fn)` on its composed Module object and as a core export.
`fn(value, options, ctx) => value`; `ctx` contains `{player, dt, direction, get(path), state}`.
`state` is a player-local Map; `direction` is `forward` or `reverse`.
Registration is idempotent replacement by name. A binding's `convert` selects this name.
Named authored converter dispatch may register a function under each declared name; `options`
is the binding's `options` object. `$` option strings resolve against the current scope.
Converters must return a value acceptable to the destination; reverse conversion is explicit.
The shared runtime registry is `(registry.get('data') as DataModule).registerConverter` in `init`.

`bind` exposes `registerFunction(name, arity, (...numbers) => number)` on its composed Module
object and its core expression export. Only registered calls are accepted by the parser.
Functions take fixed numeric arity; nonfinite results retain bind's zero rule.

Data paths are exposed as typed model inputs and player scopes. Binding objects are owned by
data; legacy string bindings continue through bind. Runtime data state is accessed with
`dataState(player)` (also on the composed data Module for separate bundles), the future host API's internal seam (not a completed host API).

`model.afterStep(player)` runs after child steps and before settlement. Data change listeners use it;
the host API can chain it to deliver subscriptions against the complete resolved step.
