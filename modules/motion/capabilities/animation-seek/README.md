# animation.seek

Implemented in `modules/motion/core/`; normative semantics: [SPEC motion](../../../../spec/SPEC.md#motion).
The shared registry is re-exported by `registry.ts`; the module composes it once, not once per row.

- JSON/AniML: `example.ani` / `example.animl`, validated and round-tripped by the row's core test.
- Diagnostics: `test/core/invalid/animation-seek/unknown-feature.ani` plus the typed/range/reference/exit cases in `test/core/diagnostics.test.ts`.
- Conformance: `spec/conformance/animation-seek/` with hand-computed expectations; additional motion-* cases cover interactions.
- CLI/schema: generated schema plus module CLI tests and shared markup tests; no alternate evaluator.
- Browser: `test/web/browser.test.ts` runs Chromium and Firefox.
- Size: manifest ceiling 8192 B, measured with the unchanged `tools/size.ts` method.
- Oracle disposition: Native timeline sample poses verified with a Joystick; host clock/event semantics remain browser/unit observations. See [probe report](../../../../tests/oracle/MOTION-PROBES.md).
