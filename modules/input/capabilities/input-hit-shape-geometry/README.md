# input.hit-shape-geometry

Use world bounds as a broad-phase check and transformed contour geometry for the precise shape test.

Contract: [SPEC](../../SPEC.md#input-hit-shape-geometry). Registry entries compose `../../core/registry.ts` and
`../../core/index.ts`; the re-export in `registry.ts` references that same live declaration.

Evidence: `spec/conformance/input-hit-shape-geometry`, paired example, `invalid.json` tested by `test/core/evidence.test.ts`,
and browser/API assertions in `test/web/browser.test.ts` and `test/core/runtime.test.ts`.
Schema and CLI sample are tested for this row. Oracle: pending; native capture remains separate.
