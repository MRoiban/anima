# input.cursor-intent

Have scene data request an arrow, hand, horizontal or vertical resize, text, or hidden cursor; the CLI host currently applies this only on macOS and Linux.

Contract: [SPEC](../../SPEC.md#input-cursor-intent). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-cursor-intent`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: skip; native capture remains separate.
