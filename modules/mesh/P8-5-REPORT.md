# P8-5 — image meshes and animation

Status: **partial**. Functional implementation and original probes are ready; the mesh entry is
299 B over budget and the shared tuple infrastructure adds 17 B to core+web. Neither row is closed.
Branch: `p8-5`, based on `59263eb7`. No push, PR, publication or dependency change.

## Rows

Closed: none. `rigging.mesh` and `rigging.mesh-animation` remain planned pending entry-size closure,
the zero-growth decision for core+web, and orchestrator-owned oracle promotion. Native frames and
raw measurements are present; no oracle budget, manifest, finding or benchmark record was changed.

## Seams outside ticket files

- Core draw: type-only `DrawNode.mesh`; Player: type-only `skinPoints(node, xy)` mutator for P8-4.
- Core registry/load/player: `point` value type, two-number tuples, fractional signed interpolation
  and tuple-preserving public values. At this HEAD arrays previously meant RGBA, with rounding,
  clamping and hex formatting; the design's "existing tuple sampling" assumption did not hold.
- Core script and playground samples preserve tuple arrays. Web's `values()` return type expands.
- Core SVG: tooling-only `SVGBackend.checkStatic(player)`. Retained DOM never calls this, including
  verbose browser builds. Static triangle serialization stays in `@anima-format/core/mesh-static`.
- Bind calls its composed `this.expression` hook so mesh can add tuple expressions without changing
  the scalar parser. Components/data/events/nested have type assertions at colour serialization
  sites only; these emit no runtime code.
- CLI render imports the tooling-only serializer and passes `meshTriangles: true`.
- Markup corpus count 619 → 621, exact field lists include mesh, independent spelling census reads
  the mesh probe. The mesh manifest owns these integration tests.
- Canvas corpus recognizes mesh's static rejection and sparse geometry. Exact mesh pixels are
  compared against CLI triangles in the mesh suite, rather than at the older circular probes'
  fixed sample coordinates. No canvas runtime source or pixel tolerance changed.
- Generated module adapters/exports/tables, schema and own parity mappings were regenerated.

All non-generated seams carry `seam(P8-5)` comments. No rig files are used or changed.

## Verification

- `npm ci`: pass (153 packages; existing 10 moderate audit findings; dependency files unchanged).
- `npm run test:scope -- mesh --browser=chromium`: 1,386 pass / 630 filtered, 6 files before adding
  the census to scope. Firefox equivalent: 1,386 pass / 630 filtered, 6 files. Both engines cover
  reverse module arrival, canvas versus CLI at four times, and exactly one SVG fallback warning.
- Current isolated core mesh + spelling census: **73/73 pass**, 2 files; census alone 51/51.
- Canvas mesh corpus isolation after integration fixes: **5 pass / 2,587 filtered**.
- Initial broad `mesh canvas conformance oracle --browser=chromium`: **3,816 pass, 12 fail,
  1,306 skipped, 24 TODO**, 13 files. Five real failures exposed static-SVG/corpus assumptions
  (fixed and isolated above); four were 15 s timeouts, one a detached screenshot after a timeout,
  two 5 s browser perf timeouts. See `verification/scope-chromium.txt`.
- Initial Firefox setup and isolated retry both timed out (30 s setup; retry also 10 s teardown).
  Bundle preparation was moved outside timed hooks and reused across engines; no timeout or pixel
  tolerance was raised. Corrected engine suites pass as above.
- An asset-clamp assertion failed during a contended default changed run; isolated selection passes
  **2/2** (8 and 8.1 boxes). Unbounded changed attempts were interrupted after real integration
  findings or heavy swapping (12 detected CPUs). These are not counted as green checks.
- The two-CPU changed attempt found two stale standalone-demo cache failures; after rebuilding all
  77 entries, the isolated demo selection passes **2/2**, covering both engines (104 filtered).
- One subsequent tool-session test run received SIGTERM before a summary: no result claimed.
  The final two-worker run is tracked at `verification/changed-recorded.txt` and
  `verification/changed-recorded.status`; **pending**. Do not edit sources while status is absent.
- `npm run typecheck`, `npm run lint` (including resumed lint): pass.
- `node tools/modules.ts --check`, `node tools/parity.ts --check`: pass;
  `node tools/build-animl.ts --check`: 680 sources checked, pre-existing pending probes reported.
- Changed-file Prettier and `git diff --check`: pass, final staged check pending.
- CLI `validate flag.animl`, `schema image`, `render flag.ani --at 0.5`: pass.
- `node tools/oracle.ts --strict`: exit 0 for existing gated cases; its existing accepted findings
  remain findings. New probes retain TODO markers for orchestrator-owned promotion.
- `node tools/perf.ts`: exit 0. Shared-load report only: bell compile 15.25 ms, prefix sweep
  5,027 ms; frame bell 209.9 µs, composite 94.3 µs, toolbar 185.8 µs; toolbar compile 38.02 ms.
  These timings do **not** establish the ≤3% guard.

## Sizes

Before-entry values were measured with a read-only esbuild overlay of the original HEAD, using
identical terse/minifier/gzip-9 settings. Other before values are the shared design baseline.
Latest frozen runtime measurement: `verification/size-complete.txt`, exit **1 solely for mesh**.

