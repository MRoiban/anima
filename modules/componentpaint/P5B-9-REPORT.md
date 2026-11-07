# P5b-9 — draw lifecycle and live component paint

Status: implemented in the owned runtime/authoring scope. Branch
`t3/fix-nested-draw-tree-component-paint`, baseline `f17f481`; local commit only, no push/PR/merge.
Central oracle registration remains a parent integration step because `tests/oracle/cases.json`
is a protected measurement input. No parity status, test timeout, budget, tolerance or oracle
threshold was loosened. The P5b phase is not promoted.

## Canvas failure and its correction

The immediate CI trigger was replaying a player's dynamic model. The canvas harness first loads
an icon and then passes `icon.player.model` to `runScript`, which constructs another Player.
That model's tree already contained the first player's allocated slots, while the new player's
mapping/frame arrays started empty. New allocations followed the inherited slots: the leaf-fit
probe had five slots with missing frame records at indices 1 and 2. SVG could also encounter these
records during its retained-tree refresh. The renderer's dense traversal exposed the producer bug.
The initial browser repro failed 12/12 selected snapshots in both engines.

`nested` now remembers each dynamic tree's document origin and original after-step hook. Every
new player clones that origin, including replay of another player's model. Allocations create
complete hidden identity groups in both arrays. Retirement detaches the entry and replaces its
frame with a hidden neutral record, clearing old masks/clips/paints. The renderer still indexes
all allocated slots; no missing-node fallback was added.

Independent review found a second reuse defect: a free stack can allocate child indices in
reverse order. Falling back to destination indices reversed two overlapping authored paints,
even though SVG/canvas comparison alone could pass because both were wrong. Remapping now writes
the child's resolved rank, or its authored child index. Seven core lifecycle regressions cover
the five reported documents, empty/unequal/masked choices and order reuse. A new exact-pixel test
checks blue remains above red through row→box→row in SVG and canvas in both engines: two tests,
twelve opaque-blue interior samples. The former failing 24 browser snapshots pass; Chromium's
stateful-output AA maximum 30/4 pixels over 16 remains within the unchanged 128/0.5% limit. Other
repaired cases are max0, except Firefox stateful-output max1.

The dense-slot and remapping rules are explicit in `spec/MODULES.md` §3.1. This keeps graph ownership
in the producer and the two backends on one draw layer, following the explicit relationship and
retained-scene guidance in `docs/research/rive-format-and-graph.md` §6.

## Component paint

The optional lowercase `componentpaint` module implements JSON `fill.paint: "component:row"`
and AniML `paint="component:row"`, with `components paint componentpaint` declared. The registry,
CLI schema/validate/inspect/sample, compiled example pairs and generated adapters/schema are
covered. The normative contract is [README.md](README.md), linked from `spec/SPEC.md`.

Each consuming fill owns an independent child Player. Its default machine advances once per
parent step, inherits reduced motion and keeps the parent awake while animating. Values/states
are inspectable as `shape/paint/address`. Sources retain independent resources, masks, gradients,
child order and dynamic nested trees. Paint source players receive no pointer routing or outward
event bubbling. A player-owned model preserves the parent's resolved asset URLs.

SVG uses a namespaced pattern with a clipped source viewport. Canvas has an optional source-hook
array on the active host constructor; it draws the resolved frame to an offscreen canvas, saves
and restores render state/surface dimensions, and returns a pattern. No SVG rasterization or
second animation implementation is used. The ordinary core+web entry gains zero bytes. The paint
module changes only the source validation/markup seam: the source supplies its own color, while
unrelated gradient fields retain the original validation. SVG also honors per-fill visibility. Backend limitations retain
`unsupported-render`; tests cover an angular SVG source and canvas fixed-stroke trim, including
two distinct consuming JSON pointers and messages/hints.

Wire choices made explicit where §7 did not specify them: the viewBox is a repeating tile in
shape-local grid units, including its origin, with no implicit stretch to shape bounds. An
ordinary stroke remains independent; competing color/type/ordered-paint sources are diagnosed.
The name is `componentpaint` because module registration/scaffolding requires lowercase letters.
Source loading uses its dependency closure to avoid falsely treating unrelated definitions as
recursive sources. Invalid definition wrappers retain the existing components diagnostic instead
of throwing. These choices and renderer lifetime follow `docs/research/rive-web-runtime.md`.

## Independent and native evidence

