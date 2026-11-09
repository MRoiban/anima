# Web host API

Import `@anima-format/web` (or the built `anima-icon.js` module) to register `<anima-icon>`.
The browser package has no runtime dependencies. Load `.ani` through `src`, an inline
`<script type="application/vnd.anima+json">`, or `load()`. For `.animl` and inline
`application/vnd.anima+xml`, import the optional `@anima-format/web/markup` module first.

```html
<anima-icon id="bell" src="bell.ani" paused speed="0.5" label="Notifications"></anima-icon>
<script type="module">
  import '@anima-format/web';
  const icon = document.querySelector('#bell');
  icon.addEventListener('anima:load', ({ detail }) => console.log(detail.inputs));
  await icon.ready;
  icon.fire('ring'); // queued while paused
  icon.play();
</script>
```

## Optional markup hooks

Load `@anima-format/web/markup` plus the modules used by the source, before calling `load`
(or before inline source loads). Components, bind and paint automatically register their markup
hooks; either module/markup import order works, including with separate built bundles.
For example:

```js
import '@anima-format/web/markup';
import '@anima-format/web/components';
import '@anima-format/web/bind';
```

The small `markup-components`, `markup-bind` and `markup-paint` entries register only authoring
hooks, without loading the compiler or runtime modules. Their built files are
`anima-markup-components.js`, `anima-markup-bind.js` and `anima-markup-paint.js`.
A composite-only page with `<clip>`, `<mask>`, `<drawOrder>` or multiple paints must import
`@anima-format/web/markup-paint` as well as `markup` and `composite`. Registry-derived asset
forms need only markup and the assets runtime module. Missing hooks produce
`markup-components-unavailable`, `markup-bind-unavailable` or `markup-paint-unavailable`, with
source positions and a message/hint naming what to load. Precompile with `anima build` to avoid
shipping any markup compiler. CLI and playground retain every authoring feature.

