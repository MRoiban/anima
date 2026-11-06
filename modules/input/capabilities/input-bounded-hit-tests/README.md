# input.bounded-hit-tests

Offer a bounded hit-test query that restricts scripted layouts to their declared box.

Contract: [SPEC](../../SPEC.md#input-bounded-hit-tests). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-bounded-hit-tests`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
