# P5-5 surface integration handoff

Core module: `surface`, browser entry `@anima-format/web/surface` (includes paint registration).
Own 8192 B budget. P5-5 left markup and web entry integration to P5-7, completed below.

Implemented: image paint pattern/transform/modulation; n-slice images/groups/components with
stretch/repeat/hidden patches; local-space per-paint feather filters. SVG throws a structured
`unsupported-render` for enabled world-space feathering. Draw data, diagnostics, conformance
cases and Chromium/Firefox pixels cover these. No Rive algorithm, source or documentation was copied.

P5-7 resolves the markup follow-up:

- [x] `<slice>` is a structural node child; numeric cut lists and string mode lists decode by shape.
- [x] `<feather paint="fill|stroke">` targets the paint's nested object without replacing its
  colour/gradient/image. Ordered paint wrappers accept feather children too.
- [x] Descriptor-driven nested paths and structural scalar arrays/tuples are shared by compiler
  and decompiler. `surface` loads the registration-only `markup-surface` hook.
- [x] Draw conformance has authored `.animl` inputs; standalone `examples/slice.animl` and
  `examples/feather.animl` have generated `.ani` siblings and round-trip/diagnostic tests.
- [x] Image paint syntax remains `<imagePaint asset="tile" image-width="8" image-height="8"/>`;
  image transform tracks retain their dotted JSON addresses. Ordered image paints use attributes
  on `fillPaint`/`strokePaint` and preserve nested feather objects.

Rendering boundaries: source-space hit testing and local component state are retained under slicing;
path deformation/inverse patch hit mapping and world feathering belong to later backend work.
Feathering is Anima's explicitly specified Gaussian model, not claimed Rive pixel equivalence.

P5-7 verification details are recorded in `docs/LOG.md`. Fixture coverage includes the new
structural forms. The exact `STATIC.circle` expectation adds `slice`, because surface registers it
on generic nodes. The group attribute expectation stays unchanged: a slice is now a child rather
than a flat attribute. The provisional core test expecting a `fill-feather` decompilation error
now asserts successful, lossless nested output. No coverage or limits were removed.
