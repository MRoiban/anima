# P6-4a — markup and authoring headroom

Status: **partial (verification gap)**; branch `t3/implement-p6-4a-ticket`, based on `777c0a5d`.
The implementation meets both requested size targets and the corpus/Chromium guard. Three
in-checkout tooling timeouts remain unresolved; no clean complete `changed` exit is claimed.
No parity rows belong to this ticket. No row, PLAN milestone, runtime behavior, measurement input,
existing budget, threshold or oracle finding was changed. Local branch commit only; no PR or push.

## Implementation and decision

Decided, owner may revisit: move track-text parsing, named eases, transition condition spelling and
listener assignment parsing into optional `@anima-format/web/markup-animation`. The complete
`@anima-format/web/markup-hooks` authoring import still installs it automatically. The lean
`markup` entry now handles static markup; its users add `markup-animation` for those animation
forms. Tooling's public compiler installs it automatically. Missing support reports
`markup-animation-unavailable`, including pointer, source position and import/build hint; late
registration retries retained sources. Documented in AUTHORING and ANIML §9.

Moving code alone did not free aggregate authoring bytes. The browser hook entry also retained
unused decompiler helpers in the data, events, motion and converter objects. Their compiler-only
exports now live under `modules/markup-hooks/markup/`; the original module exports compose them
with their existing decompiler methods. This keeps the tooling API and lets browser authors pay
only for compiler code. Small shared cuts consolidate root-map dispatch and hook traversal, avoid
computing unused animatability metadata in compiler descriptors, and reuse already decoded XML
text while retaining exact UTF-16 source spans. Public `nodeAttrs` flags remain available to tools.

This follows the authoring/runtime separation in `docs/research/rive-web-runtime.md` and the
single-registry metadata guidance in `docs/research/rive-format-and-graph.md` §6. It does not adopt
or copy any external implementation. The keyframe semantics in
`docs/research/rive-animation-and-state.md` remain unchanged.

The initial source profile (esbuild bytes before final terser, not additive gzip costs):
`compile.ts` 17,434; XML 2,367; names 1,007; fields 520. Counterfactual section removal from the
29,313 B bundled browser compiler saved 405 B for track text, 301 B for ease handling, and 763 B
for all scalar readers. These stubs were measurement probes only. The complete original compiler
contributed 8,177 B above core+web. Raw measurements are in `verification/p6-4a/profile.txt`.

## Seams and generated files

- `modules/{data,events,motion,convert}/markup/index.ts`: compiler exports moved; tiny imports/spreads
  preserve their existing tooling/decompiler objects, marked `seam(P6-4a)`.
- `modules/convert/web/markup.ts`: imports compiler-only converter hooks, marked `seam(P6-4a)`.
- `modules/markup/web/hooks.ts`: imports the relocated hooks and includes animation automatically,
  marked `seam(P6-4a)`.
- `modules/markup-libraries/markup/{async,hooks}.ts`: optional caller-supplied compiler fixes the
  separate-bundle async capture exposed by this split, marked `seam(P6-4a)`. Motion's key reader is
  likewise passed by the active compiler, rather than captured from the registration bundle.
- Generated wiring: `packages/markup/src/module-hooks.ts`, `packages/web/package.json`,
  `packages/web/src/markup-animation.ts`, `tools/modules.generated.ts`; generated with modules.ts.
- AUTHORING and ANIML §9 are the ticket's requested documentation seams. No non-authoring runtime
  source, text/font module or CLI font source changed.

## Sizes

Min+gzip from unchanged size.ts, original HEAD archive versus frozen implementation:

| Entry | Before | After | Existing/new budget |
| --- | ---: | ---: | ---: |
| markup | 8,177 | 7,272 | 8,192 |
| markup-hooks | 4,145 | 4,488 | 4,544 |
| markup-animation | absent | 911 | 1,536 new |
| markup-convert | 622 | 535 | 704 |
| markup-libraries | 2,150 | 2,173 | 2,176 |
| markup-text (gzip context only) | 529 | 530 | 1,024 |

