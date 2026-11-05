# Rive web runtime: research notes for Anima

- Repo: https://github.com/rive-app/rive-wasm
- Commit studied: `ada7b9f35f951ff491f65f5ffc74a3ed3c582203` (2026-11-05), shallow clone, read-only. Nothing was built, installed or run.
- License: MIT ("Copyright (c) 2020-2021 Rive"), `LICENSE` at repo root. The npm packages also declare `"license": "MIT"`.
- Repo package versions are 2.49.4 (`js/npm/*/package.json`). The installed package measured below is `@rive-app/canvas` **2.45.1**. The public surface of the two is almost the same; the gamepad options are new since 2.45.1.
- The C++ core (`wasm/submodules/rive-runtime`, pinned at `a658a56a…`) is a git submodule and is not in a shallow clone. The watermark notes in §6 come from a separate checkout of `rive-app/rive-runtime` at `1c8f5d3f…`, which is not the pinned commit.
- Layout: `js/src/rive.ts` (6.4k lines, the high-level `Rive` class), `js/src/runtimeLoader.ts`, `js/src/utils/*` (input), `js/src/semantics/*` (accessibility), `wasm/js/renderer.js` (canvas2d renderer written in JS), `wasm/src/bindings*.cpp` (embind glue).

---

## 1. Package variants and sizes

### Variants (`js/npm/*`, `wasm/build_flavor.sh`, `wasm/build_wasm.sh:56-110`)

| Package | API | Renderer | WASM | Notes |
|---|---|---|---|---|
| `@rive-app/canvas` | high-level `Rive` | Canvas2D, driven from JS | separate `rive.wasm` plus `rive_fallback.wasm` (no SIMD) | "heavy" feature set |
| `@rive-app/canvas-lite` | high-level | Canvas2D only (`--renderer=c2d_only`) | separate | built with `-l`, which drops the heavy flags: **no text, audio, layout (Yoga) or scripting** |
| `@rive-app/canvas-single` | high-level | Canvas2D | **inlined in the JS** (`--wasm_single`, emscripten SINGLE_FILE) | no second request; larger JS, slower parse |
| `@rive-app/canvas-advanced(-lite/-single)` | low-level embind API (`canvas_advanced.mjs`), your own loop | same as above | same as above | the "advanced" packages ship the raw module |
| `@rive-app/webgl2` | high-level | Rive Renderer (GPU, pixel-local-storage shaders) | separate | |
| `@rive-app/webgl2-advanced` | low-level | WebGL2 | separate | |
| `@rive-app/webgl2-threads` | high-level | WebGL2, with a replay worker | pthreads wasm | needs a cross-origin-isolated page |

The older WebGL1 `@rive-app/webgl` package is gone from the repo; WebGL2 replaced it.

The heavy flags are `--with_rive_text --with_rive_audio=system --with_rive_layout --with_rive_scripting` (`build_wasm.sh:57`). Text means HarfBuzz shaping plus bidi. Audio uses miniaudio. Layout is Yoga. Scripting is Luau, plus `--scripting_vm=both` (`-w`) so wasm script modules can also run.

The **default `canvas` flavor also links the WebGL2 Rive Renderer.** `premake5.lua:31-32` sets `RIVE_WITH_WEBGL2` for both `c2d` and `webgl2`. In `wasm/js/renderer.js:740-775` the canvas renderer "delegates" draws that Canvas2D cannot reproduce to an offscreen WebGL2 atlas, then blits the result back into the 2D context. Those draws are feathering, non-centered strokes, images modulated by a paint, and strokes under a non-uniform gradient transform. Only `canvas-lite` (`c2d_only`) is a pure Canvas2D renderer. The installed `rive.wasm` contains GLSL strings (`#version`, `GL_EXT_shader_pixel_local_storage`, `WebGL2RenderImage`), which confirms this.

