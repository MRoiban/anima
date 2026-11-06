# No faithful headless counterpart

The headless runner selects one default state machine per artboard. It has no command to create independently named machines over the same scene, with isolated inputs and creation-order composition. Nested artboards do not share that scene.

Anima coverage: `modules/motion/test/core/runtime.test.ts`, `modules/motion/test/web/browser.test.ts`.
No native equivalence is claimed. See [probe report](../../MOTION-PROBES.md).
