# No faithful headless counterpart

The local schema exposes KeyFrameInt but no general signed-int custom/view-model channel: CustomPropertyNumber and ViewModelInstanceNumber are doubles; BindablePropertyInteger is uint and not animatable. Keying doubles with integer-looking values cannot establish signed 32-bit hold storage. No faithful headless signed channel observation was found.

Anima coverage: `modules/motion/test/core/typed-oracle.test.ts`.
No native equivalence is claimed. See [probe report](../../MOTION-PROBES.md).
