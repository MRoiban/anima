# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

STATUS: P4d-3 implemented and locally verified; no push, PR or merge. Started from 383d99f,
p4d-events HEAD, in the supplied `t3/expression-actions-conditions` branch.

## VERIFY

- `npm run test:scope -- bind events core markup conformance components`: **1274/1274**,
  68 files, including the bind/events/components Chromium and Firefox suites.
- Additional `packages/web/test/markup-hooks.test.ts`: **18/18**, Chromium and Firefox.
- All package/tool typechecks, `npx prettier --check .`, `npx eslint .`,
  `node tools/modules.ts --check`, `node tools/build-web.ts --check`,
  `node tools/build-animl.ts --check`, `node tools/parity.ts --check`, `git diff --check`: exit 0.
- Public CLI validates both share forms without diagnostics; its regression test compares both
  25-click sample streams byte-for-byte. Independent `share-evidence/verify.py`: 6/6 brief items.
- Rest pixel comparison against the unchanged benchmark reference: **0 differing pixels**, max
  channel difference 0, tolerance 0. Tone requests verified through the actual events audio path
  with a mocked AudioContext in both browsers; audible playback is not claimed.
- Extra oracle scope: **902 passed, 1 pending** comparative capture (see below).

## METRIC

Six authoring forms are added/extended: listener expression sets (SPEC §9 and bind / Input
expressions in actions), state entry, state exit, transition actions (same bind subsection and
§7), arithmetic expression comparisons (§8), and typed event expression values (events chapter).
The shared expression language additionally gains `floor` and `mod` calls and events gain a
colour payload type. AniML forms are specified in ANIML / Input expressions in actions and
conditions; CLI schema lists listener string values and machine block fields. Inputs remain
number/bool/trigger: colours can target colour properties/event fields, not numeric/bool inputs.

Seven hand-derived conformance cases added (97 → 104 completed authored cases):
`data-bind-listener-actions`, `bind-action-clamp`, `bind-action-snapshot`, `bind-machine-actions`,
`bind-condition-modulo`, `bind-event-expression`, `bind-action-event-listener`.
Share **6/6**: count 1–25; 25 new-count shared payloads at pulse entry; 25 completions;
milestones 5/10/15/20/25; generated tone request path; rest pixels exact. Source **40 lines,
1,960 characters**, compared with the prior 62-line ladder. See `examples/share-evidence/README.md`
for scripts, raw snapshots, event times, geometry assertions and reproduction.

Unchanged `tools/size.ts`, bytes min+gzip (baseline measured before implementation):

| Entry | HEAD | P4d-3 | Delta | Budget/ceiling |
|---|---:|---:|---:|---:|
| core+web | 19347 | 19767 | +420 | 30720 |
| bind | 1664 | 1866 | +202 | 2048 |
| events | 3419 | 3551 | +132 | 4096 |
| components | 3986 | 3985 | -1 | 4096 |
| markup | 7440 | 7470 | +30 | 8192 |
| full-featured SVG | 55014 | 55857 | +843 | 102400 |
| Rive-class | 59245 | 60115 | +870 | 256000 |

All other module budgets pass. Raw complete size output is in `examples/share-evidence/size.txt`.
No limit, budget or measurement method changed. The exact corpus census increases by seven;
the independent decompile reader now recognizes expressions and JSON action blocks while keeping
whole-document equality checks.

Unchanged `tools/perf.ts`, before:

```text
compile: bell 3.10 ms; all 9040 prefixes 1056 ms
frame: bell 49.3 µs; composite 41.0 µs
frame: toolbar 70.4 µs (step + draw, 4 instances)
compile: toolbar 9.36 ms
```

Final performance run on the exact committed runtime and registry:

```text
compile: bell 2.42 ms; all 9040 prefixes 752 ms
frame: bell 55.0 µs; composite 29.8 µs
frame: toolbar 31.9 µs (step + draw, 4 instances)
compile: toolbar 3.80 ms
```

Other jobs on the machine caused substantial load variation (bell frame 37.5–69.8 µs across
post-change runs); these figures establish neither a speedup nor a sustained frame regression.
The unchanged prefix compile time limit passed throughout final verification.

## DEVIATIONS

There is no separate machine module in this checkout. State/transition blocks extend the existing
core machine through bind registry entries. Machine blocks target local inputs; existing listener
and host scoped writes retain their behavior. Bind supplies pure evaluator closures via the base
runtime's shared module registry, including separate browser bundles; no evaluator copy or cycle
is introduced. All sets in an action read one pre-action snapshot; successive actions see prior
writes. Existing literal types/clamping and 0.1 conformance stay unchanged.

Event expression fields retain existing end-of-local-step payload sampling, after state resolution
and bindings. This is distinct from action-set evaluation, which occurs when its action executes.
String payload braces stay literal. No benchmark run file was changed.

## PROBLEMS

No requested local check is failing. Full CI was not run or claimed. The scaffolder's independent
comparative oracle remains explicitly pending; parity status remains planned. No external Rive
capture is claimed, and no Rive source/docs text or .riv file was read.

Initial development failures were corrected: missing tools (npm ci), stale generated schema,
noncanonical examples, independent reader support for the new forms, an incorrect test API,
a missing paint in a test fixture, and separate-bundle evaluator lookup. The latter is covered
by the share browser test, which checks numeric payload counts beyond ten.
