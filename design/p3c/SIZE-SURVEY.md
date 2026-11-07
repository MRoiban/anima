# P3c-1 size survey

Measured 2026-11-07 on `24d437e9243028f8955c35084a7eea7e9f7446ed` (branch `t3/p3c-runtime-size-survey`), Node 24.22.0. Measurement only: shipped sources, budgets, size tools, flags and inputs are unchanged. Evidence and reproducible scratch probes are in [survey/](survey/README.md).

## Decision

**The tested potential behavior-preserving opportunities do not establish the required 5,500 B saving.** The diagnostic-guard trial saves **1,568 B**; adding the two positive helper-sharing trials saves **1,624 B combined** (109,971 → **108,347 B**, 1.48%). That leaves **3,875 B** to the owner's 104,472 B target, before carry-overs, and **3,876 B** to a 5,500 B saving. These are measurement estimates, not tested implementations: exception text and diagnostic normalization need review.

Removing runtime-imported AniML hooks saves **4,461 B**, but breaks browser authoring. It is an architectural lead, not an eligible size cut. A relocation trial below quantifies the authoring-gate tradeoff. No deletion-only probe, module excision, or sum of overlapping deltas is counted as a deliverable saving.

## Baseline and attribution method

`node tools/size.ts` completed successfully; exact output: [baseline.txt](survey/baseline.txt).

| Gate               | Baseline B | Ceiling B |
| ------------------ | ---------: | --------: |
| Core + web         |     20,622 |    24,576 |
| Largest scene (29) |     55,313 |    65,536 |
| App UI             |     91,158 |   131,072 |
| Runtime sum        |    109,971 |   163,840 |
| Authoring add-on   |     11,949 |    16,384 |
| Rive-class         |    115,473 |   256,000 |

Runtime sum means the **single ordered union bundle** of every non-authoring, non-heavy `moduleBudgets` entry, plus index. It is not the sum of the individual deltas. Canvas is shown in the inventory because it is non-authoring, but is heavy and excluded from that union. Base margin is 3,954 B; none of the proposed shared helpers belongs in core.

Every entry and scratch trial is minified by the repo's unmodified `bundle()` and gzipped at level 9. Individual module deltas subtract the exact `over` entry where specified, otherwise core+web. Function probes stub bodies, preserve export bindings, and rebuild that module's browser entry. Four candidates per owner are selected by source length, then ranked by measured excision cost; these are sampled hotspot measurements, not an exhaustive profile. Table/object probes similarly sample the two largest candidates. Excision includes code made unreachable and **does not mean that a function can be removed**. Costs overlap and must never be summed. Zero often means that a renderer/helper is not reachable from that particular browser entry.

### Every non-authoring entry

Locations below are repository-relative. All costs after a function or table name are **gzip B lost from that entry** on excision, not runtime-sum savings. Raw locations, line numbers, baselines and all probes: [attribution.json](survey/attribution.json), [tables.json](survey/tables.json). The prose-cost column is the **runtime-sum** diagnostic-guard trial for its owner; repeated owners such as assets/assetio are not additional savings.

