# data-converter-number-to-list

Conformance: pending; native evidence: pending.

Pure bounded index/repeated-item lists are implemented; retained default model-instance creation and identity are not. Data exposes no list-write or instance-creation hook, and making this converter retain instance state conflicts with the design’s only-interpolate-is-stateful rule. Needs a design/seam decision.

Implementation: `modules/convert/core/`; normative behavior: `modules/convert/SPEC.md`.
Probe: `spec/conformance/data-converter-number-to-list/`; native evidence: `tests/oracle/data-converter-number-to-list/`.
Parity status is unchanged. Full integration results: `modules/convert/REPORT.md`.
