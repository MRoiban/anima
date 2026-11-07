# BF-4 — downstream runtime bugs B14–B19

Status: **partial**. Branch `t3/fix-downstream-runtime-bugs`, baseline `1d0b8d80`.
B14, B15, B17, B18 and B19 are implemented; B16 requires a protected host-file change.
The strict oracle also rejects the decided B14 circle approximation against its frozen reference.
No push or PR was made. The downstream checkout was read only through
`git -C /data/t3/projects/anima-kit show 3ee3000:<path>`.

## Findings and implementation

| Item | Base reproduction | Change and decision | Retained coverage / conformance |
| --- | --- | --- | --- |
| B14 | **Yes.** `modules/paint/test/core/paint-geometry.test.ts`: 40×40 corners emitted Q, not circular C. | Rects use quarter-circle cubic controls with k=4(√2−1)/3; axes clamp independently to half width/height, producing ellipses when unequal. Polygon/star rounding is unchanged. Standard independent geometry, no source port. | Same test checks 40×40 and 40×20; new independent `spec/conformance/paint-shape-corners/expected-paths.json` checks the existing animated scene at 0/0.5/1s. Existing numeric snapshots remain unchanged. |
| B15 | **Yes.** Corrected scene fails on the base overlay: second radio has tabindex 0. | Reuse tab-list roving for radio groups, filter by child role and disabled state; checked/first fallback, arrows wrap, focus and select through semanticAction. Authored selection triggers own exclusivity. Tabs retain manual activation. Tooling mirrors radio keys. | `modules/a11y-dom/test/web/bf4.test.ts`, focus absent/present, Tab entry, ArrowRight selection, Tab exit and Shift+Tab re-entry; new `a11y-bf4-radio` conformance case. |
| B16 | **Yes.** Escape and pointerdown/move/up fail ancestor bubble listeners. | **Blocked, propagation behavior unchanged.** Removing stops caused duplicate root Enter activation in existing overlay tests, and the input adapter would also duplicate base pointer delivery. No protected host file was edited. | Two explicit `it.fails` repros in `modules/a11y-dom/test/web/bf4.test.ts` per engine. These are unresolved bugs, not passing functionality. |
| B17 | **Yes.** Unknown roles/controls rejected on base. | Add progressbar, meter, status and controls in existing modules. Numeric ranges reuse the bound-value contract; progressbar may omit value. Status defaults polite; controls is a validated local semantic id, prefixed in nested output, and mapped to a shadow-root id/aria-controls. These are **Anima extensions with no parity inventory rows**; no inventory row/status invented. | `modules/a11y/test/core/bf4.test.ts`, `test/cli/bf4.test.ts`, DOM BF-4 suite; new `a11y-bf4-roles` conformance case. Invalid target/type/missing meter value diagnostics retain code, field pointer, message and hint. Nested instances keep distinct controls relations. |
| B18 | **Not reproduced** after sampling the initial value. | Existing interpolate supports duration and timeline easing on geometry. Added a travelling-indicator recipe to AUTHORING, data/convert docs and an example pair. No new runtime feature. | `modules/convert/test/core/integration.test.ts` verifies x≈31.5357 halfway through a 200ms ease-in, retarget continuity, final x=0 and settlement. CLI docs test checks both data and convert recipes. |
| B19 | **Yes with lists**, headless and browser. Plain input writes already work without lists. | Lists' renderer-local Model clone lost input configuration keyed by Model identity. Key configuration by the retained compiled input-table identity. Include repeated players in input pointer/key routing with repeat spacing in the matrix and dotted key targets. No data storage/bind/components changes. | `modules/input/test/core/bf4-writes.test.ts`, `test/web/bf4-writes.test.ts`, `test/fixtures/bf4-writes.json`: set/copy, pointer x/y/deltas and key name writes, root, two explicit component levels and both list items; both authoring spellings headlessly. New `input-bf4-data-writes` conformance case. |

B19's fixture deliberately uses explicit nested data contexts. Implicit propagation is BF-1's
scope; this change does not claim to fix it. Missing/removed repeated key targets still reject.
Player controllers and queued writes remain player-local; compiled listener configuration is shared.

## BF-2 rechecks and discoverability

The large 1200×350 host scene combines a slider and an activate-trigger button without focus.
The range has identical pixels with opacity zero and lifted to one, and ArrowRight still adjusts it:
the reported painted-thumb magnification does not reproduce after BF-2.

A narrower no-focus activation issue **does reproduce**: a trigger queues machine entry actions,
but the overlay only invalidates paint, leaving a settled host asleep. After an accepted action,
the overlay now calls play on an unpaused host, allowing the queued work/animation to finish.
Explicit pause remains respected. The radio scene with queued enterActions and the scaled
trigger scene retain this regression. Native Enter and Space behavior still comes from buttons.

Modal and expanded were already present in validation, node semantics, ARIA output and
`anima schema a11y`; the kit's absence claim is not reproduced on this baseline. The old
short authoring guide concentrated on checkboxes/sliders. New docs distinguish node semantics
from root a11y, include dialog/progress/status/controls examples, and point to the correct
schema topic. `schema rect.a11y` only describes the object field, so it is not the right command
for enumerating its child roles/states. CLI docs and semantic snapshots are tested.

## B16 integration seam