| Entry          | Delta / budget B |    Use | Subtracts    | Largest measured function consumers                                                                               | Other measured table/object bound                                 | Prose opportunity B |
| -------------- | ---------------: | -----: | ------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------: |
| paint          |    4,635 / 5,120 |  90.5% | core+web     | `modules/paint/core/index.ts:91` load **586**                                                                     | `modules/paint/core/geometry.ts:117` geometry **1,104**           |                 189 |
| composite      |    3,885 / 4,096 |  94.8% | core+web     | `modules/composite/core/svg.ts:129` attrs **1,045**; `modules/composite/core/index.ts:45` load **707**            | `modules/composite/core/index.ts:195` draw **466**                |                  95 |
| bind           |    2,036 / 2,048 |  99.4% | core+web     | `modules/bind/core/expression.ts:37` expression **1,027**; `modules/bind/core/index.ts:78` load **408**           | See object/subsystem bounds in raw evidence                       |                   9 |
| assets         |    1,788 / 2,048 |  87.3% | assetio      | `modules/assets/core/index.ts:156` load **436**; `modules/assets/core/svg.ts:17` attrs **269**                    | See object/subsystem bounds in raw evidence                       |                   0 |
| surface        |    8,017 / 8,192 |  97.9% | core+web     | `modules/surface/core/svg.ts:93` attrs **1,126**; `modules/surface/core/index.ts:271` frame **566**               | `modules/surface/core/index.ts:238` draw **663**                  |                   0 |
| components     |    4,049 / 4,096 |  98.9% | core+web     | `modules/components/core/index.ts:60` create **3,205**; `modules/components/core/index.ts:491` nest **868**       | `modules/components/core/index.ts:414` draw **347**               |                   0 |
| assetio        |      658 / 2,048 |  32.1% | core+web     | `modules/assetio/web/index.ts:30` callback **388**; `modules/assetio/web/index.ts:16` callback **159**            | See object/subsystem bounds in raw evidence                       |                   0 |
| canvas (heavy) |    5,252 / 8,192 |  64.1% | core+web     | `modules/canvas/web/renderer.ts:468` #shape **1,044**; `modules/canvas/web/renderer.ts:696` #paint **853**        | `modules/canvas/web/renderer.ts:380` map **30**                   |                   0 |
| focus          |    4,075 / 4,096 |  99.5% | core+web     | `modules/focus/core/index.ts:314` init **1,686**; `modules/focus/core/index.ts:86` install **1,527**              | `modules/focus/core/index.ts:326` entries **121**                 |                   0 |
| input          |    6,444 / 8,192 |  78.7% | core+web     | `modules/input/core/runtime.ts:205` pointer **641**; `modules/input/web/index.ts:77` attach **579**               | See object/subsystem bounds in raw evidence                       |                   0 |
| media          |    2,744 / 3,072 |  89.3% | core+web     | `modules/media/web/index.ts:13` callback **265**                                                                  | `modules/media/web/index.ts:41` diagnostics **40**                |                   0 |
| motion         |    6,645 / 8,192 |  81.1% | core+web     | `modules/motion/core/index.ts:198` load **2,268**; `modules/motion/core/api.ts:441` install **721**               | `modules/motion/core/api.ts:455` methods **650**                  |                   7 |
| events         |    3,789 / 4,096 |  92.5% | core+web     | `modules/events/core/index.ts:114` load **1,379**; `modules/events/web/index.ts:202` callback **872**             | See object/subsystem bounds in raw evidence                       |                 196 |
| machine        |    6,293 / 8,192 |  76.8% | core+web     | `modules/machine/core/index.ts:42` load **5,484**; `modules/machine/core/runtime.ts:113` enter **428**            | `modules/machine/core/registry.ts:35` entries **441**             |                 182 |
| paint-sampling |      939 / 1,024 |  91.7% | paint        | `modules/paint/core/sampling.ts:50` attrs **760**; `modules/paint/core/index.ts:91` load **606**                  | `modules/paint/core/geometry.ts:117` geometry **1,128**           |                 189 |
| contour        |    3,738 / 5,120 |  73.0% | core+web     | `modules/contour/core/index.ts:35` compileVertices **568**; `modules/contour/core/effects.ts:192` load **446**    | `modules/contour/core/effects.ts:177` effects **1,085**           |                 225 |
| data           |    7,983 / 8,192 |  97.4% | core+web     | `modules/data/core/compile.ts:13` prepare **2,918**; `modules/data/core/index.ts:168` load **1,805**              | `modules/data/core/index.ts:35` data **6,445**                    |                 142 |
| convert        |    6,782 / 8,192 |  82.8% | core+web     | `modules/convert/core/index.ts:176` load **671**; `modules/convert/core/converters.ts:107` 'color-format' **344** | `modules/convert/core/converters.ts:76` implementations **2,601** |                 389 |
| derive         |    2,383 / 4,096 |  58.2% | core+web     | `modules/derive/core/index.ts:18` init **2,361**; `modules/derive/core/index.ts:73` prepare **2,196**             | `modules/derive/core/index.ts:33` entries **100**                 |                   0 |
| host-values    |    1,211 / 2,048 |  59.1% | core+web     | `modules/host-values/core/index.ts:131` validate **386**; `modules/host-values/core/index.ts:85` values **279**   | `modules/host-values/core/index.ts:167` data **55**               |                   0 |
| host           |    3,570 / 4,096 |  87.2% | host-values  | `modules/host/core/api.ts:237` #address **388**; `modules/host/core/api.ts:358` #set **378**                      | `modules/host/core/api.ts:344` watch **39**                       |                   0 |
| data-host      |      903 / 2,048 |  44.1% | core+web     | `modules/data-host/core/index.ts:13` computed **662**; `modules/data-host/core/index.ts:120` resolve **137**      | See object/subsystem bounds in raw evidence                       |                  18 |
| host-edit      |    3,663 / 4,096 |  89.4% | core+web     | `modules/host-edit/core/index.ts:48` extend **1,563**; `modules/host-edit/web/index.ts:21` callback **643**       | `modules/host-edit/core/index.ts:190` nested **113**              |                   0 |
| lists          |    4,587 / 6,144 |  74.7% | core+web     | `modules/lists/core/index.ts:192` resolve **2,203**; `modules/lists/core/index.ts:418` extend **1,191**           | `modules/lists/core/index.ts:444` extension **1,171**             |                   0 |
| a11y           |    2,047 / 2,048 | 100.0% | core+web     | `modules/a11y/core/runtime.ts:40` install **965**; `modules/a11y/core/validate.ts:15` validate **468**            | `modules/a11y/core/registry.ts:11` shape **204**                  |                   0 |
| a11y-actions   |    1,021 / 1,024 |  99.7% | a11y         | `modules/a11y-actions/core/index.ts:19` init **900**; `modules/a11y-actions/core/diff.ts:4` semanticDiff **144**  | `modules/a11y-actions/core/index.ts:123` set **17**               |                   0 |
| a11y-dom       |    1,899 / 2,048 |  92.7% | a11y-actions | `modules/a11y-dom/web/index.ts:30` attach **1,680**                                                               | See object/subsystem bounds in raw evidence                       |                   0 |
| nested         |    4,535 / 5,120 |  88.6% | core+web     | `modules/nested/core/index.ts:25` init **3,776**; `modules/nested/core/time.ts:7` clock **826**                   | `modules/nested/core/index.ts:20` nested **4,036**                |                   0 |
| mix            |    1,680 / 5,120 |  32.8% | core+web     | `modules/mix/core/svg.ts:85` attrs **538**; `modules/mix/core/svg.ts:20` tree **457**                             | `modules/mix/core/index.ts:53` draw **277**                       |                  26 |
| componentpaint |    1,974 / 5,120 |  38.6% | core+web     | `modules/componentpaint/core/index.ts:27` init **1,059**; `modules/componentpaint/core/svg.ts:7` tree **261**     | `modules/componentpaint/core/index.ts:198` extension **203**      |                   5 |