### Measured sizes, installed `@rive-app/canvas` 2.45.1 (`gzip -9`)

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| `rive.wasm` | 2,128,716 | 880,179 |
| `rive_fallback.wasm` (non-SIMD, fetched only if the primary fails) | 2,155,107 | 892,134 |
| `rive.js` (UMD, **not minified**, 10,257 lines) | 581,835 | 127,723 |
| `rive.js.map` | 796,602 | 178,968 |
| `rive.d.ts` | 62,699 | 13,669 |
| `rive_advanced.mjs.d.ts` | 53,014 | 13,262 |

A first load fetches **about 1.0 MB gzip** (JS 128 KB plus wasm 880 KB).

**What dominates the size:** the wasm, and inside it the code section. Parsing `rive.wasm` sections with my own script gave: code 1,781,381 B (10,651 functions), data 313,211 B (static data and GLSL shader text), elem 16 KB, everything else under 20 KB. The C++ engine accounts for nearly all of the code: file format, animation, state machines, data binding, HarfBuzz, Yoga, Luau, audio, and a full GPU renderer that is in the canvas build too.

The JS is the next biggest item. By source-map share, `rive.ts` is 203 KB, the emscripten/embind glue (`canvas_advanced.mjs`) 131 KB, the accessibility overlay 61 KB, the keyboard and touch modules 23 KB each, the semantic tree 13 KB, and the text-input proxy 9 KB. It ships unminified, so a minifier would remove a large share, but the order of magnitude stays the same.

---

## 2. High-level JS API (`Rive` class, `js/src/rive.ts:2317`)

### Constructor options (`RiveParameters`, `rive.ts:1531-1742`)

- **Source:** exactly one of `src` (URL to fetch), `buffer` (ArrayBuffer), or `riveFile` (a pre-loaded `RiveFile` that is ref-counted and shared across instances, `rive.ts:1874`).
- **Selection:** `artboard` (name). `stateMachine` (single name; the current recommendation). `stateMachines` (array; deprecated). `animations` (linear animations; deprecated). Recent versions push hard toward "one state machine plus data binding": `DeprecationKeys` and `warnOnce` at `rive.ts:1038-1175`, with a static `Rive.suppressDeprecationWarnings`.
- **Playback:** `autoplay`, and `autoBind`, which binds the default view model and its default instance.
- **Layout:** `layout: new Layout({ fit, alignment, layoutScaleFactor, minX, minY, maxX, maxY })` (`rive.ts:137-272`).
  - `Fit` is `cover | contain | fill | fitWidth | fitHeight | none | scaleDown | layout`.
  - `Alignment` has 9 anchors.
  - `Fit.Layout` resizes the artboard itself to the canvas CSS size divided by `layoutScaleFactor` (`rive.ts:4355-4359`). This is the responsive mode that uses Yoga.
  - `Layout` is treated as immutable: change it with `copyWith` plus the `layout` setter.
- **Input:** `shouldDisableRiveListeners`, `isTouchScrollEnabled`, `enableMultiTouch`, `dispatchPointerExit` (default true), `tabIndex`, `focusOptions.allowFocusInterrupt`, `gamepadOptions`, `shouldDisableGamepad`.
- **Rendering:** `useOffscreenRenderer` (a shared offscreen WebGL context for many canvases), `drawingOptions` (`DrawOnChanged`, the default, or `AlwaysDraw`), `enableInkbleed` and `enableGPUCanvas` (experimental), `useReplayWorker`, `enablePerfMarks` (emits `performance.mark` entries for load and the first 3 frames).
- **Assets:** `assetLoader(asset, bytes) => boolean`, and `enableRiveAssetCDN` (default **true**).
- **Accessibility:** `semanticsMode: 'disabled' | 'enabled'` (experimental) and `semanticsOptions.riveCanvasLabel`.
- **Callbacks:** `onLoad`, `onLoadError`, `onPlay`, `onPause`, `onStop`, `onAdvance`, plus `onLoop` and `onStateChange` (both deprecated). The old lowercase `onload` and similar aliases are still accepted (`rive.ts:2598-2617`). All of them go through one `EventManager` (`rive.ts:1226`); `rive.on(type, cb)` and `off` / `unsubscribe` / `unsubscribeAll` do the same.
- **`automaticallyHandleEvents`** (deprecated) makes OpenUrl events click a synthetic `<a>` after `sanitizeUrl` (`rive.ts:3612-3628`).

