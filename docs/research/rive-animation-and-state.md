# Rive runtime: animation, state machines, listeners, data binding, events

Research notes for the Anima (`.ani`) format and web runtime. Everything here is
paraphrased; no Rive code is copied. Citations are `path:line` in the clone.

- Repo: https://github.com/rive-app/rive-runtime
- Commit: `1c8f5d3fe8d1c6bca1cfd7e40367b23aff9dba3f` (shallow clone, commit date 2026-11-05)
- License: MIT ("Copyright (c) 2020 Rive"), `LICENSE`
- Local clone (read only, untrusted, nothing built or run):
  `a local shallow clone of rive-app/rive-runtime`

The runtime has grown a lot of performance and editor machinery: a layer
"blend accumulator", "settled" layers, frozen poses, change sequence windows,
push-based binds, list virtualization, scripting (Luau), focus, semantics and
gamepad. The core semantics underneath are simple, and they are what Anima
should copy. Most of the extra machinery exists to work around problems that
came from mutating object properties in place, using several time units, and
leaving the order of side effects open. A smaller format can design those
problems out from the start.

---

## 1. Linear animations

### 1.1 LinearAnimation fields (`include/rive/generated/animation/linear_animation_base.hpp:32-39`)

| field | type | default | meaning |
|---|---|---|---|
| `fps` | uint | 60 | frames per second; **all keyframe times are integer frames** |
| `duration` | uint | 60 | length in **frames** |
| `speed` | float | 1.0 | playback multiplier; negative plays backwards |
| `loopValue` | uint | 0 | 0 oneShot, 1 loop, 2 pingPong (`include/rive/animation/loop.hpp`) |
| `workStart`/`workEnd` | uint | -1 (u32 max) | work area in frames |
| `enableWorkArea` | bool | false | if true, playback range is [workStart, workEnd] instead of [0, duration] |
| `quantize` | bool | false | snap sample time down to the frame grid (`floor(t*fps)/fps`) before sampling, which gives a stepped "on twos" look (`linear_animation.cpp:148-152`) |

Derived values (`linear_animation.cpp:204-228`): `startSeconds = (workArea ? workStart : 0)/fps`,
`endSeconds = (workArea ? workEnd : duration)/fps`. `startTime()` and `endTime()` swap
when speed < 0. `globalToLocalSeconds` (`:238-252`) maps an unbounded time into the
range using a Dart-style positive modulo. Nested "remap" animations use it.

Keyframe frame numbers are converted to seconds **once at import**:
`KeyFrame::computeSeconds(fps)` (`keyframe.cpp:10`), called from
`KeyedPropertyImporter::addKeyFrame`. After import the runtime works in float
seconds, but the file and several code paths still think in frames. See
footguns below.

### 1.2 Object graph: KeyedObject, KeyedProperty, KeyFrame

- `LinearAnimation` owns a list of `KeyedObject` (`objectId` = index of the target object in the artboard).
- `KeyedObject` owns a list of `KeyedProperty` (`propertyKey` = numeric property id of the core schema).
- `KeyedProperty` owns an **ordered** list of `KeyFrame` (`frame` uint, plus the value).
  The runtime **does not sort**. It trusts the exporter (`keyed_property.cpp:19-22`, then binary search at `:33-65`).
- Keyframe subclasses: `KeyFrameDouble` (stored as f32 despite the name, `keyframe_double.cpp:9-12`),
  `KeyFrameColor` (ARGB u32), `KeyFrameBool`, `KeyFrameId`, `KeyFrameUint`, `KeyFrameInt`,
  `KeyFrameString`, `KeyFrameCallback`.
- `InterpolatingKeyFrame` adds `interpolationType` (uint) and `interpolatorId`
  (`interpolating_keyframe_base.hpp:23-24`). At runtime only `interpolationType == 0`
  (hold) is checked (`keyed_property.cpp:192`). Any other value means "use the
  interpolator object if one is referenced, else linear". So "cubic" is really
  "type 2 plus a reference to a CubicEase/CubicValue/Elastic interpolator object".
- **Load-time pruning** (`keyed_object.cpp` onAddedDirty): a keyed object whose
  target id does not resolve is dropped (`linear_animation.cpp:47-52`, non-fatal).
  A keyed property whose key the target type does not support is **silently erased**
  (`CoreRegistry::objectSupportsProperty`). Bad references never surface as errors.
- Keyframe value type vs property type is **not validated**. `applyInterpolation`
  static-casts the next frame to its own type (`keyframe_double.cpp:76`), and
  `CoreRegistry::setDouble` switches on the property key and quietly ignores keys
  it does not know (`include/rive/generated/core_registry.hpp:2542+`).

### 1.3 Sampling a property at time t (`keyed_property.cpp:124-213`)

1. `closestFrameIndex(t)`: if `t` is past the last key, return `count`. Otherwise
   binary search for the first key with `seconds >= t`, and on an exact hit return
   that index (plus an optional offset, used for callbacks).
2. `idx == 0` (t is before or at the first key): apply key 0's value (hold before the first key).
3. `idx == count` (past the last key): apply the last key's value (hold after the last key).
4. Otherwise `from = k[idx-1]`, `to = k[idx]`:
   - if `t == to.seconds`, apply `to` exactly;
   - else if `from.interpolationType == 0` (hold), apply `from`'s value;
   - else `from.applyInterpolation(t, to)`.
   **The interpolation of a segment belongs to the left keyframe.**
