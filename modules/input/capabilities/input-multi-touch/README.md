# input.multi-touch

Route multiple concurrent contacts by pointer ID rather than treating every contact as one pointer.

Contract: [SPEC](../../SPEC.md#input-multi-touch). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-multi-touch`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
