# No faithful headless counterpart

Native KeyFrameId has consuming properties such as Solo.activeComponentId that select geometry. Anima reference channels store validated scene-node IDs without changing geometry. No arbitrary node-ID data channel is exposed in the headless data dump; a Solo frame would test different semantics.

Anima coverage: `modules/motion/test/core/typed-oracle.test.ts`.
No native equivalence is claimed. See [probe report](../../MOTION-PROBES.md).