Budget pressure is real but is not proof of compressible duplication: a11y 99.95%, a11y-actions 99.71%, bind 99.41%, components 98.85%, focus 99.49%, surface 97.86%, data 97.45%. Authoring markup is also tight (8,007/8,192), but outside this runtime inventory.

## Duplication: tested, including failed leads

All numbers in this section are changes to the **109,971 B runtime-sum bundle**, using trial source edits in independent archives and restoring sources afterward. [duplicates.json](survey/duplicates.json) and [shapes.json](survey/shapes.json) contain raw results.

| Family and locations                                                                                                                              | Trial                                                                                                                                        |                        Saving B | Shared home / decision                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node JSON pointers: `modules/components/core/index.ts` nodePointer, `modules/lists/core/index.ts` pointer, `modules/nested/core/index.ts` pointer | Replace three recursive implementations with one shared implementation; preserve root sibling order and child indexing                       |                          **48** | Optional internal `modules/components/core/node-pointer.ts`, not core. Low reward; test root/nested indexes and diagnostics.                                                                |
| SVG deep clone: `modules/composite/core/svg.ts` cp, `modules/surface/core/svg.ts` copy                                                            | Share the recursive spread/kids-map function                                                                                                 |                          **10** | Optional `modules/composite/core/clone.ts`, not core. Shallow-copy other fields exactly.                                                                                                    |
| Draw node/resource remapping: `modules/lists/core/index.ts` render and `modules/nested/core/render.ts` render                                     | Extract identical copying of children, mask/clip source indexes, world transforms and resources; parameterize their different order fallback |                         **−17** | Reject this extraction for size. If revisited, optional internal drawing helper; never collapse slot retirement, transforms or order semantics.                                             |
| All three above                                                                                                                                   | Apply together                                                                                                                               |                           **6** | Gzip and Terser interactions wipe out most standalone gains.                                                                                                                                |
| Repeated declarative shapes across module registries: num, str, bool, bounded num, tup, alt, map                                                  | Shared fresh-object factories for 12 cross-owner literal families, each measured independently and then together                             |                  **0** combined | Reject generic shape factories for size. Terser inlines them. Singleton sharing would change mutable registry identity and was deliberately not used. Exact occurrences are in shapes.json. |
| Matrix / inversion / point transforms                                                                                                             | Existing imports of `geom.ts` in focus, a11y, composite, components, lists, nested                                                           | **0 additional copies removed** | Already core. Do not move wrappers into core on speculation.                                                                                                                                |
| Colour / path parsing / expression parser                                                                                                         | paint/surface/convert use core color; paint/contour/a11y use core path; convert math imports bind expression                                 | **0 additional copies removed** | Existing bundler deduplication. There is no independent converter expression parser to replace.                                                                                             |
| Diagnostic boilerplate                                                                                                                            | Same helper signatures across modules; guard message/hint **arguments**, preserving helper/code/pointer logic                                |              **1,568** together | Keep local guards, not a new core error framework. Individual group results below are disjoint in files but gzip costs are not additive.                                                    |

