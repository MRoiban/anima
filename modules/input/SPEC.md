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
| `consume` | Stop remaining listeners for this event phase, after this listener's actions. Default false. |
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
normalizes them with an empty `set` map for the existing action compiler. Decompilation omits
that empty map when a write is present. `align=preserve` stores the target's initial x/y minus
the initial grab point in parent space; `snap` uses no offset. Singular parents produce no
coordinate writes. Capture ordering uses depth, then authored order; normal delivery bubbles
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
committed by the ordinary parent step. Rich scoped keyboard/gamepad focus forwarding is left to
the focus integration; `keyTarget` lets that module select a local node before key bubbling.

## Keyboard, scroll, gamepads

`key(down|up,key,{repeat?,shift?,control?,alt?,meta?,target?})` produces exactly one phase:
repeat replaces down, never adds a second down. Target is a node ID, default whole icon; explicit
options override the controller's optional `keyTarget`. Delivery follows target then ancestors,
with capture and consume as above. Pointer enablement does not exclude keyboard/gamepad delivery.
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
A recognized input event refines components' legacy unknown-event diagnostic without accepting
unknown dotted component events.

`core/commands.ts` implements `contact <phase> <id> [x y [button]]`,
`key <down|up|repeat> <key|Space> [modifiers|-] [target]`,
`scroll <x> <y> <dx> <dy> [phase] [seconds]`, `gamepads <JSON batch>`,
`pointer-enable <id> <true|false>`, and `scroll-cancel`. Commands queue actions; the common script
runner must step(0) after each successful command. These commands and extended AniML listener
attributes require the small shared call-site patch supplied in `integration.patch`; they are
not wired into this checkout's shared dispatcher/compiler. `on=drag` and ordinary actions already
compile and sample without that patch. Pending probes retain markers and are not counted as done.
