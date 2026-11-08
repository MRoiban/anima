# P7-3 implementation report

Status: **partial**. Fits, alignment, size overrides, pointer mapping and semantic bounds are implemented;
responsive root reflow still requires P7-2 integration. Branch: `t3/p7-3-animation-implementation`,
based on `049f5d66`; final head is supplied in the commit handoff. No push or PR was made.

## Rows

Closed in inventory: **none** (inventory is outside this ticket's owned files and remains unchanged).
These **17 rows are implementation/closure-ready**, with browser conformance, paired AniML/JSON,
native comparisons or evidenced skips, diagnostics and passing byte guards:

- `host-api.fit-contain`
- `host-api.fit-cover`
- `host-api.fit-fill`
- `host-api.fit-fit-height`
- `host-api.fit-fit-width`
- `host-api.fit-none`
- `host-api.fit-scale-down`
- `host-api.align-top-left`
- `host-api.align-top-center`
- `host-api.align-top-right`
- `host-api.align-center-left`
- `host-api.align-center`
- `host-api.align-center-right`
- `host-api.align-bottom-left`
- `host-api.align-bottom-center`
- `host-api.align-bottom-right`
- `host-api.artboard-size`

Left: **`host-api.fit-layout`**. The viewport matches native layout fit, and the per-player
`layoutSize?: [width,height]` contract is tested with a `layoutBox` stub. P7-2 must consume it for
root layout width/height, restore authored sizing when undefined, and validate real reflow. No
native reflow parity is claimed. The other 17 rows need orchestrator parity-mapping/status updates.

## Seams outside owned files

All handwritten seams are marked `// seam(P7-3)`:

- `packages/web/src/index.ts`: optional `AnimaIcon.viewBox(icon, svg?)` hook, canonical alignment
  observation, reconnect observation, renderer rebuild draw notification for paused overlays.
  Equivalent legacy alignment/offset math is shortened to keep core+web within +40 B.
- `modules/canvas/web/renderer.ts`: consumes the optional virtual viewBox for the drawing viewport;
  its existing pointer and semantic-box accessors inherit that matrix and DPR handling.
- `modules/input/web/index.ts`: with host-fit loaded, canvas input inverts the backend's current
  `canvasBox([0,0,1,1])` matrix. It follows the drawing even before a resize observer has run.
- `modules/a11y-dom/web/index.ts`: observes `alignment`; rechecks the fitted matrix on draw
  invalidation only when host-fit is loaded, including size overrides and rebuilt renderers.
- Generator output: web adapter/export, `all-modules.ts`, module build/size/scope tables; browser
  build regenerates `examples/web/index.html`. No generated file was edited by hand.

The P7-2 seam is local to `HostLayoutPlayer` in this module; no layout-owned file was modified.

## Verification

Final owned scopes after the resize-edge fix:

| Command / coverage | Result |
| --- | --- |
| `npm run test:scope -- host-fit --browser=chromium` | **1,280 pass / 0 fail**: 31 browser cases + 1,249 corpus checks |
| `npm run test:scope -- host-fit --browser=firefox` | **1,280 pass / 0 fail**: same coverage |
| Existing host-fit/input/overlay regression selection (three files, both engines) | **12 pass / 0 fail**, 174 intentionally filtered |
| `node tools/oracle.ts --strict` | **309 cases / 524 samples pass**, exit 0; 23 existing findings retained |
| `node tools/size.ts` | Exit 0; every module budget and six gates pass |
| `node tools/modules.ts --check` | Current, 0 stale files |
| `npm run gen`, parity `--check`, AniML build `--check` | Pass; 634 AniML files checked |
| Browser build; web + web-test TypeScript; scoped ESLint; changed-file Prettier | Pass |
| `node tools/perf.ts` | Exit 0; shared-load timings, **controlled ≤3% A/B unverified** |

Eight native fits at a non-square 240×120 viewport are compared in SVG and canvas on both engines.
Every RGBA pixel is compared: max channel delta ≤2, zero pixels over 2; no shifts, masks, edge
exclusions or threshold changes. Alignment and artboard API skips retain the rejected native
commands in `verification/native/session.txt` and reasons in `verification/skip.json`. Host-only
options add no document registry keys or static CLI fitting semantics; browser tests are their
conformance surface, while the paired scene compiles unchanged in both syntaxes.

Initial `npm run test:scope -- changed`: **9,095 pass / 143 fail / 82 skipped / 54 TODO**,
55 failed / 249 passed / 13 skipped files, under shared machine load 40–88. This was not a green run.
Serial retries of the ten failed unit files: **255/255 pass**. Browser retry results are recorded below.

Earlier owned results are retained honestly: Chromium initially 16 pass / 10 fail (eight missing
paused-renderer overlays, two exact-float assertions); corrected. Firefox initially 24/28 (three
setup timeouts, one overstrict float assertion); the first later isolated run had four timeouts,
then passed 1,278/1,278 before the final resize tests were added. No deadline was increased.
The malformed first AniML example was caught by corpus and corrected (version/x0/y0 attributes).

A real final edge regression was reproduced: immediately after CSS resize, the initial canvas
input seam returned x=7.5 for the drawing's x=5. Backend-matrix inversion fixes it; both engines
now pass the new SVG/canvas tests. `verification/runs/resize-before-fix.txt` retains the failing run.
An asset-pipeline isolated run had 10 pass / 1 load diagnostic failure, then both bilinear cases
passed on retry (2/2); no asset code or pixel threshold was changed.


Final invalid-size validation rejects sparse arrays (`Array(2)`), which ordinary Array.every skips.
The seven invalid-size inputs are covered in the final 1,280/1,280 passing scopes; host-fit is 733 B.

Serial retry of all 45 failed browser files: **3,016 pass / 2 timeout**, **44 passed / 1 failed file**.
Only the Firefox asset pipeline failed (component-image preload and the SVG repeat/mirror/clamp
loop). A later whole-file Firefox retry passed preload: **10 pass / 1 timeout**, 11 Chromium cases
filtered. The final isolated SVG-loop retry passed **1/1**, with 21 cases filtered. Thus every initial
failure has passing retry evidence, but no single whole changed-scope run is claimed green. No asset
implementation or deadline changed; all raw failing and passing results are retained.

## Sizes (min+gzip bytes)

Frozen archive baseline uses `049f5d66` and the same dependencies. Its measured authoring value is
14,742, not the brief's stale 14,717. The first baseline run overlapped edits and is discarded;
`verification/runs/size-before.txt` is the frozen baseline and `size-after.txt` is the delivery.

| Gate | Before | After | Limit |
| --- | ---: | ---: | ---: |
| core+web | 21,136 | 21,165 | 24,576 |
| largest scene (30 scenes) | 53,857 | 53,928 | 65,536 |
| app-UI | 98,890 | 99,002 | 131,072 |
| runtime sum | 120,281 | 121,168 | 163,840 |
| authoring | 14,742 | 14,737 | 15,360 ticket / 16,384 owner |
| heavy | 130,077 | 130,884 | 256,000 |

| Entry / guard | Before | After | Budget |
| --- | ---: | ---: | ---: |
| host-fit | absent | 733 | 768 |
| canvas | 5,379 | 5,406 | 5,888 |
| input | 6,703 | 6,743 | 7,104 |
| a11y-dom | 2,131 | 2,139 | 2,176 |
| markup (unchanged source) | 7,341 | 7,341 | no growth |
| markup-libraries (unchanged source) | 2,176 | 2,176 | 2,176 |

Core+web grows **29 B**, below the ticket's +40 B allowance. No cap, threshold, oracle finding,
benchmark record or measurement input was edited. The size tool's fixed app-UI set remains unchanged
as instructed: the orchestrator must add host-fit with the other P7 entries when updating it.
Runtime sum and heavy already include host-fit. Byte-compression trials are discarded.

## Design deviations

- SVG uses a virtual viewBox plus `preserveAspectRatio="none"` for every requested fit rather than
  separate preserveAspectRatio cases and a transformed scene group. The affine mapping is identical,
  tested with independent vectors and native pixels; this representation fits the 768 B budget and
  keeps drawing, pointer inversion and semantic mapping together.
- No request preserves B8's existing SVG grid/bleed viewport. Explicit requests fit and crop to the
  whole host in both backends, normalizing the older grid-relative explicit contain/cover mapping;
  this distinction is normative in the new spec section.
- Layout uses one CSS pixel per grid unit (DPR only affects backing pixels). The design did not
  specify a configurable pixels-per-unit API; no extra attribute is invented.
- Scaffolder dry-run and actual invocation reject `--module host-fit` because of its hyphen. The
  module and evidence were created manually; no unrelated scaffolder edit or inert core feature.

## Problems / handoff

P7-2 root-layout integration and its native reflow evidence remain outstanding. Parity metadata is
unchanged for the orchestrator's closure pass. Perf was measured under load (bell compile 9.88 ms;
prefix sweep 3,411 ms; bell/composite/toolbar frame 187.3/110.6/118.6 µs), so it proves no ≤3% guard.
No package was published, no branch pushed, no PR opened, and no Rive code or binary was read.
