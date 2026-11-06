# data-interpolate-color

Conformance: complete; native evidence: finding.

Native initializes lazily on the first non-default change, returning the changed value immediately; Anima initializes eagerly on first evaluation. Native trace ['#000000', '#ffffff', '#ffffff', '#ffffff', '#7f7f7f', '#000000']. Independently specified Anima trace ['#000000', '#000000', '#808080', '#808080', '#404040', '#000000']. Parent decision remains open; numeric/channel differences are retained.

Implementation: `modules/convert/core/`; normative behavior: `modules/convert/SPEC.md`.
Probe: `spec/conformance/data-interpolate-color/`; native evidence: `tests/oracle/data-interpolate-color/`.
Parity status is unchanged. Full integration results: `modules/convert/REPORT.md`.
