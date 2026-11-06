# Exit states

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-exit-state.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-exit-state`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle verified; evidence: `tests/oracle/state-machine-exit-state`.
