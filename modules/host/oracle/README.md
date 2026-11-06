# Independent native host-data evidence

Only local `~/.rive/bin/rive <dir> --commands=commands.txt` was used. The RML probes are
agent-authored scenes reused from the repository's data probes, not Rive runtime code
or documentation. No Rive binary file was read or emitted. Sessions and raw JSON dumps
are committed unchanged.

- `rive/`: scalar host writes, enum selection, shared nested/list identity. Initial and
  final score, label, boolean, color, enum, nested title, list length and list item title:
  16 exact comparisons; observed scalar differences 0. Two score writes before advance
  yield the last value, 9. Five scalar changed paths match exactly.
- The same CLI's idle advance leaves all five scalar changed flags true. This shows flags
  are not drained JavaScript callback counts; Anima sends zero additional callbacks on
  that idle step. No native callback-count equality is claimed.
- `trigger/`: a host-fired trigger invokes a native model change listener and writes n=9.
  Anima host subscriptions deliver once after the triggering step; the authored data listener
  queues n=9 for the following step, as specified by data. Native n=9 appears after its first
  advance; Anima n=0 after the first and n=9 after the second (timing difference 1 step).
  Final value difference is 0. This is not same-frame timing parity.

The CLI command interface was inspected locally. It has data writes/dumps and advancement,
not JavaScript callbacks, model creation, binding or unsubscribe operations. `skip.json`
records the boundary. These host probes are tested by modules/host/test/core/oracle.test.ts;
the protected global tests/oracle/cases.json measurement input was not changed, so the global
strict oracle check does not cover these new probes.
