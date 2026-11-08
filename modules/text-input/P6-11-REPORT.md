# P6-11 implementation report

Status: **partial**. Branch `t3/implement-p6-11-ticket`, based on `790d402b`.
Final head is in the handoff. Local commit only; no merge from p6, push, PR or publication.
Evidence: [verification/p6-11/](verification/p6-11/).

## Rows closed and rows left

No parity row is closed. All three retain `planned` with corrected notes:

- `text.run-list`: Anima already draws the list, including configured text/style fields and live
  mutations. New core, tool outline, `--browser-text`, retained SVG and canvas tests compare
  mutations against literal controls, with both browsers. The blank drawing in P6-9b is from its
  **native** DataBindPath/list scene. A faithful native live-list comparison remains missing.
- `data.property-text-style`: Anima's existing Player/storage and host typed setters already
  accept shared style names and clearing. Wrong-type/unknown-name writes are rejected; host
  errors retain `data-type`, a pointer, message and hint. Host aliases require `data.bind(instance)`;
  explicit instance paths are also supported. The P6-9b property classified as `artboard` and
  rejected by setters is **native-side**. Its faithful native mutation comparison is still missing.
- `text.input-placeholder`: added `placeholderColor` / `placeholder-color` for a distinct solid
  placeholder paint. Default glyphs retain the normal ink (including alpha, stroke and slots) at
  50% opacity, without dimming caret/selection. Type/clear restores the appropriate paint. Normative
  contract, schema, both syntax tests, an original-font drawing conformance vector and an example
  pair are supplied. A faithful native placeholder comparison remains missing. Local native schema
  commands find no placeholder type/property; this does not establish runtime absence and is not
  treated as a parity skip.

No Anima data setter/runtime repair was justified by the reproduction. The ticket's first two
reports were native comparison failures, as P6-9b's report and retained native README files say.
Regressions protect Anima's working behavior instead of introducing speculative changes.

## Orchestrator follow-up: local style paint binding

Reproduced `unknown-address` for a local `styles.s.fill.color` binding in JSON and AniML.
The existing text contract enumerates addressable size/font/spacing fields, not style paint fields.
Clarified that style paint objects are static. The diagnostic now explains two working alternatives:
move the paint to the text node, omit it from the style, then bind `label.fill.color`; or bind
`label.runs.0.style` to a typed property selecting a shared style. Tests verify the diagnostic and
actual color changes through the suggested node-paint fallback in both syntaxes. No new paint-address
runtime is claimed. The clarification lives beside the normative contract in `modules/text/SPEC.md`.

## Seams outside owned files

No source seam outside owned modules. Required generated artifacts: `spec/schema/ani.schema.json`,
`docs/parity/MATRIX.md` and `docs/parity/matrix.json`; append-only checkpoints in `WORKLOG.md`.
The placeholder conformance folder is ticket-owned. No hit files, benchmark records, oracle cases,
references, findings, measurement inputs, budgets or thresholds were edited.

## Verification

- `npm run test:scope -- text text-input --browser=chromium`: **3,259 passed**, zero failed,
  549 filtered, 25 files. Includes literal-control tool and browser-text list/style rendering.
- Owned browser suites, `npx vitest run --project browser modules/text/test/web
  modules/text-input/test/web -t Firefox --maxWorkers=2`: **10 passed**, zero failed, ten opposite-
  engine tests filtered, five files. New browser files separately pass **4/4** across both engines; the stronger final placeholder literal-control test passes **2/2**, with the optional SVG decoration adapter installed. SVG and authored-color pixels are exact; default Canvas glyph alpha versus offscreen node opacity differs by at most one channel level (24 Chromium / 96 Firefox channels in the initial exact comparison).
- Core/drawing/style-hint regressions: **33 passed**; final hint and placeholder CLI run: **17 passed**;
  exact placeholder diagnostic recheck: **8 passed**. Tool/browser-text placeholder pixels match
  independently authored literal controls, including the default half-opacity ink.
- Full typecheck, changed-source ESLint, module wiring, schema generation, parity views/check,
  AniML check (633 sources) and web build (56 entries): exit 0. Formatting and complete changed
  results are recorded below before handoff.
- `node tools/oracle.ts --strict`: exit 0, **307 completed cases / 522 samples**; existing findings
  retained. No new native passing comparison is claimed.
- `node tools/perf.ts`: exit 0. Bell compile 7.65 ms / frame 210.4 µs; composite 81.7 µs;
  toolbar frame 86.4 µs / compile 13.09 ms. Shared-load timings and no controlled before measurement
  mean the ≤3% guard remains **unverified**.

