# P8-5 final implementation report

## Status and branch

**Partial.** Functional image meshes, animation/binding, canvas drawing, static triangles and
original probes are committed. Entry budgets and the zero-growth guard are not met.
Branch `p8-5`; implementation checkpoint `aac2fb3b`, merge `5f7cd04e`, interoperability
`f9b2250e`, verification checkpoint `b6396029`. No push, PR or publication.
Merged `p8-rigging` through **f28a1ac6**, including P8-9, P8-6 and P8-8, before final verification.

## Rows

Closed: **none**. `rigging.mesh` and `rigging.mesh-animation` remain planned pending size closure,
the shared-core zero-growth decision and orchestrator-owned oracle promotion. Native captures and
raw measurements are present; neither oracle thresholds nor `cases.json` were changed by this ticket.

## Seams outside ticket files

All non-generated seams are marked `seam(P8-5)`.

- Core draw: type-only `DrawNode.mesh`; Player: optional `skinPoints(node, xy)` mutator for P8-4.
- Core registry/load/player: `point` value type, two-number tuples, fractional signed interpolation
  and tuple-preserving public values. This HEAD had only RGBA array sampling, rounding/clamping
  arrays and formatting them as hex; the design's existing-tuple assumption did not hold.
- Core script, web value types and playground samples preserve tuples. Components/data/events/nested
  have colour-boundary type assertions only, with no emitted module-code growth.
- Bind invokes its composed `this.expression` hook; mesh supplies tuple expressions without changing
  the scalar parser. Posepad's value printer distinguishes point arrays from RGBA arrays.
- Core SVG adds tooling-only `SVGBackend.checkStatic(player)`, never used by retained DOM. CLI render
  imports `@anima-format/core/mesh-static` and enables `meshTriangles: true`.
- Markup spelling/decompiler readers and corpus count account for mesh; the independent reader
  preserves binding expression text. The unknown-feature fixture now uses an unregistered sentinel.
- Canvas corpus recognizes mesh's static rejection and sparse geometry; module-owned pixel tests
  compare the mesh against CLI triangles. No canvas runtime or pixel tolerance changed.
- Shared adapters/exports/tables/schema and own parity mappings were regenerated.

No rig files are used or changed. Skin/rig integration tests belong to P8-4.

## Final verification

Sources were frozen at the committed interoperability checkpoint; test workers were limited to two.

| Command/check | Result |
| --- | --- |
| `npm ci` | Pass; no dependency changes |
| `npm run test:scope -- mesh canvas conformance oracle --browser=chromium` | 5,860 pass, 1 fail, 1,330 filtered, 25 TODO; 15 files |
| `npm run test:scope -- mesh --browser=firefox` | 3,378 pass, 644 filtered; 8 files |
| `npm run test:scope -- changed` | 10,535 pass, 3 fail, 37 TODO; 408 files pass, 1 fails, 12 filtered |
| Mesh + posepad integration | 52/52 pass, including a posed vertex tuple |
| Invalid-loader + independent decompiler recovery | 1,922/1,922 pass |
| Current mesh + spelling census (pre-merge) | 73/73 pass |
| Full typecheck / lint | Both pass on merged sources |
| Module / parity generated checks | Pass |
| AniML generated check | 697 sources checked; existing pending probes reported |
| Corpus count | Assertion **634** = actual `.ani` count **634** |
| CLI validate / image schema / flag render | Pass |
| Strict existing oracle check | Exit 0; new mesh probes intentionally pending promotion |
| Size tool | Exit 1; three entry overruns below |
| Perf tool | Exit 0; shared-load report only, not a ≤3% A/B proof |

The acceptance failure is inherited `a11y-tree-bounds-feather`: Canvas explicitly rejects nonuniform
local feather at `/nodes/0/fill`. It reproduces alone (1 fail / 2,639 filtered), maximum delta 247,
691 pixels over 16 (1.19965%). The full canvas run also reports this in Firefox and a Firefox
`a11y-tree-bounds-clip` comparison failure; the clip reproduces alone: max 64, 52 pixels over 16
(0.090278%), against the existing flat-geometry limit 2 / 0%. Neither foreign probe nor tolerance
was changed. These are all three failures in the completed aggregate run; other selected tests pass.

Earlier full pre-merge changed run: 10,343 pass / 3 failures / 36 TODO. Two fixture assumptions
(unknown feature named mesh; bracket binding parsed as JSON) were fixed and recovery tests pass.
The separate-dist bundle test passes isolation (1/1). Stale demo cache failures passed isolation
in both engines after rebuilding (2/2). Initial contended Firefox setup and isolated retry timed
out; moving bundle preparation out of timed hooks produced passing engine suites. No timeout or
pixel tolerance was raised. Earlier interrupted/unbounded runs are not counted as green checks.