| Entry | Before B | After B | Budget B |
| --- | ---: | ---: | ---: |
| mesh | absent | 1,323 | 1,024 (**299 over**) |
| canvas-mesh | absent | 678 | 768 |
| canvas | 5,864 | 5,862 | 5,888 |
| bind | 1,881 | 1,880 | 2,048 |
| components | 3,453 | 3,456 | 3,456 |
| data | 6,644 | 6,643 | 7,040 |
| events | 2,936 | 2,940 | 3,264 |
| nested | 4,565 | 4,569 | 5,056 |

Type-only compatibility edits emit no new module code; incremental gzip varies with the shared
base. Canvas and markup runtime sources are unchanged. CLI/playground/script are unbudgeted tools.

| Owner gate | Before B | After B | Ceiling B |
| --- | ---: | ---: | ---: |
| core + web | 22,782 | 22,799 | 24,576 |
| largest scene (30 scenes) | 57,781 | 57,796 | 65,536 |
| app-UI | 107,899 | 107,912 | 131,072 |
| runtime sum | 135,579 | 135,592 | 163,840 |
| authoring | 15,017 | 15,014 | 16,384; P8 cap 15,872 |
| Rive-class | 155,805 | 157,823 | 256,000 |

All six owner ceilings pass. The additional P8 **zero-growth** core+web requirement misses by 17 B.

## Native raw results

Original 87 B texture generated by committed `test/fixtures/generate.ts`. Native scenes use
12 px/unit, 240×240 opaque white artboards, bilinear sampling; capture code deletes transient
binaries without reading them. First capture used the wrong native asset sampler enum (nearest);
corrected to bilinear before these final measurements. No thresholds were selected or widened.

| Probe / time | Maximum channel delta | Pixels over 16 | Percent |
| --- | ---: | ---: | ---: |
| mesh / 0 | 53 | 192 | 0.333333 |
| animation / 0 | 73 | 156 | 0.270833 |
| animation / 0.25 | 81 | 230 | 0.399306 |
| animation / 0.5 | 82 | 225 | 0.390625 |
| animation / 1 | 73 | 156 | 0.270833 |

Canvas/CLI comparisons in both engines: maxima 53–63, over-16 percentage 0.2726–0.4271,
within the existing 128 / 0.5% path-geometry tolerance. Raw JSON is committed alongside this report.

## Deviations and problems

- Generic JSON-valued AniML `mesh` attributes, as allowed by the shared brief; track tuples use
  quoted JSON literals (`0 "[10,5]"`) decoded by mesh. No compiler/runtime markup growth.
- Module-owned static serializer wrapper plus the small static-check seam keeps triangle tooling
  out of web entries. Default static SVG explicitly rejects mesh; browser SVG falls back and warns.
- Grid counts bounded to 1..128 cells per axis. Generated UVs may exceed 0..1 for letterboxing;
  explicit UVs remain restricted to 0..1. Untracked grid points follow image width/height.
- Tuple infrastructure required extra seams and 17 B in core+web. Mesh remains 299 B over its
  entry budget. No budget was raised. These are explicit integration decisions for the orchestrator;
  neither row is claimed done. Combined skin/rig tests belong to P8-4 and are not claimed here.

## Checkpoints

- 2026-11-09: branched `p8-5` from the requested HEAD; installed dependencies; scaffolded both rows.
- 2026-11-09: implemented grid/explicit meshes, point sampling/binding, draw data, static triangles,
  retained fallback, canvas dilation/readiness/cache, independent expectations and original probes.
- 2026-11-09: fixed fixture/census and static-corpus integration failures; engine suites pass.
- 2026-11-09 12:30 UTC: resumed after usage limit; intact worktree, no backup restoration needed.
- 2026-11-09 12:42 UTC: refreshed browser cache and verified both stale-demo failures in isolation.
- 2026-11-09 12:47 UTC: final recorded two-worker changed run started, launcher PID 328084.
- Resume checkpoint: the recorded full run completed with **10,343 pass, 3 failures, 36 TODO** across 415 files (400 pass, 3 fail, 12 skipped). Failures: unknown-feature fixture still used the now-supported mesh name; independent decompiler reader treated tuple binding text as JSON; separately bundled paint/bind collision test. The first two are corrected in this checkpoint; the third passes its isolated rerun (1/1, 8 filtered). Integration with current p8-rigging is next, per the user's instruction.
- Integration checkpoint: committed implementation as `aac2fb3b`, then merged `p8-rigging` at `f28a1ac6` (P8-9, P8-6, P8-8 and docs refresh). Kept both SPEC chapters and both census fixtures, regenerated shared wiring/schema/parity/browser outputs, and set corpus length to **634**, equal to the actual `.ani` count. Recovery tests pass **1,922/1,922**. Final verification below supersedes pre-merge measurements and test results.
- Post-merge integration: posepad's overlay value printer needed the same RGBA-versus-point distinction as Player. Added a one-line `seam(P8-5)` guard and a mesh-owned regression posing a vertex tuple; **52/52 mesh/posepad tests pass**. This is an additional runtime compatibility seam in `modules/posepad/core/index.ts`; final size measurements will include it. Pre-fix merged typecheck found this error; merged lint/oracle/perf commands exited 0.
