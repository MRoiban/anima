# host-api.dom-listener-control

Enable or remove automatic DOM interaction listeners for authored state machines.

Contract: [SPEC](../../SPEC.md#host-api-dom-listener-control). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/host-api-dom-listener-control`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: skip; native capture remains separate.
