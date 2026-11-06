# host-api.low-level-pointer

Pass pointer down, move, up and exit in artboard coordinates with pointer IDs.

Contract: [SPEC](../../SPEC.md#host-api-low-level-pointer). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/host-api-low-level-pointer`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
