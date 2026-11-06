# host-api.scroll-latching

Track the target latched for a gesture and explicitly cancel it; wheel gestures expire after inactivity.

Contract: [SPEC](../../SPEC.md#host-api-scroll-latching). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/host-api-scroll-latching`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