The constructor (`rive.ts:2537-2637`) does the following in order:
1. Adds a `visibilitychange` listener.
2. Registers the canvas with a **page-wide, shared `ResizeObserver`** (`ObjectObservers`, `rive.ts:1476-1522`), falling back to a no-op shim when ResizeObserver is missing.
3. Wires the callbacks.
4. Calls `init()`, which waits for the wasm (`RuntimeLoader`), makes the renderer, and if the canvas has no width or height attributes calls `resizeDrawingSurfaceToCanvas()` (`rive.ts:2831-2835`).
5. Loads the file, then `setupRiveListeners()`.

Calls made before load are queued in a `TaskQueueManager` (`rive.ts:1295`); for example, `play()` checks `readyForPlaying` (`rive.ts:4138`).

### Playback control

- `play` / `pause` / `stop(names?)`, `scrub`, `reset`, `load({src|buffer|riveFile,…})`.
- Getters: `isPlaying` / `isPaused` / `isStopped`, `playingStateMachineNames`, `contents`, `bounds`, `activeArtboard`, `artboardWidth` / `artboardHeight` (settable), `resetArtboardSize()`, `volume`.
- `play()` re-registers the pointer listeners each time it runs (`rive.ts:4146-4152`).
- `drawFrame()` (`rive.ts:3440`) draws synchronously when `document.timeline.currentTime` is available; otherwise it schedules a rAF.
- `startRendering()` / `stopRendering()` (`rive.ts:4818-4837`) are explicit controls. `stopRendering` sets `_explicitlyStoppedRendering` so the visibility handler does not resume a loop the caller stopped.
- `enableFPSCounter(cb?)` injects a fixed "RIVE FPS" div when no callback is given (`wasm/js/animation_callback_handler.js`).

### Sizing and devicePixelRatio

- `resizeDrawingSurfaceToCanvas(customDpr?)` (`rive.ts:4342-4361`):
  1. Reads `getBoundingClientRect()`.
  2. Sets `canvas.width/height = CSS size × dpr`, using `window.devicePixelRatio` when no custom value is passed.
  3. Stores `devicePixelRatioUsed`.
  4. Sets `_needsRedraw`, then `resizeToCanvas()`, which sets the layout bounds to the backing-store size.
  5. With `Fit.Layout`, also resizes the artboard.
  6. Draws a frame.
- The developer has to call it, typically from a window resize listener; it is not automatic.
- The renderer's `align()` receives `devicePixelRatioUsed × layoutScaleFactor` as its scale factor (`rive.ts:3899-3914`).
- The ResizeObserver callback (`onCanvasResize`, `rive.ts:2698-2708`) only tracks "zero size or not". When the canvas changes from zero size to visible (display:none → shown), it calls `resizeDrawingSurfaceToCanvas()`. Otherwise it only refreshes the layout bounds when they are unset. **A plain CSS resize does not re-rasterize at the new size unless the app calls the method.**
- Nothing listens for dpr changes (`matchMedia('(resolution: …)')`), so moving the window to another monitor keeps the old dpr.

### Render loop (`draw()`, `rive.ts:3754-3897`)

- **One shared rAF.** `Module.requestAnimationFrame` (`wasm/js/animation_callback_handler.js`) collects every instance's callback into a single real `requestAnimationFrame`. After all of them run, `onAfterCallbacks` flushes every canvas renderer once (`renderer.js:1405-1422`).
- **Each frame:**
  1. Compute elapsed seconds from the rAF timestamp. The clock is clamped so a frame stamped during a long task, or a time going backwards, does not jump.
  2. `advanceAndReportChanges(elapsed)` (`rive.ts:3571-3747`):
     - Advance any linear animations.
     - For each playing state machine, drain reported events, then `advanceAndApply(elapsed)`.
     - Update the semantics diff and overlay.
     - Emit loop, state-change and advance events.
     - Poll focus.
     - Run view-model `handleCallbacks()`.
  3. Draw only when something changed: if `AlwaysDraw`, `artboard.didChange()`, deferred work, `_needsRedraw`, or the canvas size changed. Then: `clear` → `save` → `alignRenderer` → `artboard.draw(renderer)` → `restore` → `flush` (`rive.ts:3825-3871`).
  4. Request the next frame **while `animator.isPlaying`** (`rive.ts:3884-3896`).
