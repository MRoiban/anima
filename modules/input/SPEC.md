# Input contract

This document supplements SPEC §9–10 and the components pointer model. A document declares
`requires: ["input"]`; importing the module never changes the legacy 0.1 pointer path. Core code
owns deterministic input routing and has no DOM dependencies. The optional web entry owns DOM
listeners, coordinates, cursors and gamepad polling. The separation follows
[web runtime research](../../docs/research/rive-web-runtime.md) (host teardown and input mapping)
and [animation research](../../docs/research/rive-animation-and-state.md) (explicit input order).
No Rive implementation is used.

## Listener extensions

`on` accepts the six legacy names plus `cancel`, `drag-start`, `drag`, `drag-end`, `key-down`,
`key-repeat`, `key-up`, `scroll`, `gamepad-axis`, `gamepad-button`, `gamepad-connected`, and
`gamepad-disconnected`. Join names with `|` for one action shared by several input families.
A dotted component event remains owned by components. An extended name or a `|` list requires
`input`, including a list containing only old names. All ordinary action keys retain §9 order.

New listener JSON keys and AniML attributes use identical spelling:

| Key | Meaning |
| --- | --- |
| `button` | DOM numbering: 0 primary (default), 1 middle, 2 secondary. Applies to down/up/click/drag phases. |
| `capture` | Run outermost to innermost before normal target/ancestor handling. Default false. |
| `consume` | Stop remaining delivery for this event, including inner capture and normal listeners, after this listener's actions. Default false. |
| `propagate` | Normal keyboard listener passes the key to remaining listeners/ancestors when true. Default false; `consume` takes precedence. No effect on pointer/gamepad events or capture listeners. |
| `key` | Exact DOM `KeyboardEvent.key`, or `*`/omitted for any key. |
| `modifiers` | Exact held modifier set, in `shift+control+alt+meta` order; omit unheld tokens. Empty means none. Omission means any modifier set. |
| `index` | Exact nonnegative gamepad slot, omitted for any. |
| `control` | Exact nonnegative axis/button index, omitted for any. |
| `mapping` | `standard` requires W3C mapping; `raw` or omitted uses supplied indices without remapping. |
| `phase` | Gamepad button `press`, `release`, or `both` (default). Analog changes also dispatch with `both`. |
| `write` | Map from event-value names to declared numeric/bool inputs, applied after ordinary listener actions. |
| `align` | `snap` or `preserve`; modifies the `x` and `y` event values in the target's parent coordinates. |

`write` fields are `x`, `y`, `dx`, `dy`, `startX`, `startY`, `pointerId`, `button`, `deltaX`,
`deltaY`, `value`, `pressed`, `index`, and `control`. Only `pressed` is boolean; the others are
numbers. Missing event fields do not overwrite inputs. Writes are queued until the next step,
so ordinary `bind` expressions can move a target. Write-only listeners are actions; the loader
normalizes them with an empty `set` map for the existing action compiler. Decompilation preserves that normalization. AniML uses a JSON-valued `write` attribute,
for example `write='{"x":"dragX"}'`, derived from the generic listener registry. `align=preserve` stores the target's initial x/y minus
the initial grab point in parent space; `snap` uses no offset. Singular parents produce no
coordinate writes. Capture ordering is outermost ancestor (including the icon) down to the target, then authored order at equal depth; a consuming ancestor prevents inner listeners from running. Normal capture listeners do not implicitly consume. Normal delivery uses depth, then authored order; normal delivery bubbles
from deepest to shallowest, retaining authored order within a scope.

## Contacts and hit policy

`Player.input()` returns one controller per player and rejects a document lacking `input`.
`pointer(kind,x,y,{id=0,button=0})` receives grid coordinates and a nonnegative integer contact ID.
IDs are independent; repeated downs replace that ID's press. This controller tracks one pressed
button per contact, not several simultaneously pressed mouse buttons on the same contact ID.
The legacy `Player.pointer` delegates to it using ID 0 when input is declared.

