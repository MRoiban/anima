# Rottweiler ledger — P7 (8ffd714..c3b79b4), 5 rounds

Round 1: orchestrator-run review (GPT-6.1-sol), fixes by one coder in ef2eeab (report `modules/layout/RT1-REPORT.md`). Rounds 2–5: P7 lead.

| id | sev | finding | outcome |
|---|---|---|---|
| R1-1 | major | layout nesting factory may return undefined; nested module calls .step → Player throws (layout+components+nested) | fixed: guard (modules/nested/test/core/rt1.test.ts) |
| R1-2 | major | hit testing ignores layout placement/scaling | fixed: hit outlines + pointer mapping use layout drawing transform (modules/layout/test/core/rt1.test.ts) |
| R1-3 | major | dynamic instances (component="$x") measured as 0×0; switching doesn't remeasure | fixed: measure the selected child model (modules/layout/test/core/rt1.test.ts) |
| R1-4 | major | a11y semantic cache ignores layout changes (layoutSize, reflow) | fixed: per-player draw revision in cache validity (modules/a11y/test/core/rt1.test.ts) |
| R1-5 | major | painted a11y bounds ignore layout's draw transform | fixed: shared drawing-transform helper (modules/a11y/test/core/rt1.test.ts) |
| R1-6 | major | data-artboard retains replaced external models/catalogs; shared schema grows | fixed: prune retired assignments, per-player alias validation (modules/data-artboard/test/core/artboard.test.ts) |
| R1-7 | minor | host-fit uses border box instead of content box for layout size | fixed: content box for fit and layoutSize (modules/host-fit/test/web/fit.test.ts) |

