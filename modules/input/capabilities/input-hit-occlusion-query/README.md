# input.hit-occlusion-query

Ask whether an opaque target blocks interaction at a point, including whether it blocks scrolling.

Contract: [SPEC](../../SPEC.md#input-hit-occlusion-query). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-hit-occlusion-query`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
