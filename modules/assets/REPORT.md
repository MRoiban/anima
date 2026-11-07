# P5b-7 assets follow-up

Status: explicit-wrap fixes, genuine codec conformance, command-scoped browser reuse and all
19 native dispositions are implemented and committed on this branch. Verification is complete
with the timed-out checks and inherited implicit-wrap compatibility gap disclosed below; this is
not an all-green integration handoff. Parity status fields, measurement tools/inputs and all
existing limits remain unchanged.
The P5b-3 report is preserved in verification/P5B3-REPORT.md.

## Implementation

- SVG nearest clamp now extends edge texels to the image box, including axis overrides.
  Cropped SVG viewports retain intrinsic texels; explicit CSS sizes prevent the host's broad
  svg rule from stretching image boxes/crops to the whole viewport. Zero-area crops are hidden.
- Canvas isolates exact source texels and pads clamped axes before interpolation; periodic
  axes keep repeat/mirror filtering. Cached tiles depend only on source and sampling axes,
  not destination size. At most nine source slices populate a tile, independent of image area.
  Fractional slice coverage sums in an isolated surface before node opacity/compositing, avoiding
  source-over cracks and preserving translucent texels.
- SVG bilinear clamp with fitted margins reports a complete unsupported-render diagnostic
  at sampling, rather than stretching a filtered texel and claiming bilinear equivalence.
  The decided design permits an explicit refusal where SVG has no faithful form.
- Host-resolved bitmap pixel counts are now separate from authored layout width/height.
  This fixes SVG clamp when a 2-pixel bitmap is laid out as 1 unit: edge cropping selects one
  actual texel. CLI and browser store decoded dimensions in a WeakMap keyed by resource
  identity, outside the document and resolver metadata. Replacing an asset record cannot
  inherit the previous resource's texel counts. Separate assets/media bundles are checked in
  both registration orders. Viewport styling uses paint's existing seam to keep assets below 2 KB.
- CLI ImageEncoder lazily owns one browser per build (including all HTML script documents)
  or render image-inspection command. Each operation closes its page; command finally closes
  the browser, including decode failures. PNG-only paths remain in-process. No npm dependency added.
- Blob builds now preserve opaque bytes even when they resemble audio/image headers, retain
  declared MIME over URL hints and never attach an audio duration. Regression fixtures include
  valid WAV bytes, truncated fLaC bytes and SVG bytes declared application/octet-stream. Before
  the fix, WAV acquired duration 0.1 and SVG overrode the declaration. Both failures are captured.
- Genuine authored square-wave WAV/FLAC/MP3 fixtures replace both pending audio conformance
  sources and examples. Independent expected clock/linear-midpoint/event vectors are unchanged.
  FLAC has 800 lossless samples at 8 kHz; untagged MP3 has four 576-sample MPEG-2.5 frames
  (2304 decoded samples, 0.288 s), including codec delay/padding. No lossless MP3 claim.

## Six findings: outcomes and root-cause evidence

All measurements use the original threshold 16, maximum allowed delta 2 and zero pixels above
threshold. Original failing measurements remain in probes/native-measurements.json and
format-native-measurements.json; no reference was normalized, blurred, recoloured or replaced.

| Row | Original max / pixels >16 | Outcome |
|---|---|---|
| assets.image-wrap-x-clamp | 255 / 10,800 | Fixed geometry/coverage: now 0 / 0; promoted with identical limits |
| assets.image-wrap-y-clamp | 255 / 10,800 | Fixed geometry/coverage: now 0 / 0; promoted with identical limits |
| drawing-paint.image-wrap-clamp | 255 / 54,000 | Fixed geometry/coverage: now 0 / 0; promoted with identical limits |
| assets.image-filter-bilinear | 27 / 1,017 | Retained resvg filtering finding; native geometry through resvg equals Anima 0 / 0; ideal bilinear vs native max2 / 0, ideal vs resvg max27 / 1,027 |
| assets.image-import-jpeg | 40 / 57,600 | Retained native decoder finding; native geometry through resvg equals Anima 0 / 0; native 1:1 decoded pixels through Anima vs original native max1 / 0 |
| assets.image-import-jpg | 40 / 57,600 | Same bytes and same decoder isolation: 0 / 0 geometry control; max1 / 0 using native decoded pixels |

