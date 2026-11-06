# Host data API (normative)

Authoring: [Data: view models, `$` paths and converters](../../docs/AUTHORING.md#data-view-models--paths-and-converters).

Optional `@anima-format/core/host` installs `player.data`; register both data and host.
`@anima-format/web/host` installs `icon.data`. Host adds no document fields, markup
spellings or drawing hooks: registry entries are empty. Authored data remains owned
by data. Pages without this entry pay no host bytes.

Core and web host access starts unbound. `bind(name | {name,model})` selects an
instance of the document's default model; explicit `$instance:property` paths work
without binding. `auto-bind` on the element selects the authored default when loaded.
Existing authored data bindings keep data's default semantics before host binding.

`get(path)` returns a detached value. Typed `number`, `string`, `boolean`, `color`,
`enum`, `list`, `trigger`, `image`, `font` handles expose `value`, `set(value)` and
`on('change', callback)`. Triggers have no stored value and use `fire()`. Image/font
values are declared asset IDs (or empty), not decoded assets. List values use data's
instance notation and owned instance handles; list length is read-only. List writes must
preserve an acyclic instance graph (`data-cycle`). Numbers clamp on writes, colors accept
hex or RGBA bytes, enum values must be declared members. Handles follow subsequent
`bind()` calls; named handles retain their named instance.

Host writes queue until the next `step`, before the ordinary input queue. Subscriptions
run after the complete step, after data's `afterStep`, in subscription insertion order.
Each subscribed path delivers its final changed value once per step. Value snapshots use
structural equality for lists/colors; rebinding alone does not fire a trigger. Trigger occurrences
coalesce to one change per step. Values delivered to callbacks are detached snapshots,
prepared for every callback before any callback runs. Callback writes queue for the next
step; subscriptions to removed list-item paths are automatically removed. Unsubscribe is
idempotent and removes pending delivery. `batch(fn)` returns fn's
result and coalesces wake requests, including nested batches; it does not step. Stepping
inside a batch throws. A throwing batch retains writes already queued.

`instances()` returns `{name,model}` records; `create(model, values)` validates through
the data loader, creates isolated storage and returns a record for `bind()` or named paths.
`models()` returns `{name,properties:[{name,type,values?,assetType?}]}` with resolved enum
members. Returned metadata is detached. Shared compiled models remain unchanged.

`DataError extends Error` carries code, JSON pointer, message, hint and severity. Host
uses data's diagnostic vocabulary: `data-type` for wrong handles/values/model binding,
`data-path` for unknown properties, `data-readonly` for length writes, `data-model` for
unknown models, `data-instance` for missing/unbound instances, `data-asset` for wrong
asset IDs. Creation forwards the loader's exact diagnostic (including code and pointer).
Data exports `dataCodes` from its core entry and composed module; host uses the same table.

This implementation uses the graph metadata and host boundary discussed in
[graph research](../../docs/research/rive-format-and-graph.md) §6 and
[web research](../../docs/research/rive-web-runtime.md) §4. No Rive source is used.