The decided end policy remains: never stop DOM propagation; preventDefault only consumed events.
Completion needs two guards in the protected `packages/web/src/index.ts`:

- Exclude semantic-origin key events from root accessibility activation (`#key`).
- Exclude events already owned by input, and semantic-origin events, from legacy pointer routing (`#ptr`).

Then remove the input adapter's stopImmediatePropagation calls and the overlay's stops, while
leaving semantic keys out of focus's generic bubble handler. The temporary removal without those
guards failed `overlay.test.ts`'s existing root/native activation test. The focused module guard
experiment was reverted too. No partial propagation policy is shipped and no base-host edit was made.

## Oracle disposition

`node tools/oracle.ts --strict` exits **1**. The regular `rect-corners` case (no finding.json for
this case) changes from maxDiff 70 / 44 pixels over threshold (0.076389%) to maxDiff 190 /
153 pixels (0.265625%). The fixed bounds are maxDiff 90 and 0.12%. Circular corners follow the
owner's decision but do not match this frozen reference. This needs orchestrator/owner resolution;
no threshold, reference input, measurement tool or finding was edited. Automatic metrics/PNG
outputs from the run were restored; the comparison is in `verification/bf4/rect-corners-comparison.json`.

No other oracle metric changed. The independent circle tests and deliberate drawing expectations
remain the definition used by this implementation; the oracle failure is not described as a pass.

## Verification

The final bounded `VITEST_MAX_WORKERS=2 npm run test:scope -- changed` run exits 1:
8,192 passed, 4 failed, 4 expected failures (B16), 1 skipped and 40 inherited TODOs.
It includes Chromium and Firefox. The four failures are:

- B19 Firefox test coordinates landed on half CSS pixels (y=6.8 rather than the requested 7).
  An isolated run reproduced it; the test now uses integer CSS-pixel points with the same assertion
  precision. `writes-both-final.txt` verifies **2/2** in Chromium/Firefox. No runtime change.
- Module-order exceeded the unchanged 30s limit in the broad run. Its isolated retry passes **1/1**
  in 27.09s (`module-order-retry.txt`), identifying this timeout as load-sensitive.
- `tools/oracle.test.ts` fails only rect-corners, as above.
- The scaffolder's nested Vitest command also fails; an isolated retry is **3 passed / 1 failed**.
  A disposable-copy replay of its exact nested selection verifies 908 passes / 1 failure / 30 TODOs;
  the sole failure is the same rect-corners oracle (`scaffolder-diagnosis.json`), not another bug.

After the two recoveries, **8,194 distinct ordinary checks are verified**, with two failing checks
remaining plus four intentionally unresolved B16 repros. No green monolithic exit is claimed.
The frozen focused unit suites pass **49/49** (`unit-frozen.txt`); the three new conformance cases
pass **3/3**; new browser coverage totals **10 passes + 4 expected B16 failures** across both engines.
Strict oracle: **265/266 regular cases and 474/475 samples pass**, with rect-corners the sole changed
metric; pre-existing findings remain unchanged. Test source changed only to fix the B19 coordinate
assumption after its broad-run failure, so its old stack excerpt points at the newer source lines.

The unbounded changed run was stopped under shared-machine load (~31, available RAM ~2GB)
and restarted with VITEST_MAX_WORKERS=2, retaining test selection and timeout limits. A green
unbounded exit is not claimed. Earlier corrected test-authoring failures (machine state pose,
initial converter sample, path decimal precision, schema topic and helper import/return shape)
are retained in the raw logs; none justified changing a limit.

Static typecheck, owned lint, module generation/check, schema/parity/AniML generation and browser
artifact build pass. `node tools/perf.ts` exits 0 (bell 46.2µs; composite 27.9µs; toolbar 38.3µs);
these shared-machine samples are observations, not a non-regression claim. No benchmark record changed.

## Size gates

Official `node tools/size.ts`, min+gzip level 9, all module budgets and six gates pass:

| Entry | Before B | After B | Budget B |
| --- | ---: | ---: | ---: |
| paint | 3,982 | 4,030 | 4,416 |
| input | 6,467 | 6,642 | 7,104 |
| a11y | 2,225 | 2,388 | 2,496 |
| a11y-actions (shared-base compression) | 1,065 | 1,057 | 1,216 |
| a11y-dom | 1,993 | 2,095 | 2,176 |
| surface (shared paint) | 7,607 | 7,661 | 8,192 |
| focus (runtime unchanged) | 3,093 | 3,093 | 3,456 |
| data (docs only) | 6,371 | 6,371 | 7,040 |
| convert (docs/tests only) | 5,856 | 5,856 | 6,464 |

| Gate | Before B | After B | Ceiling B |
| --- | ---: | ---: | ---: |
| core + web | 20,635 | 20,635 | 24,576 |
| largest scene (30) | 52,153 | 52,392 | 65,536 |
| app-UI | 85,244 | 85,673 | 131,072 |
| runtime sum | 104,366 | 104,789 | 163,840 |
| authoring add-on | 14,543 | 14,543 | 16,384 |
| heavy | 109,982 | 110,382 | 256,000 |

No optional module was needed; no ceiling was raised. No shipped dependency, licence file,
external source algorithm or new inventory row was added. The existing platform/graph separation
follows `docs/research/rive-web-runtime.md` and `docs/research/rive-format-and-graph.md`.
No external runtime source, CLI documentation text or prohibited binary format was used.