- **No sleep when settled.** `advanceAndApply()` returns a "still animating" boolean in the low-level API (`rive_advanced.mjs.d.ts:1075`), but the high-level loop **ignores it** (`rive.ts:3640`). A playing state machine that has settled into an idle state keeps a rAF running at display rate, advancing every frame and skipping only the draw (through `didChange()`). Pausing happens only on an explicit `pause` / `stop`.
- **Offscreen and visibility:**
  - **There is no IntersectionObserver anywhere in `js/src`** (checked with grep).
  - Hidden tabs: the `visibilitychange` handler cancels the rAF and resets `lastRenderTime` so the next frame does not advance by a huge delta. It resumes on visible if still playing (`rive.ts:4857-4878`).
  - Zero-size canvases (`_hasZeroSize` from the ResizeObserver, plus a direct check of `canvas.width/height`) skip drawing but still advance and still request frames.
  - A canvas that is scrolled out of view but still in the layout keeps running at full rate.
- **Cleanup** (`cleanup()`, `rive.ts:3937-3988`) deletes the wasm artboard and state machine instances, unobserves the resize, removes the listeners, releases the file reference and renderer, removes the audio and visibility listeners, and cleans up the view-model instances. Embind objects have to be freed by hand. `utils/finalizationRegistry.ts` adds `FinalizationRegistry`-based wrappers as a safety net for decoded assets.

---

## 3. Input

### Pointer → artboard coordinates (`js/src/utils/registerTouchInteractions.ts`)

- Listeners are attached **only if a playing state machine `hasListeners`** (`rive.ts:2875-2878`) and `shouldDisableRiveListeners` is false.
- It listens to **mouse and touch events, not Pointer Events**: `mouseover`, `mouseout`, `mousemove`, `mousedown`, `mouseup`, `touchstart`, `touchmove`, `touchend`, `touchcancel`, and `wheel` with `passive:false` (`:623-637`).
- **Mapping** (`mapToArtboard`, `:245-281`):
  1. On each event, read the canvas `getBoundingClientRect()`.
  2. Build the forward fit/alignment matrix with `rive.computeAlignment(fit, alignment, {0,0,rect.w,rect.h}, artboard.bounds, layoutScaleFactor)`. This works in CSS pixels, so dpr is not involved.
  3. Invert the matrix and `mapXY` the point `(clientX − rect.left, clientY − rect.top)` through it.
  4. Free the temporary embind `Mat2D` and `Vec2D` objects.

  Each pointer move allocates and frees four wasm objects.
- `fit` and `alignment` are captured when the listeners are registered. Re-registration happens on `play()` and load, not inside the `layout` setter.
- **Dispatch:** the matching state machine is called with `pointerMove`, `pointerDown`, `pointerUp` or `pointerExit` and a pointer id. Down and up then call `advanceAndDrain(0)` straight away, so the press takes effect in the same task rather than on the next frame (`:430-470`). `touchend` sends both up and exit. `touchcancel` is treated as up plus exit.
- **Touch:**
  - Single-touch mode tracks one primary touch id. With `enableMultiTouch`, every changed touch is sent.
  - The runtime skips the synthetic mouse events that browsers fire after a tap (`_syntheticEventsActive`, `:283-305`).
  - **`isTouchScrollEnabled`**: when false (the default), `touchstart` and `touchmove` get `preventDefault()` (`:121-128`), so dragging on the canvas does not scroll the page. When true, the page can scroll through the canvas. The wheel listener calls `preventDefault` when the graphic consumes the scroll.
- `shouldDisableRiveListeners: true` means no DOM listeners at all; the state machine never gets pointer input. `removeRiveListeners()` (`rive.ts:3042`) removes them later.

### Keyboard, focus, accessibility

