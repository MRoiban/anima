# P7-8 semantic stroke comparison

The native scene draws a 24×12 rectangle with an 8-unit centered stroke. The source uses explicitly
linear x keyframes at 60 and 120. Frames at 0, 0.5 and 1 s have painted integer support:
`[44,50,32,20]`, `[74,50,32,20]`, `[104,50,32,20]`. Native semantic JSON reports the uninflated
rectangle: `[48,54,24,12]`, `[78.0000153,54,24,12]`, `[107.999985,54,24,12]`.

Thus standard painted stroke extents intentionally differ from the native logical semantic box.
**Animated semantic-bounds lag did not reproduce** in this corrected linear control. The initial
hold-keyframe authoring attempt was not evidence of lag and is not retained as a finding. No native
`finding.json`, tolerance, oracle budget or benchmark record was changed. The broader Anima row
remains planned for the final clipped/dashed/filtered/non-scaling/text-ink cases listed in its spec.

Reproduce from rive/ with ~/.rive/bin/rive . --commands=commands.txt; remove build/ afterward.
