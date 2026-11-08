# P6-4 — text/font integration

Status: **partial**. Integration fixes delivered; no parity row promoted. Branch
`t3/text-font-integration`, based on `777c0a5d`. Final head is in the implementation handoff.
Local commit only; no push, PR, package publication or external font.

## Rows closed and remaining

Closed: **none**. All 47 assigned rows retain their existing status.

Text rows:

```
data.bind-text
data.property-text-style
host-api.nested-text-run
host-api.text-run
text.fit-baseline
text.fit-layout-measure
text.flatten
text.font-size
text.horizontal-alignment
text.line-spacing
text.origin
text.overflow-clipped
text.overflow-ellipsis
text.overflow-fit
text.overflow-fit-font-size
text.overflow-hidden
text.overflow-visible
text.paint
text.paragraph-spacing
text.rich-runs
text.run-list
text.sizing-auto-height
text.sizing-auto-width
text.sizing-fixed
text.style-reference
text.tracking
text.vertical-alignment
text.vertical-trim
text.word-break
text.wrap
```

All need completed independent oracle integration or an evidenced no-counterpart disposition.
The 25 wave-1 captures retain unresolved baseline, leading, trim, fit and raster differences;
data/style bindings and named/nested host interaction still lack completed native comparisons.
The fixed-sizing source now omits sizing and retains its independently derived layout expectations.
`text.flatten` now accepts actual text SVG and its CSS/measurement hints, with CLI SVG/PNG and
font override tests. Component-definition traversal and preserving live text-only references remain
outside this fix, alongside independent outline reference evidence. Advanced text paint remains
limited by what the existing SVG geometry importer supports (e.g. clipping is rejected).

Font/tool rows:

```
assets.font
assets.font-formats
assets.font-glyphs-all
assets.font-glyphs-custom
assets.font-glyphs-used
assets.google-font-import
assets.host-decode-font
assets.replacement-scope-font
data.host-font
host-api.data-font
host-api.font-fallback
text.font-assets
text.font-decoding
text.font-fallback
text.font-metrics
text.opentype-features
text.variable-axes
```

The browser integration now proves loaded aliases, per-host catalogs, bound host-decoded font
assignment, per-model nested aliases/replacement, CSS/host fallback, actual-run readiness, and
queued-input preservation. The existing font diagnostic and format/subset/import tests remain active.
Font rows still need their pending native oracles and pending conformance probes replaced with
completed evidence; CSS feature/axis mapping alone does not prove actual shaping. Actual OpenType
substitution/variable-axis text rendering and full metric introspection are not claimed. Tool-format,
subsetting and Google-import rows have no newly completed native comparison or evidenced skip note.
The used-glyph subset now retains implicit U+2026 for ellipsis boxes.

## Seams outside owned files

Only generated wiring: `packages/web/src/fonts-text.ts`, `packages/web/src/all-modules.ts`,
`packages/web/package.json`, `tools/modules.generated.ts`, regenerated with `node tools/modules.ts`.
The task-owned `modules/assetio/web/index.ts` change is confined to loader initializer order: call
both initializers even when the image initializer returns true. No drawing internals in
`modules/text/core/svg.ts`, shared markup, a11y, effects, input or measurement tooling was edited.

## Verification

- Pre-cache-guard `npm run test:scope -- text fonts --browser=chromium`: 2948 passed / one 5s prefix-stress timeout / 530 filtered or skipped. All 12 owned Chromium browser tests passed. The same full compile file passed 51/51 in isolation at its original limits (`prefix-alone.txt`); both results are retained.
- `npx vitest run --project browser modules/fonts/test/web/{fonts,text-integration,nested-text}.test.ts modules/text/test/web/text.test.ts -t Firefox`: 12 passed / 12 opposite-engine tests filtered, four files, exit 0.
- CLI integration: 3/3 passed (real text flatten, SVG/PNG render --font, unsupported CSS diagnostic, deterministic U+2026 coverage, used-subset ellipsis retention).
- `npm run typecheck`, owned-source ESLint, Prettier on changed files, `node tools/modules.ts --check`, `npm run gen`, `node tools/build-animl.ts --check`, `node tools/parity.ts --check`, browser build (46 entries): exit 0. No stale generated files.
- `node tools/oracle.ts --strict`: exit 0, existing 266 completed cases / 475 samples and existing findings retained. Text/font pending probes remain pending. No oracle cases or findings were edited.
- `node tools/size.ts`: exit 0; all module budgets, 30 scenes and six gates pass.
- `node tools/perf.ts`: exit 0; bell compile 15.24 ms/frame 229.5 µs, composite 152.0 µs, toolbar compile 26.19 ms/frame 203.1 µs. Shared-host load: no controlled ≤3% non-regression claim.
- Final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **8658 passed / 2 failed / 88 TODO**, 273 passing files / two failed / 13 skipped, exit 1 in 1205.03 s. Both failures were timeouts: Firefox component-image preload (5s), capability scaffolder (60s). All 24 owned browser cases passed in this complete run, 12 in each engine. All unit/conformance cases for text/fonts/CLI passed.
- Unchanged-limit file retries after the broad run: scaffolder **4/4 passed** (57.95 s file); image pipeline **22/22 passed** (37.51 s file). Earlier image retry while the broad run remained active was **21 passed / 1 timed out**; retained as historical evidence. Prefix-stress file retry **51/51 passed**. No claim that the complete broad command exited green; all reported failing tests have passed in final file retries.
- The final initializer identity guard is separately exercised by **4/4** browser integration cases across both engines and loader orders. Earlier broad candidates stopped for runtime fixes have no final verification claim.

