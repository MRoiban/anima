# P6-13 implementation report

Status: **partial**. Implementation and original native evidence delivered; no parity row
promoted without orchestrator acceptance of strict-oracle limits. Branch `t3/implement-p6-13`,
base `7c0d9f6d`; committed head is in the handoff. Local commit only, no push/PR.

## Rows

Closed: none.

- `text.variable-axes`: local/shared JSON and AniML maps, numeric local axis addresses,
  input/data binding machinery and timeline interpolation, SVG settings, platform-aware Canvas
  and tool fvar/avar/gvar measurement/outlines implemented. Fresh native wght400/650/900 controls:
  max32, 9 pixels over16. Strict-manifest limits/acceptance remain unassigned.
- `text.opentype-features`: local/shared maps, SVG settings, Canvas native-API detection/kern
  fallback, tool kern and bounded GSUB1/3/4 (plus extensions), diagnostic and round-trip coverage
  implemented. Original fi→W / 1→A native substitution controls: max32, 11 pixels over16.
  Strict-manifest limits/acceptance remain unassigned. Features are static maps; run style
  selection can switch them. No direct numeric feature-value animation is claimed.
- `text.modifier-variation`: existing wght drawing now shares native-axis detection and fallback,
  and SVG keeps the style feature map while drawing effects. Actual arbitrary-axis Canvas
  rendering is unavailable on the tested hosts; existing planned status remains.
- `text.font-metrics`, `text.font-decoding`: not closed; integrated runtime introspection/derived
  font APIs and independent evidence from the prior reports remain outside this implementation.

`node modules/fonts/test/capture-options.ts` reproduces both native and Anima PNGs. Its temporary
font is generated from the original fixture, then deleted with all native build/binary artifacts
without reading them. No third-party font, runtime source, native binary or documentation prose
is committed. The feature control retains a separate native legacy-kern counterexample: native
kern1/kern0 draw identically for the variable fixture, while tool/browser honor its legacy pair.
The raw differences do not have an assigned passing tolerance.

## Seams

- `modules/text/core/index.ts`: marked optional `fonts.use(entries, registerTextMeasurer)` hook;
  retains the live measurer setter for independently bundled consumers. Equivalent validated
  string/index coercion simplifications fund the hook inside the full text entry.
- `modules/text/core/registry.ts`: owned field seam; shares the structural style shape and uses
  equivalent scalar property descriptors. Option field code stays in fonts.
- `packages/markup/test/corpus.test.ts`: marked census +2. `decompile.test.ts`: marked independent
  reader for the two compound style attributes. No compiler/diagnostic implementation change.
- Generated package adapter/exports, all-modules, module tables, schema and parity views only.
- Required append-only WORKLOG checkpoints; no Now/Gotchas, PLAN, budget input or benchmark edits.

## Verification

Final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **9246 passed / zero failed /
56 inherited TODO; 302 passing files + 13 skipped files**, both Chromium and Firefox, exit0
in541.70s. This includes all four new browser cases (two import orders in each engine).
See `verification/p6-13/changed.txt` and `checks.json`. Initial Chromium scope: 4561 pass / 4 fail / 43 inherited TODO; two fixture-format
failures and two independent-reader JSON recovery failures were corrected. Repeated scope:
4565 pass / 0 fail / 43 TODO. Final owned font unit files: 30/30 pass, including native Canvas-API
mocks, real fallback branches, axis slots, unknown actual-font diagnostics and metadata isolation.
The initial targeted browser run failed only on CSS serializing a feature value of 1 without the
redundant numeral; corrected assertion passed both Chromium import-order cases.

Strict oracle: 307 completed cases / 522 samples, zero failed completed samples; existing findings
retained and the two new cases explicitly pending. Full typecheck, wiring, generated schema/parity,
AniML artifacts and ESLint passed. `node tools/perf.ts` exits0 (bell compile7.86ms/frame149.5µs,
composite96.8µs, toolbar139.9µs/11.69ms); shared host load makes the ≤3% guard unverified.
Two broad attempts were stopped before final source refinements (SVG root retention and narrower
style-only font preflight); they are superseded, not counted as passing runs.

## Min+gzip bytes

The valid baseline uses an immutable archived HEAD with local workspace package resolution.
Earlier baseline attempts overlapped edits or resolved workspace links into the active checkout;
those measurements were discarded. The size tool and all existing budgets/inputs are unchanged.
The new optional entry has a 4096 B budget measured over text; resource-only fonts stays under 2048.

| Entry | Before | After | Cap |
|---|---:|---:|---:|
| text | 6136 | 6144 | 6144 |
| fonts | 1807 | 1927 | 2048 |
| fonts-text | 532 | 531 | 768 |
| fonts-options (over text) | absent | 3174 | 4096 |
| text-effects (over text) | 3364 | 3568 | 4096 |

| Gate | Before | After | Cap |
|---|---:|---:|---:|
| core+web | 21136 | 21136 | 24576 |
| largest scene (30) | 53857 | 53857 | 65536 |
| app-UI | 98674 | 98890 | 131072 |
| runtime sum | 118903 | 120281 | 163840 |
| authoring | 14649 | 14649 | 16384 |
| heavy | 128645 | 130077 | 256000 |

All thirty existing scene bundles are unchanged. The fixed app-UI input does not include the new
optional entry; runtime sum/heavy include it. No measurement input was adjusted to change that.
Text has zero spare bytes. Package/schema generation adds no new dependency.

## Design differences and problems

- AniML uses the existing registry compound convention: `axes='{"wght":650}'`, rather than a new
  CSS-list grammar. Both spellings round-trip, including shared text-style definitions.
- Import `@anima-format/web/fonts-options` for browser style options. A separate optional adapter
  keeps the existing text/fonts caps; it includes fonts-text and text, owns Canvas measurement
  and drawing, and survives separately bundled text/effects imports in both tested orders.
- Canvas arbitrary settings are feature-detected. Tested hosts lack both arbitrary-setting APIs;
  their fallback supports wght/kern, with CSS weight clamped1–1000. SVG applies all settings, but
  browser layout still uses Canvas fallback metrics; line breaks/carets can differ from drawn
  extents for unsupported options. FontFace byte/URL decoding defaults to weight1–1000 so variable
  faces can actually follow CSS weight, with explicit descriptors taking precedence.
- Tool substitution is context-free, not complex script/language shaping. Unsupported lookup
  kinds/flags fail explicitly; HVAR/complex positioning limits from P6-2 remain. Ligature advance
  belongs to its first grapheme; the tool does not invent internal caret metrics. See the normative
  `modules/fonts/SPEC.md` and its primary OpenType reference.
- Strict acceptance of the new native samples and controlled performance evidence remain for the
  orchestrator. No existing oracle threshold, finding, perf input or benchmark record changed.