Each event first leaves old targets and enters new targets, then dispatches its phase. A down
records its targets and initial point. Motion of at least 0.5 grid units starts a drag once,
then dispatches drag for each move, even outside the target. Smaller motion does not start a drag.
Up ends a drag once; otherwise it clicks targets shared with down if maximum travel stayed below
0.5. Cancel uses the contact's last position, emits cancel on its pressed targets, ends a live
drag, leaves hovered targets and removes the contact. Explicit leave exits and cancels the press
without a cancel phase. `enablePointer(id,false)` cancels that contact before suppressing further
input; re-enabling starts cleanly. `cancel()` cancels every contact and the scroll latch.

Hit geometry is the existing transformed painted contour test, including fill rule and stroke,
not a bounding rectangle. Visibility and collapse propagate through ancestors. A group queries
eligible descendants. `pointerEnabled=false` suppresses pointer hits on that node and descendants.
`hitTest(x,y,{bounded?,scroll?})` returns unique interactive target IDs, foremost first, with
`@icon` for whole-icon listeners. `bounded` additionally clips to the document viewBox. Cursor-only
and opaque nodes are interactive targets even without actions. An `opaque=true` target removes
lower authored nodes from the hit traversal, retaining its ancestor chain and higher targets.
`occludes(x,y)` detects an opaque target; `{scroll:true}` additionally requires a scroll listener
on the blocker. Geometry follows the flattened-contour accuracy contract in §9; no separate
approximate rectangle-only hit implementation is introduced.

Pointer routing into component children preserves IDs/buttons and inversely maps coordinates
through the current instance world matrix. Invisible, collapsed, disabled, singular or occluded
instances cancel the child contact. The module uses the components extension's `players` map;
without that seam only legacy primary-pointer forwarding is available. Child input actions are
committed by the ordinary parent step. Keyboard delivery follows the logical focus path into component children, then bubbles through
the outer instance ancestors. Gamepad batches remain scene-wide; they do not select a descendant
by keyboard focus. Explicit `target` overrides `keyTarget`, which overrides logical focus.

## Keyboard, scroll, gamepads

`key(down|up,key,{repeat?,shift?,control?,alt?,meta?,target?})` produces exactly one phase:
repeat replaces down, never adds a second down. Target is a node ID (including a dotted component descendant), default logical focus or whole icon. Explicit
options override the controller's optional `keyTarget`. Delivery follows target then ancestors,
with capture and consume as above. A matching normal keyboard listener handles the key and stops further delivery by default; `propagate: true` (AniML `propagate="true"`) opts into passing it on. Unmatched listeners never stop delivery. This applies to down, repeat and up, including component boundaries. Capture listeners retain explicit `consume` semantics. Logical focus arrow/opted-in Tab navigation runs after authored key delivery, even when consumed; modifiers still suppress navigation. Pointer enablement does not exclude keyboard/gamepad delivery.
Native Enter/Space activation remains the host's §10 behavior alongside authored key listeners.

`scroll(x,y,deltaX,deltaY,{phase?,time?})` uses finite positions/deltas and a logical timestamp in
seconds (default player time). Deltas retain their supplied units. `start` reselects a target;
`move`/omission retains the previous hit target even when the pointer leaves. A gap strictly greater
than 0.15 s, or decreasing time, expires the latch. `end` dispatches then releases; `cancel` only
releases. `cancelScroll()` releases explicitly. `wantsScroll(x,y,time=player.time)` checks whether
there is a live latch or eligible scroll listener; callers using their own clock pass the same
clock on queries and events. Hosts prevent native wheel scrolling only after a handled scroll.

`gamepads(batch)` takes `{index,connected,mapping?,axes?,buttons?:[{value,pressed}]}` records.
Validate the whole batch before changing anything: unique nonnegative integer indices, bool
connection/press flags, finite axes in [-1,1] and values in [0,1]. First connection emits connected;
disconnection of an existing pad emits disconnected. Changed axes/buttons emit in index order,
with missing previous values treated as zero/unpressed. Inputs repeat neither a connection nor
an unchanged button. Stored records copy caller arrays. Omitted pad indices are unchanged; hosts
send an explicit disconnected record. This operation queues actions and requires a step to commit.

## Collapse and Solo