These are newer, substantial modules, about 2.5k lines of TS in total.

- **Keyboard** (`utils/registerKeyboardInteractions.ts`, `keyMap.ts`, `textInputProxy.ts`):
  - Wired only when a playing state machine has authored **Focus nodes** (`ensureKeyboardInteractions`, `rive.ts:2922-2950`).
  - Gives the canvas a `tabIndex` (option, else 0).
  - Listens for `focus`, `blur`, `keydown` and `keyup` on the canvas.
  - Routes Tab / Shift+Tab to Rive's internal focus manager, and releases Tab to the page only when focus traversal runs off the end.
  - Leaves Alt/Ctrl/Meta arrow shortcuts to the browser.
  - Text-input nodes use a hidden proxy `<input>` so the mobile keyboard appears; it is focused inside `touchend` / `mouseup` so the browser treats it as a user gesture.
- **Semantics / a11y** (`js/src/semantics/*`, marked experimental):
  - With `semanticsMode: 'enabled'`, the C++ state machine emits semantic tree diffs (`drainSemanticsDiff`). Roles cover button, link, checkbox, switch, slider, textField, text, image, group, list, tab, dialog, radio and others (`types.ts`), with trait and state bitmasks.
  - `AccessibilityOverlay` builds a **DOM shadow tree** over the canvas: a `role="region"` container labelled `riveCanvasLabel`, default "Rive animation" (`accessibilityOverlay.ts:420-423`). It holds absolutely positioned `div`/`a` elements with ARIA roles, labels and states.
  - The overlay is positioned with the forward fit/alignment matrix, recomputed only when the layout or dpr changes (`_overlayTransformDirty`, `rive.ts:3680-3712`).
  - Enter and Space activate clickable roles (links: Enter only). Arrow keys work on sliders, tabs and radio groups. Each action fires back through `fireSemanticAction`.
  - The overlay manages `aria-modal` focus traps, and decorative images without a label are hidden. It warns when the canvas wrapper is not positioned inside a scroll container.
- **No `prefers-reduced-motion` handling anywhere** (grep of `js/src` and `wasm/js`). Reduced motion is left to the app.

---

## 4. Data API

- **View models** (`rive.ts:5288-6300`):
  - `rive.viewModelInstance` is the bound instance; with `autoBind`, this is the default view model's default instance.
  - Instances can be listed with `rive.viewModelCount`, `viewModelByIndex` / `viewModelByName`, `defaultViewModel()`, then `vm.instance()` / `defaultInstance()` / `instanceByName()`.
  - Bind with `rive.bindViewModelInstance(vmi)`. There are also global view models (`setGlobalViewModelInstance`, `globalViewModelInstance`, `bind()`) and `enums()`.
- **Property accessors are path-based** (`'group/sub/prop'` is split on `/`, `rive.ts:5531`):
  - `.number(p)`, `.string(p)`, `.boolean(p)` → `.value` get/set.
  - `.color(p)` → `.value` as an ARGB int, plus `.rgb()`, `.rgba()`, `.argb()`, `.alpha()`.
  - `.trigger(p)` → `.trigger()`.
  - `.enum(p)` → `.value` / `.valueIndex` / `.values`.
  - `.list(p)` → `add/remove/insert/swap/instanceAt`.
  - `.image(p)` / `.font(p)` set decoded assets; `.artboard(p)` swaps in a bindable artboard; `.viewModel(p)` gets a nested instance.
  - Every accessor returns `null` when the path or type does not match.
- **Subscriptions:** `prop.on(cb)` / `prop.off(cb?)` (`rive.ts:5965-5985`).
  - There is no push. The C++ side keeps a `hasChanged` flag for each property, and each frame `handleCallbacks()` walks the subscribed properties and children, calls the callbacks with the new value (triggers get no argument), then clears the flags (`rive.ts:5430-5440, 5988-5998`).
  - So a callback only fires while the render loop is running.
  - Setting `.value` from JS does not start a stopped loop by itself.
