# P3b-4 implementation handoff

Branch-only implementation of DESIGN §6 (excluding stop and libraries). No PR, push or publication.

## Implemented and existing evidence

- Existing host/component/color/batch behavior was verified rather than rebuilt. Local component
  definition-name setters are exercised in `modules/host-edit/test/{core,web}/components.test.ts`;
  native color/nested values in `modules/host-edit/test/core/oracle.test.ts`.
- `HostData.at(path)` auto-selects a discriminated typed scalar handle. Named/nested/indexed paths
  reuse host validation and queue semantics. `exportedInstances()` returns authored exports only.
- `data-host` installs frozen computed geometry snapshots and validated binding asset literals.
  The existing data/bind evaluator already compares two live paths; independent guards now prove it.
- Input supports scalar `write`/`value`, five data sources, wrong/read-only target diagnostics, and
  per-pointer grid deltas. Scalar AniML data paths use the existing data markup form hook.
  Gamepad payload reading moved from data into input, preserving the protected data size.
- Image `asset` addresses use the assets module model hook, preserving old registry ordering and
  every existing compiled AniML document. Replacements are player- and path/request-local runtime
  resources; copying a runtime ID does not make a later URL replacement mutate the copied image.
- `icon.src` directly reflects the attribute (null if absent). Compiled source-cache loads also
  attach input DOM listeners, through the input module's `loadModel` wrapper.

## Measurement

All values are min+gzip from unmodified `tools/size.ts`.

| Code touched | Before | After | Change |
|---|---:|---:|---:|
| core + web | 20,362 | 20,386 | +24 |
| data-host | 0 | 907 | +907 |
| input | 6,172 | 6,428 | +256 |
| data | 8,034 | 7,991 | -43 |
| host | 3,463 | 3,569 | +106 |
| host-edit | 3,437 | 3,673 | +236 |
| assets | 1,713 | 1,791 | +78 |
| full-featured total | 111,723 | 113,226 | +1,503 |

Protected bind remains 2,038 B; components remains 4,051 B. No existing budget, measurement tool,
input, finding record or benchmark record was edited. The oracle manifest and generated metrics
append five new comparisons; all pre-existing entries remain byte-value equivalent.

`tools/perf.ts` before → final after: bell compile 7.13→5.13 ms; all 9,040 prefixes
1,923→1,237 ms; bell frame 109.4→96.8 µs; composite 76.6→46.8 µs; toolbar 88.0→55.1 µs;
toolbar compile 11.23→9.89 ms. These are noisy single-run measurements on a machine with concurrent wave work;
no regression is observed, but they are not an isolated statistical non-regression proof.

## Oracle evidence and deviations

Fresh independently authored native listener captures match all four pointer sources exactly
(16 observations). A two-live-path comparator matches 1→9 (two observations). Existing cases,
metrics and findings were preserved. The key-name source is skip-noted with native/control evidence:
CLI 1.9.1 delivers the same key event to a constant-string control, while keyPressed leaves the
string empty for both F13 and printable a. Browser tests exercise an actual F13 KeyboardEvent. Host-only discovery, batching
and computed snapshots have explicit skips; native nested/color values retain existing evidence.

The scaffolder/runtime reject hyphenated names. The scaffold used `datahost`, then generated
public adapters from `modules/data-host`; the document feature is `datahost`. No tooling validator
was changed. The 18 inventory rows retain planned status with implementation/evidence mappings:
`tools/parity.ts` rejects done rows in a phase not yet wholly finished. The parent integrator must
promote them when closing P3b; changing that invariant is outside this ticket.

Computed bounds are geometric axis-aligned bounds, including descendants and analytic cubic
extrema, excluding strokes/clips/masks/effects; the normative module spec states that limit.
Static image consumers without asset bindings retain legacy per-player resource replacement.
Decoded replacement resources remain in the player-local catalog until collection; reload starts
fresh resources. This deliberately preserves IDs copied into another property.

## Verification

Implementation is complete. Inventory promotion remains with the parent phase integrator.

Focused scope: 35 files, 2,815 tests pass; 353 other conformance cases filtered. Both browser engines
pass all eight new data-host cases, including both module arrival orders. Typecheck, ESLint, Prettier,
module wiring, schema generation, 486 AniML artifacts, size budgets and strict oracle all exit 0.
Strict oracle: 258 cases / 467 observations, including 18 new exact observations. The full changed scope and isolated rerun results are detailed below; their raw logs are in
verification/.

Final checks and scoped test results are recorded in `verification/`.
Earlier development failures are retained in WORKLOG and verification notes: missing dependencies,
scaffold marker/corpus formatting mistakes, malformed test fill, a transient asset-slot typo,
a malformed PNG corrected to a decoded existing fixture, and contention timeouts. The real cached-load input-listener bug was fixed, not waived. Full scope also caught a CLI
help-description regression after wrapping write in a union; its metadata moved to the parent
shape, and the CLI/input follow-up passed 2,702 tests. The full changed scope completed with 7,475 passing tests and one module-order timeout (30 s);
the isolated module-order test subsequently passed unchanged. The unit-only retry passed 4,757
tests with three timeouts (module-order plus two scaffolder cases); all three timing cases subsequently passed unchanged in isolated runs. The primary scaffolder
case passed in 45.14 s, against 44.19 s on unchanged baseline 98c17e2; its earlier 88.31 s timeout
coincided with host load above 38 on 12 CPUs. Module-order passed with its existing 30 s limit.
These are timing failures in the recorded broad runs, not waived or raised thresholds.

A retained handle now rejects starting an image decode after destroy; both-engine regression and
normal host-edit scope passed 1,032 tests after this final lifecycle guard.

## Rows ready for parent promotion

- `assets.replacement-scope-image`
- `components.host-artboard-reference`
- `data.host-artboard`
- `data.host-color`
- `data.host-nested-paths`
- `data.instance-export`
- `host-api.batched-binding`
- `host-api.bindable-artboards`
- `host-api.data-artboard`
- `host-api.data-color`
- `host-api.nested-models`
- `input.write-key-pressed`
- `input.write-pointer-delta-x`
- `input.write-pointer-delta-y`
- `input.write-pointer-x`
- `input.write-pointer-y`
- `state-machine.condition-data`
- `transforms.computed-transform-values`