Round 2 (P7 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-1 fix diff (ef2eeab) plus CLI font tooling/shared OpenType reader, fonts-info, text-input selection paint, text overflow/canvas, a11y bounds, markup compile. Reviewer found no defects in selection paint, markup compile, CFF, variations, flattening, pruning/alias, load order; R1-1/3/4/5 held.

| id | sev | finding | outcome |
|---|---|---|---|
| R2-1 | major | hit test throws after clearing a dynamic instance (R1-6 deletes the child; nested.hits returns undefined → circle outline on an instance) | fixed: cleared instance returns false (modules/components/test/core/rt2.test.ts) |
| R2-2 | major | per-corner rect (`corners`) layout participant keeps its authored path: draws, hits, bounds at [10,10,2,2] | fixed: paint builds the corner path in the drawn layout box (modules/layout/test/core/rt2.test.ts); touches `paint` (owned by an earlier phase): +33 B |
| R2-3 | major | cmap expansion uncharged; repeated format-12 subtables → 16.7 M mappings (2.5 s) for a 400 KB font, 4.3 G for 2.7 MB | fixed: every mapping charges the cmap table's operation limit → `font-limit` (modules/fonts/test/core/rt2.test.ts) |
| R2-4 | major→minor | GPOS LookupFlag ignored (IgnoreBaseGlyphs lookup still kerns bases) | fixed differently: reviewer's "reject all flags" would refuse common IgnoreMarks kern lookups in real fonts; instead skip a lookup for a pair containing a glyph of an ignored GDEF class (bits 1–3). Mark-attachment/filtering flags only concern marks (already `text-shaping-approximate`). Test: modules/fonts/test/core/rt2.test.ts |
| R2-5 | major | `fonts.set(name, …)` repeatedly keeps every replaced FontFace until clear() | deferred: `set`/`retain` predate P7 (P6-4/P6-13); not P7 code, and `fonts` has 41 B left (2007/2048). For the P6 lead |
| R2-6 | minor | fit-font-size with no fitting bisection candidate calls build(0) → `font-invalid` | fixed: empty result (fittedSize 0) as for a zero box; text SPEC updated (modules/text/test/core/rt2.test.ts) |
| R2-7 | minor | zero-length round-capped subpath bounds lose half the dot | fixed: cap direction from the whole subpath; zero-length uses local x axis (SVG) for round and square caps; a11y SPEC updated (modules/a11y/test/core/rt2.test.ts) |
| R2-8 | minor | display:none host with % size measured as px (layoutSize [36,36]) | fixed: non-px computed sizes are unmeasurable (NaN) → viewBox keeps state; SPEC host layout note (modules/host-fit/test/web/fit.test.ts, Chromium+Firefox) |

Round 3 (P7 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-2 fix diff (2546cd9) plus remaining P7 hunks (canvas, assets/assetio, input, machine, lists, paint, text-input, data compile, host, components, fonts/text web, a11y-dom, layout reflow/algorithm, core load, web index, markup data-artboard/layout). Reviewer confirmed every round-2 fix (reflow/retarget, nested, display:none, canvas, 45 installed fonts decode under the cmap limit, NaN content sizes stop before canvas/viewBox/layoutSize writes).

| id | sev | finding | outcome |
|---|---|---|---|
| R3-1 | major | root component catalog omits definitions placed only inside another component → `component(doc, 'leaf')` is `unknown-component` | fixed: placements at any depth also enter the root catalog (first model wins; the root's own placements override) (modules/data-artboard/test/core/rt3.test.ts) |
| R3-2 | major | foreign inherited child ignores the destination host's `data.bind('other')` (child reads the authored default) | pushed back: not P7-specific: a local inherited component behaves identically (parent 7, child 2), since host `bind()` has never rebound inherited children (host module predates P7; host SPEC: authored bindings keep data's default semantics). The P7 bridge matches local behaviour. For the host/data phase lead |

Round 4 (P7 lead; reviewer GPT-6.1-sol xhigh; token usage: not reported). Scope: round-3 fix (508f19e), optional P7 web entries loaded twice or in either order, cross-player state, CLI font tooling end to end. No defects found in catalog cycle guards, root-placement precedence, repeated core loads, fonts-loader chaining, font decoding/measurement.

| id | sev | finding | outcome |
|---|---|---|---|
| R4-1 | major | a second host-fit/host-fit-size bundle throws `Cannot redefine property: size`; with host-fit-size first the fit adapter never installs | fixed: one size map on the live constructor; `size`/`resetSize` and the fit adapter install once (modules/host-fit/test/web/rt4.test.ts, Chromium+Firefox). host-fit 674→684 B, host-fit-size 242→271 B |
| R4-2 | major | a second data-artboard bundle replaces `resources.adopt` (and re-wraps component/loadAssets/eventHook) with empty maps: acquired values lose their source-resolved resources | fixed: install the bridge once per live module (modules/data-artboard/test/web/rt4.test.ts, Chromium+Firefox). data-artboard 835→858 B |
| R4-3 | major | requiring `dataartboard` swaps `model.doc` for a clone during data prepare, hiding the identity lists keys `$parent` context by → `data-path` | fixed: keep the document, swap only its `data` for the prepare call (modules/data-artboard/test/core/rt4.test.ts). data-artboard-values 1524→1523 B |
| R4-4 | major | `anima flatten` replaces a layout participant text with a group: intrinsic size 0, siblings move | fixed: `font-flatten` for text directly inside a `layout` container; text SPEC updated (modules/text/test/core/rt4.test.ts) |
| R4-5 | major | a second layout-reflow bundle during a flight replaces reflow with a fresh state map; players stay busy/unsettled | fixed: `??=` keeps the installed reflow (modules/layout/test/web/rt4.test.ts, Chromium+Firefox) |
| R4-6 | major | external selection with independent data and `$parent.x` refs is not checked against the destination parent → `dot.r: NaN` | deferred: real P7 data-artboard defect and not caused by R3-1 (a root-placed leaf reproduces it with the pre-R3-1 code); R3-1 only exposes more definitions. The fix (check `$parent` refs in `compatible`) needs ~80–100 B in `data-artboard-values`, which is full (1,523/1,536); an entry split is a refactor beyond this review. For the orchestrator |

Round 5 (P7 lead; reviewer GPT-6.1-sol xhigh; token usage: not exposed). Scope: round-4 fix diff (a2c3e8b) plus any remaining P7 defect. R4-1, R4-2, R4-4 (nested groups, laid-out component roots, `--node`) and R4-5 held.

| id | sev | finding | outcome |
|---|---|---|---|
| R5-1 | major | R4-3 wrote the caller's `doc.data`: a frozen document throws `Cannot assign to read only property 'data'` | fixed: data-artboard no longer touches the document. Data's `prepare` deep-copies `doc.data` and now calls an optional `normalize(document, model)` hook on that private copy; data-artboard rewrites artboard→component there. This replaces both the original clone swap and the R4-3 mutation, keeping identity for lists' `$parent` context (R4-3 test still passes). Test: modules/data-artboard/test/core/rt5.test.ts. data 6531→6540 B; data-artboard-values 1523→1449 B |
| R5-2 | major | font readiness redraws text without re-resolving layout: a static hug container keeps 0×0 text boxes | fixed: layout exposes `refresh(p)`; the fonts text consumer's `refreshText` re-resolves layout before bumping draw revisions (no step, no input queue); layout SPEC updated (modules/layout/test/web/rt5.test.ts, Chromium+Firefox). layout 4056→4069 B, fonts-text 541→552 B |
| R5-3 | minor | artboard normalization crashes on `$comment: null` in models or properties | fixed by the R5-1 rewrite: null-safe traversal (modules/data-artboard/test/core/rt5.test.ts) |

R4-6 re-checked after R5-1 freed 87 B in `data-artboard-values`: still deferred. Lists adds every outer property as a `$parent.*` ref, so a correct check must find the refs the child actually uses (bindings/expressions). That is more than a smallest fix.
