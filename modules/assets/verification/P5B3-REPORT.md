# P5b-3 assets — implementation report

Status: partial against the complete capability definition. Runtime/CLI work and evidence are
committed for integration; native findings and pending evidence are not completion claims.
No parity status field, existing test limit, budget, oracle threshold or measurement tool was changed.

## Implemented

- Assets: metadata, MIME/byte size, clip validation, encoder options and both source spellings.
- Browser: default local policy, explicit any/custom resolvers, detached metadata; lazy cached
  audio/blob bytes in the optional media entry; decoded image access reuses the loaded source.
- Events: clip offset/duration, decoded-bound failures, existing activation/gain/lifecycle rules.
- Image nodes: resize alias, nearest/bilinear, axis wrap overrides, SVG nearest repeat/mirror,
  Canvas2D periodic patterns and reflected tiles. SVG bilinear repeat explicitly declines.
- CLI: signature/container inspection, duration/dimension checks, MIME mismatch diagnostics,
  byte-preserving embed, encoding and export exclusion in AniML and HTML; original SVG/Lottie
  importers with path-bearing unsupported warnings. GIF/SVG/opaque-font embedding is preserved.
- 37 canonical AniML capability examples and compiled .ani files; 35 completed conformance
  probes with independent linear midpoint/clock expectations (399 total completed cases).
  Two audio-format probes retain todo.json; no synthetic header fixture is called playable audio.

## Native evidence

All new passing cases use max delta 2 and zero pixels above 16. Existing 216 manifest entries
and their thresholds are unchanged. Original native scenes and capture sessions are committed;
no native binary document or documentation text is included. Capture used the allowed local
headless CLI path only. The new set has 19 native scenes / 21 frames: 12 passing scenes / 14
frames, six findings / six frames, and one explicitly unsupported SVG combination / one frame.

Passing rows (supported settings/subsets only; parity statuses remain unchanged):

- `assets.image-filter-nearest`
- `assets.image-import-png`
- `assets.image-import-webp`
- `assets.image-wrap-x-mirror`
- `assets.image-wrap-x-repeat`
- `assets.image-wrap-y-mirror`
- `assets.image-wrap-y-repeat`
- `assets.lottie-import`
- `assets.svg-import`
- `drawing-paint.image-fit-resize`
- `drawing-paint.image-wrap-mirror`
- `drawing-paint.image-wrap-repeat`

Eight original sampling/resize probes, PNG import and Lottie motion have maximum delta 0.
SVG import and WebP import have maximum delta 1. Lottie motion is checked at 0, 0.5 and 1 second.
The SVG/Lottie references test independently authored expected geometry/motion, not an editor
import/reimport workflow. Original inputs live in test/cli/fixtures.

Unadjusted findings (240×240 pixels; threshold 16):

| Row | Maximum delta | Pixels above 16 | Meaning |
|---|---:|---:|---|
| assets.image-filter-bilinear | 27 | 1,017 (1.765625%) | resvg/native filtering difference |
| assets.image-wrap-x-clamp | 255 | 10,800 (18.75%) | native extends edge texels; current fitted margins are transparent |
| assets.image-wrap-y-clamp | 255 | 10,800 (18.75%) | same clamp gap |
| drawing-paint.image-wrap-clamp | 255 | 54,000 (93.75%) | same clamp gap on both axes |
| assets.image-import-jpeg | 40 | 57,600 (100%) | native differs from Chromium and resvg on the original 2×2 fixture |
| assets.image-import-jpg | 40 | 57,600 (100%) | same encoded bytes under the JPG extension |