### Minified + gzip bytes

| Entry | Before | After | Budget |
|---|---:|---:|---:|
| text | 6053 | 6142 | 6144 |
| text-host | 355 | 355 | 1024 |
| markup-text | 529 | 529 | 1024 over markup |
| fonts | 1796 | 1807 | 2048 |
| fonts-text (new) | absent | 532 | 768 over fonts |
| assetio | 709 | 713 | 768 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 21136 | 21136 | 24576 |
| largest scene | 53201 | 53201 | 65536 |
| app-UI reference | 94068 | 94176 | 131072 |
| runtime sum | 113443 | 114121 | 163840 |
| authoring | 15226 | 15226 | 16384 (also below design 15360) |
| Rive-class | 119089 | 119760 | 256000 |

The CLI and generated test font add no runtime entry. Unchanged measurement tools produced both columns.

## Design deviations

- A real optional entry, **`web/fonts-text`**, owns the readiness/cache/descendant-invalidation bridge.
  It imports `web/fonts`; text consumers import it alongside `web/text`. An integrated candidate
  exceeded the unchanged fonts 2048 B cap (2204 B), so it was split as the brief permits. New
  optional entry budget: 768 B over fonts; no existing budget is raised. Generated scene selection
  includes all entries owned by fonts; the owner's fixed APP_UI list still names fonts alone.
  Its printed app-UI gate therefore excludes the optional bridge: the orchestrator must add it
  to that reference set when integrating. Runtime-sum/heavy measurements include it.
- Canvas still measures prefix advances at authored size with normal kerning and
  geometricPrecision. Bounding metrics are measured at 1000 px and scaled to grid units, fixing
  rounded 2px metrics without changing advances. The unchanged 0.5%-of-size tolerance passes for
  explicit leading. Automatic OpenType lineGap is still unavailable from Canvas; the retained
  baseline differences are explicit in [FINDINGS.md](FINDINGS.md) and tested separately.
- The host-side resource bridge follows the separation discussed in `docs/research/rive-web-runtime.md` §5 and the browser binding decision in P6 DESIGN §4; no external shaping implementation was copied.
- The fixed-sizing default follows the ticket decision, without mutating source documents.

## Problems and verification history

- First sizing implementation mutated raw source and failed canonical AniML round-trip; fixed by
  shared pure textSizing inference. First browser test scenes omitted required image fields and
  paint declaration; corrected tests, no diagnostic suppression.
- First scaled measurement trial changed prefix advances and failed the old 5-decimal browser
  equality check; retained authored-size widths and scaled only metrics.
- Nested layout APIs updated before the displayed SVG did; the DOM regression retained 5.40625
  instead of 3.6 after replacement. Descendant invalidation fixed the actual SVG output.
- Readiness-gate, initializer-probe ordering and exact floating-point waits in development tests were corrected. Original
  0.01-unit layout tolerance remains unchanged.
- Scoped stress-prefix timeouts at the unchanged 5s limit and their isolated retries are reported
  below; they are not silently treated as passes. Superseded broad/size processes were stopped
  when adding the nested/CSS-only owner fix; mixed-source runs are not final evidence.
- Final review: non-font asset initializers must be returned by identity, because the decoded asset cache shares them between hosts. The fonts-text wrapper now only captures a host for font-bearing documents. The new identity probe passed 4/4 across both engines and loader orders.
- Initial size command failed because esbuild was absent; `npm ci` restored the existing tooling. No dependency declaration or lockfile changed.
- The new ellipsis glyph was appended, preserving old glyph IDs/outlines. Pending native ellipsis captures made with the older fixture still need recapture before closure.
- Firefox image-preload timed out at 5s in the broad run and an earlier file retry (21 passed / 1 failed), then the final file retry passed 22/22 at the same limit. Scaffolder timed out at 60s in broad, then passed 4/4 alone. Both broad and retry outcomes are retained; the broad command itself remains exit 1.
- Timings are under shared-host load and do not prove the controlled ≤3% performance gate.
- Native raster findings, pending row closure and full CLI flatten generality remain unresolved.
