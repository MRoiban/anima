# Fresh native evidence: derive and bind logic

Captured 2026-11-06 with the permitted local Rive CLI **1.9.1**, headless
`--commands` only. The earlier 1.9.0 startup block is resolved. No runtime code,
oracle comparison code, thresholds, parity statuses or existing findings changed.

## Reproduction

From the repository root:

```sh
python3 modules/derive/oracle/capture.py --capture
node tools/oracle.ts --strict
npm run test:scope -- derive bind oracle --no-browser
```

The driver independently authors RML and AniML, retains every native command and
session log, and copies typed values from raw dumps to `rive/observations.json`.
It does not run Anima to generate expectations. The driver also compiles
its authored `case.animl` through the ordinary AniML compiler to refresh `case.ani`.
The driver removes any generated `.riv` without reading it. It creates no scaffold
instruction files or copied CLI documentation. Committed `.ani` files are Anima JSON.

The manifest uses the oracle's existing exact observation comparison, with every
threshold and tolerance **zero**. The reference `click` index is the runner's
historical name for a snapshot index; these probes use data writes, not clicks.
The module evidence tests additionally check every projected value against its raw
native dump and preserve independently tabulated logic truth vectors.

## Completed comparisons

| Case | Captured values and updates | Exact typed observations |
| --- | --- | ---: |
| `derive-score-label` | Scores 1250, 980, 40, 1500, 0, 2000, 2500, 1250; grouped label and bounded score/100 | 24 |
| `derive-list-relative` | Three independent items; change Sam to 1500, Ada to 980, Lin to 40; retain the other items | 36 |
| `bind-logic-lt` | `<` driving number and bool | 18 |
| `bind-logic-le` | `<=` driving number and bool | 18 |
| `bind-logic-eq` | `==` driving number and bool | 18 |
| `bind-logic-ne` | `!=` driving number and bool | 18 |
| `bind-logic-and` | `and` driving number and bool | 18 |
| `bind-logic-or` | `or` driving number and bool | 18 |
| `bind-logic-not` | `not` driving number and bool | 18 |

**9 cases, 75 snapshots, 186 typed observations (including 20 source-value checks),
zero disagreements.** Scalar labels include `1,250 pts`, `980 pts`, `40 pts`,
`1,500 pts`; bounded results include 12.5, 10, 15 and the upper clamp 20. List
labels and bounded values update independently even when two items share score 980.

### Mapping and limits

Rive's closest tested composition uses a scene custom property with an incoming
converter binding and an outward binding to an ordinary model field. Native
string-template formatting provides grouping and suffix; a formula provides
min(20, max(10, input/100)). The list instantiates a component for each model item;
its converter and binding paths refer only to the row model, with no item index.
This tests relative instance evaluation, not upward component lookup.

The local formula catalogue has arithmetic but no comparison or logic operators.
We therefore use view-model transition comparators and two animation states that
write 0/1 and false/true into model outputs. Multiple conditions combine as AND;
alternative transitions implement OR; boolean comparison with false implements
NOT. The exact schema queries and investigation limits are in
[SCHEMA-NOTES.md](SCHEMA-NOTES.md).

Each logic probe covers nine input vectors: equality, either side of the boundary,
negative and fractional values, changes to the right operand, all four boolean
pairs and a return to the initial vector. Both directions of the state transition
are exercised. Values are sampled after two native frames following the input
writes; Anima evaluates at its specified data-binding step. This compares settled
results. It does **not** establish identical scheduling, immediate transition
latency, expression precedence, short-circuit side effects, arbitrary float64
precision, mixed-type coercion, or formula support for boolean syntax.

These choices follow the explicit binding/metadata approach in
[graph research](../../../docs/research/rive-format-and-graph.md) §6 and the
condition ordering and feedback cautions in
[state research](../../../docs/research/rive-animation-and-state.md) §2 and §C.

## Evidenced skip: read-only guarantee

`tests/oracle/derive-read-only/skip.json` skips **native read-only parity only**.
This is an evidenced skip, not a decided intentional difference or a passing case.
The native destination remains ordinary writable model storage:

1. At score 1250, label is `1,250 pts`.
2. `data label=manual` succeeds: **1 accepted native write versus 0 in Anima**.
3. Both immediate and one-frame-later dumps retain `manual` (score still 1250).
4. Changing score to 1501 resumes computation and yields `1,501 pts`.

The native evidence is retained as `write.json`, `write-settled.json` and
`source-after-write.json` beside the scalar probe, with its exact command stream.
The module test independently checks Anima rejects the same write with
`read-only-path` and retains `1,250 pts`. No faithful counterpart to the read-only
contract was found in the tested native composition/schema. This does not rule out
custom scripts or future native facilities. No finding is reclassified or hidden.

## Verification

The final command results and any development failures are recorded in
[the follow-up report](../REPORT.md#fresh-native-follow-up-2026-11-06).
The older converter captures remain useful for converter coverage, but the new
comparisons above are fresh evidence for computed model outputs and list-relative
updates. The broader `data.binding-relative` parity row remains unchanged.