## Entry sizes

Read-only baseline overlay is merged `p8-rigging` **f28a1ac6**, using identical production
minifier and gzip-9 settings. New entries were absent. Latest: `verification/size-final-merged.txt`.

| Entry | Before B | After B | Budget B |
| --- | ---: | ---: | ---: |
| mesh | absent | 1,325 | 1,024 — **301 over** |
| canvas-mesh | absent | 678 | 768 |
| canvas | 5,863 | 5,862 | 5,888 |
| bind | 1,880 | 1,880 | 2,048 |
| components | 3,453 | 3,457 | 3,456 — **1 over** |
| data | 6,643 | 6,643 | 7,040 |
| events | 2,937 | 2,942 | 3,264 |
| nested | 4,567 | 4,572 | 5,056 |
| posepad | 766 | 772 | 768 — **4 over** |
| core + web | 22,787 | 22,803 | P8 zero-growth guard missed by **16 B** |

Type-only compatibility edits emit no module code; incremental gzip also varies with the shared
base. Canvas and markup runtime sources are unchanged. CLI/playground/script are unbudgeted tools.
No budget was raised.

## All six owner gates

Before is the shared design baseline; after includes merged P8-9/P8-6/P8-8 and this ticket.
All owner ceilings pass despite the entry and additional zero-growth failures above.

| Gate | Before B | After B | Ceiling B |
| --- | ---: | ---: | ---: |
| core + web | 22,782 | 22,803 | 24,576 |
| largest scene (31 scenes after merge) | 57,781 | 59,373 | 65,536 |
| app-UI | 107,899 | 108,098 | 131,072 |
| runtime sum | 135,579 | 137,361 | 163,840 |
| authoring | 15,017 | 15,016 | 16,384; P8 cap 15,872 |
| Rive-class | 155,805 | 160,779 | 256,000 |

## Native evidence and design deviations

The committed generator creates the original **87 B** flag texture. Native scenes use 12 px/unit,
240×240 opaque white artboards and bilinear sampling. Capture code deletes transient binaries
without reading them. Raw values below are not new tolerances; promotion belongs to the orchestrator.

| Probe / time | Maximum delta | Pixels over 16 | Percent |
| --- | ---: | ---: | ---: |
| mesh / 0 | 53 | 192 | 0.333333 |
| animation / 0 | 73 | 156 | 0.270833 |
| animation / 0.25 | 81 | 230 | 0.399306 |
| animation / 0.5 | 82 | 225 | 0.390625 |
| animation / 1 | 73 | 156 | 0.270833 |

Both engines' mesh/CLI comparisons: max 53–63, over-16 percentage 0.2726–0.4271, within the existing
128 / 0.5% path-geometry tolerance. First native capture used the wrong sampler enum; it was
corrected to bilinear before these final measurements.

- Generic JSON-valued AniML `mesh` attributes, as the shared brief permits. Track tuples use quoted
  JSON literals (`0 "[10,5]"`) decoded by mesh; no compiler/runtime markup growth.
- Module-owned static serializer wrapper and static-check seam keep triangle tooling out of web
  entries. Default tooling SVG rejects mesh; browser SVG falls back and warns once per node/player.
- Grid counts are 1..128 cells per axis. Generated UVs may exceed 0..1 for letterboxing; explicit
  UVs remain 0..1. Untracked grid points follow image width/height.
- Additional tuple infrastructure and posepad interoperability are necessary for actual point
  values. They add 16 B to the shared base and contribute to the stated entry-size failures.

## Problems and checkpoints

Remaining: three entry overruns, the 16 B zero-growth miss, orchestrator oracle promotion, and
inherited canvas feather/clip failures. No full-parity or controlled performance claim is made.
Merged perf: bell compile 4.86 ms; 9,040-prefix sweep 1,016 ms; frame bell 50.1 µs,
composite 32.9 µs, toolbar 34.1 µs; toolbar compile 4.73 ms.

- 2026-11-09: scaffolded both rows, implemented/probed meshes and original captures.
- 2026-11-09: corrected fixture/census/static-corpus integration issues and verified both engines.
- 2026-11-09: implementation checkpoint `aac2fb3b`; merged P8 at `5f7cd04e`, corpus 634.
- 2026-11-09: posepad point compatibility checkpoint `f9b2250e` (52 passing integration tests).
- 2026-11-09: completed verification checkpoint `b6396029`; final aggregate run completed, exit 1, with the three inherited canvas failures above.
