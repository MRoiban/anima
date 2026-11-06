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
surviving item object and shared named reference. Host-edit edits run before host's ordinary queued
writes in the same step (host exposes no common enqueue hook). Whole-list host replacement retains
host's existing replacement semantics. A batch coalesces wake requests and cannot be stepped.
Callback edits wait until the following step. Shared compiled metadata remains unchanged.

Web `icon.instance(id)` returns the existing nested Player (data, set and fire); dotted IDs traverse
nested components. Child data writes wake the root. `component="name"` set before loading chooses a
component definition as root, retaining the document's modules, assets, data and component definitions.
`AnimaIcon.ready` resolves after entries imported in the current synchronous import group register;
await module imports first. Per-element `icon.ready` retains its existing load semantics.

Web `image(path).set(assetName | URL | Blob)` retains declared asset-name writes. URL/Blob writes
return a promise that resolves after decode and queues replacement for the following step. The
property must already name a loaded image asset. The replacement affects uses of that asset in
that icon's model, leaves other icons unchanged, and does not mutate authored asset declarations.
The property value remains the asset ID, so decoding alone does not deliver a data change event.
Blob sources are persisted as data URIs, with no retained object URLs. A later replacement request
wins over an earlier decode; reload/destroy prevents stale commits. Failed decode, unavailable
consumer/asset or unsupported/external URL is data-asset; malformed values are data-type. Data URLs
and same-origin URLs are accepted by default; the assets module's assetPolicy='any' permits external
URLs. Core-only host-edit retains asset ID writes and rejects decode requests as data-asset.

Unimplemented seams are recorded in REPORT.md; no component-property, global rebinding or
compiled-document cache behavior is claimed by this spec yet.

The stable-object graph approach follows docs/research/rive-format-and-graph.md §6, and lifecycle/
registration boundaries follow docs/research/rive-web-runtime.md §4. No Rive source is used.