5. Interpolation (`keyframe_double.cpp:68-100`):
   `f = (t - from.s) / (to.s - from.s)`. With an interpolator,
   `v = interp.transformValue(fromV, toV, f)`, else `v = fromV + (toV - fromV)*f`.
   Colors (`keyframe_color.cpp:53-83`) remap `f` through `interp.transform(f)`
   and then lerp each channel.
6. Bool, Id, String and Uint keyframes are always discrete. They apply the
   `from` value whatever the mix (`keyframe_bool.cpp:35-53`), so **mix does not
   blend discrete values: whichever animation writes last wins.**

Keyframe values can themselves be data-bound (`effectiveValue(context)` reads a
per-instance "holder" fed by a DataBind, `keyframe_double.cpp:40-51`,
`linear_animation_instance.cpp:158-235`). This is a newer feature ("keyframe
values from view model").

### 1.4 Mix (blending several animations onto one property)

The base formula is a sequential lerp onto the property's **current value**
(`include/rive/animation/blend_accumulator.hpp:20-28`):
`new = mix == 1 ? value : current*(1-mix) + value*mix`.
Colors use `colorLerp` per channel in non-premultiplied 8-bit sRGB, rounded and
clamped (`src/shapes/paint/color.cpp:83-96`).

Consequences:
- Blending is **order dependent**. Applying A at 0.5 and then B at 0.5 does not
  give an even 50/50 mix: the result is 0.25·base + 0.25·A + 0.5·B.
- The result depends on whatever value the property held before the frame.
  Rive needs "AnimationReset" snapshots (below) to make transitions stable.
- `BlendAccumulator` (`blend_accumulator.hpp:30-56`) is an optimisation layer.
  It collects writes so each property is set once per frame and stays clean when
  unchanged. Blend states use it to collect all their animations' writes. The state
  machine uses it in "layer mode" for properties keyed by two or more layers.
  It reproduces the same sequential math exactly.

### 1.5 Interpolators (`src/animation/*interpolator*.cpp`)

All are standalone objects (`KeyFrameInterpolator`) that keyframes and
transitions **reference by id**. Many keyframes can share one. They live in the
artboard (or backboard) object list (`keyframe_interpolator.cpp:24-44`).

- **CubicEaseInterpolator** (`x1,y1,x2,y2`, default 0.42,0,0.58,1, `cubic_interpolator_base.hpp:23-26`):
  a CSS-style timing curve. `transform(f) = bezierY(solveT(f))`.
  The solver (`cubic_interpolator_solver.cpp`) is the well-known WebKit/"bezier-easing"
  method: an 11-sample table of x(t), a linear guess inside the right interval,
  then 4 Newton iterations if the slope is at least 0.001, otherwise 10 bisection
  steps (precision 1e-7). Its output is close to CSS `cubic-bezier()` but not
  bit-identical to any browser.
- **CubicValueInterpolator**: the same x-solve, but `y1/y2` are **values**, not
  normalised progress. The curve runs from `fromValue` through y1 and y2 to
  `toValue` (`cubic_value_interpolator.cpp:9-35`). This lets editors drag real
  value handles (After Effects style). Note that it caches coefficients **on the
  shared interpolator object** and recomputes them when from/to change. That is
  mutable shared state, and `transform()` asserts false, so this interpolator
  cannot ease colors or transitions.
- **ElasticInterpolator** (`easing` in/out/inOut, `amplitude`, `period`; `elastic_ease.cpp`):
  the Penner-style elastic, `2^(-10t)·sin((t-s)·2π/period)`. When amplitude < 1
  it ramps the amplitude in over the first quarter period. Period 0 is replaced
  by 0.5.
- Scripted interpolators (Luau) get a per-instance stateful clone.

### 1.6 LinearAnimationInstance: advancing time and reporting loops (`linear_animation_instance.cpp:287-462`)

Instance state: `m_time` (local seconds), `m_direction` (±1, flipped by pingpong),
`m_totalTime` and `m_lastTotalTime` (accumulated |delta|, used for exit time),
`m_spilledTime`, `m_didLoop`, and an optional `loopValue` override.

`advance(elapsed)`:
1. `delta = elapsed * animation.speed * m_direction`. If delta is 0, set `didLoop=false` and return false.
2. `totalTime += |delta|`, then `time += delta`.
3. Report keyed callbacks in (lastTime, time] (see Events).
4. Convert to **frames** (`frames = time*fps`) and compare with start/end in frames:
   - **oneShot**: clamp at the end (or start if reversed). `spilledTime` = the share
     of `elapsed` that overshot. `didLoop = true` when clamping.
   - **loop**: when `frames >= end`, wrap to `start + fmod(frames-start, range)`,
     compute the spill, set `didLoop`, and report callbacks from **0.0** to the new
     time. That is a bug when a work area is enabled: it should be `start`
     (`:382-390`). Reverse wrap is symmetric.
   - **pingPong**: loop while out of range. Reflect around end/start, flip
     `m_direction`, report callbacks for each leg (`:412-452`). This handles a
     large dt that bounces several times.
5. `keepGoing` = not oneShot, or not yet at the end in the play direction (`linear_animation_instance.hpp:135-149`).

`spilledTime` is how a state machine hands leftover time to the next state, so
an exit-time transition into another animation does not lose a fraction of a
frame (`state_machine_instance.cpp` tryChangeState, "advanceTime = spilledTime").

Unit footgun in the codebase itself: `time(value)` (seek) computes
`start = workStart * fps` (frames times fps) and subtracts it from a value in
seconds (`linear_animation_instance.cpp:475-479`). That is a frames/seconds mixup
in the exit-time bookkeeping.

---

## 2. State machines

### 2.1 Structure

- `StateMachine`: an ordered list of `inputs` (legacy: bool, number, trigger),
  an ordered list of `layers`, `listeners`, and data binds for its bindable properties.
- `StateMachineLayer`: one Entry, one Any and one Exit state, plus N other states.
  **All layers run every advance, in file order.** Later layers write after
  earlier ones, so on shared properties the last layer wins (with mix as in 1.4).
- `LayerState` kinds:
  - **EntryState**: the layer starts here. It applies nothing (`SystemStateInstance`);
    its transitions are evaluated immediately.
  - **AnyState**: never "current". Its transitions are tried **before** the current
    state's transitions on every evaluation (`state_machine_instance.cpp:619-680`).
  - **ExitState**: a terminal no-op state; the layer stops applying anything.
  - **AnimationState**: plays one LinearAnimation with a per-state `speed`
    multiplier (`animation_state_instance.cpp`). A missing animation becomes a
    static empty one rather than a crash.
  - **BlendState1D**: N animations, each with a threshold `value`, driven by one
    number (a legacy input or a view model bindable). It binary-searches the
    neighbouring pair and gives them mixes `(v-a)/(b-a)` and `1-that`; everything
    else gets 0 (`blend_state_1d_instance.cpp:83-151`). The thresholds **must be
    sorted**; the runtime does not sort them.
  - **BlendStateDirect**: each animation has its own weight from a constant,
    an input, or a bindable, as a **percentage 0–100**, clamped to 0–1
    (`blend_state_direct_instance.cpp:13-56`).
  - Blend states apply each child at `stateMix * childMix` and skip zeros
    (`blend_state_instance.hpp` apply). The optional LayerState flag `Reset`
    (bit 1) seeds properties from the first animation's first keyframe so the
    sequential lerps start from a known baseline. The flag `Random` (bit 0) makes
    transition selection weighted-random.
- Each state also carries `events` (fire actions) and `listenerActions`, each
  tagged `atStart` or `atEnd`, which run when the state is entered or left
  (`changeState`, `state_machine_instance.cpp:766-810`).

### 2.2 StateTransition (`state_transition_base.hpp:31-37`, `state_transition.cpp`)

| field | meaning |
|---|---|
| `stateToId` | target state (index in the layer) |
| `flags` | bit0 Disabled, bit1 DurationIsPercentage, bit2 EnableExitTime, bit3 ExitTimeIsPercentage, bit4 PauseOnExit, bit5 EnableEarlyExit (`state_transition_flags.hpp`) |
| `duration` | crossfade length: **ms**, or **percent of the from-animation's duration** (flag) |
| `exitTime` | **ms**, or **percent of the from-animation** |
| `interpolatorId` | an optional easing curve applied to the transition mix |
| `interpolationType` | default 1; **unused at runtime** for transitions |
| `randomWeight` | weight for Random states |
| conditions | an AND list; empty means "always" |

Duration can be overridden per instance by a data bind (`resolvedDuration`,
`state_machine_instance.cpp:549-560`, rounded and clamped to >= 0).

**allowed()** (`state_transition.cpp:152-212`):
1. Disabled: no.
2. Any condition false: no (AND, in order).
3. With exit time and an animation from-state, the exit time is converted to
   local seconds. For looping animations it is lifted into the loop the
   *last* total time was in (`exitTime += floor(lastTotal/dur)*dur`). Then if
   `totalTime < exitTime` the answer is `waitingForExit` (keeps the machine
   advancing). So exit time means "at or after X within the current loop", not
   "exactly at X". The code's own TODO admits that 50% exit on a loop fires
   anywhere in 50–100%.
4. Otherwise yes.

### 2.3 Evaluation order within one advance (`StateMachineLayerInstance::advance`, `state_machine_instance.cpp:482-547`)

For each layer, in order:
1. If the layer is "frozen" (settled, not mixing, its pose already applied), skip it.
2. `currentState.advance(dt)`, then `updateMix(dt)`, then advance `stateFrom` too
   if it is still mixing (and not paused on exit).
3. `apply()` (see 2.4).
4. **Loop** `updateState()` while it returns true, applying after each change, up
   to `maxIterations = 100` (then log to stderr and give up). **A layer can
   therefore take several transitions in one frame.** Entry, then A, then B
   happens in one advance if all conditions hold, and each change fires its
   start and end events.
5. `updateState()`:
   - If mid-transition (`mix < 1`) and the transition lacks `EnableEarlyExit`,
     **no transitions are evaluated**. View model changes still "expire with the
     frame" (`:621-630`), and so do triggers.
   - Try the **AnyState's transitions first, then the current state's**. Within a
     state, **list order = priority**, and the first allowed transition wins
     (`findAllowedTransition`, `:866-900`). Random states pick a weighted random
     transition among all allowed ones (`:812-864`).
   - A transition to the state that is already current is skipped (`canChangeState`).
     This is what stops "Any → X" from re-entering X every frame.
   - If nothing is allowed and the inputs are "settle-safe", mark the layer
     `settled` so later frames skip the search until something it reads changes.

After all layers: flush layer writes, advance data-bind converters, then
`input.advanced()` for every input, which **resets all triggers**
(`state_machine_instance.cpp:5515-5522`).

The host entry point `advanceAndApply(dt)` (`:5552-5626`):
`advance(dt)`, then `artboard.advanceInternal(dt)` (nested artboards,
constraints), then up to 5 passes of
{`updatePass` (layout/transforms/binds), `tryChangeState()`; if it changed,
`advance(0)`; `advanceInternal(0)`}, stopping when the artboard is clean. It returns
`keepGoing || hasPendingReports()`. The extra passes exist because conditions can
read layout or bound values that only settle after `updatePass`. This feedback
loop is hard to make deterministic, and Anima should avoid it.

### 2.4 How a transition mixes from-state into to-state (`tryChangeState` `:921-1027`, `apply` `:1029-1072`, `updateMix` `:228-261`)

When a transition is taken:
1. Flush pending writes. Clear any previous AnimationReset. `changeState(to)`
   fires the old state's `atEnd` actions and then the new state's `atStart` actions.
2. Fire the transition's `atStart` actions. If the duration is 0, also fire `atEnd` at once.
3. `stateFrom = old current` (the previous stateFrom is deleted). Chained
   transitions therefore only crossfade the **two** most recent states. The older
   one is dropped abruptly, but the AnimationReset snapshot below hides the pop.
4. If the transition takes time, build an **AnimationReset**: a snapshot of the
   *current* values of every number and color property keyed by either state
   (`animation_reset_factory.cpp:198-207`).
5. With exit time and `PauseOnExit`, seek the from-animation to the exit time and
   hold it there (`m_holdAnimation`). `m_mixFrom = m_mix` keeps the mix the
   from-state had when interrupted.
6. Advance the new state by the old animation's `spilledTime`. Set `mix = 0`.

Each frame:
- `mix += dt / mixTime`, clamped to [0,1]. `mixTime` = `duration/1000` s, or
  `duration/100 × fromAnimation.durationSeconds` (`:563-586`). When mix reaches 1,
  fire the transition's `atEnd` actions and drop the reset snapshot.
- `apply`: (a) re-apply the AnimationReset snapshot (a stable base), (b) apply
  stateFrom at `interp(mixFrom)`, (c) apply the current state at `interp(mix)`.
  Because of the sequential lerp in 1.4, step (c) is effectively
  `lerp(fromResult, toResult, eased(mix))`. That is a true crossfade as long as
  stateFrom ran at full mix.

Properties keyed only by the old state keep their last written value after the
transition. **There is no automatic return to the setup pose.** Properties are
sticky.

### 2.5 Conditions

Legacy input conditions (`transition_*_condition.cpp`): number (`== != <= >= < >`,
`transition_condition_op.hpp`), bool (equal means "is true", notEqual means "is
false"), trigger ("fired and not yet used by this layer").
**Footgun: if the input id does not resolve, the condition evaluates TRUE** (by
design, "limp along" for forward compatibility, e.g. `transition_trigger_condition.cpp:20-24`).

View model conditions (`transition_viewmodel_condition.cpp`, about 1400 lines) are
`left comparator  op  right comparator`. Comparands can be: a bound view model
property, a literal value (number, string, bool, color, enum), a component or
artboard property (read straight from objects, so conditions can read layout
results), or a trigger. Kind resolution picks the first compatible
(left, right) pair in a fixed order (`:554-586`). Number and uint pairs compare
as float unless both are integer kinds (`:588-632`). An unresolvable comparison
evaluates **false** (`:1086-1095`), which is the opposite default from legacy inputs.

### 2.6 Trigger semantics

Legacy `SMITrigger` (`state_machine_input_instance.hpp:83-118`):
- `fire()` sets `m_fired` (idempotent) and marks the machine as needing an advance.
- During the next `advance`, every layer can see it. When a layer **takes** a
  transition whose conditions include it, `useInLayer` marks it used **for that
  layer only**, so each layer can consume the same trigger once, and a layer
  cannot take two trigger transitions off one fire.
- At the end of that advance it is reset whether or not anything consumed it.
  **A trigger that no transition can take this frame is lost.** That includes the
  case where the layer is mid-crossfade without early exit, or the target is
  already the current state.

View model triggers are a **u32 counter** (`viewmodel_instance_trigger_base.hpp:25`).
Firing increments it. Conditions do not compare values. They ask whether this
value's global **change sequence** is newer than the layer's last "searched"
baseline and not yet used by that layer (`StateMachineInstance::viewModelValueChanged`,
`state_machine_instance.cpp:6475-6512`). Every view model write takes a number from
a global monotonic sequence. A per-layer window then decides whether a change is
still pending. The design aims at "each change is visible to each layer for exactly
one search", and it works across nested and list instances. That it takes
several hundred lines suggests how hard edge-triggered events are to retrofit
onto level-triggered state.

### 2.7 Needs-advance and settled detection

- `markNeedsAdvance()` is called when an input or bound value changes, a listener
  fires, an event is reported, and so on (`state_machine_instance.cpp:5635`).
- `advance()` returns true if any layer changed state, is mixing, is waiting for
  an exit time, or its current state `keepGoing` (looping, or a oneShot not
  finished), or if a converter (for example a smoothing interpolator) is still
  animating, or if events are pending.
- Settled layers (`m_settled`) skip the transition search. They are woken
  (`unsettleLayers`) when anything their transitions read changes. Exit-time
  transitions are never settle-safe, and neither are conditions that read
  untracked object properties (`state_machine.cpp:222-234, 546-560`).
- Hosts are expected to stop the rAF loop when `advanceAndApply` returns false
  and resume on input. That is the "idle" behaviour icons need.

---

## 3. Listeners and hit testing

### 3.1 Listener model

A `StateMachineListener` has a `targetId` (a shape, a group, a layout, the
artboard itself, or an event), one or more `ListenerInputType`s (a type plus a
pointer button), and an ordered list of `ListenerAction`s.
Types (`include/rive/listener_type.hpp`): enter 0, exit 1, down 2, up 3, move 4,
event 5, click 6, componentProvided 7, textInput 8, dragStart 9, dragEnd 10,
viewModel 11, drag 12, focus 13, blur 14, keyboard 15, semanticAction 16, gamepad 17.

### 3.2 Hit-test geometry

- At instance creation each pointer listener's target becomes a "hit component".
  A Shape gives `HitExpandable`. A **group/container recursively expands to every
  Shape under it** (`addToHitLookup`, `state_machine_instance.cpp:4178-4301`).
  Layouts, text runs and (opt-in) images have their own kinds. Several listeners
  on the same shape share one hit component.
- A shape is tested in this order (`shape.cpp:267-287`, `191-210`):
  1. world AABB contains the point;
  2. walk up the parents (hidden drawables fail; clipping ancestors can reject);
  3. a "hi-fi" test: rasterize-style coverage of a **±2 px square** around the
     point against all the shape's path geometry, using the fill rule
     (`HitTestCommandPath`). It is a **fill-area test of the path geometry**. Stroke
     width is not considered, and paint opacity is not either (except
     `renderOpacity == 0` in the other hit path).
- Hit components are **sorted by draw order**, topmost first, and re-sorted when
  the draw order changes (`sortHitComponents`, `:5012`; `advance` `:5455-5459`).

### 3.3 Dispatch (`updateListeners`, `state_machine_instance.cpp:3202-3355`)

For each pointer event (down, up, move, exit) with a pointer id:
1. Optional capture phase across the machine tree (newer feature).
2. Map the position into artboard content space (undoing artboard transform and origin).
3. Reset every listener group for that pointer, then `prepareEvent` on every hit
   component, which computes `isHovered` by hit test. Components whose listeners
   need nothing for this event type early-out without hit testing.
4. `processEvent` walks the hit components in draw order with
   `canHit = !hitOpaque`. Once a component flagged **opaque** (the listener's
   `isOpaque`, or the drawable flag `Opaque`) is hit, everything below gets
   `canHit = false`. That clears their hover, so they receive an *exit* and not
   a down. Non-opaque hits let the event pass through to lower shapes.
5. Per listener group (`listener_group.cpp:212-370`):
   - hover changes produce **enter/exit**, with previous position reset on enter;
   - **click** = down then up on the same group with the same button; down outside
     or up outside sets phase "out";
   - **drag** = move while the phase is down (it emits dragStart once, and dragEnd on release);
   - otherwise the event fires if hovered and a matching type and button exists;
   - when it fires, perform **all actions in order, synchronously**, then
     `markNeedsAdvance()`. A group fires at most once per event (`consume()`).
6. Return `none`, `hit` or `hitOpaque`, so hosts can decide whether to let the
   DOM event propagate.

### 3.4 Listener actions

- `ListenerBoolChange`: value 0 sets false, 1 sets true, 2 **toggles** (`listener_bool_change.cpp`).
- `ListenerNumberChange`: set a literal. `ListenerTriggerChange`: fire.
  Each can target this machine's input or a **nested artboard's input** (`nestedInputId`).
- `ListenerViewModelChange`: write to a bound view model property, from a literal,
  another view model property, or the invocation (pointer x/y, drag delta, key
  pressed, text, focus), with type checks (`listener_viewmodel_change.cpp:52-160`).
- `ListenerAlignTarget`: move a Node to the pointer in its parent space, either
  absolute or `preserveOffset` (apply only the pointer delta) (`listener_align_target.cpp`).
- `ListenerFireEvent`: report an Event.
- Actions mutate inputs and values at once, but **transitions only respond on the
  next advance**.

---

## 4. Data binding and view models

### 4.1 Model

- `ViewModel`: a schema, an ordered list of `ViewModelProperty` (number, string,
  boolean, color, enum (custom or system), trigger, list, nested view model,
  image/font/blob assets, artboard, symbol list index).
- `ViewModelInstance`: values for one view model (`ViewModelInstanceNumber`
  f32, `Color` ARGB default `0xFF000000`, `Enum` index, `Trigger` u32 counter,
  `List` of items, each item pointing to an instance, `ViewModel` holding a
  reference to a nested instance). Instances are ref-counted and can be shared by
  several artboards and machines.
- `DataContext`: a stack or chain of instances with a parent pointer. Paths are
  resolved against the main instance, then up through parents (nested artboards).
- `DataBind` (`data_bind_base.hpp:27-29`): `propertyKey` on a `target` object,
  `flags`, and an optional `converterId`. `DataBindContext` adds a
  `sourcePathIds` path (a list of ids, or name-based ids resolved through the
  file's data resolver) (`data_bind_context.cpp:89-128`).
- Flags (`data_bind_flags.hpp`): bit0 Direction (0 = toTarget, 1 = toSource),
  bit1 TwoWay, bit2 Once, bit3 SourceToTargetRunsFirst, bit4 NameBased.
  `toTarget = TwoWay || !ToSource`; `toSource = TwoWay || ToSource`
  (`data_bind.cpp:597-611`).
- State-machine-owned binds target `BindableProperty*` objects, typed slots
  owned by the machine that conditions, blend states and listener actions read.
  Artboard-owned binds target component properties directly.

### 4.2 Update cycle

- A source value change marks its dependent binds dirty (`addDependent`, then
  `addDirt(Bindings)`). The container keeps a **dirty list**.
  `DataBindContainer::updateDataBinds` (`data_bind_container.cpp:277-370`) runs, in
  order: polled to-source binds, push-driven to-source binds, then to-target binds.
  Additions and removals made during the pass are deferred.
- To-target: `contextValue.apply(target, key)` runs the converter chain and then
  `CoreRegistry::setX(target, key, value)`. Target writes are dirt-suppressed so
  two-way binds do not echo (`data_bind.cpp:461-490`).
- To-source: the target property's change notification (or polling for computed
  properties such as world x and layout width) writes back through the reverse
  converter.
- Two-way conflict policy: the bind remembers which side changed last
  (`TargetOrigin`). On a full reconcile, `SourceToTargetRunsFirst` decides the
  winner (`data_bind.cpp:520-560`).
- The state machine calls `updateDataBinds` at the start of advance and before
  each transition search (`tryChangeState` `:5093-5106`), so conditions see fresh values.
- **Silent no-ops:** if the source path does not resolve, the bind simply
  `unbind()`s (`data_bind_context.cpp:105-118`). If the source type has no
  context value (`DataType::none`), nothing applies. Number-to-uint targets round
  and clamp to >= 0 (`context_value_number.cpp`). There is no error reporting anywhere.

### 4.3 Converters (`src/data_bind/converters/`)

There are many: boolean negate, to string, to number, rounder, string
pad/trim/template/remove zeros, operation (+−×÷ with a value or another view
model property), formula, range mapper (in range to out range, clamp,
interpolation), group (a chain), list to length, number to list, trigger,
interpolator (**smooths value changes over time** with an easing curve and
duration, which makes the machine keep advancing), and system converters
**degrees to radians** and normalizer. The existence of a system degrees-to-radians
converter shows that rotation is stored in radians internally while authors
think in degrees.

### 4.4 Why view models replaced state machine inputs (inferred; no deprecation note exists in the code)

The runtime still fully supports inputs. The code shows what inputs lack:
- inputs belong to one state machine; parents reach a nested machine only
  through `NestedInput` proxies by id;
- only bool, number and trigger exist (no string, color, enum, list or nested);
- inputs cannot drive arbitrary properties (text, colors, visibility) without
  keyframing them;
- they are one way (host to machine), with no way to read results back (to-source);
- they are per instance and cannot be shared across artboards, lists or components;
- they are addressed by name or index through a different host API than everything else.
View models give a single typed, path-addressed, shareable, two-way data
surface. Transitions, blend states, listeners, keyframe values, text and
layout all read and write it.

---

## 5. Events

- `Event` (an artboard object, a CustomPropertyGroup) has a name and custom
  properties (number, bool, string). Subclasses: `OpenUrlEvent`, `AudioEvent`.
- Ways to fire one:
  1. **Callback keyframes**: a `KeyedProperty` whose key is a callback property
     (Event `trigger`, view model trigger `fire`, nested trigger `fire`, custom
     trigger; `core_registry.hpp:5646-5658`) is not "applied". During `advance`,
     every keyframe crossed in (lastTime, time] is reported
     (`keyed_property.cpp:67-113`), with `delay = timeNow - keyframeTime` so the
     host knows how late it is. The rules: forward excludes the start and includes
     the end; the very first frame includes a keyframe at t = start; loop and
     pingpong legs are reported separately; pingpong avoids double-reporting
     at the turnaround (`linear_animation.cpp:254-291`).
  2. **State and transition fire actions** with `occurs` atStart or atEnd.
  3. **Listener action** `ListenerFireEvent`.
- `reportEvent` pushes onto `reportedEvents`. The host reads
  `reportedEventCount()`/`reportedEventAt(i)` **after** `advance`. At the start of
  the *next* advance, `applyEvents` delivers them to the machine's own "event"
  listeners, in listener order, iterating up to 100 times for cascades. They
  bubble immediately to the parent artboard's machine, and audio events play
  (`state_machine_instance.cpp:5108-5150, 6231-6330`).
  **Internal reactions to an event therefore lag one frame.** The host sees each
  batch exactly once, if it polls every frame.

---

## 6. Nested artboards (components)

- `NestedArtboard` references another artboard and holds a **cloned
  ArtboardInstance** with its own `NestedAnimation` children:
  `NestedStateMachine` (an SMI of its own), `NestedSimpleAnimation`
  (play/pause, speed, mix), and `NestedRemapAnimation` (time driven by a 0–1
  value through `globalToLocalSeconds`) (`nested_simple_animation.cpp`,
  `nested_remap_animation.cpp`).
- The parent advances nested instances inside `artboard.advanceInternal`
  (`AdvanceFlags::AdvanceNested`). Pointer events are forwarded through
  `HitNestedArtboard`, which transforms the point into nested space.
- Data context: if the nested artboard's `dataBindPath` resolves to a nested
  view model instance in the parent context, that becomes the child's main
  instance with the parent context as its parent. Otherwise the child inherits the
  parent context (`artboard.cpp:4968-4995, 5122-5137`; `nested_artboard.cpp:960-998`).
  Each nested SMI is pointed at the child artboard's data context.
- Parents can poke nested legacy inputs through `NestedBool`/`NestedNumber`/
  `NestedTrigger` listener actions. Nested events bubble up.

---

## Lessons for Anima

### A. Semantics to adopt, written precisely

1. **One time unit: seconds, as f64, everywhere.** Keyframe times are seconds
   (optionally authored as frames plus a declared fps, but normalised once at
   load into a canonical in-memory model). Durations, exit times and transition
   durations are seconds. Percent forms, if kept, use an explicit
   `{ "pct": 50 }` type and never a flag bit on a bare number.
   Angles are **degrees** in the file and in the API, and only the renderer
   converts. Blend weights are 0..1, never 0..100.
2. **Keyframe sampling rule** (copy Rive, and write it into the spec):
   before the first key, hold the first value; after the last, hold the last;
   at an exact key time, use that key; inside a segment, apply the *left* key's
   easing. Keys must be strictly increasing in time. Validate and reject
   (or sort with a warning) at load. Do not trust the exporter.
3. **Easing belongs to the segment, given inline**: `"ease": "hold" | "linear" |
   {"cubic":[x1,y1,x2,y2]} | {"elastic":{...}} | {"spring":{...}}`. No shared mutable
   interpolator objects. Cubic follows CSS `cubic-bezier` semantics with x1,x2
   clamped to [0,1]. Specify the solver (for example Newton plus a bisection
   fallback with a stated epsilon) and ship golden vectors so the JS and any
   native runtime agree to about 1e-5.
4. **Typed tracks.** Each animatable property declares a value type (number,
   color, bool, enum, string, vec2/path). The loader rejects a keyframe whose value
   type does not match the property, and rejects an unknown property. Both are
   errors with a JSON pointer, never silent pruning. Discrete types (bool, enum,
   string) always use hold.
5. **Colors** interpolate in a declared space. The default should probably be
   premultiplied linear or OKLab, rather than whatever is easiest. Store colors as
   exact 8-bit or float values and never round-trip through f32-as-int (Rive's
   reset snapshot does `(float)ARGB`, `animation_reset_factory.cpp:153`, which loses
   low bits).
6. **Blending is a pure function, not in-place lerping.** Each frame:
   `value = base (rest pose)`, then for each layer in order
   `value = lerp(value, layerSample, layerWeight)`. Inside a layer a crossfade is
   `lerp(sample(from), sample(to), ease(t))`. Because every frame starts from the
   rest pose, there is no history dependence, no AnimationReset snapshots and no
   order-sensitive drift. Rive's own transition apply converges on exactly this,
   with much more machinery. Unkeyed properties return to the rest pose. If
   "sticky" values are wanted, they become an explicit opt-in.
7. **Loop modes**: `once | loop | pingpong`, with a range [start, end] in
   seconds. Specify behaviour for very large dt (multiple wraps) and for
   negative speed. Define `didLoop` and loop events as "crossed the boundary
   during this advance", with a count.
8. **State machine step** (deterministic, one function):
   1. Apply queued host and pointer inputs, in arrival order.
   2. Advance each layer's clocks by dt.
   3. For each layer in declared order: evaluate transitions, **Any first, then
      current, in declared order, and take the first that passes.** Allow chained
      transitions within a step up to a fixed, spec-stated cap (Rive's 100). Hitting
      the cap is an error event, not a stderr print.
   4. Sample and blend (6).
   5. Emit events in a defined order (state exit, transition start, state enter,
      keyframe events in time order, transition end) as a list returned from
      `step()`.
   6. Clear edge inputs (triggers).
   `step(dt)` returns `{ events, needsAnotherFrame }`. A fixed-timestep mode
   (for example 1/120 s substeps) plus a seedable RNG for random transitions makes
   golden tests possible.
9. **Transition fields**: `to`, `when` (an AND list, or an expression tree), `duration`
   (seconds), `ease`, `exitTime` (an optional, explicit `"atOrAfter"` threshold
   within the current loop), `interruptible` (Rive's early exit), `priority` =
   list order. No self-transitions unless `allowReenter: true`.
10. **Exit time** compares the from-animation's local time within the current
    loop (not an accumulated total). Spill leftover dt into the next state (keep
    Rive's spilledTime idea, because it prevents hitches).
11. **Triggers are a queue of edge events, not a boolean.** Each fire has a
    sequence number. Each layer consumes at most one fire per transition taken.
    The spec states what happens to an unconsumed fire: **default to dropping it at
    the end of the step**, which is Rive's behaviour, but report it in debug
    output. Offer `"buffer": n` per trigger for "remember the click until the
    current crossfade ends". Rive loses triggers during non-interruptible
    crossfades, and that is a real authoring trap for icon taps.
12. **Missing references fail the load.** Rive evaluates conditions on missing
    inputs as *true* and unresolvable view model comparisons as *false*. Pick
    "load error" and keep a `strict:false` compatibility mode that logs.
13. **Hit testing**: target = a shape or a group (expanding to descendant
    shapes), tested topmost first by draw order. The point is in the fill area
    (by fill rule) **or within stroke width/2 of the stroke** (Rive ignores
    strokes, which matters for line icons), with an optional `hitPadding` in px
    (Rive's fixed ±2 px). An optional explicit `hitArea` rect or circle suits
    tiny icons. `opaque: true` stops propagation to lower targets.
    Specify enter, exit, down, up, click (down and up on the same target and
    button), and drag (with a threshold in px). Listener actions run immediately
    on input values, and transitions react in the next step. Document that one
    frame of latency, or process input at the start of the same step.
14. **Data model**: adopt view models as the *only* external interface. Use
    typed properties (number, bool, string, color, enum, trigger, list, nested),
    path-addressed by name. Bindings are `source path → target property` with an
    explicit `direction: "toTarget" | "toSource" | "twoWay"` and a stated conflict
    rule (host writes win within a step). Converters are a small pure set
    (map range, clamp, round, negate, format, ease-over-time). Binding updates run
    at one fixed point in the step (after input, before transitions). Never re-run
    the transition search after layout: conditions read only view model values and
    machine state, never computed geometry.
15. **Events** are returned from `step()` in the same frame they occur, each with
    `{name, time offset within the step, payload}`. Callback keyframes report
    every key crossed in (prev, now] (closed at the very first frame), including
    across loop wraps, in chronological order.
16. **Nested components**: each component instance owns its own machine and
    binds to a sub-path of the parent view model (`bind: "items/0"`), or
    inherits. Avoid separate "nested input" proxies; parents talk to children
    only through the shared view model.

### B. Simplify relative to Rive

- Drop: work areas (use explicit ranges on the clip reference), `quantize`
  (make it an easing or step option if anyone asks), legacy inputs, `interpolationType`
  numbers, CubicValue interpolators, the BlendAccumulator, settled or frozen layer
  tricks (instead make `step` cheap and give `needsAnotherFrame` exact semantics),
  layout feedback passes, random-weight transitions (or keep them with a seeded RNG).
- Blend states: keep 1D (sorted thresholds, validated) and direct (0..1
  weights). Both become ordinary weighted samples under rule 6.
- Use one condition language: `{"vm":"hover","op":"==","value":true}`, plus `and`,
  `or` and `not`, and `{"fired":"tap"}` for triggers.

### C. Footguns seen in Rive to avoid

- **Mixed units**: frames (keyframes, duration, work area), seconds (runtime),
  milliseconds (transition duration, exit time), percent (duration, exit time,
  direct blend 0–100), radians internally against degrees in the UI. There is even
  an in-repo frames-times-fps versus seconds mixup (`linear_animation_instance.cpp:475-479`)
  and a loop-callback restart from 0 instead of the work-area start (`:382-390`).
- **Silent no-ops**: unsupported property keys are erased at load; a mismatched
  keyframe type is cast without a check; unknown keys fall through the setter
  switch; an unresolved bind path quietly unbinds; a missing input means the
  condition passes.
- **Lost triggers**: a trigger is reset at the end of every advance, consumed or
  not; it is unreadable during non-early-exit crossfades; and it is dropped when the
  only matching transition targets the current state.
- **Order-dependent blending**: in-place sequential lerp means layer order and
  previous-frame values leak into results, which forced AnimationReset snapshots
  and a lossy color-through-float path.
- **Exit time** fires anywhere after the threshold within the loop, not exactly at it.
- **Mutable shared interpolators** (CubicValue caches per-call coefficients on a
  shared object), which is unsafe once instances or threads share a file.
- **Unsorted data trusted from the file**: keyframes and 1D blend thresholds are
  binary-searched with no validation.
- **Feedback loops**: conditions that read layout or computed properties need up
  to 5 update and transition passes per frame. That kills determinism.
- **One-frame event latency** for internal event listeners, and events visible to
  the host only until the next advance.
- **Hit testing ignores strokes and uses a fixed ±2 px square**, which is wrong for
  stroke-only line icons at small sizes.
- **Two different defaults for unresolvable conditions** (input: true; view model: false).

### D. Testability checklist for the Anima runtime

- `sample(clip, t)` is pure: golden JSON vectors per easing and per loop mode,
  including exact keyframe times, t before the first key and t after the last key.
- `step(state, inputs, dt)` gives `(state', pose, events)`, and is serialisable
  and replayable. A test is a script of `[dt, inputs]` with expected
  `currentState`, pose samples and event lists.
- Seeded RNG; fixed substep option; strict loader with error codes and JSON
  pointers; a linter for unreachable states, transitions shadowed by earlier
  ones, triggers no transition reads, and bindings to unknown paths.
