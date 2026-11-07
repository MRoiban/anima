# P6-1 implementation report

Status: **partial delivery; no parity rows closure-ready**. Branch `t3/p6-text-module`, initially
based on `216eecf3`, advanced to unchanged P6-2 commit `4a5fd75b` for tool integration. Local commit
only; no push, PR, publication, external font or proprietary binary read/conversion.

Implemented the optional text node, local/shared styles and references, data-bound text and run
lists, pure layout and fitting, cached line/cluster output, SVG/canvas drawing and browser prefix
measurement. The exact shared measurer types and `registerTextMeasurer()` live in `core/measure.ts`.
`setTextMeasurer` is a compatibility alias for the independently landed tool installer. Core requests
zero tracking from measurers and applies spacing once across clusters/runs. Normative behavior is in
[SPEC.md](SPEC.md). There are 29 AniML/JSON capability pairs and metric-derived layout expectations;
font-size, weight clamping and string animation also have `Player.step` snapshots.

## Rows and remaining work

Closure-ready: **none**. All 29 statuses remain `planned`:

```
text.wrap                     text.word-break
text.horizontal-alignment     text.vertical-alignment
text.origin                   text.overflow-visible
text.overflow-hidden          text.overflow-clipped
text.overflow-ellipsis        text.overflow-fit
text.overflow-fit-font-size   text.sizing-fixed
text.sizing-auto-width        text.sizing-auto-height
text.line-spacing             text.paragraph-spacing
text.tracking                 text.font-size
text.vertical-trim            text.fit-baseline
text.fit-layout-measure       text.rich-runs
text.run-list                 text.style-reference
text.paint                    data.bind-text
data.property-text-style      host-api.text-run
host-api.nested-text-run
```

Each row has implementation, registry spellings, diagnostic tests, an authored example, CLI/schema
coverage and deterministic layout coverage. Layout conformance now uses the unchanged P6-2 reader
and original `tools/test-font.ts` output. The fixed-advance measurer remains only in unit tests.
Independent expectations use the generated font's 600/1000 advance, 800/200 ascent/descent and
100 line gap; they were not recorded from `layoutText` output.

Twenty-five native render probes were independently authored and captured with that same generated
font. Sources, commands, session logs and PNGs are under `tests/oracle/text-*/rive/`. Raw comparisons
are in `verification/native-comparison.json`. They show unresolved baseline, line-height, fitting,
trimming and raster differences (maximum channel deltas up to 255); they have no accepted tolerance
and remain marked pending. The native run-list scene is a literal-render control only. Data/style
binding and named/nested host interactions still lack independent native captures. No case was
added to the completed oracle manifest, and no finding or tolerance was changed.

A concrete retained difference: the wrap probe's dark-pixel bounds are native `[0,3,19,21]` versus
Anima `[0,4,19,23]` at 12 px/unit. Anima's specified automatic height includes the tool's line gap;
normal browser measurement reports no separate line gap. This needs a deliberate metrics decision,
not a widened raster tolerance. The generated font has no U+2026; ellipsis raster fidelity also needs
an explicit glyph-coverage decision.

CLI validate/schema/inspect/sample and generated-font SVG/PNG rendering work after P6-2 integration.
The 29 rows still require completed native oracle integration (or a proven no-counterpart note),
resolution of the raw differences and clean broad verification. P6-3's private font-family/fallback,
axes/features and readiness helpers are not connected by this branch; its text-consumer integration
remains for the orchestrator. Bidi, hit testing, effects and editable fields remain their own tickets.
Solid/slot, linear/radial paint and strokes are covered; advanced surface text paint is unverified.

## Verification

