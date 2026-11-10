# P8 design: rigging (bones, constraints, IK, skins, meshes, pose pads, scroll)

Decided by the design lead (2026-11-09) for the 26 P8 rows (25 `rig` rows and `a11y.tree-bounds`)
and two carry-overs without rows: R4-02 (hits and pointer focus follow the painted order) and the
pre-player `icon.toggle()` queue. Within the owner's gates, "heavy modules on the canvas backend",
internal path measurement and the standing rules. Revisitable choices: `DECISIONS.md` (D1…).
Coders implement this; a needed deviation is raised with its reason.

## 1. Targets and guards

| Metric | Command | Baseline (main c2b870ae, 2026-11-09) | Target / guard |
|---|---|---:|---|
| core + web | `node tools/size.ts` | 22,782 B | ≤ 24,576 B; rigging adds **0 B**; the toggle queue ≤ 32 B |
| each scene | `node tools/size.ts` | largest 57,781 B | ≤ 65,536 B; benchmark rig scene expected ≈ 45 KB |
| app-UI scene | `node tools/size.ts` | 107,899 B | ≤ 131,072 B; unchanged (no rig module in `APP_UI`) |
| runtime sum | `node tools/size.ts` | 135,579 B | ≤ 163,840 B; rig entries are `heavy`: + carry-overs only (≤ 1,856 B) |
| authoring add-on | `node tools/size.ts` | 15,017 B | ≤ 15,872 B (my cap; owner ceiling 16,384) |
| Rive-class | `node tools/size.ts` | 155,805 B | ≤ 256,000 B; expected ≈ 166.2 KB (+10,368 B) |
| full entries | `node tools/size.ts` | canvas 5,864/5,888, focus 3,374/3,456, components 3,453/3,456, markup-hooks 4,523/4,544 | no growth; mesh drawing gets its own entry |
| frame / compile cost without rig | perf A/B vs main (WORKLOG method: pinned, alternating, minimums) | — | within noise (≤ 3 %); bell compile with the CLI's full registry too |
| rig frame cost | `anima bench` on the module examples | — | reported; a skinned scene ≤ 2× its unskinned twin (step + draw median) |
| benchmark | §9 | — | AniML ≥ Rive on the rig brief; earlier briefs: "no change" (no shared module touched) |

## 2. Modules and budgets

Module names have no hyphens (`node tools/new-capability.ts` rejects them). Every runtime entry is
`heavy: true` (Rive-class, outside the runtime sum and app-UI) and adds nothing to core + web.