The final two inventory rows describe existing shared imports, not speculative edits: they get no saving credit. Bounds are not equivalent across focus, semantic nodes, hit testing and canvas; there is no validated bounds-helper replacement in this survey. Likewise, SVG element constructors differ in role, index and key contracts. No saving is assigned to untested unification.

Core is the wrong home for the measured optional helpers: the bell and most icons need none of component pointers, composite cloning or dynamic tree copying. A 3,954 B core margin is not permission to spend it on rare scenes. This follows the registry-as-single-source design in [ARCHITECTURE](../../docs/ARCHITECTURE.md), the generated-property-table lesson in [Rive graph research](../../docs/research/rive-format-and-graph.md), and the pay-for-selected-flavor lesson in [Rive web runtime research](../../docs/research/rive-web-runtime.md) §1; these are design references, not external size baselines or copied implementations.

## Other cuts and module-specific cautions

The function bounds above identify where simplification might pay. None of the following untested ideas receives a byte estimate or counts toward the target.

| Entry          | Next inspection / constraint                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| paint          | Guard load diagnostics; inspect geometry dispatch and registry descriptors; sampling is already optional.                                                    |
| composite      | Guard diagnostics; keep world/local clip and mask paths distinct; SVG clone sharing is only 10 B.                                                            |
| bind           | Parser already shared with convert; no second grammar to remove. Guard remaining load diagnostics.                                                           |
| assets         | Validate image/audio metadata paths before simplifying; SVG attributes and validation dominate.                                                              |
| surface        | Do not count SVG feathering or nine-slice as dead code. Reduce descriptor repetition only after measuring.                                                   |
| components     | Large create/load path contains validation and scoped events. Share nodePointer only; preserve cycle/depth limits.                                           |
| assetio        | Two web asset-loader callbacks dominate; preserve URL/blob policy and release lifecycle.                                                                     |
| canvas         | Heavy, excluded from runtime sum. Do not spend this round shrinking it at the expense of runtime gates.                                                      |
| focus          | Focus install and browser attach dominate; directional/semantic carry-overs make broad rewrites high risk.                                                   |
| input          | Pointer routing/capture and browser attach dominate; preserve event ordering and mixed coordinate spaces.                                                    |
| media          | Web media hook dominates; retain activation, retry and policy handling.                                                                                      |
| motion         | Guard typed-value diagnostics; load/track processing dominates; core time primitives are already shared.                                                     |
| events         | Guard direct d.err strings; retain payload checking, audio policy and URL security checks.                                                                   |
| machine        | Guard helper arguments; its load path is the largest single measured function. Separate validation from execution before attempting a rewrite.               |
| paint-sampling | Optional sampling attrs is live here though absent from basic paint. Do not mistake its zero basic-entry cost for dead code.                                 |
| contour        | Guard effects/load diagnostic strings; retain path winding and modifier order.                                                                               |
| data           | Guard custom binding/compile diagnostics; inspect prepare/load model traversal for repeated work, not blanket validation deletion.                           |
| convert        | Guard bad/mismatch/ConverterError prose; implementations table 2601 B is live. Consolidate option-name lists only while preserving per-converter validation. |
| derive         | prepare/init dominate; compile parser and comparison utilities are shared, not another independent evaluator.                                                |
| host-values    | validate and value/child dispatch dominate; keep identity, unknown-path and read-only behavior.                                                              |
| host           | Address traversal and write dispatch dominate; preserve rebind and subscription lifecycles.                                                                  |
| data-host      | computed dominates; carry-over needs new coordinate results, so reserve rather than consume headroom.                                                        |
| host-edit      | extend dominates; generic nested/list dispatch is behavioral, not proven dead.                                                                               |
| lists          | Share node pointers; retain count/identity/state behavior. Draw-tail dedup grew 17 B.                                                                        |
| a11y           | Already 1 B from its budget; runtime semantic collection dominates. Path/transform primitives are already core imports.                                      |
| a11y-actions   | Init/action installation dominates; tiny semantic key strings are required public spellings.                                                                 |
| a11y-dom       | attach owns most bytes; DOM attribute/property spellings are browser API contracts and must remain intact.                                                   |
| nested         | Share node pointers; clock and fit/draw machinery have distinct semantics from lists. Do not unify by deleting differences.                                  |
| mix            | Guard diagnostic prose; attrs/tree are live fallback/error behavior.                                                                                         |
| componentpaint | Guard load diagnostics; init/extension composition dominates; preserve scoped component drawing.                                                             |

