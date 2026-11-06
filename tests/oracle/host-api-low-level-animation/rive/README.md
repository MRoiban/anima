# No faithful headless counterpart

No headless command separately advances an animation instance clock and applies it with a mix. Script-side Animation.advance applies immediately, so it cannot establish the split advance/apply contract or didLoop reset.

Anima coverage: `modules/motion/test/core/runtime.test.ts`, `modules/motion/test/web/browser.test.ts`.
No native equivalence is claimed. See [probe report](../../MOTION-PROBES.md).
