# drawing-paint.image-fit-resize

Implemented by the assets/paint runtime or CLI asset pipeline. Parity status is unchanged.

- Spec: SPEC assets and paint chapters; authoring: AUTHORING Images and assets.
- Syntax: example.animl and generated example.ani; registry.ts exposes live descriptors.
- Validation/runtime/CLI: modules/assets/test/{core,cli,web}/pipeline.test.ts.
- Conformance: spec/conformance/drawing-paint-image-fit-resize; width 4→8 is linear, midpoint 6.
- Browser sampling expectations enumerate source texels independently, both backends and engines.
- Oracle: tests/oracle/drawing-paint-image-fit-resize/ — passing native probe (fixed max 2 / zero pixels above 16).

See modules/assets/REPORT.md for completion limits and measurements.
