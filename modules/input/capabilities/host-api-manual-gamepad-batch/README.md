# host-api.manual-gamepad-batch

Submit a validated batch of controller connection and input records to the focused scene.

Contract: [SPEC](../../SPEC.md#host-api-manual-gamepad-batch). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/host-api-manual-gamepad-batch`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: skip; native capture remains separate.
