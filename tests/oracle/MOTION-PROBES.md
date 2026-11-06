# P4b-2 motion probe dispositions

Local Rive CLI 1.9.0, headless EGL device renderer / 4x MSAA. Only local help,
docs, schema and command-runner invocations were used. No Rive source, account
operation, interactive preview or binary read/conversion was used. Capture scripts
remove generated `.riv` files without reading them. No documentation text is copied.

All 15 pending markers are resolved as six verified comparisons, eight documented
no-faithful-counterpart skips and one retained finding. A skip is not native parity.
The uint finding is not a verified comparison. No existing tolerance changed.

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
| animation-keys-unsigned-integer | finding | KeyFrameUint on CustomPropertyTrigger.propertyValue (uint), reverse-bound into VM number. At 0/0.5 s both 0; at 1.1/2 s native dump -1, Anima 4294967295, absolute delta 4294967296, tolerance 0. |

## Uint finding and test status

The native schema declares the keyed property uint and accepts 4294967295; the
exported *number* dump nevertheless reports -1. This suggests a signed conversion
in the data-binding observation path; it does not prove the native uint storage
itself is wrong. Neither reference nor Anima value is adjusted to conceal it.
Raw native JSON, the authored scene and exact measurements remain committed.

The oracle comparison for this case uses Vitest's explicit `it.fails` annotation.
A separate ordinary test requires the precise actual/reference/delta observations,
so an infrastructure error cannot substitute for this known numerical finding.
`node tools/oracle.ts --strict` still exits 1. A green scoped suite therefore does
**not** mean all native comparisons pass; it includes one expected failure.

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
write metrics and reproduce the uint failure. `times` names captures; for scripted
mix/seek/scrub probes it is a sample label, not elapsed source-animation time. Their
exact command sequences and per-capture Anima scripts are committed.

Run `npm run test:scope -- motion oracle conformance` for the scoped suite, including
Chromium/Firefox host tests. This task changes tests and oracle bookkeeping only;
it does not change motion runtime semantics or claim P4b phase completion.
