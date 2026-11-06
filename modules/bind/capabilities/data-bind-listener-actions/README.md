# Input expressions in listener values

Implemented in the optional bind evaluator and existing core action/condition paths. SPEC bind
chapter defines snapshot timing, types, clamp and machine actions; SPEC events defines payload
expression sampling. Registry contributions are composed into bind. `example.animl`/`.ani` is the
increment probe. Diagnostics and grammar checks are in the matching core test; seven conformance
cases cover increment past ten, clamp, same snapshot, machine action order, modulo and payloads.

CLI validation/schema/sample and the 6/6 share example are checked by events tests. See
`modules/events/examples/share-evidence/README.md` for reproduction and measured costs.

Independent comparative oracle capture remains pending in `tests/oracle/data-bind-listener-actions`;
no parity row has been marked done. The requested P4d-3 proof uses hand-derived conformance and
sample evidence, not a claim of externally captured Rive equivalence.