The new conformance document has three independently authored snapshots: time0/.5/1,
source bar.x 0/3/6, source state move, settled false/false/true, and no outward events. Expected
values were not sampled from Anima. The canvas corpus also exercises eight source variants:
gradient, nested, opacity, clip, paint-in-paint, two owners, source order and hidden fill. All eleven new source
frames per engine compare at max 0/over 0 under the existing strict flat-fill max2/0% classifier.

Fresh local Rive CLI captures are in [oracle/live](oracle/live). The authored PaintImage uses an
artboard source, native-size repeat and its default state machine. Native original-size paints
are centered; the Anima counterpart uses viewBox(-5,-5,10,10). Across t0/.5/1, every one of 400
pixels per frame matches the analytic Anima expectation exactly; native maximum channel delta
is 1 from rasterizer color dithering, with zero channels over 16. There is no skipped native
counterpart or adjusted threshold. The module oracle tests all three retained PNGs. Source,
commands, replay driver and measured results are committed; no native binary or scaffold docs.

The canonical pending marker points to this completed module evidence. It is retained solely
for parent-owned manifest registration; it is not reported as a central oracle pass. All 1,238
parity statuses remain unchanged, and 3,910 existing oracle files are unchanged by git, excluding
the pending marker/README clarification. Protected runtime/CLI/measurement paths are unchanged.

## Verification

Raw command output is in [verification](verification). All final checks exit0.

| Command / evidence | Result |
|---|---|
| Requested scope plus componentpaint | 5,687 passed,31 existing TODOs;47 files including all7 owned browser files;506.61s |
| Explicit canvas browser directory, both engines | 2,270 passed;401.84s; same files also pass in the final requested scope |
| Latest focused source/paint unit+CLI suite | 98 passed, including malformed-wrapper/gradient-field validation and hidden fill |
| Component CLI / separate-bundle browser suites | 3 /12 passed |
| Nested lifecycle / exact reuse pixel regression | 7 /2 passed |
| `node tools/oracle.ts --strict` | 253 cases /449 passing samples; existing23 finding cases /26 samples retained; exit0 |
| Typecheck, ESLint, Prettier | Pass |
| Module/AniML/web/parity checks | Current;476 AniML files,33 browser entries,1,238 statuses unchanged |

The final requested scope and explicit canvas run use the final source and include every new
regression. All seven browser files executed. Earlier cached-worker failures are retained under
verification/initial. The final source/paint focused run passes98 tests and22 pixel cases.

| Entry | Final min+gzip B | Unchanged limit B |
|---|---:|---:|
| core+web | 20,362 | 30,720 |
| nested | 4,514 | 5,120 |
| components (source untouched) | 4,051 | 4,096 |
| paint | 4,632 | 5,120 |
| paint-sampling | 933 | 1,024 |
| canvas | 5,255 | 8,192 |
| componentpaint (new) | 1,968 | 5,120 |
| full-featured | 111,159 | 131,072 |
| Rive-class | 116,670 | 256,000 |

Final perf exits0: bell compile 2.97ms;9,040 prefixes 786ms; bell frame 51.0µs, composite 38.4µs,
toolbar 41.1µs and toolbar compile 4.72ms. These are shared-machine measurements. Controlled
baseline/current performance non-regression is **unverified**.

## Failures, limits and handoff

Recorded development failures were fixed at their causes: the replay holes, stale retired mask
state, reversed reused paint order, initial SVG pattern origin and unloaded nested source tree,
false dependency recursion, and malformed definition wrapper iteration. A native capture first
put the background above the bar; the authored native order was corrected and recaptured, not
normalized through a pixel tolerance. New test expectations were corrected for the existing
negative-zero matrix and loader-owned undeclared-component pointer. The two corpus census
assertions were extended 433→434 and 42→44, retaining all previous cases.

Cold optional bundles/concurrent loaded runs hit existing 5s/10s limits; prebuilding the unchanged
browser artifacts resolved setup cost without raising limits. One broad run saw two new tests
against an already-cached earlier module; a fresh process passed. Another intermediate scope was
interrupted after the independent reuse-order probe found the real order defect. The final broad
scope is green. ESLint raced the size tool's temporary entry; serialized rerun passed. Raw browser
metrics triggered Prettier; measurements were retained as compact JSON text (deep equality checked) before removing
generated JSON outputs. An audit's default stdout buffer was too small for the inventory; file redirection fixed
the audit, with no measurement-tool setting changed. Representative failures are retained in
`verification/initial`.

Remaining integration: register the new native case in the protected central manifest and perform
phase promotion/PR/merge in the parent. No public repository/package/Glyphy action was taken.
The exact Rive quantization boundary finding remains unchanged. No full-suite or comparative
performance claim beyond the commands above is made.
