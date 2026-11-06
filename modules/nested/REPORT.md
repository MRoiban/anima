# P5b-6 — components and local libraries

Status: **partial task, eight rows implemented of ten**. Four rows have passing native readback
oracles, one retains a boundary finding, and three implemented library rows retain pending native
probes. Two requested capabilities are unimplemented because they need shared hooks outside this
assignment. No parity status is promoted. Branch: `t3/component-library-outputs`; baseline `a5fa00a`.
Local commit only; no push, PR or merge.

## Delivered behavior

The optional `nested` module owns absolute/quantized child clocks, viewBox fitting with inverse
pointer routing, read-only scalar outputs, and live component selection. Outputs support number,
bool, color and string, including repeat-created players; changes keep the parent awake for the
next binding pass. Color comparisons use value equality so new equal arrays cannot keep an icon
awake. Dynamic selection preserves an unchanged player, rebuilds changed selections, hides empty
selections, resolves all choices' input addresses/ranges/events and rejects incompatible interfaces.
The component property type is the only data behavior added. Core stays DOM-free; shipped packages
have no new runtime dependency.

Libraries add public `exports`, import `select`, model definitions with lexical renaming, and
`source` metadata for `anima library update ... [--check]`. Updates preflight existing local vendor
files, reject network paths and conflicting/invalid origins, and never fetch. Library model
instances/enums were not added; the decided scope called for model definitions.

Authoring: `docs/AUTHORING.md` components section; compiled example pair:
`modules/nested/examples/controls.animl` / `controls.ani`. Library samples use
`examples/lib/cards.animl`. CLI validate/schema/inspect/sample/docs and library update are covered.

## Row status (inventory statuses unchanged)

| Row | Task status | Evidence / remaining work |
|---|---|---|
| components.nested-remap | Done | Independent conformance; native x=6→3→9→3; forward/backward scrubbing retains player state. |
| components.nested-quantize | Implemented, finding | Native .12+.13s gives x=1→2; Anima 1→3, delta1. Nonboundary .12+.14s matches 1→3. |
| components.leaf-fit | Done | Nonzero-origin matrices, fitting and pointer tests; native fitted click (15,5) changes clicked 0→1 outside original width10. |
| components.stateful-output | Done | Four scalar types, read-only diagnostics, repeat output/parent-wake vector; native numeric output6. Native nested-output host writes are not observable in this CLI. |
| components.library-export | Implemented, native pending | Public exports/import selection and private lexical dependencies tested. No authorized native library-service capture. |
| components.library-models | Implemented, native pending | Imported models/data/of/model references and component-valued defaults renamed consistently. No native library-service capture. |
| components.library-update | Implemented, native pending | Local-only checked refresh, no partial writes after preflight errors, rebuilt updated icon. No authorized native library-service capture. |
| drawing-paint.paint-artboard | Pending | Canvas paint dispatch, image resolution and offscreen subtree drawing are private; an optional module cannot supply a faithful live source through an existing hook. No SVG-only half implementation or false unsupported-render claim shipped. |
| data.property-artboard | Done | Component type/default/write validation, rebuild/empty selection, fields/ranges/events across choices; native property selects box. Native CLI rejects card=row as no property at path, so host swapping is verified by Anima conformance and both browser engines, not that native command. |
| state-machine.literal-artboard | Pending | cond.ts already delegates scalar comparisons to bind. The numeric-only function registry needs the typed literal extension owned by data-extras; no core guard-parser change was made. |

The two unimplemented capabilities and three library-native probes keep `todo.json`; no new skip
is claimed. Quantization remains a finding with its original measured numbers and zero comparison
tolerance. The nonboundary control supports a precision-boundary explanation; that is an inference,
not a claim that the native clock discards per-step remainders.

## Verification

Every requested command exits **0** on the frozen source; exact commands, exits and durations are
in `verification/checks.txt` and command logs beside it.

- Scope: **3,379 passed / 53 TODO**, including Chromium and Firefox. Command adds `nested` and the
  pending `componentpaint` scope to the requested components/lists/markup/libraries/CLI/conformance/
  oracle set; `VITEST_MAX_WORKERS=1` avoids competing local test projects. All limits are unchanged.
- **Nine** new independent conformance probes, **18** snapshots, including color outputs,
  repeated outputs and events from later component choices. Expectations use authored arithmetic,
  geometry and the specified step order, never sampled Anima output. Corpus census: **417** cases.
