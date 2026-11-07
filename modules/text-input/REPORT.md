# P6-6 implementation handoff

Status: partial; all 20 parity rows remain planned. Branch: `t3/implement-p6-6-ticket`.
The final commit is identified in the agent handoff. No push or PR.

Implemented a dependency-free field model, DOM input/textarea bridge, composition commit boundary,
limits, placeholder/masking, selection/caret drawing, focus integration, field semantic snapshots,
headless type/compose/select commands, native clipboard behavior and an optional selected-text/cut
host helper. The active registry owns shared field state across independently bundled entries.
The root observer remounts native fields when Canvas2D replaces the shadow tree; renderer
replacement can clear native focus, so the browser test explicitly refocuses after switching. Both native input
and host listener events bubble; no stopPropagation is introduced.

The search-card example binds five labels and a derived result count. Its field is four AniML lines;
filtering uses existing exact-label equality and five numeric flags. The full concise search benchmark
and independent native comparison are not claimed. CLI proof uses the generated fixture font via
`--font sans-serif=fixtures/fonts/anima-test.ttf` and `examples/search.txt`.

## Rows

Closed: none. Every row needs an independent native reference/comparison (or an accepted,
evidence-backed no-counterpart note) before closure:

- text.input-text, text.input-editable, text.input-cursor, text.input-selection,
  text.input-selection-rounding, text.input-focus-selection, text.input-ime,
  text.input-clipboard, text.input-limits, text.input-multiline, text.input-obscured,
  text.input-placeholder.
- host-api.text-input, host-api.clipboard-text.
- input.text-listener, input.write-text.
- a11y.role-text-field, a11y.state-multiline, a11y.state-obscured, a11y.text-proxy.

Fourteen conformance probes have independent expected snapshots. Six remain marked pending:
text-input-cursor and text-input-selection-rounding need standalone drawing vectors; the three
clipboard/host rows and a11y.text-proxy are DOM-only and need separate conformance disposition.
Twenty oracle directories remain explicitly pending. Baseline scaffold scenes are never counted
as completion. Tests include independent selection geometry assertions and browser canvas pixels.

## Seams

- `modules/focus/web/index.ts`: preserve pointer defaults for semantic/native field origins;
  the prior unconditional preventDefault prevented native caret placement after focus.
- `packages/markup/test/names.test.ts`: permit structural registry fields on individual node types,
  rather than assuming all structural fields belong to groups. Compiler sources are unchanged.
- `packages/markup/test/corpus.test.ts`: account for the 14 new active conformance sources (531→545).
- `packages/markup/test/decompile.test.ts`: allow and independently recover the new structural
  child, including its kebab aliases and boolean/numeric attributes.
- `packages/core/test/helpers/module-order.ts`: register the original fixture font before
  headless field semantic snapshots; it does not import core/all before the intended schema capture.
- Expected generated adapters, package exports, core/all, browser tables, schema, parity mappings,
  normative SPEC markers and the shared work log are included. The a11y commands file is owned scope.

## Verification

Raw evidence is in `verification/`. Final runtime source is fixed; all statuses below use unchanged limits.

| Command | Result |
|---|---|
| `npm run test:scope -- text-input --browser=chromium` | 2,918 passed, 0 failed; three Chromium browser cases |
| `npm run test:scope -- text-input --browser=firefox` | 2,918 passed, 0 failed; three Firefox browser cases |
| Isolated canvas corpus | 2,392 passed, both engines; before fix collection failed on missing body font |
| Exact Firefox asset-pipeline retry | 1 passed / 21 filtered after a 5s broad-run timeout |
| `npm run typecheck`; changed-source ESLint; Prettier | pass |
| `node tools/modules.ts --check`; schema generation; AniML/parity checks | pass; 612 AniML sources, 14 new active conformance cases |
| `node tools/oracle.ts --strict` | exit 0; 266 existing cases / 475 time samples; no new parity claim |
| `node tools/perf.ts` | exit 0 under shared load; ≤3% comparison unverified |
| `npm run test:scope -- changed` | exit 0; 8,771 passed / 0 failed / 114 TODO, 275 passed files + 13 skipped; both browsers |
| Independent twelve-order diagnostic audit | 12/12 identical SHA-256 outputs; 31.564s; the separate 30s timed test passes in final changed run |

The final scopes include shared compile/decompile tests added to the module manifest and use
VITEST_MAX_WORKERS=2. No timeout or tolerance was raised.

Min+gzip byte gates from the unmodified size program:

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core + web | 21,136 | 21,136 | 24,576 |
| largest measured scene (30) | 53,201 | 53,206 | 65,536 |
| app-UI fixed set | 94,068 | 94,077 | 131,072 |
| runtime sum | 113,443 | 113,451 | 163,840 |
| authoring add-on | 15,226 | 15,226 | 16,384 |
| heavy class | 119,089 | 123,047 | 256,000 |

