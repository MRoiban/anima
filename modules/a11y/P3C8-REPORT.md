# [P3c-8] Accessibility carry-overs

Status: **partial, six of seven rows closure-ready**. All inventory statuses remain planned.
Branch: `t3/p3c-8-a11y-carryovers`; baseline `f6f28753`. Local commit only; no push or PR.

| Row | Result | Evidence |
| --- | --- | --- |
| `a11y.focus-action-traversal` | closure-ready | `test/core/p3c8.test.ts`: child → right sibling → next outside matches `oracle/focus-policy/frames/{right,outside}.json`; independent `spec/conformance/a11y-spatial-focus` |
| `a11y.spatial-focus` | closure-ready | synthesized targets use resolved semantic centers; ancestors excluded from directional candidates; same native sequence and conformance; existing scope/repeat tests retained |
| `a11y.tree-visibility` | closure-ready for membership | two fresh native Solo choices in `oracle/p3c8-visibility`; hidden parent/subtree, hidden drawable, active/inactive Solo, zero opacity; `test/core/visibility-native.test.ts` compares both choices and switch-back; older hidden/modal probes retained |
| `host-api.low-level-semantics` | closure-ready | retained binding/geometry/visibility/focus/module/owner dependencies; unchanged reads skip collection and signature construction; paint-only changes and unchanged lists skip recollection; geometry/topology still update; same-signature nested-owner and reordered-list action routing tested |
| `a11y.web-overlay` | closure-ready | canvas backend `nodeBox` + optional `Icon.canvasBox` adapter; real Chromium/Firefox overlay tests for fill/contain/cover/none, resizing, DPR2, native activation, hiding and teardown |
| `a11y.focus-condition` | closure-ready | node-target component comparator (not its SemanticData child), equal/notEqual operators; six fresh PNG stages70/70/70/70/90/70 match Anima ancestor-condition machine poses in `test/core/p3c8.test.ts`; raw semantic-bounds lag is separately retained by `oracle/p3c8-condition/verify.ts` |
| `a11y.tree-bounds` | **open** | decided exact CLI stroke/path extents and SVG client-rect-plus-stroke seam remain unimplemented. Butt width4 line still reports [10,10,10,0] rather than exact [10,8,10,4]. Only16 B of this ticket's runtime allowance remains; generic exact stroke-outline tooling and the SVG measurement association still need implementation. No approximation or changed comparison is called exact |

The four numbered observations are in [P3C8-FINDINGS.md](P3C8-FINDINGS.md): opacity bounds/order,
resolved native condition wiring, missing exact stroke extents, and native animated semantic
bounds lagging rendered pixels. No protected finding.json was edited. Broader native spatial-policy
equivalence is not inferred from one sequence; Anima's scoped edge policy stays specified.

The cache checks retained scalar/value readers; it does not install a new event-subscription or
notification API. It reads resolved mutable geometry/transform/visibility addresses, ignoring
paint/opacity/draw-order addresses that do not affect the current logical boxes, plus semantic
bindings, focus-enabled inputs and owner topology. List item indices are captured immutably so a
reorder of the same players invalidates ownership even when every semantic value is identical.
The first conservative revision-based candidate was replaced because unchanged list steps and
paint changes could recollect. No shipped package dependency was added.

## Size gates and modules

Unchanged `node tools/size.ts`, min+gzip bytes; clean before measured before editing.

| Gate | Before | Final | Delta |
| --- | ---: | ---: | ---: |
| core+web | 20,622 | 20,622 | 0 |
| largest scene (29) | 51,873 | 52,122 | +249 |
| app-UI | 85,186 | 85,487 | +301 |
| runtime sum | 104,441 | 104,775 | **+334 / +350 allowance** |
| authoring add-on | 14,440 | 14,440 | 0 |
| heavy class | 109,974 | 110,408 | +434 |

All six enforced ceilings and module budgets pass. This checkout alone is **303 B above** the
owner's end-of-P3c target104,472; the orchestrator must offset that in the phase union. The ticket
allowance is met; this report does not claim the final phase target or non-growth of the other
runtime gates. No budget/threshold/tool/input was changed.

| Touched runtime module | Before | Final | Budget |
| --- | ---: | ---: | ---: |
| a11y | 2,047 | 2,226 | 2,304 |
| a11y-actions | 1,021 | 1,066 | 1,152 |
| a11y-dom | 1,899 | 1,948 | 2,112 |
| focus | 3,067 | 3,095 | 3,392 |
| canvas (heavy) | 5,252 | 5,351 | 5,824 |

