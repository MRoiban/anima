# Animated layout reflow

Implementation: `modules/layout/core/reflow.ts`, optional `web/reflow.ts`, both spellings in
`core/registry.ts`. Normative contract: `modules/layout/SPEC.md`, animated-reflow chapter.
Example: `modules/layout/examples/reflow.animl` and `.ani` (copy paired here for capability discovery).
Tests: `test/core/layout-animated-reflow.test.ts`, `test/web/reflow.test.ts`, CLI layout tests,
`spec/conformance/layout-animated-reflow` and `layout-text-wrap`.

Native parity is still planned: the local CLI's dirty update frame and retarget timing differ.
See `tests/oracle/layout-animated-reflow/todo.json` and raw captures/metrics under `verification/p7-4`.
No acceptance budget has been added or changed. The orchestrator owns this closure decision.
