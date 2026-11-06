# input.gamepad-index-mapping

Address either W3C standard button/axis slots or raw controller indices.

Contract: [SPEC](../../SPEC.md#input-gamepad-index-mapping). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-gamepad-index-mapping`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
