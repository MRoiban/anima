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