Every node accepts animatable `collapsed` (bool, false) and `pointerEnabled` (bool, true), and
static `opaque` (bool) and `cursor` (`arrow`, `hidden`, `pointer`, `resize-horizontal`,
`resize-vertical`, `text`). A group may explicitly author animatable `solo`: zero-based selected
direct-child index, with -1 selecting none. Omission leaves every child active. Inactive siblings
collapse with their descendants for rendering and hits. Input adds ancestor draw dependencies,
so animating a selection updates descendants in both retained SVG and canvas. Collapse does not
pause child clocks or remove state; it changes draw/hit eligibility.

## Diagnostics and script integration

Structural errors retain registry diagnostics. `input-index`, `input-modifiers`, `input-write`,
and `input-solo` report code, JSON pointer, message and corrective hint; their executable fixtures
are in `test/core/runtime.test.ts`. Unknown event names remain registry `bad-value` diagnostics.
Components validates scene events against the composed event-kind registry; unknown dotted
component events remain errors.

`core/commands.ts` implements `contact <phase> <id> [x y [button]]`,
`key <down|up|repeat> <key|Space> [modifiers|-] [target]`,
`scroll <x> <y> <dx> <dy> [phase] [seconds]`, `gamepads <JSON batch>`,
`pointer-enable <id> <true|false>`, and `scroll-cancel`. Commands queue actions; the common script
runner must step(0) after each successful command. These commands use the tooling-only shared dispatcher delegation. Extended listener attributes
use the generic registry path with JSON-valued compound attributes, without hand hooks.

## Focus integration

With `focus` declared, a key is dispatched to the focus owner and its ancestors before
`focusKey(key,down,shift)` navigates once. Control/Alt/Meta combinations do not navigate. Key up
does not move focus. Arrows select a spatial neighbor; opt-in inner Tab traversal moves once,
and an unhandled edge leaves the native browser Tab exit available. Without input, the focus
web adapter calls the same method. Enter/Space activation stays in the base host.

Pointer downs call focus before ordinary down actions and preserve pointer capture. Input's
pointer-enabled and opaque hit policy gates focus selection; keyboard eligibility is independent
of pointer enablement. Collapsed/inactive Solo branches are excluded from focus eligibility.
The DOM adapter prevents the down default from displacing the selected internal focus target.
Focus supplies `machineFocus(nodeId)` and calls `onChange` when ownership changes, so guards
wake a settled machine. The pure reader remains false when there is no focus owner.
See `spec/conformance/input-focus-machine-integration` and the independently bundled browser
integration tests, in both registration orders and both engines.

## Capability contracts

### host-api-coordinate-mapping

Compute fit/alignment transforms and map input coordinates through matrices. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-coordinate-mapping` plus the row-indexed API/browser tests.
### host-api-dom-listener-control

Enable or remove automatic DOM interaction listeners for authored state machines. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-dom-listener-control` plus the row-indexed API/browser tests.
### host-api-gamepad

Poll gamepads and route buttons and axes to the graphic; optionally require DOM focus. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-gamepad` plus the row-indexed API/browser tests.
### host-api-low-level-pointer

Pass pointer down, move, up and exit in artboard coordinates with pointer IDs. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-low-level-pointer` plus the row-indexed API/browser tests.
### host-api-low-level-scroll

Send indirect wheel/trackpad scrolling separately from direct touch pointer gestures. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-low-level-scroll` plus the row-indexed API/browser tests.
### host-api-manual-gamepad-batch

Submit a validated batch of controller connection and input records to the focused scene. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-manual-gamepad-batch` plus the row-indexed API/browser tests.
### host-api-multitouch

Forward multiple touch IDs to authored listeners when enabled. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-multitouch` plus the row-indexed API/browser tests.
### host-api-pointer-exit

Control dispatch of pointer exit when the pointer leaves the graphic. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-pointer-exit` plus the row-indexed API/browser tests.
### host-api-scroll-hit-policy