The shared registration follows the optional-layer precedent in AniML §9 and the small,
capability-based runtime guidance in [web runtime research](research/rive-web-runtime.md#lessons-for-anima).

## Sizing

The default SVG host is `1em` wide and uses the document viewBox aspect ratio for
its automatic height. A selected `component` uses its own viewBox. CSS width,
height and aspect-ratio override the defaults; setting both dimensions keeps that
box. For example, a 24×7 stepper with `width: 240px` is 70px high by default.
By default, the host's long axis spans `grid` units; the short axis follows its
viewBox aspect. Both drawing axes use the same scale. For viewBox `[x,y,w,h]`,
`w >= h` gives an SVG width of `w/grid` times the host width, with its own `w/h`
aspect and offsets `x` and `y` at that scale; mirror this for a tall viewBox.
Square viewBoxes keep their existing grid/bleed mapping. Pointer hits and semantic
bounds use the drawing's transform, and canvas uses the same placement. Fit and
alignment still apply inside the host box. Canvas retains its own host sizing defaults.

## Fit, alignment and artboard size

Import `@anima-format/web/host-fit` for the full fitting API:

```html
<anima-icon src="bell.ani" fit="fit-height" alignment="bottom-right"
  style="width:240px;height:100px"></anima-icon>
```

`icon.fit` and `icon.alignment` reflect the HTML attributes. Fits are `contain`,
`cover`, `fill`, `fit-width`, `fit-height`, `none`, `scale-down` and `layout`.
The nine alignments are `top-left`, `top-center`, `top-right`, `center-left`,
`center`, `center-right`, `bottom-left`, `bottom-center` and `bottom-right`.
Legacy `align` and its edge aliases (`top`, `left`, `right`, `bottom`) still work;
`alignment` takes precedence. Unknown fits use contain and unknown alignments center.

A requested fit maps the entire artboard rectangle to the host's CSS content box. Borders and padding are excluded for either `box-sizing` mode; `fit="layout"` uses those same content dimensions for `layoutSize`. The `host-fit` entry includes the separately bundled `host-fit-size` API entry.
Contain preserves proportions; cover fills and crops; fill stretches each axis;
fit-width/height match that axis; none uses one CSS pixel per grid unit; scale-down
never enlarges. SVG and canvas share that mapping, including hit testing and the
accessibility overlay. Changing renderer preserves the player. Loading host-fit
without requesting a fit, alignment or size keeps the existing SVG grid/bleed default.

`icon.size` returns a detached `[width,height]` pair in grid units. Assign a positive
finite pair to override that host's artboard size; `icon.resetSize()` restores the
authored size. Overrides do not edit the shared document/model or other hosts.
Invalid writes dispatch `anima:error` with `host-size` and leave the size unchanged.
An unloaded host without an override reports `[0,0]`. Assignments are retained and
readable before load; drawing uses them once the document loads.

`fit="layout"` uses one CSS pixel per grid unit and resizes the root artboard to
match the host, rather than scaling its authored dimensions. It takes precedence
over an explicit size while active. A root layout provider consumes the per-player
`layoutSize` seam; this ticket tests that seam with a stub pending P7-2 integration.

## Attributes

| Attribute | Meaning |
| --- | --- |
| `renderer` | `svg` (default) or `canvas`; import `@anima-format/web/canvas` before selecting canvas. Switching preserves player state. |
| `component` | With host-edit: exported root name. Set before load, loadModel or reset; changing it alone does not reload. |
| `pixel-ratio` | Canvas only: finite positive DPR override; absent follows browser DPR. |
| `src` | Document URL; `.animl` URLs use the optional compiler. |
| `speed` | Finite number ≥ 0, default 1. Invalid values use 1. Frame dt is clamped to 0.25 s before multiplication. Zero sleeps until a positive rate or another operation wakes it. |
| `paused` | Presence pauses playback, including initial loading. Removing it applies queued writes with a zero-time step and resumes. |
| `fit` | Base: `contain`, `cover`, `fill`, `none`; host-fit adds `fit-width`, `fit-height`, `scale-down`, `layout`. Unknown values use `contain`. |
| `alignment` | With host-fit: nine positions; see fitting above. |
| `align` | Legacy alias. `center` (default), `top-left`, `top`, `top-right`, `left`, `right`, `bottom-left`, `bottom`, `bottom-right`. Unknown values use `center`. |
| `motion` | `full` or `reduce`; otherwise follows `prefers-reduced-motion`. |
| `label` | Overrides the document's accessible label. |

Without the host-fit entry, `contain` maps to SVG `preserveAspectRatio="<alignment> meet"`; `cover` uses `slice`;
`fill` uses `none` and ignores alignment. Alignments map to SVG `xMin/xMid/xMax` and
`YMin/YMid/YMax`. The default layout retains the grid-sized host and viewBox bleed described
in [Architecture](ARCHITECTURE.md#web-packagesweb); SVG overflow remains visible, including
with `cover`. Size the host with CSS, for example `width: 40px; height: 40px`.

`fit="none"` gives the SVG viewport the viewBox's width and height in CSS pixels, so one grid
unit equals one CSS pixel. The entire viewBox rectangle (including bleed) is aligned within
the host using `align`, without scaling. Its `preserveAspectRatio` remains `<alignment> meet`.
Changing fit or align updates the existing SVG and pointer coordinate mapping immediately.

## Properties

| Property | Meaning |
| --- | --- |
| `speed` | Read/write number reflecting the `speed` attribute. Invalid writes normalize to 1. |
| `playback` | Read-only `empty` (no player), `paused` (explicit pause), `playing` (pending input or animation), or `settled`. Visibility suspension and speed zero do not change logical playback state. |
| `info` | Read-only detached summary, or `null` when empty; shape below. |
| `ready` | Promise for the first load; resolves on success, rejects with diagnostics on failure. Use `anima:load` for subsequent loads. |
| `player` | Core `Player`, for debugging. Direct calls bypass host playback controls. |
| `trace` | Assign an array to record input, pointer and step operations for replay. |

`info` is `{ name, title, grid, viewBox, inputs, timelines, layers }`:

- `inputs`: `{ name, type, default, min?, max? }`; bounds appear for bounded numeric inputs.
  Trigger defaults are false; `get()` returns undefined for triggers.
- `timelines`: `{ name, duration, loop }`; duration is seconds and loop is `once`, `loop` or `pingpong`.
- `layers`: `{ name, initial, states: string[] }`.

`title` may be undefined. Each access returns a fresh summary, so editing it does not modify
playback or the loaded model.

## Methods

| Method | Meaning |
| --- | --- |
| `load(textOrObject, markup = false)` | Load a document; returns diagnostics. Errors leave the element empty and emit `anima:error`. |
| `loadModel(model)` | Instantiate a compiled model with fresh player state. With `host-edit`, the host's `component` selects any retained exported root, independent of the root previously loaded from that model. |
| `set(name, value)` | Queue a bool or number write; applied on the next step. |
| `fire(name)` | Queue a trigger. |
| `settle()` | Resolve current inputs, blends and once-timelines silently, then draw. Returns true if at rest; false if deferred or capped. |
| `toggle(name)` | Queue a bool toggle. |
| `get(name)` | Current committed bool or number value, or undefined for a missing input/trigger/empty element. Queued writes are not reflected yet. |
| `values()` | Current resolved values keyed by animated address. |
| `pause()` | Add `paused` and remove this instance from the scheduler. No stepping, including pointer handling, occurs while paused. Inputs continue to queue. |
| `play()` | Remove `paused`, apply queued writes, and resume; safe to repeat. |
| `reset()` | Reload the current model from its defaults and initial states, discarding queued input and retaining the host element, attributes and external event listeners. Keeps explicit pause. Emits `anima:load`. Empty elements are unchanged. |
| `destroy()` | Idempotently detach internal listeners, observers and scheduler entry, invalidate pending URL responses, and clear the player and SVG. Keeps the host and external listeners. A later `load()` or new `src` can reuse it. |
| `invalidate()` | Repaint the retained SVG once without stepping, consuming queued inputs, or scheduling frames. Empty elements are unchanged. |

`set()` and `fire()` also queue before a player exists, including while asset loading
is deferred. Calls retain their order and apply to the next player this host creates,
before its first step. They are consumed once; a superseded asynchronous load does
not consume them. Unknown names and invalid values follow the player's normal error
handling when the queue is applied.

For a control that should **mount already on**, call `set()` then `settle()` before
the first paint. You can do this before loading:

```js
const icon = document.createElement('anima-icon');
icon.set('on', true);
icon.settle(); // false: deferred until a player exists
icon.load(scene);
document.body.append(icon);
```

`settle()` consumes current queued inputs and advances in bounded 0.25-second steps
(up to 60 simulated seconds), stopping as soon as the player reports rest. It discards
all events from those steps and suppresses `anima:event` and `anima:state`, including
on the next normal frame. It draws the resulting state and updates ARIA. Pause and
speed settings are preserved; normal playback is re-armed if still busy. Loops or
other scenes that cannot reach rest return false at the cap. Calling it without a
player queues the operation in order with `set()` and `fire()`, returns false, and
resolves it before that player's first draw. Simulation is independent of host speed;
normal reduced-motion policy still applies.

Successful `load()` compilation is shared by parsed document identity (weak references) or exact
source text (a 16-entry LRU, separately keyed for JSON and AniML). Treat parsed documents as
immutable; pass a new object after editing one. Module registration invalidates these caches;
failed loads are never cached. Every host still owns its Player, queued writes, resolved resource catalog and DOM. With
`host-edit` imported before compilation, all validated component roots are retained and chosen
at instantiation, including for `loadModel` and reset. An absent root reports `unknown-component`
at `/component` with the available component names. No root-specific recompilation is needed.
`AnimaIcon.compile(source, markup?)` exposes the same cached `{ model?, diagnostics }` result
when an application wants a compiled model before creating any hosts.
URL sources with host-edit share a bounded cache by absolute URL and module registration
generation; roots, asset resolvers and policy do not split compilation. Asset decoding retains
its separate resolver/policy/base-URL cache. Inline JSON uses the text cache.

The shared scheduler sleeps when settled; offscreen and hidden documents suspend animation.
On viewport re-entry, an unpaused host commits pending data with `step(0)` and draws synchronously
in the visibility callback before resuming animation. Explicit pause retains queued data until play;
speed zero still permits this zero-time refresh.
Disconnecting the host removes its scheduler entry and observations; reconnecting resumes a busy
player. Keyboard, pointer, reduced motion and accessibility behavior follow spec §9–10.
The API follows the small imperative handle, shared sleeping scheduler and idempotent teardown
recommendations in [web runtime research](research/rive-web-runtime.md#lessons-for-anima).

## Events

| Event | Detail | Behavior |
| --- | --- | --- |
| `anima:load` | `info` | After every successful load, once the initial SVG and a11y are ready. Does not bubble. |
| `anima:error` | Diagnostic array | Failed load; also logged to the console. Does not bubble. |
| `anima:event` | `{ name, layer, time }` | Authored runtime event. Bubbles across shadow boundaries. |
| `anima:state` | Object mapping layer names to current states | State change. Bubbles across shadow boundaries. |


Anima never calls `stopPropagation()` or `stopImmediatePropagation()` on DOM events.
Keyboard and pointer events from the host or semantic controls bubble to page listeners.
Only consumed browser defaults are prevented: for example, tab-list arrow navigation
sets `defaultPrevented`, while an unhandled Escape does not. Semantic controls own their
native keys and pointer events; the host guards against duplicate root activation and
legacy pointer routing. Input owns its pointer events even when automatic listeners are
disabled, so disabling input cannot fall back to legacy pointer handling. Authored
input `consume`/`propagate` options govern only Anima's internal listener delivery;
they do not stop DOM propagation to the page.

P5 module registration: inline/fetched sources and failed explicit `load` calls retry when a
compiler hook or runtime module registers later. The failed attempt still emits `anima:error`
and rejects its `ready`; the retry replaces `ready` with the new attempt's promise. Successful
loads stop retrying, and explicit `destroy()` cancels retained sources. Modules can load before
or after markup support and after the icon is connected. A loaded player's state is preserved
when unrelated modules register. Registration listeners detach when an icon disconnects; a retained
failed source retries on reconnection, including when its modules arrived while disconnected.

## Motion module

Import `@anima-format/web/motion` and declare `requires="motion"` in AniML (or
`requires: ["motion"]` in JSON). The module can register before or after the base
runtime/markup module and retries a source that was waiting for motion.
It installs the same methods on `Player` and `<anima-icon>`:

| Method/property | Meaning |
| --- | --- |
| `animations` | Detached `{name,duration,speed,quantize,work:[start,end],loop}[]`; quantize is null when absent. All times in seconds. |
| `timeline(name)` | Reuse/create the default `TimelineInstance` for that timeline. |
| `createTimeline(name, {name?,mix?,speed?,loop?})` | Independent instance; explicit name required when another instance uses the default name. |
| `seek(name, seconds)` | Seek its default instance in the authored work area; returns the handle. |
| `scrub(name, progress)` | Pause its default instance and seek normalized work-area progress. |
| `applyTimeline(name, seconds, {mix?})` | Pause, seek and weight the default instance. |
| `machine(name)` | Create/reuse a named machine instance from `machines[name]`. |
| `node(id, type?)` | Typed handle `{id,type,get(key),local,world}` or undefined for a missing id/type. |

A timeline handle exposes `info`, `time` (read/write seconds), `mix` (0–1), `speed`
(finite, signed), `loop` (`once`, `loop`, `pingpong`; assign null to restore authored),
`playing`, `finished`, and `didLoop`. Methods are `play()`, `pause()`, `stop()`,
`seek(seconds)`, `scrub(progress)`, `advance(dt)` and `apply(mix?)`. All controls return
the handle except `advance`, which returns crossed events. Manual `advance` moves
only that instance; a later player step resolves its pose. It does not dispatch DOM
events itself. Metadata is detached; node handles remain bound to the player that
created them, so acquire new ones after load/reset.

Machine handles expose `name`, `mix`, `player`, `set`, `fire`, `get`, `states`, and
`play/pause/stop`. Their inputs are independent of the default machine. Pause holds
its pose; stop removes its contribution and retains state for resume. The composition
order is the order in which instances were created; each step starts with rest/default
layers, then bindings, then these instances. Numeric values interpolate sequentially;
typed channels and bools assign at any positive mix. Zero mix writes nothing.

Core controls take effect when `Player.step(dt)` next resolves, including `step(0)`.
On the element, handle changes wake the shared scheduler; a paused element retains
pending changes until `play()`. For deterministic paused inspection, call
`icon.player.step(0)` then `icon.invalidate()`. Global `icon.play()/pause()` and its
nonnegative `speed` attribute retain their existing meaning; reverse speed is on the
individual timeline handle. Finishing/pausing all instances lets the scheduler sleep.
Authored timeline events use the instance name as their layer; named-machine events
use `instance/layer`. Seek/scrub emit no crossed events. Stale handles do not wake a
newly loaded player.

Player `states()` and `inspect()` include named machines under `instance/layer`;
`anima:state` therefore also reports their state changes without overwriting default
layer names. A stopped machine retains its state for inspection and resume.

## Optional Canvas2D backend

```html
<anima-icon renderer="canvas" src="scene.ani"></anima-icon>
<script type="module">
  import '@anima-format/web';
  import '@anima-format/web/canvas';
  // Import paint/assets/components/etc. as required by the scene, just as for SVG.
</script>
```

Canvas shares the host's player, scheduler, visibility pause, reduced motion and core hit testing.
ResizeObserver and resolution notifications keep its backing dimensions at CSS viewport size × DPR;
`pixel-ratio="2"` overrides DPR and `icon.devicePixelRatioUsed` reports it. Size changes repaint without
stepping. `invalidate()` repaints colours from the host's computed style; call it after changing CSS
slots on an idle scene. It does not consume queued input. Disconnect/destroy removes observers;
reconnect restores them. Canvas clips to its viewBox viewport and isolates blending from the page.

Rendering errors arrive as `anima:error` diagnostics (`unsupported-render` with the feature name,
pointer, message and hint). Unavailable backends use the host root pointer. Current limitations:
nonuniform/sheared local feathering (world feather works through nonuniform node transforms),
nonuniform viewport feathering and partial fixed-stroke trims. Cross-origin images require CORS.
SVG remains the CLI renderer and default browser renderer. Measurements and raster differences are
recorded in [the canvas test report](../modules/canvas/test/web/RESULTS.md).

## Focus module

Import `@anima-format/web/focus` and declare `requires="focus"`. Nodes with a `<focus>`
child become real shadow-DOM focus targets. The icon is one Tab stop by default;
arrows move focus inside it, and Tab leaves. A node's `focus.tabStops: true`
(AniML `tab-stops="true"`) opts into native inner Tab stops. Focus/blur listener
actions queue through the core player. Existing host Enter/Space activation remains.

`icon.player.focused` reports the local id or dotted component path. Core methods
`focusTarget(id)`, `focusClear()`, `focusTraverse(direction)` and `focusPointer(x,y)`
share browser and headless traversal. Component-local state machines read local ids.
Use `anima sample`'s focus/key commands for deterministic inspection (SPEC §11.2).

## Input module

Import `@anima-format/web/input` and declare `requires: ["input"]`. `icon.input()` returns
the player's controller for queued manual input. `inputPointer`, `inputKey`, `inputScroll` and
`inputGamepads` accept the same arguments as its `pointer`, `key`, `scroll`, and `gamepads` methods,
and commit/repaint immediately unless paused. Coordinates are source-grid coordinates.
`inputPoint(clientX,clientY)` maps a client position through the SVG screen matrix, or the
axis-aligned canvas fit/alignment viewport. The exported `inputMatrix` computes the source-to-CSS
viewport transform. Arbitrary CSS rotations/skews of a canvas host are not supported by this
fallback; SVG mapping uses the browser's actual matrix.

`inputOptions` accepts a partial options object and returns a detached full snapshot. Defaults:
`listeners:true`, `multitouch:true`, `pointerExit:true`, `touchScroll:true`, `gamepads:false`,
`requireFocus:true`. Disabling automatic listeners cancels current contacts but leaves manual
input available. Multitouch false ignores non-primary contacts; pointerExit false retains
contacts across DOM leave. Touch scrolling selects `pan-x pan-y` or `none` via touch-action.
Wheel line deltas use 16 CSS pixels and page deltas use host height; fractional pixel deltas
remain exact. Only a handled wheel calls preventDefault. A controller query `wantsScroll`
receives the same clock as its scroll events (DOM events use performance.now()/1000).

Gamepad polling is explicit opt-in, respects document visibility and optional host focus,
submits disconnection records, and stops after destroy/disconnect. Re-enable polling on a
reconnected host if its previous poll has stopped. Native cursor intent follows the foremost
interactive target. Keyboard filtering is independent of role; existing Enter/Space button
activation is retained. Destroy aborts module handlers and removes its polling entry.
See [the input contract](../modules/input/SPEC.md) for deterministic routing, hit tests and values.

When input and focus are both declared, input owns keyboard routing and pointer capture;
focus supplies traversal and real DOM ownership. Authored key listeners see the previous owner
before navigation. Enter and Space still use the host accessibility activation path. Logical
focus changes wake machine guards through `Player.machineFocus(nodeId)` and `onChange`.

## Events module

Import `@anima-format/web/events` for typed payloads, URL policy, Web Audio, lifecycle
notifications and subscriptions. Existing `anima:event`, `anima:state`, `anima:load` and
`anima:error` retain their meaning. Added events are `anima:advance` (`{dt,events,settled}`),
`anima:draw` (`{revision}`), `anima:statechange` (states map), `anima:loop` (loop record),
`anima:play`, `anima:pause`, `anima:stop` (null), and `anima:loaderror` (diagnostics).
Draw notifications follow synchronous drawing, including invalidate/build; advance notifications
follow a host step/draw and precede delivery of its custom events. Direct `player.step` does not
dispatch DOM events. `anima:event` is Anima's generic custom event, including payloads.
`loaderror` is delivered before the failed load destroys the previous scene.

`icon.on(type, callback)` accepts `event` or `anima:event` and returns an unsubscribe function.
Duplicate subscriptions use EventTarget's identity semantics. `off(type,callback)` removes one;
`unsubscribeAll()` removes subscriptions installed with on. Explicit destroy clears those subscriptions; load failure retains them so both loaderror and the
existing error notification reach subscribers.
`stop()` pauses and reloads the initial scene while retaining paused state, then reports stop.
`play`/`pause` report actual paused-attribute changes; autoplay load reports play.

Navigation defaults to denied. Opt in with `url-policy="allow"` or `icon.urlPolicy =
(url,target,event) => boolean`. HTTP(S) protocol and relative-reference same-origin checks
always apply. The callback receives a detached URL, so mutating it cannot change the validated
navigation destination. `_blank` uses noopener; other targets remain subject to browser rules.

Audio additionally needs `@anima-format/web/assets` for asset declarations. `icon.volume`
is a finite [0,1] master gain (default 1; invalid assignments throw RangeError). It updates
already playing sources. Authored `audioVolumes` controls every use of an asset; event volume
controls one occurrence. No event before prior user activation fetches, decodes or starts audio.
Decode starts on demand, never at document load. Reload/disconnect/destroy invalidates pending
audio work and releases sources/context. Playback remains subject to browser audio permissions.
See SPEC's events chapter for payload snapshot timing and next-step local listeners.

Event definitions also apply to state endEmit and transition startEmit/endEmit actions. Their
payloads and host delivery follow the same path as timeline events.
