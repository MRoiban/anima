# P6-4 browser/tool text comparison

The generated `anima-test.ttf` is the common, original font. The browser test
`test/web/text-integration.test.ts` compares exact line strings and every cluster's x/y with the
unchanged limit **0.5% of font size** (0.01 grid units at size 2), in both engines and loader orders.
Explicit `lineHeight: 1.2` passes after measuring Canvas metrics at 1000 px and converting to grid units.
At the original 2 px measurement, rounded Canvas bounding metrics shifted the first baseline by
0.6 units; this was a real failure, not a tolerance adjustment. Prefix widths continue to use the
actual font size with `fontKerning: normal` and `textRendering: geometricPrecision`, matching the
settings used for drawing. The default Chromium width rounding is unsuitable for the tool contract.

Automatic leading remains an explicit difference: the OpenType font has ascender 800, descender
-200 and line gap 100 per 1000 em. At size 2 the tool uses height 2.2, baseline 1.7; Canvas exposes
no separate line gap and uses height 2, baseline 1.6. After a soft wrap the baseline difference grows
from 0.1 to 0.3 (and then 0.5) units, exceeding the 0.01-unit tolerance. The test records this as a
separate known finding, while retaining the original tolerance for explicit leading. Authors who
need browser/tool baseline identity should set lineHeight explicitly. This does not resolve the
wave-1 native raster findings in modules/text/verification/native-comparison.json.

Native row closure remains open: no accepted comparison or evidence-backed no-counterpart decision
has been added by P6-4. No oracle finding, threshold, measurement input or benchmark is changed.
