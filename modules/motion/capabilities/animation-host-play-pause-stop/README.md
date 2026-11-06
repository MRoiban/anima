# animation.host-play-pause-stop

Implemented in `modules/motion/core/`; normative semantics: [SPEC motion](../../../../spec/SPEC.md#motion).
The shared registry is re-exported by `registry.ts`; the module composes it once, not once per row.

- JSON/AniML: `example.ani` / `example.animl`, validated and round-tripped by the row's core test.
- Diagnostics: `test/core/invalid/animation-host-play-pause-stop/unknown-feature.ani` plus the typed/range/reference/exit cases in `test/core/diagnostics.test.ts`.
- Conformance: `spec/conformance/animation-host-play-pause-stop/` with hand-computed expectations; additional motion-* cases cover interactions.
- CLI/schema: generated schema plus module CLI tests and shared markup tests; no alternate evaluator.
- Browser: `test/web/browser.test.ts` runs Chromium and Firefox.
- Size: manifest ceiling 8192 B, measured with the unchanged `tools/size.ts` method.
- Oracle disposition: No faithful headless counterpart: The headless command runner has no animation-instance play/pause/stop controls. Advancing zero seconds or switching a state cannot establish paused writes, resume clocks and stop removal of writes on one instance. See [probe report](../../../../tests/oracle/MOTION-PROBES.md).
