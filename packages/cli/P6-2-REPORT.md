# P6-2 font tooling report

Status: **partial delivery, not phase/row closure**. Branch `t3/p6-font-tools`, based on
`216eecf3`. The final commit SHA is in the implementation handoff (`git log -1`). No push or PR.

The Node-only reader, deterministic generated test font, tool measurer and CLI paths are
implemented. `modules/text` and `modules/fonts` are absent in this checkout, so actual text-document
layout/render/flatten integration and asset schema/AniML integration remain unverified. CFF1 subsetting now has original-font tests, including private-dictionary/subroutine relocation. Parity statuses remain planned.

## Delivered

- Range-checked sfnt, WOFF/zlib and WOFF2/Brotli containers; inverse glyf/loca/hmtx transforms.
- cmap 4/12; head/maxp/hhea/hmtx/OS/2/name; kern; GPOS kern pair formats 1/2 and extension lookups,
  including pair placement/advances; TrueType quadratic/composite outlines; CFF1 Type2 outlines,
  subroutines, CID private dictionaries; fvar axes/named instances, avar and gvar tuple/IUP deltas,
  including component deltas and phantom advances. Resource and recursion limits produce diagnostics.
- DESIGN §4 types in `src/font/measure.ts`, family/weight/style registration, grapheme cumulative
  advances, kerning/tracking, metrics and outline drawing. A contract test compares the optional
  `modules/text/core/measure.ts` declarations when that file exists; **not exercised against P6-1**.
- Document-font aliases and `--font family=path`; local bytes only. AniML preparation uses
  validate=false before installing the measurer, then ordinary validation. Imported sources use
  the source map. The optional setter seam is `setTextMeasurer` (or `setMeasurer`) from P6-1's
  measure.ts; confirm this name at integration. The conformance runner installs before load.
- CLI render replaces SVG text/tspan output with glyph paths before resvg. `--browser-text` uses
  ImageEncoder's cached, lazy Chromium and closes its page/browser; SVG output embeds faces.
- `import-font` normalizes font containers and emits asset metadata; `--chars` subsets. Explicit
  Google import downloads CSS/font bytes with bounded reads, stores numbered local files, and
  supports custom subsetting. Imported metadata includes OS/2 weight/style for static faces.
  Network tests mock Fetch.
- TrueType/CFF1 subsetting preserves glyph IDs, closes composite dependencies, clears unused outlines,
  replaces cmap and retains layout/variation references. CFF1 dictionary/INDEX offsets are relocated
  around reduced charstrings; original local/global subroutines and charset/encoding/FDSelect remain. GSUB fonts retain all outlines
  conservatively. Used coverage includes authored text and bound/default strings across the root
  document and components. All preserves every byte; custom uses Unicode scalars in chars.
- `flatten` freezes authored/default text into editable path groups with common transforms and
  surrounding nodes retained. It rejects unsupported SVG features and leftover text-only references.
- `tools/test-font.ts` and `fixtures/fonts/anima-test.ttf`: original deterministic ASCII, accented
  Latin, Hebrew, Arabic and supplementary-plane geometric glyphs, AV kern and variable wght data.
  No third-party font files, library code or new shipped dependencies.

## Row evidence and outstanding runtime work

No row is claimed fully closure-ready before integration. Tool-side candidates are
`assets.font-formats`, `assets.font-glyphs-all`, `assets.font-glyphs-custom`,
`assets.font-glyphs-used`, `assets.google-font-import`, and `text.font-metrics`.
`text.flatten` remains unverified against actual text nodes. Per-row evidence:

| Row | Tool evidence | Remaining work |
|---|---|---|
| `assets.font-formats` | Font tests: TTF, original synthetic CFF OTF, WOFF, WOFF2 including transforms; CLI local import | P6-3 FontFace loading, host decode/replacement/MIME/policy integration; broader real-font coverage |
| `assets.font-glyphs-all` | all policy preserves bytes; original fixture coverage tested | P6-3 registry/schema/AniML glyphs/chars fields; end-to-end authored build |
| `assets.font-glyphs-custom` | custom cmap/glyf subset, checksums, variation/kern retention and composite closure tested | P6-3 fields + authored build; CID/real-font CFF coverage unverified |
| `assets.font-glyphs-used` | authored/default/nested coverage and buildAssets test | P6-3 fields + data/text authored integration; CID/real-font CFF coverage unverified, GSUB retention is conservative |
| `assets.google-font-import` | mocked CSS + font fetch, local file + subset, HTTP failure; CLI dispatch | real network import not exercised; imported assets still need P6-3 runtime loading |
| `text.font-metrics` (tool side) | explicit ascent/descent/cap/x/line gap, coverage/axes/instances and grapheme widths tested | P6-1 setter/contract integration; P6-3 runtime metrics/fallback and FontFace behavior |
| `text.flatten` | text-to-SVG-path conversion and rejection tests; command + document converter | **not closure-ready**: real P6-1 node/layout integration unverified; component definitions and live text properties need integration coverage |

