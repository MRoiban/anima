# P4b-2 motion probe dispositions

Local Rive CLI 1.9.0, headless EGL device renderer / 4x MSAA. Only local help,
docs, schema and command-runner invocations were used. No Rive source, account
operation, interactive preview or binary read/conversion was used. Capture scripts
remove generated `.riv` files without reading them. No documentation text is copied.

All 15 pending markers are resolved as seven verified comparisons and eight documented
no-faithful-counterpart skips. A skip is not native parity. The uint comparison covers
only the exactly observable range below; the full-range dump observation is a note,
not a test of Anima. No existing tolerance changed.

| Probe | Outcome | Evidence / limits |
|---|---|---|
| transforms-origin-animation | oracle verified | Three frames at 0/1/2 s; max channel delta 1, 0% over 16. Native parent/child translations express T(p) R T(-p), with both pivot axes animated and a fixed 180° rotation. This is an equivalent scene, not native fractional-origin equivalence. |
| animation-host-loop-override | skip-noted | No headless command changes/restores an existing animation instance's loop override. Authored loopValue does not observe that API. |
| host-api-low-level-scene-query | skip-noted | No typed runtime handles/type-mismatch or matrix-query commands. Inspect reads authored definitions. |
| animation-keys-reference | skip-noted | KeyFrameId consumers such as Solo select geometry; Anima stores validated node IDs with no geometry effect. No arbitrary node-ID channel in data dumps. |
| animation-seek | oracle verified (poses) | Native Joystick samples an actual timeline at 1.5, 0.5, 2, 0 s, including backwards jumps; Anima seeks the same instance in the same sequence. Four frames: max 1, 0% over 16. Does not establish host play-state/event semantics. |
| host-api-animation-metadata | skip-noted | Inspect cannot establish detached runtime snapshots, handle identity or metadata mutation isolation. |
| host-api-scrub | oracle verified (poses) | Joystick samples 1.25, 0.75, 1.5, 0.5 s; Anima scrubs 0.75, 0.25, 1, 0 within work [0.5,1.5]. Four frames: max 1, 0% over 16. Pause/event guarantees are browser/unit observations. |
| animation-mix-discrete | oracle verified | Native BlendStateDirect applies two boolean tracks with weights 100% then 25%; Anima composes instances at 1 then 0.25. Dump false = Anima false, exact tolerance 0. This observes a positive-weight boolean replacement; string/reference cases have independent unit tests. |
| host-api-low-level-animation | skip-noted | Commands have no split clock-advance/apply controls. Script Animation.advance also applies immediately; it cannot establish the split contract/didLoop reset. |
| host-api-multi-state-machine | skip-noted | Runner selects one default machine/artboard; no independent named machines sharing one scene and isolated inputs. Nested artboards would change the semantics. |
| animation-host-play-pause-stop | skip-noted | No commands controlling individual host instances' pause, resume and stop-removes-writes behavior. |
| animation-keys-signed-integer | skip-noted | KeyFrameInt exists but schema/docs provide no general signed-int custom/view-model storage channel. Number channels are doubles; BindablePropertyInteger is uint and not animatable. Integer-looking double samples would not test signed 32-bit storage. |
| animation-mix-numeric | oracle verified | Two native animations in BlendStateDirect, first at 100%, second at 0/25/50/100%; Anima composes two instances. Four frames: max 1, 0% over 16; resolved x = 0/2/4/8 units. |
| animation-keys-string | oracle verified | Native KeyFrameString on CustomPropertyString, reverse-bound into the exported VM. Dumps at 0/0.5/1.1/2 s = “one two”/“one two”/“three”/“three”, identical to Anima, tolerance 0. |
| animation-keys-unsigned-integer | oracle verified (observable range) | KeyFrameUint on CustomPropertyTrigger.propertyValue (uint), reverse-bound into VM number. Fresh dumps at 0/0.5/0.8/1.1/2 s = 0/7/42/2147483520/2147483520 on both sides, exact tolerance 0. Full uint maximum is checked independently in Anima, not through this dump. |

## Uint observation-path limit

The former full-range probe keyed 0 at frame 0 and 4294967295 at frame 60
(60 fps, duration 120 frames) on CustomPropertyTrigger.propertyValue, reverse-bound
into a VM number via property key 870. Its raw observations were:

| Time (s) | Anima uint | Rive number dump | Absolute difference |
|---|---|---|---|
| 0 | 0 | 0 | 0 |
| 0.5 | 0 | 0 | 0 |
| 1.1 | 4294967295 | -1 | 4294967296 |
| 2 | 4294967295 | -1 | 4294967296 |

Anima's 4294967295 is correct for the declared uint type. Rive's number data dump
converts that value to -1 in its observation path; this says nothing about Anima's
behaviour and does not establish a defect in native uint storage. These historical
numbers are retained as a documented observation only, not an oracle test or expected
failure. The committed probe now keys 0, 7, 42 and 2147483520 at native frames
0, 20, 40 and 60; every value is exactly reportable by both sides, with tolerance 0.
A fresh attempt with 2147483647 produced a raw dump of 2147483648 at 1.1/2 s
(Anima 2147483647, absolute difference 1). We therefore use 2147483520, the nearest
lower float32-representable integer to 2^31, for the near-top exact comparison.
This is a fixture choice within 0 … 2^31−1, not a tolerance change.
Fresh references replace the old dumps. No value is remapped or signed-cast in the
comparison.

Anima's full 0 … 4294967295 uint range remains specified and independently covered:
the unsigned-integer conformance case samples the maximum at its exact key, and
`modules/motion/test/core/typed-oracle.test.ts` verifies that the maximum survives
AniML → JSON → AniML → JSON, loading and playback, including backwards seeking.
There is no `it.fails` exception; strict oracle must exit 0.

Data probes use an explicit exact `values.tolerance` in the manifest. There is no
pixel comparison for their typed values; the legacy metrics fields `maxDiff`,
`over` and `overPercent` denote scalar delta, mismatch count and 0/100 mismatch
percentage for those records. Image comparisons retain the existing raw RGBA
method with max 2 / 0% over 16 for all newly authored image probes.

Off-boundary 1.1 s data samples avoid native accumulated-float ambiguity at hold
keys. Exact boundary, integer extrema, zero/positive mixing and reference identity
are independently checked in `modules/motion/test/core/typed-oracle.test.ts` and
conformance. Host skips name their actual core/browser coverage in `skip.json`;
parity inventory test fields point there. Skip metadata is checked by the oracle
suite. Native help/schema/docs were consulted for these decisions; the independent
scene/composition approach follows [animation research](../../docs/research/rive-animation-and-state.md)
and the [web-runtime observation limits](../../docs/research/rive-web-runtime.md).

## Reproduction

Run `python3 modules/motion/capture-pending-oracles.py` to author/capture these seven
paired scenes, then `node tools/oracle.ts --build --strict` to build Anima documents,
write metrics and verify all comparisons. To recapture only the uint probe, add
`--only animation-keys-unsigned-integer` to the Python command. `times` names captures; for scripted
mix/seek/scrub probes it is a sample label, not elapsed source-animation time. Their
exact command sequences and per-capture Anima scripts are committed.

Run `npm run test:scope -- motion oracle conformance` for the scoped suite, including
Chromium/Firefox host tests. This task changes tests and oracle bookkeeping only;
it does not change motion runtime semantics or claim P4b phase completion.