## Sizes

Unmodified `node tools/size.ts`, min+gzip. All module and scene budgets pass.

| Entry | Before | After | Ceiling |
|---|---:|---:|---:|
| text | 6136 | 6136 | 6144 |
| text-host | 355 | 355 | 1024 |
| text-hit (untouched) | 983 | 983 | 1024 |
| markup-text | 530 | 530 | 1024 |
| text-input | 3789 | 3671 | 4096 |
| text-input-svg | 356 | 363 | 512 |
| text-input-clipboard (bundling context) | 118 | 122 | 512 |
| text-input-canvas | 92 | 104 | 256 |
| markup-text-input | -45 | -45 | 192 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 21136 | 21136 | 24576 |
| largest scene (30) | 53857 | 53857 | 65536 |
| app-UI | 98674 | 98674 | 131072 |
| runtime sum | 118903 | 118903 | 163840 |
| authoring | 14649 | 14649 | 16384 |
| Rive-class | 128523 | 128645 | 256000 |

Relative bundle deltas include minifier/gzip context; they are not additive source sizes.
No cap was raised. Authoring also fits the design's stricter 15,360 B guard.

## Deviations, failed attempts and limitations

The opacity implementation stays in input adapters to preserve the full text module's bytes.
The first shared text-renderer candidate was 6,171 B; successive micro-optimization trials still
exceeded the 6,144 B cap and were reverted. No speculative cache/style-loop optimization remains.
The type-only drawing opacity field adds no display bytes. Diagnostic wording is omitted entirely
from terse builds. Input SVG order hooks use the existing chained descriptor pattern to preserve
other renderer adapters; canvas uses its existing field-decoration hook.

Initial reproduction scripts forgot the tool font override and the host instance binding; corrected
scripts demonstrate the working paths. First new core invalid-value tests mistakenly called a
nonexistent generic host setter; changing the test to the actual typed handle passes 14/14.
The initial AniML hint test attempted to load an absent document after compile had already returned
its diagnostic; asserting that compile diagnostic passes. A new CLI schema test initially queried
only top-level node fields; `schema --json-schema` verifies the actual nested field, and that test
passes. ESLint caught an unused test binding, fixed. These failures are retained in evidence.
No implementation failure or budget breach is hidden by a raised threshold.

Placeholder paint is a solid color override, matching the row's distinct-color requirement.
Default opacity preserves existing richer paints. This ticket does not complete native list/style
mapping, add native placeholder APIs, add dynamic local style paints, or establish a controlled
performance guard. Existing input/effects composition and OS editing limitations remain as described
in `SPEC.md`. The bounded-renderer and observation-surface choices follow
`docs/research/rive-web-runtime.md` and `docs/research/rive-format-and-graph.md`; no external source
or documentation text was copied.

The final browser check initially assumed a particular half-opacity channel rounding, then exact
identity with the runtime's offscreen node-opacity path. The measured differences are max 1 at
24/96 channels for Chromium/Firefox Canvas, respectively; SVG matches exactly. The new test uses
that one-level Canvas compositing boundary, exact SVG/authored-color controls, and exact restored
pixels after clearing. It changes no existing test limit or oracle tolerance. The original complete
changed run was stopped after test strengthening; it is superseded rather than called passing.
A final frozen run includes the added CLI file and stronger browser controls.

## Final complete-run outcome

`VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **9,212 passed / 2 failed / 58 inherited
TODO**, 296 passing files, one failing file and 13 skipped files, exit 1 in 592.17 s. Both failures
are the standalone-demo tests (Chromium/Firefox): the source fingerprint changed with the final
diagnostic wording, so `readCachedBundle` rejected the otherwise unchanged base bundle.
`node tools/build-web.ts --check` independently reported only stale `packages/web/dist/build.json`.
Rebuilding all 56 entries and rerunning those exact two tests at their unchanged limits gives
**2/2 passed**; all 56 source/output cache entries then verify. The broad command remains exit 1;
there is no claimed clean rerun of it. Every failed test now passes in its exact retry.

Full typecheck plus the final browser-test typecheck, changed-source ESLint/Prettier, module wiring,
AniML and parity checks pass. The pre-commit format hook is mandatory. Source remains frozen.
All final commands, counts, sizes, unresolved work and earlier failed checks are in
`verification/p6-11/checks.json` and neighboring logs. No push or PR was made.
