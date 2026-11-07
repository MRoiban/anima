# Data and host inspection

`data-host` is the optional browser/package entry; its document feature name is `datahost`
(the runtime feature-name grammar permits letters only). It imports no other optional entries.
Host model access requires `host` and `data`; image binding literals additionally require `assets`
and `bind`. Geometry inspection is pure, does not step the player, and works without data models.

`player.computed(id)` returns a detached, recursively frozen snapshot `{world, bounds, opacity}`.
`world` is the six-number node-to-root affine matrix. `opacity` multiplies the resolved node and
ancestor opacities. `bounds` is a root-space geometric axis-aligned box including descendants;
it excludes strokes, clips, masks, visibility, effects and layout. Circles are analytic, rectangles
use transformed corners, paths solve cubic derivative extrema after transforming their normalized control points. Empty geometry has zero bounds at its origin.
Unknown ids throw `data-path` at `/data/<id>` with a hint. Inspection has no timing effects.

`data.at(path)` resolves the declared type and returns the corresponding live handle with a
discriminating `type` field. TypeScript callers narrow `handle.type` before a typed write (for
example, `if (handle.type === "string") handle.set("Grace")`).
Paths allow optional `$`, named `$instance:property`, nested models and indexed lists, with the
same validation, retained-handle rebinding and queued writes as the typed accessors. `color(path)`
already supports nested models; `host-edit` adds `.rgba` and `.hex`. `component(path).set(name)`
selects a declared component by its definition name; unknown names fail `data-type`.
`exportedInstances()` returns detached authored instance records with `exported: true` only,
including private-to-default-model types; dynamically created records are not authored exports.
`data.batch(fn)` queues every write, coalesces wakeups, and subscriptions run once per changed
handle after the complete step. Throwing does not roll back writes. Steps within a batch are errors.

With `datahost`, bindings accept `asset("name")` as a validated string literal, including inside
comparisons and `mix`-independent conditional boolean expressions. Undeclared names report
`unknown-asset` at the binding JSON pointer with a declaration hint. Quoted text is opaque.
The ordinary bind type rules apply. Both JSON `bind` and AniML `<bind>` use the same expressions.

`icon.src` reflects the `src` attribute. Setting it follows the existing asynchronous load,
registration retry, last-request-wins and error lifecycle; an empty value does not load.

Implementation is independent. The host responsibility split follows
[the web runtime research](../../docs/research/rive-web-runtime.md); no native source is reused.

Image nodes expose discrete string `asset` slots to bindings. JSON `bind: {"pic.asset": {"value": "$photo"}}`
is AniML `<bind target="pic.asset" value="$photo"/>`. The declared node `asset` remains a valid
image fallback when a runtime expression returns an unavailable or non-image resource ID.
URL/Blob host replacements publish generated player-local IDs at the next step, with one
normal change notification per changed property. Bindings follow that addressed property;
static consumers without asset bindings retain legacy per-player replacement behavior.
