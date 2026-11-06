# assets.image-encoding-jpeg

Implemented by the assets/paint runtime or CLI asset pipeline. Parity status is unchanged.

- Spec: SPEC assets and paint chapters; authoring: AUTHORING Images and assets.
- Syntax: example.animl and generated example.ani; registry.ts exposes live descriptors.
- Validation/runtime/CLI: modules/assets/test/{core,cli,web}/pipeline.test.ts.
- Conformance: spec/conformance/assets-image-encoding-jpeg; width 4→8 is linear, midpoint 6.
- Browser sampling expectations enumerate source texels independently, both backends and engines.
- Oracle: tests/oracle/assets-image-encoding-jpeg/ — evidenced native skip; see skip.json and REPORT.md for the observation limit.

See modules/assets/REPORT.md for completion limits and measurements.