- **Events** (`EventType`, `rive.ts:997-1030`): `Load`, `LoadError`, `Play`, `Pause`, `Stop`, `Draw`, `Advance`, plus the deprecated `Loop`, `StateChange` and `RiveEvent`.
  - `RiveEvent` carries `{name, type, properties, url/target for OpenUrl}`, which the state machine reports (`reportedEventAt`) before each advance.
  - The docs now steer users to data binding for all of these.
- **State machine inputs** (deprecated): `rive.stateMachineInputs(name)` returns `StateMachineInput` objects with `.value` (number or boolean) and `.fire()` (`rive.ts:286-334`). Nested-artboard variants exist: `setNumberStateAtPath`, `fireStateAtPath`, and similar. Text runs are also deprecated: `getTextRunValue` / `setTextRunValue`.

---

## 5. Renderer bridge

- **Inversion of control via embind subclassing.** The C++ `rive::Renderer`, `RenderPath` and `RenderPaint` are abstract. `bindings_c2d.cpp` declares wrapper classes whose virtual methods forward each call to JS with `call<void>("…")`: `save`, `restore`, `transform`, `_drawPath`, `_clipPath`, `_drawImageMesh`, and on paths `moveTo`, `lineTo`, `cubicTo`, `close`, `addPath`, `fillRule`, and on paints `color`, `thickness`, `join`, `cap`, `blendMode`, `feather`, gradients (`bindings_c2d.cpp:93-470, 677-700`). JS supplies the subclasses with `Renderer.extend("Renderer", {...})` and `RenderPath.extend(...)` (`wasm/js/renderer.js:357, 513, 893`).
  - Every path verb and every draw crosses the wasm→JS boundary. That is chatty but simple.
- **Canvas2D renderer in JS** (`renderer.js`):
  - `CanvasRenderPath` stores the path instructions and builds a `Path2D` lazily with `Path2DBuilder` (`:182-272`). The builder adds a cap for a lone moveTo to match Rive's behaviour. Path2D objects are ref-counted and cached; a second Path2D, pre-transformed, serves gradient-transform draws.
  - Paint state becomes `fillStyle` / `strokeStyle`, `lineWidth`, `lineJoin`, `lineCap`, `globalCompositeOperation`, and `createLinearGradient` / `createRadialGradient`.
  - The renderer keeps a JS copy of the matrix and opacity stacks, and **records draws into `_drawList` closures** (`:893-990`). They are replayed at flush, at the end of the shared rAF tick, so draws delegated to WebGL can be batched into an atlas and blitted in order.
  - `_drawMode` (`:740-775`) chooses one of three paths: draw natively, apply the inverse gradient transform to the path, or delegate to the offscreen WebGL2 renderer (`canvas_offscreen_*.js`).
- **Per frame**, the JS calls into wasm for:
  - `stateMachine.advanceAndApply(dt)` (or `animation.advance` / `apply`, then `artboard.advance`);
  - `artboard.didChange()`;
  - `renderer.clear`, `save`, `align(fit, alignment, frame, bounds, scale)`;
  - `artboard.draw(renderer)`, which calls back into JS many times;
  - `restore`, `flush`.
- **Text and fonts:**
  - Shaping and layout run in wasm (HarfBuzz plus bidi). Glyphs come out as ordinary paths through the same RenderPath bridge, so Canvas2D text rendering is not used.
  - Fonts are embedded in the `.riv`, referenced on the Rive CDN, or supplied by the `assetLoader`.
  - `decodeFont(bytes)` returns a `FontWrapper`, which must be `unref()`'d.
  - `RiveFont.setFallbackFontCallback(missingGlyph, weight)` lets the host supply fallback fonts (`utils/riveFont.ts`).
  - The lite build has no text.
- **Images:**
  - In the canvas build, images are decoded **in JS**, by putting a `Blob` into `new Image()` (`renderer.js:~100`), and drawn with `drawImage` or meshes.
  - `decodeImage` and `decodeAudio` are exported helpers.