SVG bilinear repeat measured maximum 188 and 36,852/57,600 pixels above 16 (63.979167%).
The pre-decline image and native reference remain in tests/oracle/assets-bilinear-repeat-finding;
this case retains todo.json. The backend now reports unsupported-render with a periodic-filtering
reason, valid source pointer, measured hint and nearest/canvas alternatives. Canvas uses its own
periodic filter; browser tests independently check interpolation across its texture seam.
Raw observations are in probes/*native-measurements.json and jpeg-decoder-observation.json.
No finding was normalized, blurred, excluded, recoloured or made passing with a higher threshold.

Native evidence still pending (19 rows; no unsupported host comparison is claimed as a skip):

- `assets.audio`
- `assets.audio-clip`
- `assets.audio-export-source`
- `assets.audio-import-flac`
- `assets.audio-import-mp3`
- `assets.audio-import-wav`
- `assets.blob`
- `assets.cdn-disable`
- `assets.exclude-export`
- `assets.host-decode-audio`
- `assets.image-encoding-jpeg`
- `assets.image-encoding-png`
- `assets.image-encoding-webp`
- `assets.image-export-controls`
- `assets.metadata`
- `assets.replacement-scope-image`
- `host-api.asset-cdn-policy`
- `host-api.asset-loader`
- `host-api.asset-metadata`

Audio headless observation does not provide audible PCM/clip output, and the permitted local CLI
route does not exercise JavaScript host resolvers/policy. Encoding/export/metadata rows need a
faithful independent observation route; local byte/header and browser tests are not native parity.
The audio FLAC/MP3 conformance markers remain pending for genuine per-format source/evidence;
unit tests cover inspected synthetic containers and real WAV event wiring separately. A genuine
800-sample, 8 kHz WAV additionally decodes to the independently expected duration, sample count
and PCM values in both browsers; the host passes a copy so the cached bytes remain usable.

## Decisions and deviations needing integration review

1. Current clamp preserves the pre-existing transparent fitted margin. This does **not** reproduce
   native edge-texel clamp. The three clamp rows are not complete; implementing edge extension or
   an integration decision about a deliberate semantic difference is still required. SPEC retains
   edge extension as the required clamp behavior and labels the implementation gap explicitly;
   no change to the decided design is claimed.
2. export=false retains the name/type/source record so references can validate and a resolver can
   supply bytes. Referenced sources remain references; embedded sources become anima:NAME
   placeholders and their payload is actually removed. This interprets exclusion as payload
   exclusion rather than deleting a referenced declaration; deleting it would fail before resolution.
3. Optional media isolates byte access from image-only pages. Optional paint-sampling installs SVG
   patterns; ordinary paint retains registry/diagnostic seams. Even paint plus sampling stays within
   the original 5 KB paint allowance (4557 + 548 = 5105 B). Canvas wrapping is in canvas.
4. resvg lacks WebP decoding, so cached Chromium decodes WebP, including before in-process PNG
   encoding/rendering. PNG encoding itself is in-process; JPEG/WebP encoding uses the browser.
   No npm dependency was added. CLI PNG rasterization maps CSS pixelated to resvg optimizeSpeed:
   this fixes the measured nearest-filter failure without changing browser SVG output.

## Sizes

All min+gzip; the new-entry budget is initial, no existing budget was raised.

| Entry | Bytes | Budget |
|---|---:|---:|
| core + web | 20,109 | 30,720 |
| assets | 2,001 | 2,048 |
| media (includes assets) | 2,317 | 3,072 |
| paint | 4,557 | 5,120 |
| paint-sampling over paint | 548 | 1,024 |
| canvas | 4,749 | 8,192 |
| events | 3,703 | 4,096 |
| markup | 7,913 | 8,192 |
| surface (transitive effect) | 7,938 | 8,192 |
| full-featured | 95,305 | 102,400 |
| Rive-class | 100,331 | 256,000 |

Full-featured increases 1,730 B from 93,575 B, leaving 4,414 B of P5b's 6 KB allowance
for other workstreams. The base 20,109 B entry is unchanged.

## Verification

Full requested scope: **5385 passed, 52 TODO**, 48 files, 465.00 s, both Chromium and Firefox,
with VITEST_MAX_WORKERS=1. Bilinear seam checks sample binary-exact texture boundaries in both engines, retaining a
2-channel bound and all 64 seam locations. Real WAV decoding also passes both browsers
with independent expected PCM values and without consuming the cached buffer. Strict oracle: **228 cases,
424 samples, zero failed completed samples**; six new findings remain separately failing.
Final CLI/markup follow-up after CLI-only hardening: **2409 passed**, 31 files, 49.30 s.
All of the following exit 0: `npm run typecheck`, `npx eslint .`, `npx prettier --check .`,
`node tools/modules.ts --check`, `node tools/build-animl.ts --check`,
`node tools/build-web.ts --check`, `node tools/parity.ts --check`, `node tools/size.ts`,
`node tools/perf.ts` and `node tools/oracle.ts --strict`. AniML generation checks 443 sources;
37 capability examples additionally pass their separate canonical compilation test.
Durable logs are in verification/. Performance: bell compile 2.04 ms; all 9,040 prefixes 540 ms; bell frame
30.7 µs; composite frame 19.7 µs; toolbar frame 22.2 µs; toolbar compile 3.09 ms.
The module-order regression passes all 12 arrival orders in 21.53 s within its unchanged 30 s limit.
All 37 capability examples are compiled/canonical checked by pipeline.test.ts, including the
capabilities paths not scanned by tools/build-animl.ts.

Development failures retained for honesty: absent node_modules (npm ci restored baseline tooling),
compound metadata parsing and independent reader omissions, missing WebP decoding in resvg,
import filename handling, SVG backend registration before assets, and default images accidentally
using patterns. The last issue caused eight unchanged canvas comparisons to fail; limiting patterns
to explicit wrapping restored all eight. An over-budget surface dependency was fixed by literal
schema descriptors and the optional sampling entry. New Firefox tests were split by backend while
retaining every assertion and the same 5 s limit; no timeout was raised. Concurrent module-order
and codec runs timed out earlier; isolated reruns pass. New compatibility tests caught GIF embedding
regression, fixed by preserving its earlier header-only embedding path. A final CLI-only hardening pass adds RGB/RGBA/basic named colours, pixel units and explicit
warnings for unsupported SVG descriptive/paint values; its 11 CLI tests pass.
No original measurement record or test criterion was weakened. No push, PR, merge, publication or Glyphy edit was performed.
