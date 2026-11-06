# Blend weight from constant

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-blend-weight-constant.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-blend-weight-constant`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle verified; evidence: `tests/oracle/state-machine-blend-weight-constant`.
