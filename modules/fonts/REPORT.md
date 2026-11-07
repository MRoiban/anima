# P6-3 — fonts runtime

Implementation complete in the isolated fonts entry; phase parity closure remains open.
Branch: `t3/runtime-fonts-module` (head recorded in final handoff).

Import `@anima-format/web/assets` and `@anima-format/web/fonts`. No runtime dependency or font
file is added. The module is measured over base web, with a 2,048 B budget. Assets source is
unchanged; assetio composes earlier font loaders in either entry order. The fixture generator under
test/font.ts creates original sfnt bytes in memory.
It deliberately does not claim a variable axis or OpenType substitution fixture.

## Integration contract for P6-1

`cssFont(spec)` is exported from core/fonts and web/fonts. It returns camel-case CSS properties,
including the canvas `font` shorthand. Browser text must call `icon.fonts.cssFont(spec)` to resolve
private asset family names and append host fallback families, then apply the returned CSS to SVG
text (and supported properties to canvas). Call `await icon.fonts.ready(spec, actualRunText)` before
measuring. Asset faces are already decoded/registered/awaited before `anima:load`; readiness also
covers CSS families supplied by the host. For component models use `icon.fonts.forModel(model)`.
Asset loading, fallback additions and replacements invalidate draw versions and wake the player;
the measurement/layout cache must include the controller and icon.fonts.revision, including when
CSS family names stay unchanged. Host fallback configuration survives the first load and reloads;
explicit fonts.clear() forgets it. Child helpers append the root host fallback list.

The structural `FontStyle` type matches DESIGN §4 without owning or importing FontSpec. No text
module is present on this ticket's base, so generated-font canvas measurement acts as the measurer
stub. The pure SVG backend is empty: fonts owns resources and CSS, text owns drawing/measurement.

## Rows and closure evidence

All twelve inventory statuses remain planned. Runtime portions ready for integration:

| Row | Evidence and remaining closure work |
|---|---|
| assets.font | Original bytes load before scene readiness; JSON/AniML round trip, existing asset diagnostics, deterministic conformance case. Native text comparison pending. |
| assets.host-decode-font | decode(bytes/URL), set(name, face); generated font measured in both engines. Native reference pending. |
| assets.replacement-scope-font | Two icons retain distinct families; replacing one changes 36px → 54px, other stays 36px. Bound text and nested rendering integration pending. |
| data.host-font | Decoded assignment allocates player-local id; sibling property retains body. Bound text consumer integration pending. |
| host-api.data-font | data.font(path).set(face) and queued resource reference tested in both engines. Native comparison pending. |
| host-api.font-fallback | add(face,{weight}); two same-family faces choose 36px/54px at weights400/700 in both engines. |
| text.font-fallback | CSS list preserved and ordered host families appended. Generated missing-glyph canvas fallback is covered; SVG/text integration pending. |
| text.font-assets | Private aliases supplied; text must consume helper for bound/animated family selection. |
| text.font-decoding | Browser decode and options projection supplied; browser does not expose axis/feature enumeration or glyph outlines. Full row remains open. |
| text.variable-axes | CSS mapping verified; actual variable-font rendering/animation awaits P6 fixture and text. |
| text.opentype-features | CSS mapping verified; actual substitution rendering awaits P6 fixture and text. |
| text.font-metrics | Loaded-face canvas ascent/advance exercised; cap/x-height/coverage/introspection belong to text/tool reader. Full row remains open. |

No row is claimed fully parity-closure-ready while its independent reference or text consumer is
pending. Eleven conformance and twelve oracle scaffold markers remain explicitly pending rather
than counting baseline scenes as passes. The active assets-font conformance case only proves the
font resource does not change deterministic Player output, not browser shaping.

## Deviation

A shared preload composition hook in assetio is necessary: when fonts arrived first, the old image
loader overwrote it (probe: both icons retained unresolved body). Preserving the earlier loader
makes both entry orders resolve private families. The shared hook measured +16 B in assetio;
assets source is unchanged (+3 B gzip-context shift). Tests cover both engines and entry orders.


A two-line font-only cache bypass was necessary in `modules/host-edit/web/index.ts`. Its existing
shared decoded-assets cache skipped the fonts loader for a second icon using the same compiled
model (probe families: first `anima-font-1`, second unresolved `body`). Font-bearing documents now
run the loader for each icon; non-font documents retain the cache. Both engines cover this case.
This extends ticket ownership narrowly to the font part of that cache; host-edit is also measured.
Superseded changed-scope runs were stopped for cache/typed-error fixes; the corrected-source
changed run covers them. Invalid core font values initially bypassed the typed setter; a browser
FontFace predicate now routes only decoded faces to the extension, retaining all original errors.
The web installation is guarded for repeated entry imports from separately bundled consumers.
Final scope review also preserved the active model-resolved image catalog when font assignment
creates player-local records; a native SVG Blob image verifies decoded source and dimensions remain.
The Chromium warning test exposed async inline-module injection in the test harness (unknown-feature
fonts, registry contained only assets); tests now wait for module registration at unchanged limits.

## Verification

Measured min+gzip bytes (verification/size-before.txt and size-after.txt):

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core + web | 20,622 | 20,622 | 24,576 |
| largest scene | 52,122 | 52,122 | 65,536 |
| app-UI fixed set | 85,154 | 85,175 | 131,072 |
| runtime sum | 104,285 | 105,973 | 163,840 |
| authoring add-on | 14,544 | 14,544 | 15,360 (P6 cap) |
| heavy class | 109,904 | 111,567 | 256,000 |

Fonts: absent → 1,789 / 2,048 B (259 B spare). Assets: 1,788 → 1,791 / 1,984 B (unchanged source, gzip context +3 B);
assetio: 658 → 674 / 768 B (+16 B shared hook). Host-edit: 3,663 → 3,677 / 4,032 B (+14 B).
All six enforced gates pass. The app-UI fixed set excludes fonts, as noted below.

Final focused scope: 1,090 passed (ten Chromium/Firefox browser tests), 512 filtered. Typecheck,
changed-source ESLint, generated wiring, schema generation and AniML artifact check pass.
Strict oracle command exit0 with existing findings and pending probes preserved; no new native
comparison is claimed. Perf command exit0: bell compile9.09ms/frame164.7µs, composite92.6µs,
toolbar compile18.05ms/frame158.6µs; shared-host contention prevents a meaningful baseline comparison.
Final required changed scope: **8,111 passed, 63 TODO, four Firefox startup/import timeouts**
(251 files passed, one failed, 13 skipped). The exact four failing base-web cases passed in an
isolated retry in 9.00 s at the original limits (verification/web-firefox-retry.txt). No assertion
or timeout was relaxed. A prior complete run before the final catalog-preservation review passed
all 8,115 tests. The final catalog regression and every fonts case pass in the final 1,090-test scope.
Earlier loaded runs had inherited browser/scaffolder/CLI timeouts; they are not counted as passes.
See verification/changed.txt and focused.txt.
Failures during development: empty nodes rejected by loader; original test font first had invalid
head bounds and unsupported cmap; fixed using sanitizer diagnostics and original format4 cmap.
Unpainted fixture warnings/canonical formatting were corrected. No limits or expectations were
relaxed. No native binaries, third-party fonts, tool changes, budgets or findings were committed.

Non-text core/web sources are unchanged. The perf run is under shared-host load; its absolute
numbers do not establish the ≤3% non-regression gate. The orchestrator must do the controlled A/B.
The existing size tool's fixed app-UI set does not yet include fonts; its measured value is reported
as-is, without changing measurement inputs. Runtime-sum/heavy gates do include the new module.
