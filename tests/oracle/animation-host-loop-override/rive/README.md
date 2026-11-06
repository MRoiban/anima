# No faithful headless counterpart

The headless command runner has no per-animation loop override or authored-mode restore operation. Authored loopValue scenes cannot observe mutation of an existing host instance.

Anima coverage: `modules/motion/test/core/runtime.test.ts`, `modules/motion/test/web/browser.test.ts`.
No native equivalence is claimed. See [probe report](../../MOTION-PROBES.md).
