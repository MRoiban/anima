# Random transition selection

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-state-random.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-state-random`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle skipped: Anima specifies a portable per-player LCG and exact seeded selection sequences. Native state random choices expose no matching seed/PRNG control through the headless runner. The CLI seed flag controls script math.random, not native state-transition selection; matching an unseeded screenshot cannot establish deterministic choices.; evidence: `tests/oracle/state-machine-state-random`.
