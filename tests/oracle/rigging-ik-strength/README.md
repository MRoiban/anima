# P8-2b IK strength oracle probe

This raw probe compares the benchmark's two-bone IK geometry at `strength=0.5` against a native Rive `IKConstraint` with `parentBoneCount=1` and `strength=0.5`. Both scenes use solid rectangle art in bone-local space, following D44.

Rive CLI 1.9.1 captured the native 240×240 frame. The Anima frame is rendered at the same size and white background. With threshold 16, the raw comparison is max channel delta 42, 72 pixels over threshold (0.125%), all within three pixels of a rectangle boundary or joint overlap; 0 over-threshold pixels are in the solid interior.

No oracle budget is set and the probe remains pending by task instruction.