Test whether content wants a scroll or has a wheel target before deciding whether to prevent browser scrolling. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-scroll-hit-policy` plus the row-indexed API/browser tests.
### host-api-scroll-latching

Track the target latched for a gesture and explicitly cancel it; wheel gestures expire after inactivity. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/host-api-scroll-latching` plus the row-indexed API/browser tests.
### input-align-preserve

Move a target while retaining the offset between its origin and initial grab point. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-align-preserve` plus the row-indexed API/browser tests.
### input-align-snap

Move a chosen target's origin to the pointer in its parent's coordinate space. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-align-snap` plus the row-indexed API/browser tests.
### input-bounded-hit-tests

Offer a bounded hit-test query that restricts scripted layouts to their declared box. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-bounded-hit-tests` plus the row-indexed API/browser tests.
### input-button-middle

Filter down, up, click, and drag input to the middle button. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-button-middle` plus the row-indexed API/browser tests.
### input-button-secondary

Filter down, up, click, and drag input to the secondary button. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-button-secondary` plus the row-indexed API/browser tests.
### input-capture-phase

Run listeners from outer scopes inward before normal target handling; supported capture handlers can claim input. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-capture-phase` plus the row-indexed API/browser tests.
### input-cursor-arrow

Restore the default arrow cursor. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-arrow` plus the row-indexed API/browser tests.
### input-cursor-hidden

Hide the native pointer. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-hidden` plus the row-indexed API/browser tests.
### input-cursor-intent

Have scene data request an arrow, hand, horizontal or vertical resize, text, or hidden cursor; the CLI host currently applies this only on macOS and Linux. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-intent` plus the row-indexed API/browser tests.
### input-cursor-pointer

Request the native pointing-hand cursor. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-pointer` plus the row-indexed API/browser tests.
### input-cursor-resize-horizontal

Request a horizontal resize cursor. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-resize-horizontal` plus the row-indexed API/browser tests.
### input-cursor-resize-vertical

Request a vertical resize cursor. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-resize-vertical` plus the row-indexed API/browser tests.
### input-cursor-text

Request a text-editing I-beam cursor. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-cursor-text` plus the row-indexed API/browser tests.
### input-disable-listeners

Let the embed disable installation of DOM interaction handlers. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-disable-listeners` plus the row-indexed API/browser tests.
### input-gamepad-axis

React to controller axis events with an authored input filter. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-axis` plus the row-indexed API/browser tests.
### input-gamepad-button

React to controller button events with an authored input filter. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-button` plus the row-indexed API/browser tests.
### input-gamepad-button-phases

Filter a controller button to press, release, or both. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-button-phases` plus the row-indexed API/browser tests.
### input-gamepad-connected

React to controller connected events with an authored input filter. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-connected` plus the row-indexed API/browser tests.
### input-gamepad-disconnected

React to controller disconnected events with an authored input filter. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-disconnected` plus the row-indexed API/browser tests.
### input-gamepad-host

Poll browser controllers and feed batched events into the focused scene, optionally requiring canvas focus. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-host` plus the row-indexed API/browser tests.
### input-gamepad-index-mapping

Address either W3C standard button/axis slots or raw controller indices. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-gamepad-index-mapping` plus the row-indexed API/browser tests.
### input-hit-occlusion-query

Ask whether an opaque target blocks interaction at a point, including whether it blocks scrolling. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-hit-occlusion-query` plus the row-indexed API/browser tests.
### input-hit-parent-chain

Walk the component ancestry as part of a target's hit eligibility. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-hit-parent-chain` plus the row-indexed API/browser tests.
### input-hit-shape-geometry

Use world bounds as a broad-phase check and transformed contour geometry for the precise shape test. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-hit-shape-geometry` plus the row-indexed API/browser tests.
### input-hit-test-host

Ask whether a point hits the machine's interactive scene. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-hit-test-host` plus the row-indexed API/browser tests.
### input-key-down

Select the down phase of a keystroke using a phase mask. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-key-down` plus the row-indexed API/browser tests.
### input-key-filter

Match a specific keyboard key or a wildcard across printable, navigation, function, and keypad keys. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-key-filter` plus the row-indexed API/browser tests.
### input-key-modifiers