Property names such as `imageScaleX`, converter option names, and semantic ARIA attributes are not uniformly redundant: some are the format, some are browser contracts, and some have separate per-converter validity rules. A registry-driven replacement must preserve these distinctions. Neither `elements`/`markup` metadata nor whole validation methods are proven dead: the browser authoring API observes them. No property mangling, validation deletion, budget change or optional/heavy relabeling was used.

## Ranked parallel tickets

Ownership is by **files**, not whole modules. All files named by T1–T4's diagnostic trials are recorded in [tickets.json](survey/tickets.json). T5 owns browser entry files, so it does not overlap the core files of T1–T4. Shared helper files have one owner. No coder should edit generated adapters or shared size tooling in this round.

| Rank / ticket                                          | Exclusive file ownership                                                                                                                                                                          |                   Measured saving B | Risk / acceptance                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — T5: authoring seam investigation (**conditional**) | `modules/{paint,surface,components,bind,convert,events,focus,motion,data}/web/index.ts`; `modules/markup/web/index.ts`; existing `web/markup.ts` hooks only as needed                             | **4,461 removal bound; 0 approved** | High. Deleting registration breaks AniML. Relocation must pass all registration-order/browser cases and the authoring no-growth rule. Not a ready cutting ticket. |
| 2 — T2: event/data/machine diagnostic guards           | `modules/{events,machine,motion}/core/index.ts`; `modules/data/core/{bindings,compile}.ts`; `modules/data-host/core/index.ts`; `modules/input/core/index.ts`; `modules/derive/core/index.ts`      |                             **578** | Medium. Preserve verbose diagnostics, codes/pointers/hints and argument evaluation; skip files with zero useful delta.                                            |
| 3 — T3: visual diagnostic guards + SVG clone           | `modules/{paint,composite,surface,mix,componentpaint}/core/index.ts`; `modules/contour/core/{index,effects}.ts`; `modules/{surface,composite}/core/svg.ts`; new `modules/composite/core/clone.ts` | **561 guards; 10 clone separately** | Low–medium. No SVG behavior change. Clone saving is too small to justify churn unless the combined result still falls.                                            |
| 4 — T1: converter/bind prose                           | `modules/convert/core/{converters,index,types}.ts`; `modules/bind/core/index.ts`                                                                                                                  |                             **399** | Medium. Distinguish diagnostics from public thrown-error text; normalize false guards to empty strings and preserve Node messages.                                |
| 5 — T4: component pointer sharing                      | `modules/{components,lists,nested}/core/index.ts`; new `modules/components/core/node-pointer.ts`; `modules/lists/core/context.ts` only if a useful diagnostic change survives                     |                              **48** | Low–medium. Root ordering and nested pointers must match exactly. Reject the draw-tail extraction (−17 B).                                                        |

T1–T4 offer four disjoint coding owners. Their standalone credits are 578 + 561 + 10 + 399 + 48 = **1,596 B**; the **measured combined** result with all diagnostic guards and the two positive deduplications is **1,624 B**. The 28 B difference is compression/minifier interaction, not extra code removed. The mechanically guarded zero-benefit files should be left alone in implementation, which requires another final combined measurement.

**No demonstrated plan reaches ≥5,500 B with margin while preserving behavior and all other gates.** Even granting the entire combined 1,624 B opportunity, a further **3,876 B** is needed, plus whatever runtime carry-overs cost. Do not promise 5% from this survey. The authoring seam is the largest measured architectural lead, but it needs a no-growth authoring solution; otherwise a second focused simplification pass in machine/data/convert is necessary. Their excision costs show scale, not achievable savings.

## Combined gate checks

The corrected combined trial passes `node tools/size.ts` (exit **0**), with every module under budget. [Exact output](survey/proposed-gates.txt), [status](survey/proposed-gates-status.json), [union trial measurements](survey/duplicates-guarded.json):

