# P4d-3 action-expression oracles

Four completed probes compare **104 observations** (baseline plus 25 clicks each),
with deep equality and tolerance **0**. All dumped counts and ordered reported event
sequences match at the documented post-click boundary. No pending marker remains.

| Probe | Count after clicks 1–25 | Reported events |
|---|---|---|
| data-bind-listener-actions | 1 through 25 | none |
| bind-action-clamp | 1 through 7, then 7 for 18 further clicks | none |
| bind-event-expression | 1 through 25 | 25 `shared`, observed number field 1 through 25 |
| bind-condition-modulo | 1 through 25 | 5 `shared`, observed number field 5/10/15/20/25 |

`python3 tests/oracle/capture_listener_actions.py` independently authors native
Rive formulas/listeners and captures all dumps and session logs. It invokes only
`~/.rive/bin/rive . --commands=commands.txt`, deleting binary outputs without reading
them. It does not scaffold documentation. `node tools/oracle.ts --build --strict`
rebuilds AniML and compares the committed captures. CI needs no Rive installation.

## Observation boundary and payload limits

Each completed native observation follows `pointer click@120,120`, **then
`advance 1`**, then `data-dump`. Anima uses a click, one 1/60-second advance, and
`snapshot count`. `click` in observations.json is the interaction index, **not a
60 fps frame number**. The manifest time is the Anima script's duration only.
These cases establish post-click value/sequence parity, not elapsed-time parity.
All authored reports between dumps are retained in order; Anima-only automatic
`@state-end`/`@transition-start`/`@transition-end` metadata is omitted, as in the
existing event probes. No expected fifth-click filter
is applied to the reference. Every empty event interval is compared too.

The count increments through a native formula-backed listener read/write.
The native clamp is `min(7, count + 1)`; Anima clamps the action result using
its input max=7. Modulo uses a native remainder formula in a transition comparator.
For these nonnegative integers it expresses Anima's floor-based modulo exactly;
negative operands and zero divisors are outside this probe. Rive remains in its
milestone state until the remainder changes; Anima returns to idle immediately.
This mapping compares observable reports/counts, not internal machine states.

Rive's event custom number property reads count; a second outward binding exposes
that **same event property** as `observed` in the dump. The reference payload is
that observed property value, not a number copied from Anima or inferred from the
click index. Session logs independently supply event names and order. This is the
existing oracle's payload observation method: the CLI log itself omits payloads.
It proves the custom property's sampled value at the dump boundary, not the exact
host callback payload or instant-of-emission value. Count stays unchanged between
click and dump. No browser host payload claim is made.

The independent bindings and explicit boundaries follow the silent-no-op and
feedback-loop cautions in [animation/state research](../../docs/research/rive-animation-and-state.md)
§C, and the delivery/observation separation in
[web runtime research](../../docs/research/rive-web-runtime.md) §§2–3.

## Findings, excluded from completed parity cases

1. **New immediate observation finding:** omitting native `advance 1` produces
   4 events at clicks **6/11/16/21**, with observed fields **6/11/16/21**;
   Anima produces 5 at **5/10/15/20/25**. Thus four reports lag by one click and
   the fifth is absent at the end of the 25-click run. Fresh captures, scene,
   commands and exact mismatch are retained in `bind-condition-modulo/immediate-probe/`.
   Adding an advance is an explicitly different observation boundary, not a
   tolerance change. The capture does not establish the underlying runtime cause.
2. **Inherited listener finding:** sources at frames 13/28 in both; Anima responses
   14/29, Rive 13/28 (one-frame lag; intentional SPEC next-step rule).
3. **Inherited timeline endpoint finding:** keys at 15/30/60 in Anima versus
   15/30/61 in Rive (last key one frame later; cause unproven).

`--strict` exits 0 for the 45 completed cases; all three findings are printed and
recorded separately in `findings-metrics.json`, and tests preserve their mismatch.
There are no new skips, tolerance increases, runtime or normative-spec changes.
Parity test fields are updated; row statuses are unchanged.