- **Asset loader** (`rive.ts:29`, `RiveFile` `:1995-2015`, `utils/finalizationRegistry.ts:115-145`):
  - `assetLoader(asset: FileAsset, bytes: Uint8Array) => boolean`.
  - The callback receives each referenced asset, which exposes `name`, `fileExtension`, `cdnUuid`, `cdnBaseUrl`, `isImage`, `isFont` and `isAudio`, plus the bytes when they are embedded.
  - Returning `true` means "I'll handle it". The host then decodes asynchronously and calls `asset.setRenderImage()` / `setFont()` / `setAudioSource()`.
  - `Module.load` wraps loaders in a `FallbackFileAssetLoader`: the custom loader first, then, unless `enableRiveAssetCDN: false`, a built-in `CDNFileAssetLoader` (`wasm/js/renderer.js:1353-1366`, `webgl2_renderer.js:446-455`). By default the CDN loader fetches unhandled assets from Rive's CDN.
- **WASM loading** (`runtimeLoader.ts`):
  - `RuntimeLoader` is a singleton. By default it fetches `https://unpkg.com/<pkg>@<ver>/rive.wasm` (`:47`). On failure it falls back to `https://cdn.jsdelivr.net/npm/<pkg>@<ver>/rive_fallback.wasm` (`:51, 177-195`), the build compiled without SIMD.
  - Override with `RuntimeLoader.setWasmUrl(url)` and `setWasmFallbackUrl(url|null)`; the threads URL has `setWasmThreadsUrl`.
  - `getInstance(cb)` / `awaitInstance()` hand out the module.
  - **By default a third-party CDN is contacted at runtime** for both the wasm and any CDN assets. Self-hosting or CSP requires configuring both.

---

## 6. Watermark / splash

- **The JS layer has none.** A grep of `js/src`, `wasm/js` and `wasm/src/bindings*.cpp` for watermark, splash, trial, license or branding finds nothing.
- **The C++ core does contain a watermark mechanism**, checked in the separate rive-runtime checkout (§ header): `src/watermark.cpp`, `include/rive/watermark.hpp`, `File::attachWatermark` (`src/file.cpp:1662-1700`).
  - When a file's **manifest asset** says `hasWatermark()` and points at a watermark artboard **inside the same file**, the runtime instantiates that artboard. It then plays the artboard's state machine as a pre-roll in front of the host artboard, over a black backdrop, holding the host frozen.
  - The pre-roll is capped at 10 s and clamped against wall-clock fast-forwarding.
- So the splash **content and the decision to show it come from the exported file** (per the package READMEs, free exports get a short splash). The **playback logic lives in the runtime core**. The JS wrapper takes no part.
- I could not confirm whether the 2.45.1 wasm build includes this code, because the symbols are stripped.
- Nothing was modified or disabled.

---

## Lessons for Anima

1. **Make the main API a web component, with a small imperative handle.** `<ani-icon src="bell.ani" state="idle" label="Notifications">` renders inline SVG in its own DOM; light DOM or an open shadow root are both fine. Expose a tiny class for scripting: `el.play()`, `pause()`, `set(name, value)`, `fire(name)`, `on(name, cb)`, `ready: Promise`, `destroy()`. Skip Rive's 40+ constructor options and the four parallel naming eras (`onload` / `onLoad` / `on()` / deprecated keys).
2. **One input model, not three.** Rive's history shows the cost: linear animations, then SM inputs, then events, then data binding, with deprecation walls in between. Give Anima a typed **property bag** from the start (number, bool, color, enum, trigger), mapped from HTML attributes and JS properties. Use path names only if nesting ever exists. Emit DOM `CustomEvent`s (`ani-change`, `ani-trigger`) instead of a custom EventManager.
3. **The render loop should sleep when settled.** Rive keeps a rAF running every frame while "playing", even when idle, and only skips the draw. For Anima:
   - The state machine's `advance()` returns `stillAnimating`.
   - Schedule the next frame only while it is true.
   - Wake on any input, property set, attribute change, resize or visibility change.
   - Keep Rive's good parts: one **shared rAF** for all instances (`animation_callback_handler.js`), a reset clock after a hidden tab, and a clamp on large frame deltas.
