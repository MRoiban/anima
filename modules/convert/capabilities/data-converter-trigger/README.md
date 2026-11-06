# data-converter-trigger

Conformance: pending; native evidence: pending.

Boolean/integer conversion is implemented; delivering an incremented trigger signal counter is not. Data bindings target animatable scalar node properties, while custom triggers are deliberately non-animatable; registerConverter alone exposes no trigger destination/write hook. Needs a binding destination seam.

Implementation: `modules/convert/core/`; normative behavior: `modules/convert/SPEC.md`.
Probe: `spec/conformance/data-converter-trigger/`; native evidence: `tests/oracle/data-converter-trigger/`.
Parity status is unchanged. Full integration results: `modules/convert/REPORT.md`.