| Module / entry | Class | Holds | Budget |
|---|---|---|---:|
| `rig` / `rig` | runtime, heavy | `bone` nodes (root and chained), rest frames, world solve with dependency order and cycle check, the `constraints` field, ordered composition and strength, `copyPosition`, `copyRotation`, `copyScale`, `copyTransform`, `keepDistance` (3 modes), derived `world.*` / `tip.*` addresses, the constraint-kind API (§5) | 3,072 B |
| `rig` / `markup-rig` | authoring | AniML spellings not derivable from the registry (bone and constraint child elements if the generic node-field path can't express them) | 384 B |
| `ik` / `ik` | runtime, heavy | the `ik` constraint: 1-bone aim, 2-bone analytic, n-bone iterative; `bend` | 896 B |
| `pathfollow` / `pathfollow` | runtime, heavy | internal path measurement (arc-length table, point + tangent at a fraction), `alongPath`, `spreadAlongPath` | 1,280 B |
| `skin` / `skin` | runtime, heavy | `skin` field on `path`/`contour`/meshed `image`, rest-pose binding, explicit and automatic weights, independent handle weights, deformed draw geometry and hit outlines | 1,536 B |
| `mesh` / `mesh` | runtime, heavy | `mesh` field on `image` (explicit or `grid`), vertex addresses, draw data, SVG fallback with `unsupported-render` | 1,024 B |
| `mesh` / `canvas-mesh` | runtime, heavy, over `canvas` | Canvas2D textured-triangle drawing through `canvasShapes` | 768 B |
| `posepad` / `posepad` | runtime, heavy | `posepad` nodes: two-axis timeline posing, invert, handle reading | 768 B |
| `scroll` / `scroll` | runtime, heavy | `scroll` and `scrollThumb` constraints (clamped offsets, drag/wheel, bindable, linked thumb) | 1,024 B |
| **sum (runtime, heavy)** | | | **10,368 B** |
| carry-overs | runtime | R4-02 in `input` (≤ 96 B), `focus` (≤ 64 B, needs a split if over), `composite` (≤ 160 B); a11y extents in `a11y-bounds` (1,416/4,096, ≤ 1,536 B growth); toggle queue in web | as stated |

`markup` (7,435 B) and the full markup entries must not grow; spellings that need code go in
`markup-rig` (P8-1 only). Other tickets use registry-generic spellings (JSON-valued attributes for
compound fields, the contour precedent) or stop and report.

## 3. The authoring model

```xml
<anima viewBox="0 0 40 30" requires="paint rig ik skin posepad input">
  <bone id="upper" x="8" y="20" length="9">                     <!-- root: starts at (x, y) -->
    <bone id="fore" length="8">                                 <!-- starts at the parent tip -->
      <ik target="aim" bones="2" bend="cw" strength="1"/>       <!-- strength animated on leave -->
      <circle id="hand" center="25 20" r="1.2" fill="#141413"/> <!-- rigid art, rest coordinates -->
    </bone>
  </bone>
  <path id="sleeve" d="M 8 19 L 25 19 L 25 21 L 8 21 Z" fill="#d97757">
    <skin bones="upper fore"/>                                  <!-- automatic weights -->
  </path>
  <group id="aim" x="30" y="10"/>                               <!-- a listener writes x/y -->
  <group id="eye" pivot="32 6"/>
  <circle id="pupil" center="32 6" r="0.6" pivot="32 6" fill="#141413">
    <copy-position from="aim"/>
    <keep-distance to="eye" distance="1" mode="within"/>        <!-- runs second: the gate -->
  </circle>
  <posepad id="look" timeline-x="lookAcross" timeline-y="lookUpDown" handle="pupil"
            box="31 5 2 2" invert-y="true"/>
</anima>
```

**Bones.** `type: "bone"`: `length` (≥ 0), `rotate` (degrees, clockwise on screen), `scaleX`/`scaleY`/
`scale` (animatable), `root` (static). A bone outside a bone is a root (starts at `(x, y)` in its
parent's grid coordinates); a bone inside a bone starts at the parent's tip with `rotate` relative to
the parent's direction (`x`/`y` there → `rig-bone-offset`) unless `root="true"` anchors a new chain at
`(x, y)` inside the moving parent (`rigging.root-bones`). `pivot` → `rig-bone-pivot`. Draws nothing.
**Rest-relative children:** art inside a bone stays authored in grid coordinates (Anima's no
re-origining rule, SPEC §4); a bone contributes to its children only its motion away from its rest
frame (`F(now) · F(rest)⁻¹`), so at rest every bone is the identity and Glyphy geometry is used as-is.

**Constraints.** Any transformable node (bones included) takes `constraints`: an ordered array, AniML
child elements. JSON `{kind, …}`; addresses `<node>.constraints.<k>.<prop>` (the `paints.<k>`
precedent). Every kind has `strength` (0..1, default 1, animatable and bindable). A node's
**position** is its pivot (a bone: its start) in world space; rotation and scale are the world
matrix's decomposition (`DECISIONS.md` D3).

| JSON `kind` / AniML | Fields (animatable in *italics*) | Rows |
|---|---|---|
| `copyPosition` / `<copy-position>` | `from` (absent → parent), *`factorX`/`factorY`* (negative mirrors), `copyX`/`copyY`, *`minX`/`maxX`/`minY`/`maxY`*, `offset`, `fromSpace`/`toSpace`/`limitSpace` (`world`\|`local`) | translation |
| `copyRotation` / `<copy-rotation>` | `from`, *`factor`*, *`min`/`max`* (degrees), `offset`, spaces | rotation |
| `copyScale` / `<copy-scale>` | as copyPosition, on scale axes | scale |
| `copyTransform` / `<copy-transform>` | `from` (required), *`origin`* `[u, v]` normalized over the node's rest bounds (default: the pivot), spaces | transform |
| `keepDistance` / `<keep-distance>` | `to` (required), *`distance`* (grid units), `mode` `within` (default, max radius) \| `beyond` (min radius) \| `exact` | distance-closer/-further/-exact |
| `ik` / `<ik>` | `target` (required), `bones` (chain length incl. this bone, default 1 = aim), `bend` `cw` (default) \| `ccw` | ik, ik-bend |
| `alongPath` / `<along-path>` | `path` (required; `path`, `contour`, `circle`, `rect`, `arc`), *`at`* (fraction of length; open paths clamp to 0..1, closed wrap), `orient`, `offset` | follow-path |
| `spreadAlongPath` / `<spread-along-path>` | `path`, *`start`* (0), *`end`* (1), *`shift`* (0), `orient`; child k of n (direct children, or a `repeat`'s items) at `start + (end − start)·k/max(n − 1, 1) + shift` | list-follow-path |
| `scroll` / `<scroll>` | `viewport` (node id), `axis` `x`\|`y`\|`both`, *`offsetX`/`offsetY`* (grid units, bindable), `interactive` (true); read-only `percentX`/`percentY` (0..1) | scroll |
| `scrollThumb` / `<scroll-thumb>` | `scroll` (content node id), `track` (node id), `axis`, `resize` (thumb length = track × viewport/content) | scroll |

`ik` sits on the tip bone and rewrites the rotations of its chain (`rig-ik-host` on a non-bone,
`rig-ik-chain` when `bones` exceeds the chain). `bend="cw"` puts the middle joint on the clockwise
side of the line from chain start to target as seen on screen; `ccw` is the opposite solution; a
negative-determinant ancestor mirrors it. Out of reach, the chain straightens toward the target.

**Skins and weights.** `skin: {bones: [ids], weights?: Weight[]}` on a `path` (inline `d` or
`glyph`), a `contour` or a meshed `image`. The bind pose is the bones' **rest** frames from the
document (no bind matrices to write; `DECISIONS.md` D6). Without `weights`, weights are automatic:
for each control point (anchors and cubic handles separately) the two nearest bone segments at rest
weigh `1/(d + 0.001)²`, normalized. Explicit `weights` lists one entry per point in order (path:
every M/L/C endpoint; contour: every vertex; mesh: every vertex), each an influence map
`{"upper": 0.5, "fore": 0.5}` or `{"point": {…}, "in": {…}, "out": {…}}` (cubic handles get their own
weights, `rigging.cubic-weights`; omitted handles follow their anchor). At most four bones per point
(`rig-weight-count`); `"@rest"` is the identity influence that holds part of a shape at its bind
position; sums off by > 1e-6 warn `rig-weight-sum` and are normalized. AniML: `<skin bones="a b"
weights='[…JSON…]'/>`. A skinned node ignores its own and its ancestors' animated transforms (the
bones move it); its stroke width follows its rest world scale. `skin` with an animated `d` is
`rig-skin-morph`.

**Meshes.** `mesh` on an `image`: `{grid: [cols, rows]}` (vertices over the box `x0 y0 width height`,
uv from the image's fit and align, so a rest mesh draws exactly like the unmeshed image) or
`{vertices: [[x, y, u, v], …], triangles: [[a, b, c], …]}` in node-local grid units, uv 0..1 of the
texture (`rig-mesh-index`, `rig-mesh-host`, `bad-value` for uv). AniML `<mesh grid="4 3"/>` or
`<mesh vertices='[…]' triangles='[…]'/>`. Each vertex is an animatable tuple address
`<image>.mesh.vertex.<k>` = `[x, y]` (`rigging.mesh-animation`, independent of bones); a `skin` on the
same image deforms the animated vertices. **Backends:** canvas draws textured triangles (`canvas-mesh`);
the browser SVG backend draws the undeformed image and reports `unsupported-render` (feature `mesh`,
pointer `/nodes/…/mesh`, hint `use renderer="canvas"`) once per node; static `toSVG` with
`meshTriangles: true` (the CLI's `render`, tooling only) emits one clipped affine `<image>` per
triangle, which is what the oracle compares.

**Pose pads.** `type: "posepad"` (AniML `<posepad>`; one lowercase word like every node type, D36), draws nothing: `timelineX`/`timelineY`
(timeline names, either optional), `valueX`/`valueY` (−1..1, clamped, animatable and bindable),
`invertX`/`invertY`, `handle` (node id) and `box` `[x0, y0, w, h]` in the pad's grid coordinates.
Value v maps to timeline time `(v' + 1)/2 · duration` with `v' = invert ? −v : v`; the pad writes
that timeline's sampled tracks over everything below (topmost writer). With `handle`, the values
are outputs: `2(hx − x0)/w − 1`, `2(hy − y0)/h − 1` from the handle's constrained position in pad
coordinates (−1 is left/top); a bind or track on them is `posepad-output`.

**Diagnostics** (code, JSON pointer, message, hint, one test each): `rig-cycle` (at the closing
constraint), `rig-target`, `rig-bone-parent`, `rig-bone-offset`, `rig-bone-pivot`, `rig-ik-host`,
`rig-ik-chain`, `rig-path-target`, `rig-weight-count`, `rig-weight-sum` (warning), `rig-weight-bone`,
`rig-skin-host`, `rig-skin-morph`, `rig-mesh-host`, `rig-mesh-index`, `posepad-timeline`,
`posepad-output`, `posepad-cycle`, `scroll-viewport`; `unsupported-render` (feature `mesh`, SVG).

## 4. Where rigging runs (the step contract)

A new **rig stage** in SPEC §7, after the layout stage and before drawing (`DECISIONS.md` D2):

1. Steps 1–4 as today (inputs, clocks, layers, bindings, clamp), then layout.
2. **Solve** (rig): for every node in the rig's dependency order (computed once at load: parent
   before child, every constraint target and path before the constrained node, an IK chain's bones
   before the chain's descendants; a cycle is `rig-cycle` at load), world = parent world · local
   (the layout-adjusted `p.local`, bones as in §3), then each constraint in authored order:
   `W ← blend(W, target_k(W), strength_k)`. `blend` decomposes both matrices into pivot position,
   rotation (shortest arc), scale and skew and interpolates componentwise; strength 1 replaces,
   0 skips (`rigging.constraint-order`, `-strength`).
3. **Pose** (`posepad`, only if declared): pads compute their values (handles read the solved
   handle), sample their timelines and write a value overlay (clamped to each property's range);
   if any pad wrote, **solve again** (exactly two passes, never a loop). A pad timeline that writes
   its own handle, the handle's ancestors or constraint targets is `posepad-cycle` at load.
4. **Publish:** constrained nodes get an overridden per-player `p.local` = parentWorld⁻¹ · W, so
   drawing, hit testing, a11y bounds and pointer mapping follow without new seams; skin and mesh
   `draw.frame` hooks write deformed geometry; paint's `outline(player, node)` returns the deformed
   outline for hits.

Layout reads pad output from the previous step; guards never read rig outputs in the same step (the
P7 "previous boxes" rule; no feedback passes: `rive-animation-and-state.md` §2.3 notes Rive's up-to-5
update passes are hard to make deterministic). The solve is a pure function of values and layout
boxes: it adds nothing to `settled` and is skipped when none of its inputs changed. Scroll offsets
are per-player state changed only by queued pointer/wheel input in step 1 (no physics, settles at once).

Derived, read-only addresses for conformance and tooling (snapshot/expect only, not guard operands):
`<node>.world.x|y|rotate|scaleX|scaleY` (pivot position and decomposition), `<bone>.tip.x|y`,
`<node>.skin.point.<k>` (world `[x, y]`), `<node>.constraints.<k>.percentX|percentY` (scroll),
`<pad>.valueX|valueY` (outputs with a handle).

## 5. Seams between tickets (decided now so wave 2 can code against them)

- `modules/rig/core/api.ts` (P8-1): `registerConstraint({kind, shape, targets(raw, model), writes?(raw,
  node, model), solve(ctx, node, raw, k)})` and `RigContext` (`world`, `setWorld`, `rest`,
  `position`, `num(node, k, key, fallback)`, `blend`); ik, pathfollow, scroll register in `init`.
- `Model.rigPose?: (p) => boolean` between rig's two passes (posepad chains it; without rig,
  posepad runs its own `afterStep` stage on `p.world`). `Player.skinPoints?(node, xy: number[])`
  (P8-4; mesh calls it). `Player.paintRank?(node)` (composite, R4-02).
- `DrawNode.mesh?: {points, uv, triangles}` beside the image geometry (type-only in core, 0 B).
- Path measurement stays private to `pathfollow`, using core's outline parser and the SPEC "Shared
  outline lengths" subdivision so trims and following agree.

## 6. Carry-overs

- **R4-02:** composite installs `Player.paintRank(node)` (pre-order index of the tree with children in
  resolved `drawOrder`; absent without `drawOrder`, consumers fall back to the node index, the same
  walk). Input's hit order and opaque-blocker test and focus's pointer ranking use it; nested
  instances rank inside their host. One coordinated change to the three chapters.
- **Toggle queue:** pre-player `icon.toggle(name)` joins `#pending` (FIFO with `set`/`fire`).
- **`a11y.tree-bounds`:** implement clipped (∩ clip source), masked (∩ mask source painted bounds),
  trim (visible pieces), non-scaling stroke, feather (grown by its extent); close **dash** (undashed
  stroke bounds, conservative) and **text ink** (logical line boxes, as DOM text rectangles and
  screen-reader highlights) as documented differences; rig geometry follows via `p.local`/outline.

## 7. Definition of done per row

Each row: spec section, registry both spellings, CLI/schema (`anima schema <kind>`), conformance case
`spec/conformance/<row-id-dashed>/` (values via the derived addresses), oracle case
`tests/oracle/<row-id-dashed>/` or skip note, AniML + `.ani` example in the module, tests, parity row
`done` with evidence. Start: `node tools/new-capability.ts <row> --module <module> --dry-run`.

| Row | Ticket | Module | Conformance proves | Oracle |
|---|---|---|---|---|
| rigging.bone-chains | P8-1 | rig | tips and child-art world positions under animated length/rotate | bone chain frames 0/0.5/1 s |
| rigging.root-bones | P8-1 | rig | root at (x, y) + rotate; root nested in a moving bone | yes |
| rigging.constraint-order | P8-1 | rig | two constraints both orders; later full strength wins | yes |
| rigging.constraint-strength | P8-1 | rig | strength 0, 0.5, 1, animated and bound | yes |
| rigging.translation | P8-1 | rig | factors, mirror, per-axis, min/max, spaces, no target | yes |
| rigging.rotation | P8-1 | rig | factor, limits, offset, spaces | yes |
| rigging.scale | P8-1 | rig | per-axis, mirrored factors, limits | yes |
| rigging.transform | P8-1 | rig | full copy with origin, spaces | yes |
| rigging.distance-closer / -further / -exact | P8-1 | rig | inside/outside/on the ring, animated distance | yes, 3 cases |
| rigging.ik | P8-2 | ik | 1-, 2-, 3-bone chains reach / straighten | yes |
| rigging.ik-bend | P8-2 | ik | cw/ccw elbow side; mirrored parent | yes |
| rigging.follow-path | P8-3 | pathfollow | at 0/0.25/1, orient, offset, closed vs open | yes |
| rigging.list-follow-path | P8-3 | pathfollow | 1, 3, 5 children; start/end/shift; repeat items | yes |
| rigging.skin | P8-4 | skin | deformed points on path and contour; rest == unskinned | yes |
| rigging.weights | P8-4 | skin | 1–4 influences, `@rest`, auto weights | yes (explicit weights) |
| rigging.cubic-weights | P8-4 | skin | in/out handle weights differ from anchor | yes |
| rigging.mesh | P8-5 | mesh | grid and explicit meshes: vertices/uv in draw data | yes (CLI triangles) |
| rigging.mesh-animation | P8-5 | mesh | animated vertex tuples | yes |
| rigging.joystick | P8-6 | posepad | bound values pose two timelines | yes |
| animation.joystick-two-axis | P8-6 | posepad | x/y → timeline times −1/0/1 | yes |
| animation.joystick-invert | P8-6 | posepad | inverted axes | yes |
| animation.joystick-handle | P8-6 | posepad | handle positions (incl. distance-gated) → values | yes |
| rigging.scroll | P8-7 | scroll | clamped offsets by drag/wheel/bind, percent, thumb | yes (offset keyed) |
| a11y.tree-bounds | P8-9 | a11y | every extent in §6, both differences | existing skip note + P7-8 capture |
| R4-02 (no row) | P8-8 | input/focus/composite | hit and pointer-focus order after `drawOrder` swaps | — (P4 interaction oracles rerun) |
| toggle queue (no row) | P8-8 | web | browser test: toggle before load, FIFO with set/fire | — |

## 8. Order of work

Wave 1 (parallel, disjoint files): **P8-1** rig core (owns `modules/rig/**`; lands `api.ts` first),
**P8-5** mesh (owns `modules/mesh/**`), **P8-6** pose pads (owns `modules/posepad/**`), **P8-8**
R4-02 + toggle, **P8-9** a11y bounds. Wave 2 after P8-1 merges into `p8-rigging`: **P8-2** IK,
**P8-3** path following, **P8-4** skin (incl. skinned meshes), **P8-7** scroll. Wave 3: benchmark
(§9), `docs/parity/P8-closure.md`, LOG, perf A/B, full check, PR.

## 9. Benchmark: "reaching arm"

Brief, success checks and scoring: `design/p8/BENCHMARK.md` (IK reach with a fixed elbow side, a
skinned sleeve, straightening out of reach, eased release by animated strength, a distance-gated
pupil; numeric proof). Scored as `docs/benchmarks/agent-native.md`; AniML ≥ Rive is the gate.

## 10. Risks

1. **Rest-relative bones vs Rive's bone-local art:** oracle scenes encode Anima's rule (art in bone
   space), as rect-corners does; a mismatch is a fixture error first. D3 is tested by the oracles.
2. **IK beyond two bones** has no unique answer: follow Rive's MIT runtime's approach, fixed
   iteration count (no early exit, for determinism), NOTICE attribution.
3. **Mesh seams:** triangles dilated by 0.5 device px; oracle budgets from measured AA only.
4. **Size:** rig at 3 KB is tightest (`keepDistance` may split to `rig-distance`); focus has 82 B.
5. **Parallel merges** touch generated wiring, SPEC and inventory; regenerate per WORKLOG Gotchas.
6. **Spread spacing and path wrap** (k/(n−1); open clamps, closed wraps) may differ from Rive;
   the oracle decides and the spec records it, never a widened budget.
7. **Scope creep in scroll** toward the won't-do layout rows (physics, snap, virtualize, infinite).
8. **Automatic weights** are ours, not Rive's editor weights; oracles use explicit weights only.
