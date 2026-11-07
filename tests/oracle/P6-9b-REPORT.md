# P6-9b implementation report

Status: **partial**. Branch `t3/implement-p6-9b`, based on `77a13f4b`; the final head is in the
handoff. Local commit only: no push, PR, publication, external font or proprietary document read.
All five benchmark findings are addressed. Fifteen rows close; eighteen remain planned.
Evidence is in [p6-9b-verification/](p6-9b-verification/).

## Benchmark fixes

1. Reproduced a semantic label `Changed` with drawn SVG text `Old`, using a run's `$title`
   shorthand. Semantic cache validation refreshed the text layout before text's after-step dirty
   comparison, so the comparison missed the change. A replacement layout now invalidates drawing
   at the point it is cached; after-step only refreshes already-requested layouts. Regressions
   compare headless semantic sampling, tool SVG/PNG, browser-text SVG/PNG and literal control
   renders, plus retained browser SVG/canvas in Chromium and Firefox. No explicit run binding is
   needed. The fixture and reproduction live in `packages/cli/test/p6-9b.test.ts`.
2. Help and `anima docs` list repeatable font overrides for every text-consuming command.
3. Missing semantic fonts retain `font-missing`, the requested family, script-line JSON pointer
   and a `--font Name=path` hint. The script adapter retains structured error codes/hints.
4. Shared font preflight covers `sample`, `session`, `bench`, `inspect`, `validate`, `render`,
   `flatten` and `build`. Session startup and each reload await font loading/installation;
   source maps retain imported assets' source directories. Tests cover session startup, a
   changed family/asset on reload, preserved data, inspect and bench. Schema/fmt/decompile do
   not step a player. Session's loader may now return a promise; existing synchronous loaders
   remain supported.
5. **No text-input scheduling change was necessary.** Committed native input queues the source
   write before text listeners. The next single `Player.step` applies it, computes derives
   before guards and resolves visual bindings, just like a queued host write. Extended
   `input-write-text` conformance independently checks typed `data`, clearing, and external
   `host`: source/count/hasQuery, bound opacity, machine state/radius and ordered events agree
   in that first step. A DOM event followed immediately by a host read can still precede the
   scheduled step; `icon.invalidate()` draws without consuming queued writes. No bind source
   was changed; string-function work remains P6-10's.

## Rows closed

Original-font native comparisons:

- `text.input-text`
- `text.input-editable`
- `text.input-multiline`
- `text.input-obscured`
- `text.line-spacing`

Evidenced DOM/host-only oracle skips, with both-engine tests and deterministic field projections:

- `text.input-ime`
- `text.input-clipboard`
- `host-api.text-input`
- `host-api.clipboard-text`
- `input.text-listener`
- `input.write-text`
- `a11y.role-text-field`
- `a11y.state-multiline`
- `a11y.state-obscured`
- `a11y.text-proxy`

Each skip has its reason, existing tests and actual native command rejection evidence. The local
headless route rejects `text`, `compose` and `clipboard`. Its keyboard route cannot substitute
for composition/text transactions, and its semantic JSON cannot prove a DOM field's browser
role ownership or duplicate suppression. This is an observation-surface limitation, **not** a
claim that the native runtime lacks these APIs. Real OS IME sessions, clipboard grants, mobile
keyboards and screen-reader announcements are unverified.

Four formerly placeholder conformance sources now project the real field model for DOM host,
clipboard and proxy APIs, with explicit README dispositions. Two more provide standalone original-
font cursor/rounding vectors, independently checked by `drawing-conformance.test.ts`. The latter
resolve the Anima conformance gap without claiming successful native geometry equivalence.
Corpus count is 575 (569 + six); no baseline circle is counted as a DOM capability proof.

## Rows left and exact missing work