## Verification

Evidence is under `verification/p6-2/`. Final scoped/static results are recorded in checks.json.
Focused font suite: **25 passed / 1 skipped (26 total)**, including original CFF cubic/GPOS pair forms, compressed
containers/transformed metrics, variation/composite/subset behavior, fuzz/truncation diagnostics,
mocked Google downloads and real cached Chromium font loading/measurement. Earlier CLI scope:
**358/358 passed** (before the final focused additions).

`node tools/oracle.ts --strict`: exit 0, **266 cases / 475 samples**, zero strict failures;
24 existing findings retained. No measurement script, manifest, threshold, finding or benchmark
record was edited. No new native parity claim or capture was made.

`node tools/perf.ts`: exit 0 under heavy shared-machine load: bell compile 7.95 ms, frame 124.5 µs;
composite frame 80.1 µs; toolbar compile 12.49 ms/frame 109.3 µs. These timings are **not** evidence
of the ≤3% performance gate versus the design's unloaded 29.4 µs baseline. Runtime source/bundles
are unchanged; the orchestrator needs controlled measurements if that gate must be asserted.

The later CLI run passed 358 tests with 1 conditional skip but timed out in 4 existing cases
(docs convert, forgotten pivot rendering, JPEG/WebP encoding). Serial fixed-limit retries also
timed out; these failures remain unresolved. The font suite passed separately.

The first changed-scope run was superseded after final code fixes and artifact regeneration. It
observed a Firefox overlay timeout, four Firefox asset timeouts and two missing/stale standalone
demo artifact failures. These are **not classified load-only without isolated passing reruns**.
The full changed-scope run finished **8,087 passed / 24 failed / 5 skipped / 40 TODO**, with
12 failed files. Failures are test/hook timeouts across existing Firefox modules and unit tools,
plus an undefined-context close after a failed hook. This run began before the final CFF follow-up;
the final font suite verifies that follow-up. Final `changed --no-browser` finished
**5,293 passed / 6 failed / 1 skipped / 40 TODO**: five test timeouts and one nested Vitest
command failure in the scaffolder test (cause unresolved). No general green-suite claim is made.
The overlay retry passed 1/1 at the original limit; regenerated demo checks passed 2/2. The Firefox
asset-file retry still timed out in 3/11 cases (8 passed); four selected CLI timeouts also persisted
serially. Those remain unresolved and are **not** labelled load-only. Details/results are in checks.json.

## Six gates (min+gzip bytes)

Both measurements are from unchanged `node tools/size.ts`. All module and scene size gates pass.

| Gate | Before | After | Delta |
|---|---:|---:|---:|
| core + web | 20,622 | 20,622 | 0 |
| largest scene (30) | 52,122 | 52,122 | 0 |
| app-UI scene | 85,154 | 85,154 | 0 |
| runtime sum | 104,285 | 104,285 | 0 |
| authoring add-on | 14,544 | 14,544 | 0 |
| heavy class | 109,904 | 109,904 | 0 |

Authoring also stays below the design's stricter 15,360 B cap; size.ts prints 16,384 B. Neither
threshold was changed. This tooling adds **0 runtime bytes**.

## Limits, findings and deviations

- CFF2, Type2 arithmetic/seac, collections, HVAR metric variations and GPOS
  device/variation adjustments are unsupported. Nondefault HVAR axes diagnose instead of silently
  returning static widths. MVAR metric interpolation and general GSUB/script shaping are absent.
- WOFF2 short-loca reconstruction uses canonical explicit coordinate data and rejects output
  exceeding the 131,070-byte short-offset range. Broader real-font/container coverage remains needed.
- Tool complex shaping is approximate with `text-shaping-approximate`; RTL SVG outline conversion,
  SVG position lists and nonzero glyph rotations are explicitly unsupported. Use browser-text.
- Chromium's default grid fitting gives AV width 23 px versus tool 22 px at size 20. The 1 px
  discrepancy exceeds the original 0.1 px tolerance and is retained in the test. Canvas
  geometricPrecision gives 21.99996948 px, within 0.1 px. Generated lowercase outlines also match the declared 500-unit x-height
  (verified through actualBoundingBoxAscent). No tolerance was widened. P6-1 should
  account for this browser measurement choice; no runtime browser policy was changed here.
- Scaffold dry-run for assets.font-formats targeted sibling-owned runtime/manifest/parity files;
  the mutation pass was deferred to P6-3 to avoid conflicting placeholders and runtime bytes.
  No capability is marked done merely because a tooling test passes. No PLAN checkbox changed.
- The spec documents tool behavior and these limits in the same commit. Decisions cite the
  bounded-reader pitfall in docs/research/rive-format-and-graph.md §1 and grid units in
  docs/research/glyphy-compat.md §1. Implementation was written from primary OpenType/WOFF specs.
