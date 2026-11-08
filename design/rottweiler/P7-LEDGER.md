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
