# P3c-9 implementation handoff

Status: **partial**. Branch `t3/bindable-artboards-computed-coordinates`, based on `f6f28753`.
No push, PR, publication, budget change, measurement-tool/input edit or inventory-status change.

## Closure-ready rows

- `transforms.computed-transform-values`: `Player.computed(id)` adds recursively frozen
  `local` and `root` position/rotation/scale snapshots alongside world matrix, bounds and opacity.
  Analytic tests cover parent transforms, pivots, reflection and degenerate scale; the browser
  tests exercise separately loaded bundles in both registration orders and engines.
  Semantics and shear/embedding-space limits are normative in `modules/data-host/SPEC.md`.
- `host-api.deprecation-policy`: `AnimaIcon.warnings = {off: [ids]}` suppresses stable IDs
  selectively. Tests exercise policy transitions, repeated calls, suppressed calls not consuming
  once history, and the unchanged once/always/off policies. See `modules/devtools/SPEC.md`
  and `modules/devtools/test/core/policy.test.ts`.

Both rows remain `planned`, as instructed. Host-only inspection/policy changes add no document
fields, registry entries, diagnostics, CLI syntax, AniML vocabulary or Player.step output.
The existing independent analytic tests and browser tests supply the applicable conformance;
existing native oracle skips remain accurate. No native parity is asserted for these APIs.
The optional host instrumentation boundary follows `docs/research/rive-web-runtime.md`,
Lessons 12–13; computed geometry uses the existing core affine matrices.

## Open rows and limits

- `host-api.performance-marks`: the complete trial added `anima:load`, `anima:first-frame`
  and `anima:load-to-first-frame` using loadModel and the first built-frame load event.
  It measured **377 B / 320 B** for devtools, with selective warning suppression included.
  Rejected rather than raising the budget. The retained code still instruments frames only.
  The trial source and full size output are retained in verification/p3c9 as rejected evidence;
  that candidate is not shipped or claimed lifecycle-correct (overlapping asynchronous loads
  would also need listener cancellation).
- `components.host-artboard-reference`, `data.host-artboard`, `host-api.bindable-artboards`,
  `host-api.data-artboard`: **not implemented**. No `componentFrom` or associated-data assignment
  is shipped. The local-name tests continue to pass; they do not close these rows.
  Current validation (`modules/data/core/storage.ts: accepts`) admits strings only, nested
  selection (`modules/nested/core/index.ts`) resolves compiled per-node local placements,
  and host component handles (`modules/host/core/api.ts`) are `DataHandle<string>`.
  A correct change needs source-document ownership, per-target assignment identity, associated
  data binding, reload/destroy semantics and rendering isolation. No complete artboard candidate
  was measured, so this report does **not** claim a proven minimum byte cost or budget impossibility.
  The measured remaining runtime allowance after computed coordinates is 102 B; a coordinated
  nested/data hook change and a fresh byte measurement remain work for the integrator.

The existing `tests/oracle/data-host-artboards/skip.json` covers local assignment only; no native
capture or expanded skip is presented as cross-document evidence. No native CLI commands were run.

## Verification and measurements

Final results are recorded below; raw logs are under `verification/p3c9/`.

| Gate (min+gzip B) | Before | After | Delta |
| --- | ---: | ---: | ---: |
| core + web | 20,622 | 20,622 | 0 |
| largest scene (29 scenes) | 51,873 | 51,873 | 0 |
| app-UI | 85,186 | 85,186 | 0 |
| runtime sum | 104,441 | 104,539 | +98 |
| authoring add-on | 14,440 | 14,457 | +17 |
| heavy | 109,974 | 110,076 | +102 |

Runtime growth is below this ticket's +200 B allowance. The combined P3c target of 104,472 B
is nevertheless exceeded by 67 B on this base: the integrator must recover it elsewhere.
Authoring remains below the stricter 15,360 B P3c target. Every module and all 29 scene budgets pass.

| Owned module | Before | After | Budget |
| --- | ---: | ---: | ---: |
| data-host (runtime changed) | 885 | 967 | 1,024 |
| devtools (authoring changed) | 283 | 299 | 320 |
| host (unchanged) | 3,570 | 3,570 | 3,968 |
| host-edit (unchanged) | 3,663 | 3,663 | 4,032 |

Untouched measurement tools produced these figures. The first overlapping baseline attempts
were stopped and replaced by a completed frozen-HEAD run before candidate restoration.
The rejected full devtools trial and retained source were measured in separate complete runs.

Performance before → after: bell compile 3.13 → 7.06 ms, prefix sweep 642 → 1,961 ms;
bell frame 33.4 → 124.4 µs, composite 21.4 → 74.8 µs, toolbar frame 27.5 → 108.6 µs,
toolbar compile 3.97 → 13.94 ms. Both commands exited 0, but these measurements **do not meet
or establish the ≤3% condition**. Shared-host load was 19.52 on the later sample with concurrent
browser and size jobs. The changed API is on-demand inspection; no baseline scene invokes it,
and devtools is absent from those scenes. A controlled comparison remains unverified; the
slower measurements are reported, not normalized or claimed passing.

Verification completed so far:

- Focused unit scope: 1,083 passed, 498 filtered/skipped.
- Owned full scope: 1,257 passed, 497 filtered/skipped, one failed standalone demo cache check.
  The build was launched concurrently with tests; its cache was not ready when that assertion ran.
  A fresh cache fingerprint matches the source, and the isolated unchanged demo assertion passes
  in both Chromium and Firefox (2 passed). The functional owned browser cases all passed.
- Module wiring, full repository typecheck, changed-TypeScript ESLint and Prettier: exit 0.
- Browser artifact regeneration: exit 0; generated tracked output unchanged.
- Strict oracle: exit 0, 266 cases / 475 observations; existing findings and pending/skip reports
  retained. No oracle inputs, expectations, findings or comparator thresholds were edited.
- Final size: exit 0; all existing caps pass, with the stricter P3c integration caveat above.

Deviations/problems: partial ticket (five open rows); full initialization-marks candidate rejected
at its existing module budget; cross-document assignment has no completed or measured candidate;
≤3% performance condition is unverified; the first browser cache check raced artifact generation.
Historical WORKLOG was condensed per the repository's 200-line rule. No external service changes.

The broad `changed` scope against main completed with **8,069 passed / 2 failed / 40 TODO**
(578.71 s). Besides the already isolated demo cache check, scope-selection coverage found the
new policy test was incorrectly placed at `test/policy.test.ts`: package scopes require a
`test/<package>/` directory. Moved it to `test/core/policy.test.ts` and corrected relative imports;
all seven scope-selection tests plus the policy test now pass (8/8). This was an implementation
mistake, not a load-only timeout. The final ticket-only rerun uses `changed --base=HEAD`; it
compares all staged/unstaged/untracked ticket files with the immutable task base, retaining browsers.

Final frozen-source verification after relocation: **`npm run test:scope -- changed --base=HEAD`
passes 1,171 tests in 10 files**, with 498 filtered/skipped and both browser engines included
(92.12 s). Full typecheck, changed-TypeScript ESLint and Prettier pass again. No timeout limits
were changed. The two earlier failures and their passing isolated/final reruns remain recorded;
the failed broad run is not represented as green. `verification/p3c9/checks.json` records command
exit states. Final head SHA is supplied with the commit handoff (a report cannot embed its own
commit hash).
