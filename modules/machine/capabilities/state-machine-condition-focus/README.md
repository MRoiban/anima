# Focus conditions

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-condition-focus.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-condition-focus`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle skipped: The machine feature exposes a host-supplied pure focus reader; it does not create a native focus tree. The local command runner cannot install that arbitrary host callback or query the same document node IDs. Native DOM/key ownership parity belongs to the separately developed focus module; this module tests true/false equality against its explicit reader contract. This skip does not claim native focus traversal parity.; evidence: `tests/oracle/state-machine-condition-focus`.