Match the exact held combination of Shift, Control, Alt, and Meta. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-key-modifiers` plus the row-indexed API/browser tests.
### input-key-repeat

Select the repeat phase of a keystroke using a phase mask. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-key-repeat` plus the row-indexed API/browser tests.
### input-key-up

Select the up phase of a keystroke using a phase mask. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-key-up` plus the row-indexed API/browser tests.
### input-keyboard-bubbling

Offer key events to the focused node and then its ancestors until consumed. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-keyboard-bubbling` plus the row-indexed API/browser tests.
### input-multi-touch

Route multiple concurrent contacts by pointer ID rather than treating every contact as one pointer. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-multi-touch` plus the row-indexed API/browser tests.
### input-multi-trigger-listener

Attach several input-type children so one action responds to multiple trigger families. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-multi-trigger-listener` plus the row-indexed API/browser tests.
### input-opaque-targets

Stop pointer hit traversal at an opaque target instead of activating lower objects. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-opaque-targets` plus the row-indexed API/browser tests.
### input-pointer-cancel

Release and exit cancelled contacts using their last known positions. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-pointer-cancel` plus the row-indexed API/browser tests.
### input-pointer-drag

React continuously while a pressed pointer drags a target, including outside its initial bounds. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-pointer-drag` plus the row-indexed API/browser tests.
### input-pointer-drag-end

React when an active drag ends. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-pointer-drag-end` plus the row-indexed API/browser tests.
### input-pointer-drag-start

React once a target's drag begins. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-pointer-drag-start` plus the row-indexed API/browser tests.
### input-pointer-enable

Disable or re-enable pointer delivery per pointer identifier. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-pointer-enable` plus the row-indexed API/browser tests.
### input-touch-page-scroll

Let the embed choose whether touch gestures also scroll the surrounding page. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-touch-page-scroll` plus the row-indexed API/browser tests.
### input-trackpad-scroll

Pass precise scroll deltas and gesture phase so trackpad scrolling can settle or fling appropriately. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-trackpad-scroll` plus the row-indexed API/browser tests.
### input-wheel-scroll

Forward wheel deltas to scrollable scene content and consume the DOM wheel only when the scene handles it. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/input-wheel-scroll` plus the row-indexed API/browser tests.
### transforms-collapse

Propagate collapsed state through inactive Solo branches to suppress descendants. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/transforms-collapse` plus the row-indexed API/browser tests.
### transforms-solo

Render one selected direct child while collapsing the others. The corresponding contract above defines the Anima API and limitations.
Executable evidence: `spec/conformance/transforms-solo` plus the row-indexed API/browser tests.

## Data event writes (P3b)

`write="$path" value="pointer-x|pointer-y|pointer-delta-x|pointer-delta-y|key-pressed"`
uses one selected source (the bars here denote alternatives, not a literal value). JSON uses
`write: "$path", value: "pointer-x"`. The existing map form also accepts all five source keys.
The pointer values use root grid coordinates before optional drag alignment; deltas compare the
previous event of the same pointer and are zero initially or on cancellation. `key-pressed` is
the key name string, including on a selected repeat/up event. It does not mean a boolean pressed
flag (`pressed` already supplies that). Targets must be writable number/string inputs or data
paths. Wrong types, read-only targets and unknown sources are `input-write`, with a JSON pointer,
message and hint. Writes follow the existing next-step FIFO. Native headless pointer captures
match exactly; key-name payload has an evidenced CLI synthesis limit (oracle skip).

## Repeated-player input configuration (BF-4)

Input listener configuration follows the compiled input-table identity, retained when lists
creates a renderer-local Model clone. Each player still owns its controller, contacts and queued
writes. Pointer and keyboard routing include live repeated items as well as component instances;
repeat spacing participates in the pointer matrix, and `rows.index.child` names the key target.
Missing/removed rows are not retained input targets. This restores ordinary listener set/copy and
`write` data paths in scenes using lists, without changing data storage or scoping rules.
The regression fixture uses explicit data contexts through two component levels; implicit context
propagation is owned by BF-1. The model/runtime separation follows the graph research in
`docs/research/rive-format-and-graph.md`; no external runtime algorithm is ported.
