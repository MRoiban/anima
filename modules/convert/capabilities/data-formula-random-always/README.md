# data-formula-random-always

Conformance: complete; native evidence: skip.

Native random has no exposed seed matching Anima’s specified uint32 LCG; direct sample equality is not a faithful counterpart. Anima sequence/policy/isolation are independently tested.

Implementation: `modules/convert/core/`; normative behavior: `modules/convert/SPEC.md`.
Probe: `spec/conformance/data-formula-random-always/`; native evidence: `tests/oracle/data-formula-random-always/`.
Parity status is unchanged. Full integration results: `modules/convert/REPORT.md`.
