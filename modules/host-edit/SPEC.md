# Host data editing (normative)

Optional `host-edit` extends host in either registration order. Import host and data as well.
It adds no document fields or AniML syntax; data and components own those fields. The import and
manifest name is host-edit; the internal registration key is hostedit because core currently
rejects hyphenated module names.

`defaultInstance()` returns the authored default record without binding it; `instance(name)`
returns an owned record suitable for host.bind and list insertion. Unknown names are data-instance.

`color(path).rgba` is a detached RGBA byte array; `.hex` is canonical lowercase hex. Existing
`.set(hex | RGBA)` behavior is retained. `enum(path).values` returns detached declared keys;
`.index` reads/writes the member index. Invalid indices throw data-enum.

`list(path)` retains host's detached value/set/on and adds `length`, `at(index)`, `add(values?)`,
`insert(index, values?)`, `remove(index | item | instance)`, and `swap(a,b)`. Fresh values use the
list's declared model and its defaults; mixed lists require an explicit owned instance. `at` returns
an identity-bearing nested accessor with get/number/string/boolean/color/enum/list methods. Resolve
these methods again after a move; ordinary host scalar handles remain path-based. Removing an item
invalidates its nested accessor. Invalid indices/removed accessors are data-path, wrong models
are data-type, unknown instances are data-instance, missing mixed-list model is data-model, and
cycles are data-cycle. All diagnostics are DataError with JSON pointer, message and hint.

Edits are queued, visible after step, and notify through host's complete-step subscriptions.
List edits compose in call order on a projected list; they splice data's live array, preserving every
surviving item object and shared named reference. Host and host-edit writes use one queue and apply in call order, including a whole-list
replacement followed by helper edits. Whole-list host replacement retains
host's existing replacement semantics. A batch coalesces wake requests and cannot be stepped.
Callback edits wait until the following step. Shared compiled metadata remains unchanged.

Web `icon.instance(id)` returns the existing nested Player (data, set and fire); dotted IDs traverse
nested components. Child data writes wake the root. `component="name"` set before loading chooses a
component definition as root, retaining the document's modules, assets, data and component definitions.
`AnimaIcon.ready` resolves after entries imported in the current synchronous import group register;
await module imports first. Per-element `icon.ready` retains its existing load semantics.

Web `image(path).set(assetName | URL | Blob)` retains declared asset-name writes. URL/Blob writes
return a promise that resolves after decode and queues replacement for the following step. The
property must already name a loaded image asset. The replacement receives a player-local generated asset ID and updates only the addressed data
property at the next step. Image `asset` bindings follow it; two paths sharing the original asset
remain independent, including nested players sharing one compiled component. Static consumers
without any `asset` bindings retain the legacy per-player resource replacement. Authored asset
declarations and other players are unchanged. Decoding alone does not deliver a data change event;
the step publishes the replacement ID through the normal property subscription.
Blob sources are persisted as data URIs, with no retained object URLs. A later replacement request
wins over an earlier decode; reload/destroy prevents stale commits. Failed decode, unavailable
consumer/asset or unsupported/external URL is data-asset; malformed values are data-type. Data URLs
and same-origin URLs are accepted by default; the assets module's assetPolicy='any' permits external
URLs. Core-only host-edit retains asset ID writes and rejects decode requests as data-asset.

`globals()` returns detached owned `{name,model}` records for authored named instances whose model
is global. `setGlobal(name, ownedRecord)` validates that name and delegates to host's queued atomic
rebind. A missing/non-global name or foreign record is data-instance; a wrong model is data-type.
Use instance(name) or create(model, values) to supply the replacement. Globals remain player-local;
shared child contexts see the replacement, while another root player retains its own globals.

The web runtime exposes a sourceLoader hook and loadModel(model) to instantiate a compiled Model.
Host-edit also accepts Models in load(). Host-edit
caches successful source loads by absolute URL, asset resolver function identity, policy, selected
root component and module registration generation. Concurrent consumers share the fetch and parse
(including AniML compilation). Failed source/compile/decode loads are retryable. Late module
registration retains the runtime's ordinary diagnostic/retry path. Same-src icons with identical
resolver/policy decode each initial image once and receive independent mutable asset records.
Asset-free icons share the compiled Model; icons with assets instantiate a validated model from
the cached parsed document because module asset records are model-keyed. This does not reparse
source text or redo the initial decode. Direct compiled-Model loads also isolate asset records.
Changing resolver/policy before setting src creates a distinct cache entry. Image replacements
remain local, even when initial decoding was shared. Cache lifetime is the current page.

`data.component(path)` returns a typed `DataHandle<string>` for a component property. Reads
are committed definition names (or empty string); `set(name)` validates against the same
player's declared component vocabulary and enqueues on host's shared FIFO. A consumed
`<instance component="$card"/>` rebuilds during the next step, before subscriptions run;
equal names retain the child, empty hides it, and clearing/restoring rebuilds it. Retained default
handles follow `bind()`, named handles retain their named target. `list(path).at(i).component(key)`
also follows the item identity. `create` validates component-valued models against the original
vocabulary without recompiling consumers in a temporary data scope. Wrong handle/value is
`data-type`, missing paths `data-path`, invalid create defaults `unknown-component`, with pointers
and hints. This API chooses local definition names; arbitrary foreign-file player/data handles
are outside the decided component-name representation. Root selection remains the existing
`<anima-icon component="name">`/load behavior, independently covered in both browsers.

The stable-object graph approach follows docs/research/rive-format-and-graph.md §6, and lifecycle/
registration boundaries follow docs/research/rive-web-runtime.md §4. No Rive source is used.

Decoded URL/Blob replacements have a reserved, path-and-request-scoped runtime ID. Assigning
that ID to another image property is supported within the same player; replacing the original
property again does not mutate the copied resource. Runtime resources stay in the player-local
catalog until that player is collected. Reloads start a fresh catalog.