| Row | Missing work |
|---|---|
| `text.input-cursor` | Native caret remains 1 px despite authored scaleX 0.72, versus Anima's steady 0.06 grid units (0.72 px). Delta 63 at 20 pixels over 16; no passing budget. |
| `text.input-selection` | Native rounding differs; arbitrary selected-text paint/drawable references are not exposed. |
| `text.input-selection-rounding` | Authored native radii 0 and 2.4 produce the same captured rounding; Anima SVG rx differs. Delta 76 at 41 pixels; no passing budget. |
| `text.input-focus-selection` | Native select-all focus is captured but selection geometry differs: delta 76 at 45 pixels. Browser/headless behavior passes; native geometry is open. |
| `text.input-limits` | Anima uses HTML UTF-16 maxlength and explicit LF limits; native schema uses code points and wrapped lines. Wrapped-line limiting/native editing comparison is missing. |
| `text.input-placeholder` | Distinct configurable placeholder color and faithful native placeholder comparison are missing. |
| `text.fit-baseline` | Existing font-size-fit geometry disagreement remains unresolved. |
| `text.fit-layout-measure` | Existing fitted-size/reported-box geometry disagreement remains unresolved. |
| `text.overflow-ellipsis` | Native truncation selection/placement still differs with U+2026. |
| `text.overflow-fit-font-size` | Native fitted font size still differs. |
| `text.vertical-trim` | Native trim flags 257 still produce displaced geometry. |
| `data.property-text-style` | Authored a typed native property and styleId binding. Dump labels the property `artboard`; both id/name setters reject it. Native mutation comparison is still missing. |
| `text.run-list` | Authored actual list, textContent/textStyle symbols and DataBindPath. `items[0]/label` mutations appear in data dumps but drawing is blank. Native path/runtime mapping remains unresolved; literal control is preserved separately. |
| `text.flatten` | Component traversal, general SVG/clip preservation, live text-reference policy and independent native outline conversion remain missing. |
| `text.font-decoding` | Derived-font axes/features/glyph-path API and independent native evidence remain missing. |
| `text.font-metrics` | Integrated runtime metrics/coverage/options introspection and independent evidence remain missing. |
| `text.opentype-features` | Registry rejects authored features; substitution rendering/animation and native comparison remain missing. |
| `text.variable-axes` | Registry rejects authored axes; actual authored axis rendering/binding/animation and native comparison remain missing. |

Existing unexplained geometry differences retain TODO markers without a passing tolerance. No
oracle finding or existing threshold was edited. No font-runtime API completion is inferred from
tool-reader tests or CSS helper mapping.

## Native measurements and intentional leading difference

All new completed frames compare raw 240×240 RGBA with threshold strictly greater than 16.
No alignment, blur, resampling or edge exclusion is applied. `cases.json` only appends five entries.

| Probe | Measured max / pixels over 16 | Allowed max / pixels |
|---|---|---|
| input text | 32 / 8 | 36 / 10 |
| editable (abcd, WXYZ, abcdefgh) | 32 / 8, 5, 14 | 36 / 16 |
| explicit multiline | 32 / 4 | 36 / 6 |
| obscured | 32 / 6 | 36 / 8 |
| two explicit 2-em lines | 32 / 4 | 36 / 6 |

`node tests/oracle/check-input-contours.mjs` checks all five cases/seven samples against the
original font's independent outline corners: every over-threshold pixel touches a glyph corner,
zero non-corner differences. Four channel levels and two pixels of headroom are assigned per case.
The editable probe labels 0/1/2 index settled value mutations, not elapsed seconds.
The original font lacks U+2022: obscured rendering compares missing-glyph outlines, not a dot design.

Anima intentionally splits extra leading symmetrically. Native keeps its first baseline at ordinary
ascent. The line-spacing reference therefore explicitly places the native text at y=6 px for a
12 px font with 24 px line height; both subsequent baselines are 24 px apart. This mapping and its
reason are in `modules/text/SPEC.md`. The old unshifted source/capture remain under
`text-line-spacing/rive/`; `text-leading-default` remains the separate raw default-leading evidence.
No claim of native automatic-leading identity is made. This follows the independent scene and
renderer-boundary cautions in `docs/research/rive-format-and-graph.md` and
`docs/research/rive-web-runtime.md`.

## Seams outside owned files

- `modules/text/core/index.ts`: minimal cache-replacement invalidation and simpler refresh loop;
  marked P6-9b. No other ticket's hit/effect/a11y source was changed.
- `modules/text/SPEC.md`: marked normative clarification for invalidation, fonts and intentional
  first-baseline mapping.
- `modules/text/test/web/shorthand.test.ts`: browser regression for semantic-cache interaction.
- `packages/core/src/script.ts`: marked tooling-only preservation of structured error code/hint.
- `packages/cli/test/p6-9b.test.ts`: six end-to-end benchmark regression tests.
- `packages/markup/test/corpus.test.ts`: marked six-projection count update.
- Generated `docs/parity/MATRIX.md` / `matrix.json`, plus append-only WORKLOG checkpoints.

All runtime changes fit the existing budget. No measurement script, measurement input, budget,
benchmark record, external font, a11y/effects source or bind implementation was changed.

## Verification

