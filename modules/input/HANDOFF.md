# P4c input integration handoff

P4c-4 supersedes the original 0dd104a handoff and hand-hook patch (retained in git history).
Input is merged with machine and focus. Listener fields use generic live registry forms,
including JSON-valued `write`. The input compiler hook and integration.patch are removed;
the public markup adapter remains an empty compatibility export. The shared sample dispatcher
routes input commands, preserving focus-only key commands. No runtime dependency was added.

The focus DOM adapter defers key routing to input when both are declared. Input dispatches
keys to logical focus (including component descendants) before one root `focusKey` navigation.
Outer capture precedes child delivery; consume stops outer bubbling. Enter/Space remain in the
base host. Pointer capture cooperates with pointer focus, disabled/opaque hit policy and DOM
ownership. Collapsed nodes are ineligible. Focus supplies `machineFocus` and `onChange` wake-ups.
Components owns the event-kind registry; neither focus nor input deletes diagnostics.

`rows.json` lists all 54 requested rows and evidence paths. 54 have implementation evidence;
18 are strictly complete (3 retained native captures, 15 documented host-only oracle skips).
36 real scenes await native captures and retain `todo.json` oracle markers. No native commands
were run during integration. 51 standard conformance markers were replaced with independent
script/expectations; two more cases cover focus/machine and component key capture/consume.
All 54 example pairs are schema-, compile/decompile- and script-tested. Inventory statuses are
unchanged for the phase owner. See `REPORT.md` for exact final checks and measurements.

Retained limits: one pressed button per contact ID; physical touch-page gestures are tested via
CSS touch-action; canvas fallback is axis-aligned; gamepad batch delivery remains scene-wide.
No phase-wide completion, performance speedup or native equivalence for pending rows is claimed.