All six gates pass; authoring also remains under the design's 15,360 B guard.

| Touched entry | Before | After | Ceiling / basis |
|---|---:|---:|---|
| text-input | absent | 3,789 | 4,096 over base web |
| text-input-svg | absent | 356 | 512 over text-input |
| text-input-clipboard | absent | 118 | 512 over text-input |
| text-input-canvas | absent | 92 | 256 over text-input |
| markup-text-input | absent | −46 | 192 over markup |
| focus | 3,092 | 3,092 | 3,456 over base web |
| a11y (tooling change only) | 2,360 | 2,360 | 2,496 over base web |
| markup (generated adapter/test seams) | 8,177 | 8,177 | 8,192 over base web |

The negative markup incremental measurement is a bundle/gzip context result, not a negative file
size. Field markup is descriptor-only; the aggregate authoring gate is unchanged. The a11y command
change is tooling-only and adds no bytes to its runtime entry.

## Design deviations and remaining work

- Registry feature names reject hyphens. The directory/manifest/browser entry is text-input, while
  the runtime feature is textinput. The scaffolder ran dry/run pairs for all twenty rows using its
  accepted textinput name, then its generated directory and adapters were reconciled.
- A 4,219 B trial exceeded the main entry budget. The brief permits optional entries: clipboard host
  helpers and canvas decoration drawing moved to text-input-clipboard and text-input-canvas.
  Subsequent registration-order and SVG integration fixes exceeded the main budget again (4,138 B),
  so SVG decoration drawing moved to text-input-svg. These optional entries are heavy, with
  512/256/512 B ceilings respectively; the main ceiling remains 4,096 B.
- Generated caret/selection rectangles expose color/radius controls; arbitrary authored drawable references are not implemented.
- Field semantics live in the heavy module through the existing a11y runtime extension seam.
  The native element is the accessible textbox; the existing overlay's duplicate field is hidden.
  No a11y runtime core or a11y web source was changed. New state keys use a local state type cast;
  shared semantic-state typings remain for the subsequent integration owner.
- One plain run per field. Nested/repeated native field mounting and qualified host addressing,
  scroll-to-caret, exact mixed-direction geometry, animated native typography/box dimensions and private font-family
  alias integration remain open. Native line height is approximate unless explicitly authored.
- Limits count UTF-16 code units and explicit LF-separated lines; masking preserves those offsets.
  Native model/initial-value assignment can exceed editing limits, as with HTML maxlength.
- Multiline obscured fields are diagnosed: HTML has no password textarea and exposing its plaintext
  native accessible value would violate the obscured-field policy.
- Real OS IME/dead-key sessions, system clipboard grants, mobile keyboard behavior and screen-reader
  announcements are unverified. Automated tests exercise composition events, keyboard typing,
  native selection, copy/cut privacy, accessibility role uniqueness and host clipboard helpers.
- The existing strict oracle command passes without establishing new text-input parity. Perf ran
  under shared-host load and does not establish the ≤3% performance guard. No existing measurement program or
  input, threshold, budget, finding or benchmark record was changed.

The earlier complete changed run reported 8,739 passed, 31 failed and 114 TODO. Its 28
decompiler failures and the reverse-registration unknown-text failure were real: inferred focus
now lives only on compiled nodes, the independent markup reader handles the structural child,
and field registry entries defer until text exists. The listener regex extension is returned as
a cloned registry contribution to preserve arrival-order determinism. Shared decompile tests
now pass. Two scaffolder timeouts pass their isolated unchanged-limit rerun (4/4). An earlier isolated
module-order run still timed out at 30s; the separate direct twelve-order audit produced identical
outputs (SHA-256 `24b487c28b43f10f407a111eb9d61ac00840abdb37e5c6479a0ba4889d23aa91`).
The final changed run exits 0 with 8,771 passed and includes a passing original-deadline
module-order test. Earlier timed failures remain in evidence; they were not hidden by raising limits.

Development failures retained in evidence: missing dependencies (npm ci restored them), the scaffold's
hyphen rejection, missing explicit tooling font, two incorrect test API assumptions, premature module
readiness checks, real duplicate bundle/state ownership defects, renderer-remount/focus timing, and
superseded size/broad runs, and one final CLI retry using a nonexistent entrypoint before the
corrected `packages/cli/src/main.ts` invocation passed. A formatting script briefly left an unmatched brace; it was corrected
before runtime verification. The full canvas corpus initially required a fixture alias correction (body→sans-serif) because its prefilter measurer only registers sans-serif; the same generated font and independent expectations were preserved. No test timeout, expectation tolerance or existing budget was relaxed.
