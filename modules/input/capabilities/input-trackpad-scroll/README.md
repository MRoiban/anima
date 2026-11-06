# input.trackpad-scroll

Pass precise scroll deltas and gesture phase so trackpad scrolling can settle or fling appropriately.

Contract: [SPEC](../../SPEC.md#input-trackpad-scroll). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-trackpad-scroll`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
