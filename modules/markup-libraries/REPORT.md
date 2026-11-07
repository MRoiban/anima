# P3c-3 library rows

Status: complete; all three rows closure-ready with independently tested local behavior and
evidenced account-command skips. Local branch
`t3/library-models-update`; head is the commit containing this report (see `git log -1`).
Parity statuses remain `planned`; promotion and replacement of historical inventory `todo.json`
citations/reasons with the closure evidence below belong to the orchestrator.

| Closure-ready row | Evidence |
| --- | --- |
| `components.library-export` | Public selection (`export`, aliases `exports`/`select`), private lexical dependencies and unknown exports: `test/markup/extras.test.ts`, `spec/conformance/components-library-export`. Native account-command ban: `tests/oracle/components-library-export/skip.json`. |
| `components.library-models` | Shared definitions, authored instance values/defaults, named-instance paths, enums/defaults, collision-free aliases, private references, consumer enum references, sync/async imports and JSON round-trip: `test/markup/extras.test.ts`; paired AniML/JSON `spec/conformance/components-library-models`; source `examples/shared.animl`. Native ban: `tests/oracle/components-library-models/skip.json`. |
| `components.library-update` | Vendored refresh/check, preflight atomicity and local-only diagnostics: `test/cli/library.test.ts`, `spec/conformance/components-library-update`; native ban: `tests/oracle/components-library-update/skip.json`. |

Rows left: none within this ticket. Skips establish the authorized observation limit; they do
not claim a native comparison. No native commands were run.

The implementation follows the existing lexical-expansion seam (research:
`docs/research/rive-format-and-graph.md` §6, cited in SPEC), preserving dependency-free runtime
documents. Export-selection duplication was consolidated to offset the new authoring code.
No split or budget increase was needed. The async cache error is caught and replaced by the
existing positioned `unknown-import` diagnostic, so its unused private message was removed. Expanded JSON uses ordinary `data.models`,
`data.instances` and `data.enums`; AniML is the external library authoring syntax.

Verification and six-gate measurements: see the accompanying verification directory and final
checkpoint below. End-of-P3b baseline comes from `design/p3c/DESIGN.md`; the first local size
measurement raced the first source edit and is **not** represented as an untouched baseline.

Problems/deviations: the first size attempt failed because esbuild was absent; `npm ci` restored
dependencies. Initial new-test type errors were fixed. The first changed run had 933 passes,
27 TODOs and one unrelated `assets-image-import-webp` 5000 ms timeout under concurrent load;
the isolated unchanged test passed (1/1), and the subsequent changed run passed 936/27 TODOs.
Performance command completed under load (bell 127.8 µs, toolbar 85.0 µs, bell compile 6.88 ms,
toolbar compile 10.59 ms); comparison to the design baseline is **unverified**, not a passing
≤3% timing claim. No measurement tool, threshold, budget, finding, benchmark record, parity
status or CLI source was changed. Specs and conformance files outside the owned module changed
as required for the new contract. No push, PR, publication or account command.

| Gate (min+gzip B) | End of P3b | Final |
| --- | ---: | ---: |
| core + web | 20,622 | 20,622 |
| largest scene | 55,313 | 55,313 |
| app-UI scene | 91,158 | 91,158 |
| runtime sum | 109,971 | 109,971 |
| authoring add-on | 11,949 | 11,944 |
| heavy / Rive-class | 115,473 | 115,473 |

Verification: changed scope **936 passed / 27 existing TODOs** (5 files, including all
conformance and oracle unit tests); strict oracle **266 cases / 475 completed samples pass**, with
24 retained findings/differences. Full typecheck, owned-test typecheck, ESLint, module wiring,
542 authored AniML checks and browser artifact checks pass. Selected scopes contain no browser
suite for this authoring module. The JSON conformance document was regenerated with
`node tools/build-animl.ts`; browser artifacts with `node tools/build-web.ts`.

Final size: all six gates pass and none grows. `markup-libraries` **1,936 → 1,925 / 2,048 B**;
authoring add-on **11,949 → 11,944 B**. No runtime bytes were added. Intermediate authoring
measurements (+65, +17, +16, +5 B) failed the design non-growth requirement; selection/key
consolidation and removal of redundant resolver checks recovered the difference. Final frozen
source passed the changed scope again; subsequent edits affect this report/log only.