4. **Add the offscreen handling Rive lacks.** Use one shared `IntersectionObserver` (and `document.hidden`) to suspend instances that are out of view. Use one shared `ResizeObserver`. Because SVG is resolution-independent, resizing costs nothing: no backing store and no dpr bookkeeping. If a raster fallback is ever added, listen for dpr changes too.
5. **Input mapping: use DOM hit testing.** With SVG, put Pointer Events (`pointerdown`, `pointerup`, `pointerenter`, `pointerleave`, `pointercancel`) on the element itself and let the browser do the hit testing. When artboard coordinates are needed (drag, hover position), use `svg.getScreenCTM().inverse()` or `createSVGPoint().matrixTransform()` and drop the fit-matrix inversion; `viewBox` plus `preserveAspectRatio` already implement fit and alignment. Use the CSS `touch-action` property instead of `preventDefault` on touch events (that is Rive's `isTouchScrollEnabled` problem). Apply a press synchronously, as Rive does with `advanceAndDrain(0)`, so taps feel instant.
6. **Accessibility is built in, not an overlay.** Rive needs about 2.5k lines to rebuild ARIA over a canvas. With inline SVG, the host element itself can be the control:
   - Use `role="button"` / `"switch"` / `"img"`, `aria-label` from the file or attribute, `aria-pressed` / `aria-checked` bound to state, and `tabindex="0"` only when interactive.
   - Enter and Space activate the control (keydown for Enter, keyup for Space, matching native buttons).
   - Show `:focus-visible` styling.
   - Decorative icons get `aria-hidden="true"`.
   - Prefer wrapping a real `<button>` when used as a button, so you are not reimplementing one.
7. **Honor reduced motion by default.** Rive has nothing for it. Read `matchMedia('(prefers-reduced-motion: reduce)')` and listen for changes. Either jump straight to each state's end pose, or let `.ani` files declare a reduced variant. Allow `motion="full|reduce|none"` as an override.
8. **Theme with CSS, not data binding.** Rive needs view-model color properties and ARGB ints to restyle. In Anima, paints default to `currentColor` and to named CSS custom properties (`fill: var(--ani-accent, currentColor)`), so icons inherit text color, dark mode and hover states with no JS. Let the file declare its theme slots, and animate opacity and transforms through attributes or CSS.
9. **Keep icons crisp.** Author on an integer grid (24×24, for example). Keep `vector-effect: non-scaling-stroke` optional so stroke weight stays constant across sizes. Avoid fractional translates at rest and snap the final pose. Use `shape-rendering` defaults; let the browser antialias.
10. **No network and no runtime splash by default.** Rive fetches its wasm from unpkg/jsdelivr and assets from its own CDN unless configured otherwise. Anima should be a single self-contained ESM with zero runtime fetches beyond the `.ani` itself, and the file can also be inlined. It needs no wasm, no fallback binary, and no asset CDN. The file format should have no watermark or manifest features that the runtime has to enforce.
11. **Size budget.** Rive canvas is about 1 MB gzip, because a full C++ engine (text shaping, layout, a scripting VM, a GPU renderer) ships to show one icon. Anima targets well under 10 KB min+gzip: a small parser, a keyframe/easing interpolator, a tiny state machine, and an SVG attribute writer. Leave text shaping, meshes, audio, scripting and layout engines out. Lean on what the browser already does: SVG, CSS, DOM events, ARIA.
12. **Things to avoid:**
    - Per-verb cross-boundary calls (Rive's embind path bridge).
    - Manual `delete()` memory management.
    - Allocating per pointer move (four wasm objects per event in Rive).
    - Polling-based change callbacks that fire only while a loop runs; push changes instead.
    - Capturing fit or alignment at listener registration time.
    - Shipping unminified bundles.
    - Gating features on a separate "lite" package.
    - Opt-out third-party CDNs.
    - A global FPS div that is injected into the page.
13. **Worth copying:**
    - Lazy start for calls made before load (a task queue, or simply a `ready` promise).
    - Clean idempotent teardown (`destroy()` removes observers and listeners).
    - Sanitizing any URL a file can make the page open.
    - Draw-only-when-dirty as a second safety net.
    - Optional perf marks behind a flag.