| Gate             | Baseline B | Combined candidate B | Change B |
| ---------------- | ---------: | -------------------: | -------: |
| Core + web       |     20,622 |               20,622 |        0 |
| Largest scene    |     55,313 |               54,750 |     −563 |
| App UI           |     91,158 |               89,859 |   −1,299 |
| Runtime sum      |    109,971 |              108,347 |   −1,624 |
| Authoring add-on |     11,949 |               11,949 |        0 |
| Rive-class       |    115,473 |              113,854 |   −1,619 |

The source edits in this candidate are restricted to runtime module owners and two optional shared helper files. Size/gate acceptance is established for the scratch trial; behavioral acceptance is not. Every scene individually stays at or below its baseline (comparison of the two saved outputs).

The hook-relocation probe restores hook imports/registration through `modules/markup/web/index.ts`, rather than dropping authoring support outright. It keeps the runtime saving at **4,461 B**, but **fails** the owner's no-growth requirement and two existing module budgets (`node tools/size.ts` exit **1**):

| Gate             | Baseline B | Hook relocation B |   Change B |
| ---------------- | ---------: | ----------------: | ---------: |
| Core + web       |     20,622 |            20,622 |          0 |
| Largest scene    |     55,313 |            52,433 |     −2,880 |
| App UI           |     91,158 |            86,256 |     −4,902 |
| Runtime sum      |    109,971 |           105,510 |     −4,461 |
| Authoring add-on |     11,949 |        **14,322** | **+2,373** |
| Rive-class       |    115,473 |           111,038 |     −4,435 |

`markup` becomes **12,046/8,192 B** and `paint-sampling` **1,083/1,024 B**. The latter is an incremental-delta effect: shrinking the paint subtraction bundle can increase the sampling delta even though the sampling source was unchanged. [Exact output](survey/relocated-gates.txt), [status](survey/relocated-gates-status.json), [trial](survey/hooks-relocated.json). Relocation changes timing and eager hook availability, so even a gate-compliant variant would still need authoring/load-order verification. A seam ticket must remove at least **2,373 B from the resulting authoring add-on** as well as restoring the individual budgets; moving code between columns alone is insufficient.

## Measurement oddities and limits

- Gzip context matters: deleting only paint's hook import **grows** the runtime union by **415 B**, while deleting surface's redundant route saves 0 B; the same structural hook remains reachable through other entries. Hook-only standalone savings do not sum to the combined 4,461 B.
- Pointer 48 + clone 10 − draw-tail growth 17 suggests 41 B, but the measured three-way result is only **6 B**. With all diagnostic guards applied, pointer sharing adds 48 B and clone sharing adds 12 B; the two together add 56 B. Use the union build, not arithmetic, for acceptance.
- Source size is not compressed cost. Basic paint sampling methods, generic registry factories and manifest-only data can measure 0 B because they are already inlined, folded or unreachable. Paint-sampling's live attrs cost is measured separately.
- Initial scratch trials accidentally resolved workspace aliases through the real checkout's node_modules symlink. They were **discarded**, source archives restored, workspace aliases repointed inside each scratch tree, and every recorded run restarted. Every JSON result reports baseline 109,971 B. prepare.py encodes the corrected isolation.
- Core flags are exactly the existing `VERBOSE=false` build replacement; no measurement settings changed. Diagnostic probes are not semantically verified implementations. In particular broad guards may require boolean-to-string typing fixes and must preserve public runtime exception text.
- A broad combined guard trial also touched core/web/authoring call sites; it was rejected and rerun with runtime-owner scope. It reduced core by 7 B but grew authoring by 1 B and made a11y 2,049/2,048 B. [Recorded failure](survey/discarded-broad-trial.json). The first relocation attempt omitted the authoring source from its scratch snapshot and failed a missing `registerLibraries` export; the archive was restored, snapshot scope fixed, and the recorded relocation run repeated successfully through all six gates (with the budget failures above).
- Setup initially failed with missing esbuild; `npm ci` restored dependencies. No runtime tests were run because no runtime implementation is delivered. Baseline and combined size checks plus formatting are the relevant validations here. Future code changes require scoped tests, deterministic conformance and existing oracle/browser cases; no expected outputs may change for a size cut.
- Authoring relocation changes registration timing and available hook sets. Its size measurement does not establish API equivalence. This survey makes no compile/frame performance claim under concurrent machine load.