Markup-a11y remains970 B and unchanged. Incremental module and union gzip deltas do not add.
Canvas maps resolved world boxes to CSS pixels through its actual viewport/backing-surface
mapping; it does not claim exact path/stroke geometry. The overlay imports the adapter's type
only, so SVG-only pages do not load canvas.

## Verification

Final frozen results are appended below. Evidence is in `verification/p3c8/`.

Already complete: precise owned core/CLI/conformance scope **1,208 pass /1 existing TODO**;
overlay **42/42 pass** in Chromium+Firefox. The earlier owned scope before precise address
tracking passed3,629/1TODO across24 selected files and both engines. Its first full changed run
passed8,086/40TODO; that source used the conservative cache, so it is not the final claim.
An intermediate precise-cache changed run was intentionally stopped after the immutable-index
reorder fix; `changed-final.txt` is not reported as a successful frozen check.

Size, strict oracle, perf, wiring, scoped typecheck/lint and generated AniML/schema/web/parity
checks are run with the existing commands. Raw performance before → final: bell compile5.11 →
6.59ms; prefix sweep1292 →1696ms; bell frame105.0 →45.8µs; composite53.8 →34.4µs;
toolbar frame49.3 →44.2µs; toolbar compile8.42 →6.33ms. Commands succeed, but shared-machine
load makes the ≤3% timing non-regression **unverified** (bell compile is slower).

## Deviations and problems

- Exact painted bounds are not implemented; its concrete counterexample and pending work remain.
  The condition row now closes against six native PNG stages; failed earlier drafts are documented.
- No new grammar/diagnostic/registry field was introduced. Existing invalid fixtures and both
  syntaxes remain exercised; the spatial conformance is independently authored and compiled.
- Required shared edits: linked normative spec text and corpus census492→493 for the added
  conformance case. Generated ANI was rebuilt, never edited by hand. No parity status changed.
- Scaffolder dry-run on the existing bounds row wanted to reintroduce a TODO marker; no new
  capability was added, so the existing completed probes were preserved instead of reset.
- Early failures were corrected: dependencies absent; wrong temporary cwd; native visibility
  draft without an inert machine; duplicate control.rml ids (retained as .rml.txt); rect AniML
  spellings/canonical formatting/corpus count; a stale enabled-focus action when signature
  equality omitted the enabled input; an overbroad world-call test counted list drawing work.
- Superseded native condition conclusions based solely on semantic bounds are explicitly
  corrected by the PNG control and successful node-target comparator. Native right-hand booleans
  do not invert this condition: use its notEqual operator. Idle also needs its explicit reset pose.
  Raw captures and protected comparisons are unchanged.
- No runtime dependencies, licence file, native binary/build folders, publication, push or PR.
  Research rationale: `docs/research/rive-web-runtime.md` (platform geometry belongs to the
  renderer/overlay) and `rive-animation-and-state.md` (focus/listener ordering and queued actions).

## Final frozen checks

- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **8,089 passed /40 inherited TODOs**,
  247 files passed /13 skipped,442.11s; both Chromium and Firefox. No final failures or load-only
  timeouts. `changed-final.txt` is the final run including the six-stage native condition test.
- `npm run test:scope -- a11y focus --no-browser`: **1,208 passed /1 inherited TODO**;
  focused overlay scope **42 passed**, including both engines. The earlier wider owned scope
  passed3,629/1TODO before the finer cache guard; all final runtime changes are covered by changed.
- `node tools/modules.ts --check`, full `npm run typecheck`, changed/new TypeScript ESLint,
  Prettier and whitespace checks: pass. AniML543, web41, schema and parity generation/checks pass.
- `node tools/size.ts`: exit0, all six enforced ceilings and module budgets pass; +334/350 B.
- `node tools/oracle.ts --strict`: exit0; canonical oracle cases, inputs and findings unchanged.
  `node oracle/p3c8-condition/verify.ts` independently checks all six PNG stages and raw bounds.
- `node tools/perf.ts`: exit0; raw before/after above, ≤3% paired timing acceptance unverified.
- Protected audit: no measurement tool/input, budget, finding.json, benchmark record, parity
  status, dependency, licence or Glyphy change. No retained native binary or capture build folder.

The remaining exact-bounds work is explicitly unimplemented, not a passing measurement. The
phase remains unfinished and no PLAN phase checkbox or parity status was promoted.
