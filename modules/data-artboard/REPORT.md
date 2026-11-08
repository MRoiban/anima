# P7-5 implementation report

Status: **partial**; all four inventory rows remain planned for browser resource ownership.

The optional `data-artboard` browser entry extends the active data/compiler registry,
compiles the source `artboard` type to the existing component storage type, installs
`data.artboard(path)` and exposes `icon.component(loadedModel, name)`. External values
keep lexical component models; selection uses the existing nested-player machinery.
Same-selection writes preserve state; changed selection restarts the child clock.
External assignment identities belong to the target root player; inherited and
repeated descendants use that owner. Placements are installed for the synchronous
step and restored, so players sharing a compiled model remain isolated. Existing explicit, inherited and repeated data contexts are reused.

The small seams are the validated component catalog and dynamic ancestor exclusion
in `modules/components/core/index.ts`, native-only grammar installation in
`modules/components/markup/index.ts`, active host API class exposure in
`modules/host/core/index.ts`, foreign inherited default-instance rebinding in `modules/data/core/compile.ts`,
the data JSON-schema expectation in `modules/data/test/cli/data.test.ts`,
the existing repeated-parent map exposed in `modules/lists/core/index.ts`, and the
conformance count/name whitelists in
`packages/markup/test/{corpus,decompile}.test.ts`. Generated adapters, schema and
parity views are regenerated. No measurement tool, threshold, benchmark record,
or oracle finding was edited. No PR or push is part of this ticket.

Implementation evidence is in `test/core/artboard.test.ts` (seventeen independent host,
identity, context and diagnostic regressions), `test/web/artboard.test.ts` (both
engines, two import orders, SVG/canvas and browser AniML), and four standard
conformance cases. The complete native limitation and reused capture evidence are
in [NATIVE.md](NATIVE.md); the four native probes are explicit skips. No new native
capture is claimed.

Known API limits: external components cannot add scoped input names to an already
loaded parent. External handles expose a stable opaque string; retain the assignable
value to reuse it. Source-spelled artboard properties use the existing component
storage/metadata representation. Browser authoring loads `markup-data-artboard`
after the runtime entries. A controlled performance A/B has not been established
on the shared machine; an ordinary perf command is not evidence for the ≤3% guard.

Remaining implementation: an external model reference does not transfer the source
image resolver/base-URI catalog or retain font faces in the destination. See the
normative remaining-work section in SPEC.md. Font ownership is held by the source
FontController (`modules/fonts/web/index.ts`); its cleanup releases faces, whereas
assetio installs resolver catalogs per player/model (`modules/assetio/web/index.ts`).
Closing the four rows needs a resource-context bridge with destination ownership,
including unused source components, two sources/resolvers sharing a compiled model,
source reload/destroy tests with images and generated-font text, and cross-document
data-schema compatibility validation. None is claimed
by the vector-only browser lifecycle tests. Generic host metadata continues to report
the component storage type for the source-spelled artboard alias.

## Verification

- `npm run typecheck`, changed-file ESLint, module wiring, parity views, generated
  schema/AniML and Prettier checks: pass.
- Focused unit/CLI/conformance run: 603 pass / 7 inherited TODO before the cyclic
  regression was added; the final host file is 17/17 pass.
- Own SVG/canvas/AniML browser suite: 6/6 pass (3 Chromium, 3 Firefox), including
  source reload/detach. The final full run also selects these tests.
- Earlier full run: 9,325 pass / 7 fail / 54 inherited TODO. One stale JSON-schema
  type expectation was corrected; the other six were Firefox deadlines in
  componentpaint/nested. Original-limit isolated retries: 12/12 and 10/10 pass.
- A later run saw the newly added cyclic test with the previously cached JSON
  clone implementation (9,332 pass / 1 fail / 54 TODO). The final implementation
  copies only schema descriptors, preserving the normal cyclic-data diagnostic
  path; its focused 17/17 pass is from a fresh process. Final fresh full-run
  outcome is recorded below.
- New end-to-end browser tests use a 20 s case deadline and 30 s setup deadline:
  eight separate bundles, three document loads, renderer transitions and source
  lifecycle work exceeded the initial 5 s defaults under shared load. Existing
  test deadlines and measurement thresholds were not changed. Initial own runs
  had test/setup timeouts; both engines now pass the complete owned file.
- `node tools/oracle.ts --strict`: exit 0, 309 cases / 524 time samples, inherited
  findings retained; four new host-only evidence-backed skips, no new comparison
  or widened threshold.
- `node tools/perf.ts`: exit 0, bell compile 4.03 ms / prefix sweep 1,077 ms;
  bell/composite/toolbar frame 49.7/34.8/46.8 µs; toolbar compile 6.26 ms. Shared
  load reached 83 earlier in the session; these are not controlled A/B evidence.
  The ≤3% guard remains unverified.

## Measured bytes

`node tools/size.ts`: final source, exit 0. Baseline was a dependency-isolated
archive of 049f5d6. Its authoring measurement was 14,742 B, whereas the shared brief
lists 14,717 B; the observed baseline is reported without normalization.

| Entry (min+gzip B) | Before | After | Budget |
| --- | ---: | ---: | ---: |
| data-artboard (over nested) | — | 1,013 | 1,024 |
| markup-data-artboard (over markup-hooks) | — | 35 | 256 |
| components | 3,331 | 3,394 | 3,456 |
| host | 3,679 | 3,685 | 3,968 |
| lists | 4,596 | 4,603 | 5,120 |
| data | 6,470 | 6,515 | 7,040 |
| markup-hooks | 4,511 | 4,534 | 4,544 |
| markup-components | 768 | 768 | 896 |
| markup | 7,341 | 7,341 | 8,192 (must not grow) |
| markup-libraries | 2,176 | 2,176 | 2,176 |

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core+web | 21,136 | 21,136 | 24,576 |
| largest scene (30) | 53,857 | 53,913 | 65,536 |
| app-UI | 98,890 | 99,017 | 131,072 |
| runtime sum | 120,281 | 121,373 | 163,840 |
| authoring | 14,742 | 14,812 | 15,360 owner cap / 16,384 tool cap |
| Rive-class | 130,077 | 131,148 | 256,000 |

## Deviations and handoff

All four rows remain planned; none is closed. Source-spelled artboards compile to
component storage and generic metadata reports that alias. Source component
acquisition uses the provided model's validated catalog; context-dependent
components may require a nested/repeated source model rather than the root model.
The `lists.parents` exposure and foreign-default rebinding in data are additional
small seams beyond the ticket's initially listed components/host seams, required
for repeated/inherited assignment ownership. The shared brief's seam rule is used;
no unrelated refactor was made.

The scaffolder initially rejected a new hyphenated directory. It was bootstrapped
with a valid identifier, moved to the owned directory, and regenerated. Obsolete
package exports from that bootstrap were removed by restoring the generated
package manifests and regenerating them; no generated output was hand-edited.
Several intermediate full/size runs were superseded by source fixes and are not
represented as passing final-source verification. Raw command logs remain at
`/tmp/p7-5-*.txt` in this worktree's environment.

Final fresh full-suite outcome: **9,333 pass / 0 fail / 54 inherited TODO**, 305
passing files plus 13 skipped, both Chromium and Firefox; command
`VITEST_MAX_WORKERS=2 npm run test:scope -- changed`, exit 0, 696.87 s. This run
uses the final source, including the cycle-safe normalization and inherited-default
context seam. No source changes followed it.