- Strict oracle: **250 cases / 446 samples**, exit0.
  Five added passing native cases / ten paired observations; one new boundary finding. Existing
  **245** metric records and **24** findings are unchanged. Current findings: **25**
  cases / **28** collection samples.
- Typecheck, ESLint, Prettier, modules --check, AniML --check and web --check pass. **462** AniML
  artifacts checked; **31** browser entries current. Schema regenerated with `npm run gen`.
- Audit: all **2,987** tracked files in completed baseline oracle trees are byte-identical; all
  **1,238** parity statuses unchanged. No measurement tool, old oracle input/threshold, prohibited
  module source or guard parser changed. No native binary/scaffold documentation is committed.
- Extra registration-order verification uses all twelve orders and the unchanged 30-second limit;
  see `verification/module-order.txt`. The helper now uses the manifest's declared core export,
  fixing the inherited host-edit name/export mismatch rather than bypassing any comparison.
  Final quiet run: **20.45s**.

## Bytes (min+gzip)

| Touched shipped entry | Bytes | Unchanged limit |
|---|---:|---:|
| core + web | 20,109 (unchanged) | 30,720 |
| components | 4,055 | 4,096 |
| nested (new optional entry) | 4,409 | 5,120 |
| data | 7,574 | 8,192 |
| markup | 7,915 | 8,192 |
| markup-components | 755 | 2,048 |
| markup-libraries | 1,949 | 2,048 |
| full-featured | 106,275 (+4,006 vs 102,269) | 131,072 |
| Rive-class | 111,261 | 256,000 |

`componentpaint` has pending metadata only: no core feature, browser entry or shipped bytes.
No limit was raised. Other existing entries remain under their budgets; raw table is size.txt.

## Performance, failures and decisions

`node tools/perf.ts` exits0: bell compile **3.00ms**, all **9,040 prefixes 717ms**; bell frame
**45.4µs**, composite **31.5µs**, toolbar **31.5µs**; toolbar compile **4.17ms**. A controlled
baseline/current A/B was not run; comparative no-regression is **unverified**.

Development failures were corrected without loosening checks: stale parent output reads, output
wake scheduling, time-expression decompilation quoting (including numeric-string expressions and empty attributes), library capitalized model names, late
module registration and isolated browser-markup replay, later-choice alias ranges/events, and
repeat-player output access. The new color test was corrected to the existing rounded-byte/hex
contract (128 and #800080 rather than fractional channels or an array from Player.value); no
color tolerance changed. Test vocabulary/census and the independent decompiler reader were extended
for the new syntax. The pending paint scaffold's fake source was removed, retaining its marker,
so existing paint corpus assertions were not altered.

Earlier loaded runs hit the existing 5s bell-prefix and 30s registration-order limits. Cold browser
bundle setup and the inherited export-name test-loader bug were corrected; quiet order checking
and the final full scope use unchanged limits. An initial formatter check flagged the runner's
live checks.json, now retained as checks-initial.txt; final verification writes a plain text log
and Prettier passes without ignore changes. Representative failed logs are retained in verification.

No decided behavior was substituted. Public local-library wire spellings were chosen where §7
left them unspecified. Runtime splitting follows the required byte constraints; module names are
lowercase because registerModule/scaffolding require that. The two shared-hook blockers and native
library-service restriction are explicit handoff work, not fabricated passes. The phase/PLAN is
not marked complete.

Handoff seams: `modules/canvas/web/renderer.ts` keeps `#paint`, `#image`, `#surface` and subtree
drawing private; component paint needs an optional source resolver/draw callback at that boundary.
`modules/bind/core/expression.ts` exposes only numeric `registerFunction` arguments/results and
forces function arguments through `numeric`; the shared typed-function change must admit the string
argument/result for `component("row")`. `packages/core/src/cond.ts` already calls the bind parser,
so this capability does not need a separate guard-parser change.

## P5b-8 follow-up

The typed guard hook and component host handle now live in this branch's P5b-8 follow-up.
The quantize boundary has fresh partition, unquantized-control and rate-precision probes;
its original delta1 remains unchanged. Current scope, measured results and remaining native
integration limits are in [P5B-8-REPORT.md](P5B-8-REPORT.md). Counts above describe P5b-6 only.
