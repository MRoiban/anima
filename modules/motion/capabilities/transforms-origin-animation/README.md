# transforms.origin-animation

Implemented in `modules/motion/core/`; normative semantics: [SPEC motion](../../../../spec/SPEC.md#motion).
The shared registry is re-exported by `registry.ts`; the module composes it once, not once per row.

- JSON/AniML: `example.ani` / `example.animl`, validated and round-tripped by the row's core test.
- Diagnostics: `test/core/invalid/transforms-origin-animation/unknown-feature.ani` plus the typed/range/reference/exit cases in `test/core/diagnostics.test.ts`.
- Conformance: `spec/conformance/transforms-origin-animation/` with hand-computed expectations; additional motion-* cases cover interactions.
- CLI/schema: generated schema plus module CLI tests and shared markup tests; no alternate evaluator.
- Browser: `test/web/browser.test.ts` runs Chromium and Firefox.
- Size: manifest ceiling 8192 B, measured with the unchanged `tools/size.ts` method.
- Pending oracle / mapping limit: Anima pivots change transform centres without moving local geometry; native Rive fractional shape origins also change geometry. Native origin frame equivalence is not claimed.
