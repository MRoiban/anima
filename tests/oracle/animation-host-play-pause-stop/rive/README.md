# No faithful headless counterpart

The headless command runner has no animation-instance play/pause/stop controls. Advancing zero seconds or switching a state cannot establish paused writes, resume clocks and stop removal of writes on one instance.

Anima coverage: `modules/motion/test/core/runtime.test.ts`, `modules/motion/test/web/browser.test.ts`.
No native equivalence is claimed. See [probe report](../../MOTION-PROBES.md).