- `npm run test:scope -- text text-input fonts cli --browser=chromium`: **3,632 passed**, zero failures, 545 filtered; 61 files. Includes all six CLI regressions.
- Final seven-file browser run, `npx vitest run --project browser ... -t Firefox --maxWorkers=2`: **18 passed**, 18 opposite-engine tests filtered, seven passing files. The earlier standalone shorthand regression passes **2/2**, Chromium and Firefox.
- Independent field/drawing projections: **304 passed**, 1,519 filtered / one inherited TODO. Standalone original-font drawing vectors: **2/2 passed**.
- `node tools/oracle.ts --strict`: exit 0, **293 completed cases / 508 samples**; existing 24 findings retained. New input/leading subset: **5 cases / 7 samples**, no non-corner differences.
- `npm run typecheck`, changed-source ESLint, module wiring, schema regeneration, parity generation/check, AniML check (**630 sources**) and web artifact check (**56 entries**): exit 0.
- Before/after `node tools/size.ts`: exit 0; all entries/scenes/six gates pass.
- Initial complete `npm run test:scope -- changed`: **9,088 passed / 13 failed / 2 skipped / 73 TODO**; 281 passing, nine failed and 13 skipped files, exit 1 in 617.71s. Errors comprise 12 test timeouts, one asset setup rejection (`page.evaluate: Array(1)`, before its pixel assertion), and a Firefox host-edit 10s hook timeout. This command did not exit green.
- Serial unchanged-limit browser retries: asset pipeline **22/22**; overlay/component paint/nested/motion **86/86**, both engines. Host-edit **4/4**, original 10s hook deadline; examples/module-order/scaffolder **22/22**, original 5s/30s/60s test limits. Every failed file now passes unchanged; the first broad command remains exit 1. **Final `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: 9,103 passed / zero failed / 73 inherited TODO; 290 passing files + 13 skipped files, both engines, exit 0 in 657.64s.** The implementation and test limits were unchanged between the failed broad run and this passing run.

The final changed-file Prettier check and mandatory commit hook pass. An ad hoc check
initially included deleted TODO paths and reported missing files; rerunning with the correct
ACMR filter passes (`format-corrected.txt`), with no formatting or code change needed.

Earlier failures are retained:
the first scoped Chromium run had 3,590 pass / one 5s pivot timeout; its unchanged-limit isolated
retry passes 1/1. An early Firefox scope had 3,039 pass / one genuine AniML canonical-format
failure; formatting was corrected without changing expected behavior. A first CLI session test
used an invalid uppercase asset name; the corrected lowercase test passes. The first strict
oracle run lacked the newly generated .ani files; `--build --strict` regenerated them and exits 0.
A duplicate-id native spacing attempt came from a backup .rml inside the project; the backup now
has .rml.txt extension and the recapture passes. Native text-input structure and list-path dead
ends are not counted as passing evidence.

## Sizes and design limits

Frozen min+gzip measurements from the unmodified size tool:

| Entry | Before | After | Ceiling |
|---|---:|---:|---:|
| text | 6142 | 6136 | 6144 |
| text-host | 355 | 355 | 1024 |
| markup-text (shared bundling) | 530 | 530 | 1024 |
| text-effects (shared bundling, source untouched) | 3359 | 3358 | 4096 |
| text-input | 3789 | 3789 | 4096 |
| text-input-svg | 356 | 356 | 512 |
| text-input-clipboard | 118 | 118 | 512 |
| text-input-canvas | 92 | 92 | 256 |
| markup-text-input | -45 | -45 | 192 |
| fonts | 1807 | 1807 | 2048 |
| fonts-text | 532 | 532 | 768 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 21136 | 21136 | 24576 |
| largest scene (30) | 53780 | 53780 | 65536 |
| app-UI | 98604 | 98596 | 131072 |
| runtime sum | 118830 | 118824 | 163840 |
| authoring | 14649 | 14649 | 16384 |
| Rive-class | 128449 | 128445 | 256000 |

No cap was raised; authoring also fits the design’s 15,360 B guard. Negative relative markup entry sizes are gzip/bundling context, not negative
files. The font-options/runtime gaps remain open rather than growing the full text entry or
claiming CSS projection as implemented behavior. `node tools/perf.ts` exits 0 under shared host
load (bell compile 5.98 ms/frame 61.2 µs, composite 41.6 µs, toolbar 69.7 µs/11.10 ms); these are not
controlled before/after evidence for the ≤3% guard.

The design is partially delivered: 15/33 row closures, the documented symmetric-leading mapping,
and no implementation change for an already-correct single-step field commit. Remaining runtime
features and native comparisons above still need a subsequent ticket. No claimed completion hides
a real geometry disagreement or relies on increased thresholds.
