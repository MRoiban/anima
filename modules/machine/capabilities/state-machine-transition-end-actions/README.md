# Transition completion actions

Implemented behind `requires: ["machine"]`; spec: SPEC.md machine chapter.

- Shared fields: `../../core/registry.ts`; runtime: `../../core/runtime.ts`.
- Both syntaxes: `example.animl` and compiled `example.ani`.
- Validation: `../../test/core/state-machine-transition-end-actions.test.ts` and `diagnostics.test.ts`.
- Independent conformance: `spec/conformance/state-machine-transition-end-actions`.
- CLI/schema and examples are registry-derived; byte/perf evidence is in `../../REPORT.md`.
- oracle skipped: Anima queues the listener action object (fire/set/toggle/emit) at the named state/transition boundary and commits it at the next input stage. Native state fire actions expose events/triggers, not the same queued compound listener transaction, and the headless runner exposes no input-stage barrier for observing that queue. A screenshot or bound-data dump after an advance would conflate action dispatch with its later commit. Independent conformance tests cover input visibility, ordering and cancellation; this skip is not native event payload/dispatch parity.; evidence: `tests/oracle/state-machine-transition-end-actions`.
