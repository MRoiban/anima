# P5-5 surface integration handoff

Core module: `surface`, browser entry `@anima-format/web/surface` (includes paint registration).
Own 8192 B budget. Existing markup and web entry files were not edited.

Implemented: image paint pattern/transform/modulation; n-slice images/groups/components with
stretch/repeat/hidden patches; local-space per-paint feather filters. SVG throws a structured
`unsupported-render` for enabled world-space feathering. Draw data, diagnostics, conformance
cases and Chromium/Firefox pixels cover these. No Rive algorithm, source or documentation was copied.

The two nested AniML forms remain unimplemented. The structural compiler can currently attach a
flat object to a node key, or a flat paint object, but cannot attach an object inside a paint;
it also reads array-valued scalar structural attributes as strings. Do not mark P5-5 complete yet.

Markup owner follow-up (existing files deliberately left alone):

- `slice` node child: `x`/`y` cut lists, `width`, `height`, `modes` string list; maps to `node.slice`.
- `feather` child: `paint=fill|stroke`, inner/outer/offset/enabled/space; maps into that paint's
  `feather` object, including ordered paints. Preserve the flat colour/gradient/image on that paint.
- Add descriptor-driven nested target support and structural scalar array/tuple decoding to
  compiler/decompiler; register the forms in `surface` and add matching `.animl` conformance inputs.
- Add standalone feather/slice AniML examples and round-trip tests. Currently `anima schema` sees
  both object shapes, but AniML nested authoring is unsupported. Decompilation exposes feather as
  a named `fill-feather`/`stroke-feather` attribute so it fails explicitly rather than losing data.
- Image paints already work with `<imagePaint asset="tile" image-width="8" image-height="8"/>`.
  Image transform fields are animatable in JSON; markup track addresses pass through dotted keys.
- `core/all.ts`, core/web package exports and build/size lists contain the new module integration.
  There is a new `web/src/surface.ts`; existing web entry source files were not changed.

Rendering boundaries: source-space hit testing and local component state are retained under slicing;
path deformation/inverse patch hit mapping and world feathering belong to later backend work.
Feathering is Anima's explicitly specified Gaussian model, not claimed Rive pixel equivalence.

Full-check integration failures requiring the markup owner:

- `packages/markup/test/compile.test.ts`: fixture coverage does not yet include `slice` and
  per-paint feather spellings. Add proper forms/examples rather than weakening coverage.
- `packages/markup/test/names.test.ts`: expected group attribute list and `STATIC.circle` key list
  predate `slice`. The registry currently attaches slice to generic nodes and rejects invalid
  painted-node use through `slice-type`; vector shapes should be wrapped in a group.
- Existing markup budget was 8551/8192 at baseline, now 8802/8192. It remains unchanged.
