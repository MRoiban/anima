# Nested component controls

Declare `components nested`; expressions require `bind`, and `$` paths require `data`.
The optional module preserves ordinary components' byte budget. It adds the following fields
(JSON and AniML use the same names):

| JSON field | AniML | Meaning |
|---|---|---|
| `time: number \| string` | `time="0.5"` or `time="$t"` | Absolute child animation source time in seconds |
| `fps: number` | `fps="12"` | Positive finite sample rate |
| `size: [w,h]` | `size="20 10"` | Positive target bounds |
| `fit: string` | `fit="contain"` | contain, cover, fill, none, scale-down, fit-width, fit-height |
| `align: string` | `align="bottom-right"` | center, top-left, top, top-right, left, right, bottom-left, bottom, bottom-right |
| `outputs: {done: expression}` | `<output name="done" value="count > 1"/>` inside a component | Read-only number, bool, color or string outputs |
| `component: "$card"` | `component="$card"` | Select the definition named by a component data property |

`time` is sampled after parent bindings and before the child step. Omitted time accumulates
`dt * speed`, preserving the fractional remainder between samples. With `fps`, the source clock
is floored to `floor(time * fps) / fps`, recognizing a tick reached within SPEC §5's existing
1e-9 second boundary rule. Time must be finite and nonnegative; invalid live values throw
`instance-time` with a node pointer and corrective hint. Backward scrubbing resamples the current
child state without reconstructing it or undoing transitions. State ages and fades advance by
positive source deltas; animation sampling and event crossings follow both directions. When
`motion` is also declared its timeline work areas, speeds and looping remain in effect.
Paused children retain their time, pending writes and fractional accumulator.

Fitting maps the child's entire viewBox, including its nonzero origin, into `[0,0,w,h]`.
With size present, omitted fit defaults to contain and omitted alignment to center.
Contain uses the smaller scale, cover the larger, fill separate X/Y scales, none 1, scale-down
min(1,contain), and the axis fits use that axis's scale. Remaining space aligns to the selected
edge or center. There is no implicit viewport clip. Ordinary instance transforms compose outside
the fit. Hit testing uses the inverse fitted world matrix. `fit`/`align` without `size`, or a zero
size, is `instance-size`. With lists, ordinary repeated placements keep their existing bounds
semantics; the new fit applies to instance nodes.

An output expression reads the child's inputs, `$` properties and nested child outputs. Outputs
cannot depend on their own `outputs.*` namespace. Invalid expressions are `output-expression`;
opaque list/model sources also fail with `output-expression`. Parent reads use `badge.outputs.done`, including in bindings
and guards; selected snapshots use `badge/outputs.done`. The parent evaluates before children,
so child writes from this step reach parent bindings/guards on the next step. A changed output
keeps the parent awake for that next pass, including when the child is otherwise settled. Outputs are
read-only: actions, bindings, poses, tracks and host writes reject with `read-only-path`.
Repeat items expose the same outputs as `rows.0.outputs.done`; snapshots use
`rows/0/outputs.done`. Read access is installed for every player, including repeated components.
Canonical decompilation may use a JSON-valued `outputs` attribute, which round-trips identically.

The `data` property type `component` stores a definition name, defaults to empty string, and
validates declared names. Empty selection hides and stops a placement. Changing names rebuilds
that placement with default state; retaining a name keeps its player. Clearing then restoring a
name rebuilds it. Unrelated placements/repeat identities survive. Runtime values must name a
declared component or empty string. Dynamic choices with a shared input name must agree on its
type (`component-input-type`), and explicit initializers must exist in every choice
(`unknown-input`). A non-component `$` selector is `component-path`. All possible choices are
validated, including recursion/expansion limits. `component("row")` guard literals await the typed
literal parser owned by the data-extras task; they are not implemented here.

Drawing uses per-player trees, recycles released slots, and shares the existing SVG and Canvas
backends. This follows [graph research](../../docs/research/rive-format-and-graph.md) §6; the single
parent/child step ordering follows [state research](../../docs/research/rive-animation-and-state.md)
§C. No native implementation is copied.

Native observation: Rive 1.9.1 reports x=1 then x=2 after 0.12s and 0.13s with nested quantize=12
for x=12t. Anima reports x=1 then x=3. A nonboundary 0.12s+0.14s follow-up matches x=1 then x=3
in both runtimes. This supports a precision-boundary explanation (an inference), not per-step
truncation. The original delta1 observation remains a finding with unchanged numbers and limits.
