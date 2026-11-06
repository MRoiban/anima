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

## Attributes

| Attribute | Meaning |
| --- | --- |
| `renderer` | `svg` (default) or `canvas`; import `@anima-format/web/canvas` before selecting canvas. Switching preserves player state. |
| `pixel-ratio` | Canvas only: finite positive DPR override; absent follows browser DPR. |
| `src` | Document URL; `.animl` URLs use the optional compiler. |
| `speed` | Finite number ≥ 0, default 1. Invalid values use 1. Frame dt is clamped to 0.25 s before multiplication. Zero sleeps until a positive rate or another operation wakes it. |
| `paused` | Presence pauses playback, including initial loading. Removing it applies queued writes with a zero-time step and resumes. |
| `fit` | `contain` (default), `cover`, `fill`, or `none`. Unknown values use `contain`. |
| `align` | `center` (default), `top-left`, `top`, `top-right`, `left`, `right`, `bottom-left`, `bottom`, `bottom-right`. Unknown values use `center`. |
| `motion` | `full` or `reduce`; otherwise follows `prefers-reduced-motion`. |
| `label` | Overrides the document's accessible label. |

`contain` maps to SVG `preserveAspectRatio="<alignment> meet"`; `cover` uses `slice`;
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
| `set(name, value)` | Queue a bool or number write; applied on the next step. |
| `fire(name)` | Queue a trigger. |
| `toggle(name)` | Queue a bool toggle. |
| `get(name)` | Current committed bool or number value, or undefined for a missing input/trigger/empty element. Queued writes are not reflected yet. |
| `values()` | Current resolved values keyed by animated address. |
| `pause()` | Add `paused` and remove this instance from the scheduler. No stepping, including pointer handling, occurs while paused. Inputs continue to queue. |
| `play()` | Remove `paused`, apply queued writes, and resume; safe to repeat. |
| `reset()` | Reload the current model from its defaults and initial states, discarding queued input and retaining the host element, attributes and external event listeners. Keeps explicit pause. Emits `anima:load`. Empty elements are unchanged. |
| `destroy()` | Idempotently detach internal listeners, observers and scheduler entry, invalidate pending URL responses, and clear the player and SVG. Keeps the host and external listeners. A later `load()` or new `src` can reuse it. |
| `invalidate()` | Repaint the retained SVG once without stepping, consuming queued inputs, or scheduling frames. Empty elements are unchanged. |

The shared scheduler sleeps when settled; offscreen and hidden documents suspend animation.
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


P5 module registration: inline/fetched sources and failed explicit `load` calls retry when a
compiler hook or runtime module registers later. The failed attempt still emits `anima:error`
and rejects its `ready`; the retry replaces `ready` with the new attempt's promise. Successful
loads stop retrying, and explicit `destroy()` cancels retained sources. Modules can load before
or after markup support and after the icon is connected. A loaded player's state is preserved
when unrelated modules register. Registration listeners detach when an icon disconnects; a retained
failed source retries on reconnection, including when its modules arrived while disconnected.

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