Reproduce with `node modules/assets/probes/sampling-controls.ts`. Its persisted JSON includes
source SHA256 equality, inspected native vertex/UV coordinates, triangle indices and sampler
fields. The standalone SVG control bypasses Anima's fit/wrap geometry. The JPEG controls use
fresh 2×2 native renders at source resolution, not pixels recovered from the 240×240 comparison.
Those decoded 2×2 PNGs are then fed through the full Anima image geometry and renderer. Thus
geometry accounts for zero delta; changing only decoder data explains the original difference
within the unchanged max2 bound. The exact native JPEG decoder algorithm is not established.

Additional adversarial finding: `assets-clamp-fractional-finding` uses an 8.12-unit centred box
and the independently authored native UV mesh. SVG measures **max164, 956/57,600 pixels >16
(1.659722%)**. Both the inspected-native geometry control and exact authored-decimal control
rendered through resvg equal Anima **max0 / over0**. The 956 above-threshold pixels lie entirely
on the two horizontal/two vertical slice-coverage lines; all other pixels match exactly.
This isolates a raster coverage/compositing difference, not missing clamp extent or incorrect UVs.
`node modules/assets/probes/fractional-clamp.ts --capture` reproduces the raw native capture,
independent controls and finding registration. Its original threshold/max2/zero-over still fail;
no pixel is excluded from the oracle. Canvas independently passes every channel of every pixel
for integer and fractional fitted boxes in both browsers, with the unchanged max2 bound.

The pre-existing unsupported bilinear-repeat exploratory probe retains todo.json with its
precise measured reason (max188, 36,852 pixels >16); no passing oracle is claimed for it.

## All 19 previously pending rows

Each row now has skip.json with a precise native observation limit, explicit test links and
captureEvidence. No one of these 19 remains TODO. These are evidenced skips, not passing native
parity claims. The original 12 passing row subsets remain, and the three nearest clamp rows
increase that set to 15; three original finding rows and 19 skips account for all 37 rows.
The additional fractional finding overlaps the clamp rows and is not a new parity row.

`node modules/assets/probes/native-capabilities.ts` rechecks current local CLI schema/commands
and the capability-limit assertions without committing documentation text. Native AudioEvent
sessions accept and trigger all three genuine formats. Native image format/quality mutations
are editor-only: PNG/JPEG/WebP settings all render identically to the untouched PNG (max0),
and runtime inspect omits format. These controls cannot be mislabelled encoding or PCM parity.

