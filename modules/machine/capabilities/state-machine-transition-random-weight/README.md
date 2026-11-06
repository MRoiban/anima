# Random transition weights

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-transition-random-weight.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-transition-random-weight`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle skipped: Anima tests weights with the specified per-player LCG, including disabled/zero/false-condition edges. The native headless runner has no matching native state-selection seed or random-number injection (its seed option is for script math.random). Sampling an uncontrolled draw is not an exact oracle for these deterministic weighted sequences.; evidence: `tests/oracle/state-machine-transition-random-weight`.
