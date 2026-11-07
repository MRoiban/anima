# P6-10 — string functions for bind expressions

Status: **done**. All ticket checks pass; the broad run retains four timeouts, all passing
on isolated file retries at the unchanged limits. No push or PR.
Branch: `t3/implement-p6-10-ticket`, base `9f8b5921`; final head is in the handoff.

`contains(text, part)` returns bool, including true for an empty part. `lower(text)` returns a
string via Unicode default `toLowerCase`. Both require string operands and share the existing
parser in bindings, set actions, derive and scalar guards. No registry field or spelling changes.
The spec documents UTF-16 substring matching, no normalization/full folding, and the existing
parenthesized guard form. Core/web remain dependency-free.

No parity rows are assigned or closed. This extends existing bind syntax; there is no new row to
pass to the capability scaffolder. Inventory statuses are unchanged. The scalar-oracle disposition
is in [ORACLE.md](ORACLE.md); no new native raster comparison or benchmark rerun is claimed.

Seams outside `modules/bind/` and the owned guide/spec sections:

- `spec/conformance/bind-string-filter/`: one case, six independently specified snapshots. A query
  write or label rename updates derived visibility and count in the same `step(0)`. The count is
  declared before its computed dependencies to exercise graph evaluation rather than source order.
- `packages/markup/test/corpus.test.ts`: corpus count 569 → 570, marked `seam(P6-10)`.
- `modules/data/SPEC.md`: short data-doc filtering recipe/link, marked `seam(P6-10)`.
- `WORKLOG.md`: required append-only checkpoints. No CLI, text, text-input or benchmark edits.

Verification evidence is in `verification/p6-10/`:

- `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: 9,096 passed / 4 failed / 94 existing
  TODO; 285 passing files, 3 failed files and 13 skipped. Both engines and the executable authoring
  guide were included. All four failures are existing test/hook timeouts: host-edit Firefox
  components twice (5 s), BF-4 Firefox input setup (10 s), markup prefix compiler (5 s).
  Isolated file retries all pass at unchanged limits: host-edit 4/4 (5.07 s), BF-4 input
  2/2 (6.49 s), compiler 51/51 (2.85 s). Broad exit 1 is retained; no full-green claim or
  second broad run. The compiler prefix case also passed in the earlier Chromium scope.
- `npm run test:scope -- bind conformance --browser=chromium`: 3,740 passed, 1 filtered skip,
  15 existing TODO, 13 passing files. Includes all 43 new string tests and the six-snapshot case.
- `npx vitest run --project browser modules/bind/test/web/bind.test.ts -t Firefox`: 1 passed,
  1 filtered skip. Both engines exercise string calls in the shipped terse bind bundle.
- `node tools/oracle.ts --strict`: exit 0, 288 completed cases / 501 samples, 24 retained findings.
  No oracle case, threshold, finding, benchmark record or measurement input changed.
- Full typecheck, changed-source ESLint, module wiring check, browser build (56 entries) and
  AniML rebuild/check (632 sources) pass. Guide executable examples are included in changed scope.
- CLI `validate` and `schema bind` pass. Sampling the new example with the generated font produces
  counts 2 → 1 → 2 for empty → `SO` → empty, with matching visibility in the same step.
- `node tools/perf.ts`: exit 0 before/after. Bell compile 7.83 → 6.94 ms, bell frame
  125.9 → 93.5 µs, composite 94.2 → 55.8 µs, toolbar compile 13.96 → 12.13 ms and frame
  99.5 → 82.5 µs. Shared load was about 17; these are not evidence for the ≤3% guard.

All measured min+gzip sizes pass. Only these module entries changed bytes (the latter two bundle
the same expression parser); markup-bind remains 125/192 B. All other module entries are unchanged. A separate bundle of the new example's declared features
(including all text-input adapters, using the unchanged browser build helper) is 51,090 B, below
the 65,536 B scene ceiling; no size-tool input or budget was changed.

| Entry | Before | After | Budget |
|---|---:|---:|---:|
| bind | 1,824 | 1,904 | 2,048 |
| machine | 6,054 | 6,131 | 6,720 |
| convert | 5,851 | 5,917 | 6,464 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core + web | 21,136 | 21,136 | 24,576 |
| largest scene (30) | 53,780 | 53,857 | 65,536 |
| app-UI | 98,604 | 98,680 | 131,072 |
| runtime sum | 118,830 | 118,909 | 163,840 |
| authoring | 14,649 | 14,649 | 16,384 |
| Rive-class | 128,449 | 128,527 | 256,000 |

Design deviations: none; bind grows 80 B, below the 120 B target. No parser fork, host helper or
optional entry is needed. Standalone bool guards retain their existing parenthesized syntax.

Problems: no unresolved ticket failure. Broad timeouts passed isolated retries. Native field commit/session settling belongs to P6-9b; this ticket proves the same-step
behavior of a queued `$query` write. The owner's fresh AniML search-card benchmark rerun remains
outstanding. Development checks caught an unparenthesized guard fixture and canonical empty
instance values; those fixtures were corrected without changing core guard grammar. One manual
schema probe used unsupported `--json` (usage exit 2); the corrected `schema bind` command passes.