- `assets.audio` — **skip**: native headless AudioEvent triggers for WAV/FLAC/MP3; no PCM or host playback output in the command vocabulary. Skips waveform/playback parity only, not native decode acceptance.
- `assets.audio-clip` — **skip**: AudioAssetClip startSeconds/endSeconds are editor-only (present only with schema --all). Permitted headless commands expose triggers, not trimmed PCM. Cannot observe start/end playback offsets natively.
- `assets.audio-export-source` — **skip**: exportFormatValue/exportQualityValue are editor-only and native local headless loading has no source-byte export command. Comparing exported encoded audio would require a prohibited publishing/binary route. Anima byte-preserving build is tested locally.
- `assets.audio-import-flac` — **skip**: Genuine FLAC builds with zero native errors and sound pulse: triggered. The permitted headless command vocabulary has no decoded PCM output; waveform parity skipped. Completed conformance + both-browser lossless PCM checks replace the earlier synthetic-only gap.
- `assets.audio-import-mp3` — **skip**: Genuine four-frame MPEG-2.5 source builds with zero native errors and sound pulse: triggered. Native decoded PCM is not output by permitted headless commands; waveform parity skipped. Completed conformance + both-browser 2304-sample decode checks cover Anima.
- `assets.audio-import-wav` — **skip**: Genuine 800-frame PCM WAV builds with zero native errors and sound pulse: triggered; no native waveform capture in permitted commands. Both-browser sample-exact host decoding is independent Anima evidence, not native PCM parity.
- `assets.blob` — **skip**: BlobAsset exists, but permitted headless commands expose data/semantics/pixels and no host asset byte getter or JavaScript ArrayBuffer. A script-side blob reader is a different API; native JS host-byte/cache lifetime parity cannot be observed.
- `assets.cdn-disable` — **skip**: Local native file loading exercises neither CDN requests nor enableRiveAssetCDN. No network/JS host-policy command exists in the captured vocabulary; local-data renders cannot evidence CDN suppression.
- `assets.exclude-export` — **skip**: Native exclusion controls editor export (excludeFromRev/contents), while all content remains in the headless scene; no byte-exclusion export command exists in the permitted route. Publishing/editor-revision or binary inspection would be required and is prohibited.
- `assets.host-decode-audio` — **skip**: AudioAsset native decode accepts genuine WAV/FLAC/MP3, but no JavaScript decodeAudio callback, decoded AudioBuffer or PCM output exists in permitted headless commands. Host decoding/cache-copy tests run in both browsers instead.
- `assets.image-encoding-jpeg` — **skip**: Native format=jpeg quality=0.1 is accepted as editor-only metadata, absent from runtime inspect, and produces identical unencoded-PNG pixels (max0/over0); it does not invoke a JPEG encoder. No faithful local encoding observation without prohibited publication/editor routes.
- `assets.image-encoding-png` — **skip**: Native format=png quality=0.1 remains editor-only, absent from runtime inspect; PNG source renders max0/over0 against unencoded source. This observes loading, not re-encoding/output bytes, which permitted commands do not expose.
- `assets.image-encoding-webp` — **skip**: Native format=webp quality=0.1 remains editor-only, absent from runtime inspect; output is unchanged from PNG (max0/over0). Local preview does not invoke WebP mutation/export, so it cannot verify encoding.
- `assets.image-export-controls` — **skip**: includeInExport/exportTypeValue and excludeFromRev concern export/byte placement. Headless pixels/inspect do not expose the exported byte stream; the required publication/editor-revision/binary route is prohibited. Anima built payload exclusion is locally tested.
- `assets.metadata` — **skip**: Native FileAsset runtime schema has name/id/CDN fields, not the detached arbitrary metadata/size/MIME info object delivered to a JavaScript resolver. No host callback observation exists in headless commands.
- `assets.replacement-scope-image` — **skip**: Headless commands have no JavaScript asset-loader replacement hook or per-icon resolver scope. Native image drawing is observable, but it cannot observe same-name replacements across independent host icons or callback metadata lifetime.
- `host-api.asset-cdn-policy` — **skip**: No JavaScript host or CDN-policy setter exists in the permitted command vocabulary; native file-backed loading cannot exercise cross-origin authorization or custom resolver bypass. Both-engine route/resolver tests cover Anima only.
- `host-api.asset-loader` — **skip**: No host asset-loader callback/returned URL/Blob promise exists in permitted commands. Native file loading cannot evidence resolver rejection, detachment or scoped replacement. Both-engine host tests cover these behaviors.
- `host-api.asset-metadata` — **skip**: Native FileAsset runtime schema and inspect do not expose JavaScript callback info or arbitrary nested metadata. Headless command results cannot observe detachment or mutation isolation of the host info object.

## Decisions, deviations and gaps

- No decided design change is requested for the implemented row subsets. Native skips identify
  the prohibited/unavailable observation route, not an implementation exemption.
- Compatibility clarification needing integration review: wrapping controls opt into whole-box
  sampling; documents omitting all wrap controls retain the older fitted-image footprint.
  Extending default clamp to those legacy documents would change pre-P5b contain/none renders.
  This was already the runtime behavior; this follow-up fixes explicit clamp without silently
  changing it. The normative default-clamp wording and this compatibility behavior need the
  parent's decision; omission is not claimed as newly verified native clamp coverage.
- The requested modules/assets/SPEC.md was absent; added a contract index pointing at the
  existing normative spec/SPEC.md instead of inventing a second normative format.
- The markup corpus census changes 408→410 strictly to count the two completed conformance
  sources; no test criterion is weakened. It is the only non-owned test integration edit.
- Source fixture generation used temporary Debian FLAC 1.5.0 and libmp3lame 3.100 tooling under
  /tmp; the repository gains no system/npm dependency. Source samples and codec parameters
  are documented in probes/audio/README.md.

## Sizes

All min+gzip; no budget raised. Core+web remains 20,109 B (unchanged).

| Entry | Bytes | Budget |
|---|---:|---:|
| assets | 2031 | 2048 |
| media | 2346 | 3072 |
| paint | 4598 | 5120 |
| paint-sampling over paint | 926 | 1024 |
| canvas | 5005 | 8192 |
| events | 3703 | 4096 |
| full-featured | 102688 | 131072 |
| Rive-class | 107953 | 256000 |

Image-only/base pages acquire no media-byte or optional SVG sampling entry. The optional-consumer
split follows docs/research/rive-web-runtime.md §1; the new runtime code is original.

## Verification

Strict oracle: **248 completed cases / 444 samples, exit 0**. All 245 inherited completed
case definitions and measured records are unchanged; all 18 inherited findings are unchanged.
Four owned finding probes retain their failing numbers (bilinear, JPEG, JPG and the additional
fractional SVG probe). Genuine WAV/FLAC/MP3 native captures have zero errors and all trigger.

