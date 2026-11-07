# Local schema investigation, 2026-11-06

Rive CLI 1.9.1. These are independently written notes, not copied CLI documentation.
Only local schema/docs queries and headless command streams were used.

Queries: `schema DataConverterFormula`, `schema --search Formula`,
`schema --search Condition`, `schema --search DataConverter`,
`schema FormulaTokenOperation`, `schema FormulaTokenFunction`,
`schema TransitionViewModelCondition`, `schema TransitionCondition --all`,
`schema ViewModelInstanceString`, `schema ViewModelInstanceNumber`,
`schema DataConverterStringTemplate`, `schema --search NumberFormat`,
`docs data`, `docs state-machines`, `docs workflow`.

- Formula tokens support arithmetic; the formula-token schema lists
  five infix arithmetic operations (0–4) and functions 0–16, with no comparison
  or boolean operator. The broader arithmetic converter catalogue also has
  operations 5–18; those are not formula infix operators. The search for
  condition types finds transition comparators, not a condition data converter.
  `schema DataConverterCondition` is rejected as an unknown type. Therefore these
  probes use native transition conditions as the equivalent logic mechanism.
- Transition view-model conditions offer equality, inequality and all four order
  comparisons. Multiple conditions on one transition combine as AND; alternative
  transitions supply OR. Complementary transitions return to the false state.
  Boolean equality against false expresses NOT. The captured vectors establish
  those behaviors, rather than inferring them from the schema alone.
- Instance number/string values are bindable and animatable. Neither schema marks
  them as derived/read-only. The schema alone cannot establish writable runtime
  behavior: the scalar command stream additionally writes the computed destination,
  captures it immediately and after a frame, then changes the source again.
- No number-format converter was found by the schema search. Native string-template
  argument formatting does group thousands: the authored `${score:,.0f} pts`
  template yields the exact labels in the reference dumps.
- The bounded-number probe uses formula min(20, max(10, input / 100)). A custom
  property receives its result and an outward binding writes ordinary model storage.
  A row component instantiated by the list runs the same relative bindings separately
  for three item instances. No row index appears in the row's source bindings.

This is evidence about this local composition, not a proof that every possible
script or future native type lacks a read-only facility. See the recorded skip and
raw destination-write dumps for the narrower supported conclusion.
