# host-api.low-level-scroll

Send indirect wheel/trackpad scrolling separately from direct touch pointer gestures.

Contract: [SPEC](../../SPEC.md#host-api-low-level-scroll). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/host-api-low-level-scroll`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
