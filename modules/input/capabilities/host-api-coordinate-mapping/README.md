# host-api.coordinate-mapping

Compute fit/alignment transforms and map input coordinates through matrices.

Contract: [SPEC](../../SPEC.md#host-api-coordinate-mapping). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/host-api-coordinate-mapping`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: skip; native capture remains separate.
