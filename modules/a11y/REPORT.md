# P3b-1b split checkpoint — budget blocked

Status: **blocked** on the explicit size stop. Branch `t3/a11y-actions-size-split`.
Prototype merged with `git merge --no-ff t3/p3b-a11y-module` (merge `1bfca8e`).
The prior P3b-1 report below is historical. No parity statuses changed, no rows are
closed, and no new oracle captures or completed conformance probes are claimed.

## Split delivered

- `a11y`: registry, load validation, tree/state/visibility/modal/bounds prototype,
  and semantics cache. `a11y-actions`: descriptions/dispatch, diffs, synthesized focus,
  ancestor states and retarget prototype, ordered after `a11y`.
- Shared registry-owned cache seam supports separate bundle identity; one flatten
  helper, core clamp and existing matrix/path helpers are reused. Repository search
  found no existing exported painted/group/path-extrema bounds helper to reuse.
  Bounds completion was deferred after the failed size round.
- Headless commands stay tooling-only; no browser entry imports commands.ts.
- Scaffold dry and real invocations both rejected `--module a11y-actions` under the
  existing hyphen restriction (evidence in verification/p3b1b/scaffold*.txt). Module
  files were added manually and all adapters/tables/exports regenerated.
- Public module/folder `a11y-actions` uses the runtime key `a11yactions`, as existing
  hyphenated modules do, avoiding any further base-runtime name-rule growth.

## Size guard (min+gzip B)

| Entry | Before split | After split | Fixed guard |
|---|---:|---:|---:|
| a11y | 3,623 | 3,002 | 2,048 — **FAIL (+954)** |
| a11y-actions | absent | 828 over a11y | 1,024 — pass |
| core+web | 20,369 | 20,369 | 20,369 — pass |
| data (untouched) | 8,032 | 8,032 | must not grow — pass |
| bind (untouched) | 2,038 | 2,038 | must not grow — pass |
| components (untouched) | 4,047 | 4,047 | must not grow — pass |
| full-featured | 114,392 | 114,584 | 131,072 — pass |

The companion imports a11y, so its manifest measures the incremental dependency
layer with `over: 'a11y'`, as paint-sampling/paint and host/host-values do. The base
still fails even with this accounting. No budget, measurement tool, protected input,
finding, benchmark record or parity status was changed. The split adds 192 B to the
full-featured total; it is an ownership seam, not a claimed net byte reduction.

## Verification

Final focused scope: 966 pass, 445 skipped/filtered, 1 TODO, zero failures.
Static-only load smoke check passes; action/diff methods are absent as intended.
Typecheck (all nine projects), targeted ESLint/Prettier, generated wiring, schema,
480 active AniML builds and 36 browser entries pass. Strict oracle exits 0:
253 cases / 449 samples, zero failing completed samples; 24 existing finding /
intentional-difference records retained. No new native comparison is claimed.
`node tools/size.ts` exits 1 solely for a11y (3,002 > 2,048 B); other gates pass.
The first split measured 2,993 B, but review caught slider metadata being exposed
while disabled. Restoring prototype behavior produced the final 3,002 B result.
Separate-bundle browser registration and late-registration invalidation remain
unverified; shared registry ownership is implemented but not a completion claim.

`node tools/perf.ts` exits 0: bell compile 7.32 ms, 9,040 prefixes 2,119 ms,
bell frame 136.1 µs, composite 86.3 µs, toolbar frame 105.4 µs, toolbar compile
12.51 ms. Shared load remained elevated (~16–31 during checks); these are not quiet
paired measurements. The ≤3% regression target remains **unverified**.

First broad changed scope: 7,390 pass / 3 fail / 45 TODO, 223 files pass /
2 fail / 13 skipped, in 599.06 seconds. A genuine third failure was the companion
reading the a11y seam before the base arrived. Init now defers until that peer is
registered, retaining arbitrary registration order. This adds 7 B to the companion
(821 → 828 B). The first order recheck timed out at the unchanged 30-second limit
under concurrent checks and load ~23. With those checks finished, the isolated
order test passes all 12 permutations in 21.04 seconds (1 test / 1 file). This
subsequent timeout is classified as contention-only on that evidence; the initial
TypeError was real and fixed.

Final frozen-source changed scope passes: **7,393 pass / 0 fail / 45 TODO**,
225 files pass / 13 skipped, in 524.66 seconds. This resolves all three first-run
failures. No first-run failure is waived; no failing test or expectation was removed.

Two standalone-demo assertions initially ran before browser artifacts were ready. After rebuilding,
both Chromium/Firefox tests pass alone (2 pass / 72 filtered); these are artifact
ordering failures, not classified as load-only. No timeout or expectation changed.
Initial focused a11y/a11y-actions scope: 966 pass, 445 skipped/filtered, 1 existing
TODO, zero failures. Core tsc and targeted ESLint pass. The scope tool rejects
`--maxWorkers=2`; verification uses supported Vitest `VITEST_MAX_WORKERS=2` without
changing configuration, timeouts or tests.

## Closure evidence and remaining rows