- Final clean `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **8,396 passed / 65 TODO**,
  256 passing files plus 13 skipped files, exit 0 in 528.72 s. This includes the complete canvas
  corpus in Chromium and Firefox.

- Final owned scope: `npm run test:scope -- text conformance oracle --no-browser`, **3,783 passed /
  52 TODO**, 12 files. Includes 29 generated-font layout probes and shared markup integration.
- Owned browser suite: **8/8 passed**, Chromium/Firefox and both base/text import orders. It checks
  generated-font cluster advances against the tool at the original 0.5%-of-size tolerance, escaped
  SVG text, host replacement, queued-input preservation during font refresh, structural markup
  and actual SVG/canvas pixels. Baseline/line-height equivalence is not claimed.
- P6-2 outline integration and fit edge cases pass in the final owned scope. Checks caught and fixed a doubled SVG
  fit transform and the unsupported namespaced whitespace attribute; CSS white-space now preserves
  runs while passing the outline parser. CLI SVG/PNG render commands exited 0.
- Full typecheck, changed-source ESLint/Prettier, module wiring, schema generation, parity check,
  browser build (44 entries), and AniML artifact checks passed. Final broad result is recorded below.
- Strict oracle exited 0 with existing comparisons/findings retained; new text probes remain pending.
  No measurement source/input, benchmark record, finding or threshold was edited.

The base minified browser bundle is byte-for-byte identical to the untouched initial HEAD archive:
SHA-256 `24f0b6d4e452f7e17a1b236c867ab1f0adc1d85f79d326d1ec10fcfd74d97250` on both sides.

## All six size gates (min+gzip bytes)

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| Core + web | 20,622 | 20,622 | 24,576 |
| Largest scene (30) | 52,122 | 52,197 | 65,536 |
| App-UI reference | 85,154 | 85,224 | 131,072 |
| Runtime sum | 104,285 | 110,372 | 163,840 |
| Authoring add-on | 14,544 | 14,971 | 15,360 requested cap |
| Heavy | 109,904 | 115,972 | 256,000 |

The fixed app-UI reference in this branch's tool still excludes text; changing it belongs to the
orchestrator. Runtime sum includes the new entries. The unchanged tool prints 16,384 B for authoring;
the result also passes the stricter requested 15,360 B cap.

| Module / shared seam | Before | After | Budget |
|---|---:|---:|---:|
| text | 0 | 6,079 | 6,144 |
| text-host (over base web) | 0 | 367 | 1,024 new optional seam |
| markup-text (over markup) | 0 | 529 | 1,024 |
| paint | 3,983 | 3,983 | 4,416 |
| paint-sampling | 1,093 | 1,093 | 1,216 |
| markup-paint | 396 | 396 | 448 |
| markup-surface | 396 | 396 | 448 |
| canvas | 5,351 | 5,382 | 5,888 |
| data | 6,375 | 6,415 | 7,040 |
| host (over host-values) | 3,570 | 3,591 | 3,968 |
| host-values | 1,211 | 1,210 | 1,344 |
| lists | 4,623 | 4,636 | 5,120 |
| derive | 2,383 | 2,390 | 2,624 |
| markup | 8,007 | 8,178 | 8,192 |
| markup-libraries (over markup) | 1,925 | 1,916 | 2,176 |
| markup-hooks | 4,123 | 4,138 | 4,544 |
| markup-a11y | 970 | 1,014 | 1,088 |

These include unchanged paint entries and incidental shared-bundle deltas; a smaller
relative add-on delta does not mean its source was optimized.

No existing cap was raised. Complete named-run editing exceeded 6,144 B in the display entry, so it
was split at a real optional API seam. Web API callers import **both** `web/text` and `web/text-host`;
the adapter consumes the active text module and does not bundle/register text a second time.
Core clients may import `core/text-host`; core/text also re-exports its functions. Data binding and
text rendering remain in the default 6,079 B entry. `markup-text` is authoring-only and measured over
the compiler, as `markup-libraries` is. The new host adapter/separate allowance is a design deviation
for the orchestrator to review; it does not conceal a raised text cap.

## Perf, shared changes and limitations

Prescribed before/after perf ran unchanged. Under shared-host load, bell compile was 6.22 → 12.93 ms,
bell frame 85.4 → 154.6 µs, composite 59.8 → 96.2 µs, toolbar frame 80.6 → 111.3 µs and toolbar compile
10.53 → 14.70 ms. **Controlled ≤3% non-regression is unverified.** Raw numbers are retained.

Shared seams: static SVG text content (tree-shaken out of base web), a canvas shape hook, generic
keyed root/map resources and wrapperless arrays, and a dedicated authoring hook. Data/host gain a
specialized text-style string kind. Decompilation preserves structural source order and quotes
string keys safely while preserving raw morph paths. Thus base core+web is byte-identical, but some
optional non-text bundles/scenes grew as shown above. The broader literal byte-identity demand is
**not fully met**, and optional-module performance is not proven unchanged.

Development failures fixed: structural style/property name collision, wrapperless run lists,
canonical AniML, empty/space-bearing string keys, morph-path quoting, hold-only text sampling,
nested invalidation, literal dollar values, implicit animated defaults, numeric bounds, trimmed baseline fitting, fitted baseline
origin and zero-area fit boxes. Named and nested host replacements are exercised in the generated-font
conformance suite, with sibling isolation and persistence through step. Two
transient script-write mistakes were corrected and verified. Oversize candidates were rejected;
obsolete overlapping measurements were cancelled. Final measurements use frozen runtime sources.

## Broad verification history

The earlier completed `changed --no-browser` run had **5,522 pass / 14 fail / 65 TODO**. Unchanged-limit
isolated retries recovered prefix stress and assets JPEG/WebP plus its cascading launch-count failure.
Five failures remained in the serial retry: two capability-scaffolder subprocess timeouts, module-order
30-second timeout and two CLI authoring timeouts. They are not labelled load-only proven. Logs are
retained in `verification/changed-unit.txt`, `prefix-alone.txt` and `retries-alone.txt`.

The later broad run exposed a real canvas collection setup gap: it drew text before filtering
geometry without installing a Node measurer. The canvas test now installs the unchanged generated-
font tool measurer; its existing pixel limits and classifier are untouched. The rebuilt demo passed
2/2 and component paint passed12/12 at their existing limits. P6-2 font integration passed26/26.
A private-layout return annotation caused a real scaffold typecheck failure; it is corrected, full
typecheck passes and all4 scaffold tests pass. A broad run overlapped layout/fixture changes and was
stopped as mixed-source evidence; it is retained and is not a final-state verification claim.

After the infrastructure interruption, the clean broad process had stopped without a result; it
was restarted on unchanged sources. No later `p6` changes were merged. P6-2 was already an ancestor
before that instruction. The exported installer is `setTextMeasurer` (plus public
`registerTextMeasurer`); no `setMeasurer` alias is needed. P6-3 integration still needs
`icon.fonts.cssFont(spec)`, `await icon.fonts.ready(spec, text)` and `icon.fonts.revision` in cache
keys. This branch does not yet consume those helpers.

Text authoring is in its own `markup-text` entry. Nevertheless, generic keyed-resource/compiler
seams grew the existing markup entry **8,007 → 8,178 B** in this checkout. The orchestrator's newer
8,012 B baseline is not merged here. That remaining shared growth does not meet a literal
no-growth requirement; it must be reconciled at integration rather than hidden by the separate
529 B authoring entry.

The completed clean run initially found a real all-backend hook regression: **6,062 passed /
2,330 failed / 65 TODO**. Direct assignment to `orderSVG` invoked component-paint's existing
accessor setter, creating a callback cycle. Text now installs the same configurable chained
descriptor pattern as the other backends. Both opposite import-order regressions pass in
Chromium and Firefox (**8/8 text browser tests**); representative canvas/source-order and browser
perf probes passed **10/10** before the final complete **8,396-pass** rerun. Existing limits and
measurement inputs stayed unchanged. The raw failed run is retained as historical evidence, not a
current failure. Verification and the infrastructure restart extended the approximate timebox.
