# input.touch-page-scroll

Let the embed choose whether touch gestures also scroll the surrounding page.

Contract: [SPEC](../../SPEC.md#input-touch-page-scroll). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-touch-page-scroll`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: skip; native capture remains separate.