All remaining authoring entries and every runtime entry retain their original measured bytes. `markup-hooks` includes the new
animation layer; the separate entry is independently optional and is counted once in aggregate.
No existing budget or measurement base was raised or rebased. Markup meets the ticket's 7,400 B
target; aggregate authoring meets 15,000 B, freeing 578 B in total and 905 B in the lean entry.
`markup-libraries` has only 3 B spare, so further compiler changes need another measurement.

| Gate | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| core+web | 21,136 | 21,136 | 24,576 |
| largest scene (30) | 53,201 | 53,201 | 65,536 |
| app-UI | 94,068 | 94,068 | 131,072 |
| runtime sum | 113,443 | 113,443 | 163,840 |
| authoring add-on | 15,226 | 14,648 | 16,384 |
| Rive-class | 119,089 | 119,089 | 256,000 |

Core+web bundles also match byte for byte: SHA-256
`38d09fa51dd82685fb9bea2b7ed011d7981725d027dd954a7f673f98770caef6`.
The six-gate baseline was rerun from an untouched HEAD archive because the initial live run
straddled exploratory changes; that mixed-source run is discarded.

## Verification and problems

Final `npm run test:scope -- changed` exits **1**: **8,657 passed / 5 timeouts / 88 inherited TODO**,
270 passing files, four failing files and 13 skipped files, including both browser engines.
The five timeouts were Firefox host-edit (5 s), JPEG pipeline (5 s), scaffolder (60 s and 5 s)
and module-order (30 s). Exact unchanged-limit file retries recovered host-edit **4/4** (both engines)
and pipeline **19/19**. A serial retry of the two tooling files remains **2 passed / 3 timed out**.
The untouched `777c0a5d` archive gives **4 passed / 1 module-order timeout**; therefore module-order
also fails before this patch, but the two checkout scaffolder timeouts are not classified load-only.
An exact current-source copy on RAM-backed `/tmp` gives **3 passed / 2 timeouts**: the 5 s scaffolder
case recovers, while its 60 s case and module-order still fail. This is diagnostic evidence, not a
replacement for the failed checkout run. No timeout, assertion, measurement input or threshold was
changed. The orchestrator still needs a clean run of these three checkout checks.

A before/after web typecheck comparison exits 0 on both: CPU user 9.600 → 8.168 s,
wall 5.146 → 4.443 s, so no typecheck slowdown was observed in this pair. The checkout is on ext4;
the archive/mirror are on tmpfs. These observations do not prove why every timeout occurred.

 The required Chromium guard
`npm run test:scope -- markup conformance web markup-animation --browser=chromium` exits 0:
**4,963 passed / 16 inherited TODO / 1,479 filtered**, 57 files. Focused separate-bundle regressions:
**12 passed**, including both engines, four animation entry orders and the two library entry orders.
Full typecheck, lint and generated wiring pass. Initial markup/library suite: 2,885 passed; Unicode/entity source spans:
5 passed. AniML build check: 591 files unchanged. Strict oracle: exit 0, 266 cases / 475 samples,
zero strict failures; retained findings are not passes and were not edited.

Perf commands exit 0 under shared-machine load: bell compile 2.62 → 8.16 ms, frame 59.6 → 130.8 µs;
composite 41.0 → 90.0 µs; toolbar compile 10.37 → 19.53 ms, frame 60.4 → 126.9 µs. These are not
controlled evidence for the ≤3% guard. Non-authoring runtime sources and all runtime size gates
are unchanged; a controlled performance comparison belongs to the orchestrator.

Development failures: missing esbuild fixed by npm ci; oversized relocation candidates rejected
without raising budgets. Two six-failure browser setup runs used an imported/incorrectly decompiled
fixture; corrected to the self-contained bell reference and then 6/6 passed. The first broad Chromium
run exposed a real libraries-first compiler capture (also isolated: 1 failed / 1 passed); that
superseded run was stopped for the caller-compiler fix. A subsequent regression fixture compiled
legacy bell listeners after loading data without its input companion; it now uses the appropriate
motion/data document in that scenario. No runtime source, timeout or existing assertion was relaxed.

Early extraction shadowing and callback-type errors were corrected before final typechecks.
Outstanding problems are the three checkout tooling timeouts, the unverified controlled perf
comparison, and the 3 B margin in markup-libraries. No parity row or runtime defect closure is claimed.
