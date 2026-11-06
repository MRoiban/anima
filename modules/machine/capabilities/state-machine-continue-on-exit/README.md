# Advance outgoing during blend

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-continue-on-exit.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-continue-on-exit`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle verified; evidence: `tests/oracle/state-machine-continue-on-exit`.