**No row is closure-ready:** the required size gate fails. Every row listed in the
historical report stays planned and open. Prototype-only evidence remains
`test/core/semantics.test.ts` (tree contract/actions/diffs/focus),
`test/core/diagnostics.test.ts`, `test/cli/sample.test.ts`, and the AniML/ANI contract
example. It does not meet the complete capability definition of done.

Unchanged pending work: group painted bounds and path/stroke extrema, nested/repeated
order and dotted focus, transparent modal scope, semantic traversal restrictions,
ancestor machine conditions, read-dependency and structural invalidation, read-only
data action edges, complete traits/defaults/Solo, filtered snapshots, and all required
independent conformance and logical-tree native captures. Late registration after a
cached static read also needs coverage before declaring the seam complete. The
native CLI was not invoked during this checkpoint; its headless capability remains
as documented by P3b-1, not a reason to skip logical-tree oracles.

All DOM rows remain wave 2 as requested, including live-region/low-level semantics
DOM integration. Stop reason is the user-requested post-split guard, before feature
expansion; no enlarged or third module was introduced.

---

# P3b-1 partial checkpoint — blocked by the 2 KB budget

Status: partial. Do not merge as a completed capability. Branch `t3/p3b-a11y-module`.
No parity statuses changed. No push or PR was made.

## Delivered prototype

Registry-driven node authoring, authoring validation, a pure semantic-tree/diff/action
prototype, exported TypeScript types, a checked JSON tree fixture, queued headless
actions, semantic inspection, and `sample --semantics`. Root document semantics retain
their schema, parser and canonical spelling. The web entry only registers the module
and structural markup; no overlay exists. Runtime remains dependency-free.

See `SPEC.md` for the draft contract and explicit implementation gaps. Test coverage
is limited to basic checkbox/slider/group semantics, explicit bounds, focus/ancestor
retargeting, headless inspection, diagnostics and unchanged root parsing.

## Stop condition

The first registration bundle measured 3,624 B incremental versus 2,048 B allowed.
Implementation expansion stopped immediately at that guard. The later size command
reports 3,623 B. No budget was changed and no artificial measurement entry was used
for the final result. No runtime optimization/split was attempted after the stop.
A separate budgeted implementation split needs design work; this prototype does not
satisfy the capability definition of done.

## Measurements (min+gzip B)

| Entry | Recorded before | After |
|---|---:|---:|
| core+web | 20,362 | 20,369 (+7 B) |
| a11y registration (core + markup registration stub) | absent | 3,623 / 2,048 FAIL |
| markup | 7,949 | 8,015 |
| markup-paint | 390 | 389 |
| paint | 4,632 | 4,627 |
| focus (source unchanged) | 3,877 | 3,916 |
| data (source unchanged) | 8,039 | 8,032 |
| bind (source unchanged) | 2,038 | 2,038 |
| components (source unchanged) | 4,054 | 4,047 |
| full-featured | 111,725 | 114,392 |

The supplied canonical baseline is full 111,723, data 8,034 and components 4,051.
The recorded starting measurement completed during the initial module-name seam
edit; its small differences from that frozen baseline are not a claimed module-size
regression. All final protected deltas also meet the canonical numbers. The core
name-rule seam costs +7 B relative to the supplied base, within the +40 B allowance.
The full use-case ceiling passes; the a11y module budget fails.

`node tools/perf.ts` completed both times. Starting: bell frame103.6µs,
composite69.4µs, toolbar79.6µs, bell compile6.38ms, toolbar11.63ms.
After: bell227.1µs, composite97.1µs, toolbar186.8µs, bell compile28.96ms,
toolbar16.90ms. These runs are not controlled or equivalent-load measurements;
`/proc/loadavg` reached 76.67 during shared-agent testing. The ≤3% no-regression
requirement is UNVERIFIED. No work was done in the base step/draw hot path.

## Verification

- `npm run test:scope -- a11y --no-browser`: 963 pass, 445 filtered/skipped,
  1 TODO; 0 failures (before the added CLI test and final example formatting).
- First focused run: 946 pass / 4 failures / 55 TODO. Root canonical attribute
  ordering, the explicit registry field list, and a mistaken test use of
  decompile's string return were corrected; unused scaffold noise was removed.
- `node tools/modules.ts --check`: pass, 0 stale.
- `npm run gen`: generated the schema.
- `node tools/build-animl.ts`: built 480 sources; pending probes remain pending.
- `node tools/build-web.ts`: pass; generated browser artifacts rebuilt.
- Targeted ESLint and Prettier: pass; no limits relaxed.
- `node tools/size.ts`: FAIL, one module budget (a11y3623 >2048); every other
  module and use-case ceiling passes.
- `node tools/oracle.ts --strict`: exit0; existing253 cases /449 samples,
  0 failing completed samples. Existing23 findings plus one intentional difference
  remain separate. No comparison or finding record was edited.
- Final `npm run typecheck`: pass across all nine projects.
- Final `npm run test:scope -- a11y markup --no-browser`: 2,445 pass,
  445 filtered/skipped, 1 TODO; 0 failures, including the new CLI test and corrected
  root-held ordering assertion.
