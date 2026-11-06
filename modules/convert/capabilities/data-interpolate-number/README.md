# data-interpolate-number

Conformance: complete; native evidence: finding.

Native initializes lazily on the first non-default change, returning the changed value immediately; Anima initializes eagerly on first evaluation. Native trace [0, 10, 10, 10, 15, 20]. Independently specified Anima trace [0, 0, 5, 5, 12.5, 20]. Parent decision remains open; numeric/channel differences are retained.

Implementation: `modules/convert/core/`; normative behavior: `modules/convert/SPEC.md`.
Probe: `spec/conformance/data-interpolate-number/`; native evidence: `tests/oracle/data-interpolate-number/`.
Parity status is unchanged. Full integration results: `modules/convert/REPORT.md`.
