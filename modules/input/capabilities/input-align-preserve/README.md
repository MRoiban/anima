# input.align-preserve

Move a target while retaining the offset between its origin and initial grab point.

Contract: [SPEC](../../SPEC.md#input-align-preserve). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-align-preserve`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