- Full `changed` scope results are recorded in the final note below.

## Deviations and remaining work

`a11y` was rejected by both the runtime and scaffolder's letters-only name rule.
The rule now permits digits after an initial lowercase letter. New shared-module
name support is the only base-runtime seam. The generic structural markup reader
now decodes bool-or-input unions, and the compiler preserves the existing root
`a11y` form explicitly when compiling `/a11y`; its node form comes from the registry. Layout ordering merges the root attribute
order into that shared form so the existing held attribute remains recognized.
One dispatch plus an import hooks the tooling-only command handler into script.ts;
CLI edits are limited to its sample path, flag declaration and usage.

No focus-module source edits were made. Reusable focus evidence: `modules/focus/test/core/focus.test.ts`,
`modules/focus/test/web/focus.test.ts`, and
`spec/conformance/input-focus-{target,next,previous,left,right,up,down}`.
Those rows are not newly closed: the earlier focus oracle notes say the CLI was
unavailable, whereas this checkout can dump semantics; logical focus captures have
not been renewed. Ancestor machine conditions and repeat focus are also incomplete. Native CLI `--help`, `docs semantics`, and `schema --search Semantic --json`
confirm headless tree/action support; a skip claiming no headless support would be
false. No native captures or new completed oracle cases were made before the stop.
The one pending oracle/conformance scaffold stays marked TODO. No Rive documentation
text, binary, generated build folder, watermark material, or source code was committed.

Unfinished behavior: group painted bounds and path/stroke extrema, nested/repeated
ordering and focus, transparent modal scopes, semantic restrictions in traversal,
ancestor focus conditions, robust read-dependency invalidation, read-only data/action
edge cases, trait/default completeness, Solo state, and filtered semantic snapshots.
Conformance snapshots and independent logical-tree oracles are still required.

All wave-2 rows remain untouched: a11y.web-overlay, a11y.overlay-policy,
a11y.focus-sync, a11y.roving-focus; host-api.semantic-overlay,
host-api.keyboard-focus, host-api.low-level-focus. Live announcements and the full
host-api.low-level-semantics row also need wave-2 integration.

## Rows left (none closed)

Each row below remains planned because the module budget and complete evidence gate
are unmet, even where its prototype or P4d counterpart exists:

- `a11y.ancestor-focus`
- `a11y.check-checked`
- `a11y.check-mixed`
- `a11y.check-unchecked`
- `a11y.focus-action-target`
- `a11y.focus-action-traversal`
- `a11y.focus-condition`
- `a11y.focus-retarget`
- `a11y.headless-inspection`
- `a11y.property-heading-level`
- `a11y.property-hint`
- `a11y.property-label`
- `a11y.property-value`
- `a11y.role-alert-dialog`
- `a11y.role-checkbox`
- `a11y.role-dialog`
- `a11y.role-group`
- `a11y.role-link`
- `a11y.role-list`
- `a11y.role-list-item`
- `a11y.role-none`
- `a11y.role-radio-button`
- `a11y.role-radio-group`
- `a11y.role-slider`
- `a11y.role-tab`
- `a11y.role-tab-list`
- `a11y.role-text`
- `a11y.semantic-diffs`
- `a11y.spatial-focus`
- `a11y.state-disabled`
- `a11y.state-expanded`
- `a11y.state-focused`
- `a11y.state-hidden`
- `a11y.state-live-region`
- `a11y.state-modal`
- `a11y.state-read-only`
- `a11y.state-required`
- `a11y.state-selected`
- `a11y.state-toggled`
- `a11y.tab-focus`
- `a11y.trait-checkable`
- `a11y.trait-enablable`
- `a11y.trait-expandable`
- `a11y.trait-focusable`
- `a11y.trait-requirable`
- `a11y.trait-selectable`
- `a11y.trait-toggleable`
- `a11y.tree-bounds`
- `a11y.tree-visibility`
- `host-api.low-level-semantics`
- `input.semantic-decrease`
- `input.semantic-increase`
- `input.semantic-tap`
- `tooling.headless-semantic-actions`
- `tooling.headless-semantics`

## Final verification note

Final focused a11y + markup scope: 2,445 passed, 445 skipped/filtered, one TODO,
zero failures. All project typechecks pass. The bell's unchanged root a11y round-trip
was independently checked in `verification/root-roundtrip.txt`; the earlier missing
root-held attribute-order expectation is fixed. Final wiring and AniML artifact
checks pass. Lint/format pass. Final size: a11y3,623/2,048 FAIL, base20,369, full114,392;
all other size budgets/ceilings pass. `npm run test:scope -- changed` exits1: 6,176 passed, 44 failed, 1,152
skipped, 45 TODO; 204 files pass,20 fail,13 skip. The run includes the root-held
assertion fixed afterward and verified by the final focused scope. Remaining failures
include browser/hook timeouts, prefix/module-order/raster/authoring timeouts, a failed
scaffolder test subprocess, and cleanup errors after timed-out setup. High shared
load was observed, but causes are not proven for every failure; these failures remain
unresolved, not waived. No full rerun was made after the small root layout fix.
