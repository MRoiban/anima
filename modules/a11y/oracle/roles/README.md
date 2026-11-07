# Logical role/state probe

Authored local RML, captured through the allowed headless command-file interface.
No Rive source, CLI documentation text or native binaries are included.

From this directory, reproduce with `~/.rive/bin/rive . --verify`, then
`~/.rive/bin/rive . --commands=commands.txt`. Delete the generated `build/` directory
before committing. The sibling AniML/ANI scene uses equivalent rectangles and states.

`test/core/oracle.test.ts` compares 16 ordered nodes per capture: role (explicit
native-to-Anima spelling map), label, bounds, checked, pressed, selected, expanded,
readonly, disabled and focused. Missing bool states normalize to false. The native
switch toggled state maps to Anima checked; button toggled maps to pressed. The
checkbox uses mixed plus readonly. Captures cover initial state-entry focus on button,
an idempotent target action, and next traversal to checkbox. Three captures / 48
nodes match exactly (numeric bounds max difference 0).

This is a module-owned logical comparison because the central oracle tool has no
semantic-tree comparator. The measurement tool and completed central records are
unchanged. `node tools/oracle.ts --strict` still runs the central corpus independently.
Native trees do not report an actions array; action availability/dispatch is covered
by unit/conformance tests only, not claimed as native equivalence. Tap, increase,
decrease, modal/hidden/live states and the remaining focus captures stay open.

Capture dead ends: a scene without a state machine cannot dump a native semantic
tree; the command protocol has no `focus` command; key actions need initial focus.
The final scene has an explicit state-entry target and keyboard listeners. Earlier
failed sessions are retained in `../../verification/p3b7/` and not treated as evidence
of behavior. Existing oracle findings and thresholds were not edited.
