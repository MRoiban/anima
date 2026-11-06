# derive

Optional `derive` (with `data` and `bind`) adds read-only computed scalar model properties.
A number, string, bool, color or enum property may declare `value` as a bind expression and
optionally `convert` naming a converter/group (requires `convert`). JSON and AniML use the
same names: `<string name="label" value="$score" convert="points"/>`.

Inside that expression `$name` resolves against the containing instance, including each list
item. `$main:path` remains absolute. Computed properties can depend on other computed properties;
cycles fail with `derive-cycle`. Values initialize per player and recompute at the data binding
position before ordinary data bindings sample their snapshot. Conditions/actions before that
position observe the previous resolved computed value; events/subscriptions after it see the new
value. Read paths work in conditions, bindings, events, CLI samples and host handles.

`set`, `copy`, `toggle`, input `write`, reverse binding modes and instance initializers reject
computed destinations with `read-only-path`, an authored JSON pointer, message and hint. Host
handle `.set()` throws `DataError` with the same code. Write the source properties instead.
`derive-type` rejects non-scalar or incompatible declarations; `derive-converter` identifies
missing converters. Expression errors retain bind codes. Computed values use the declared scalar
normalization and numeric bounds. Computed numbers evaluate the expression before initial
bounds are applied; the stored-property fallback zero is not an initial computed value. Bool
results become 0/1 for number properties before clamping. State and converter caches belong to each player/instance.

The scope-and-binding approach follows the metadata separation in
[graph research](../../docs/research/rive-format-and-graph.md) §6 and avoids feedback iteration
as discussed in [state research](../../docs/research/rive-animation-and-state.md) §C.
No implementation or text is copied from Rive. Documents without computed declarations receive
no derived scope, resolver, scheduler or per-step work.

This completes instance-relative computed evaluation, not upward component lookup; the broader
`data.binding-relative` parity row remains pending. See oracle/README.md for the native evidence
boundary. Examples under examples/ compile through the ordinary CLI.


## Native evidence (2026-11-06)

Fresh CLI 1.9.1 headless data dumps verify formatted score labels, bounded formula
values and relative evaluation in three list instances, including source updates.
Seven paired probes verify `<`, `<=`, `==`, `!=`, `and`, `or`, `not` settled results
for number and bool targets through native transition comparators. All nine cases
use exact comparisons. See [the evidence report](oracle/README.md) for raw dumps,
commands, mappings and scheduling/precision limits.

The read-only contract above remains Anima's contract: the tested native
converter-to-model composition permits destination writes, including retaining a
manual label after an advance. Its read-only parity comparison is an evidenced
skip, not verified parity or a decided intentional difference. No normative
behavior changes in this evidence follow-up.
