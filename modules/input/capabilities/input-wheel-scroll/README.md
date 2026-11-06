# input.wheel-scroll

Forward wheel deltas to scrollable scene content and consume the DOM wheel only when the scene handles it.

Contract: [SPEC](../../SPEC.md#input-wheel-scroll). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-wheel-scroll`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