Final targeted checks: **47/47** CLI/core tests (CLI pipeline 17, core pipeline 10, asset core 20)
and **20/20** pipeline browser tests in Chromium and Firefox. These cover real codec decoding,
integer/fractional edge sampling, authored layout overrides, replacement resource identity,
separate bundle order and command browser closure on success/failure.

The requested full scope ran with both owned browser engines:

- Earlier frozen run: **5474 pass, 25 TODO, exit 0**, 43 files, 479.51 s.
- Latest full run, before the final Blob MIME correction: **5479 pass, 25 TODO, 1 failure**, 43 files, 514.43 s. The first Chromium
  policy/resolver test timed out at 5003 ms against its unchanged 5000 ms limit. The full
  browser pipeline file subsequently passes 20/20 in 9.78 s.
- Final broader CLI follow-up: **199 pass, 1 failure**, 19 files, 71.16 s. Existing authoring
  pivot geometry test timed out at 5104 ms against 5000 ms. This also timed out at 5643 ms in
  an earlier 5472-pass scope; its whole file passed 51/51 in an intervening isolated run.
  The recurring timeout remains unresolved. Scheduling/load as its sole cause is unverified.

Final **typecheck, ESLint, repository-wide Prettier, modules wiring, AniML and web-artifact
checks all exit 0** on the final source. AniML checks 451 sources; web checks 30 entries.
No timeout, assertion bound, budget, oracle limit or test coverage was relaxed. The remaining
25 TODOs are not reported as passing; the unrelated/exploratory pending probes retain markers.

Size exits 0 with the numbers above. Perf exits 0: bell compile 3.10 ms, all 9040 prefixes
792 ms, bell frame 41.8 µs, composite 29.0 µs, toolbar 35.0 µs, toolbar compile 4.52 ms.
An earlier loaded run measured bell 104.9 µs, composite 73.2 µs and toolbar 81.7 µs at host
load 16. Comparative non-regression is **unverified**; these readings are not an idle-baseline
comparison. Measurement tools and inherited inputs/limits are unchanged. Only the three proven
clamp case promotions and the additional measured fractional finding extend the oracle catalogue.

Logs and the machine-readable verification summary are in verification/p5b7/. The commit
containing this report is the branch handoff; no push, PR or merge was made.

Development logs preserve failures:
SVG crops initially inherited width/height/overflow CSS; zero-area viewport hiding and explicit
sizes fix them. The first HTML reuse test used the wrong MIME/container and exercised no build;
corrected to application/vnd.anima+xml inside anima-icon, then 15/15 CLI tests passed.
A native help file cannot be /dev/stdin through Node's pipe; a real command file fixes the route.
Chromium FLAC positive samples normalize by 32767, Firefox by 32768; tests assert exact
engine-specific Float32 conversions for all 800 samples (negative samples use 32768).
Cold bundle generation and assertion-stack construction contributed to browser timeouts;
fixtures now memoize/prebuild bundle promises (the shared fallback itself does not memoize),
and the bilinear shader test asserts the same bound on the maximum
of all 12,288 channel comparisons. No coverage, timeout or tolerance is reduced.

The first full-scope development run also hit a transient syntax error while the SVG alternative
was being edited during Firefox setup: 4406 pass, 1059 skipped, 25 TODO, five browser timeouts
and one failed setup. The pattern-of-patterns alternative regressed mirror (max28 /32 pixels>16)
and was reverted. Final verification uses frozen generated artifacts. Captures and original
metrics remain unadjusted; the independent fractional control initially differed at one corner
(max5) because its cell paint order was column-major. Matching the renderer's row-major order
makes both native-data controls exact without changing the compared native or Anima output.

No push, PR, merge, publication or Glyphy edit. Final exit-status logs are archived with this report.

Final development checkpoint: the later review caught declared layout dimensions being used as
SVG texel counts. Host/CLI now preserve decoded pixel counts separately; the new 1-unit layout of
a 2-pixel PNG fails with the old algorithm and passes exactly after the fix. Both backend/engine
browser variants exercise it. No registry/parity status field or budget changed.

Ignored Canvas metric JSON outputs are archived byte-for-byte as verification/p5b7/*-metrics.json.txt
before removing the generated ignored copies, so repository-wide formatting checks do not rewrite
measurement outputs. They are not measurement inputs.
