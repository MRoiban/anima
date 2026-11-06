# input.keyboard-bubbling

Offer key events to the focused node and then its ancestors until consumed.

Contract: [SPEC](../../SPEC.md#input-keyboard-bubbling). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-keyboard-bubbling`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: verified with unchanged native values and zero tolerance.

A matching normal key listener stops delivery by default; propagate=true opts into passing it on.
