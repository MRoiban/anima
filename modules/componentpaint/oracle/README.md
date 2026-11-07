# Local native component-paint oracle

The authored PaintImage uses `artboardId`, native-size mode and repeat on both axes; its row's
default state machine moves a two-unit bar by six units in one second. Captures are local CLI
1.9.1 headless commands only. `node modules/componentpaint/oracle/capture.ts` recaptures the three
frames. No source code, CLI documentation text, `.riv` or `.rev` is retained.

The native original-size paint is centered in its shape: stripe starts are 5, 8 and 1 modulo10
at t=0/.5/1. The independent Anima equivalent uses a source viewBox origin (-5,-5). Expected
orange is (224,128,32,255), blue (32,64,128,255); every pixel is opaque. The native rasterizer
changes some blue channels by one byte. The module oracle asserts exact analytic Anima pixels
and native maximum delta1 over all400 pixels in each frame; channels over16 are zero. These
numbers are in verification/native-metrics.json. No tolerance was raised and no capture is skipped.

Central tests/oracle/cases.json is a protected measurement input in this task. The tested native
case is module-owned; canonical manifest registration remains a parent integration step. Its
existing pending marker is retained and points here rather than claiming a canonical pass.
