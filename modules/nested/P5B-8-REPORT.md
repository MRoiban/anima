# P5b-8 — non-canvas seam closure

Status: implemented and verified for the assigned component-name design. Local branch `t3/p5b-8-close-noncanvas-seams`, baseline `0c5028a`. No push, PR or merge.
No parity status, measurement tool/input, timeout, budget, tolerance or oracle threshold changed.

## Behavior and rows

| Row | Assigned scope | Evidence / limit |
|---|---|---|
| state-machine.literal-artboard | Implemented | Optional typed-function guard hook in core; nested registers component(name), validates component property/name and ==/!=. No bind required. Two exact fresh native results: row9 / box1. |
| data.property-artboard | Guard seam completed | Existing component property/consumer plus typed guard use; invalid type/name/operator and malformed strings diagnosed. |
| data.bind-keyframes | Implemented | Core KeyValue callback + owner-aware sampleTrack/custom sampler; motion owns path/channel checks and markup. Four supported scalar types, live value-cubic endpoints, fades and seek ownership and independent players. Native midpoint2 / changed endpoint16 / changed endpoint4 match exactly. |
| data.host-artboard | Implemented for local definition names | Shared-FIFO component(path) handle, default/named/list paths, callbacks, create/bind validation and consumer rebuild. Native host property writes rejected; initial native selection observed. |
| host-api.data-artboard | Same local-name handle | Core and both separate-bundle browser orders; scalar subscriptions and isolation. Native setter parity is unobservable through authorized CLI commands. |
| components.host-artboard-reference | Local-name portion implemented | Existing icon.instance retrieves selected child; assigning arbitrary foreign-file player/data objects is outside the decided name representation and remains pending. |
| host-api.bindable-artboards | Local-name portion implemented | Validated local selection + existing selected-player/data access. Foreign-file/data association remains pending. |
| host-api.artboard-selection | Existing implementation verified | Existing host-edit browser tests select roots from object/JSON sources and native selection evidence; no replacement API introduced. |
| components.nested-quantize | Finding investigated; rule retained | Native precision boundary, original Anima3/native2 delta1 retained unchanged; full evidence below. |

Registry: existing transition.when and data component entries retain both spellings; motion adds a
registry-described key element while JSON retains [time,value,ease?] tuples. CLI validate/inspect/sample
checks cover both compiled authoring pairs. Every new diagnostic has an exact pointer, message,
hint and test; two global invalid-code fixtures also cover the normative diagnostic census.

## Quantize root-cause evidence

Fresh local command captures: oracle/p5b8 (61 readbacks, including guard probes), motion's
oracle/p5b8-keyframes (3), host-edit/oracle/p5b8-component (2). Native build errors: zero.
No binary native files or copied scaffold documentation is retained.

- fps12, .25s in one advance: native2, Anima3. Splits .12+.13, .125+.125, .2+.05 and .1+.15
  give the same native2; per-call time truncation is ruled out.
- At .25s an unquantized twin reads3 while the quantized child reads2. At .2500001s the twin
  reads3.00000095 and the quantized child3. The unchanged Anima rule recognizes boundaries
  within1e-9s; independent conformance distinguishes .25-2e-9 (tick2) from .25-5e-10 (tick3).
- At .25s, fps12.0000001 still gives native2; that rate rounds to12 in float32. fps12.000001
  gives2.99999976; its float32 value is12.000000953674316 and 36/rate=2.99999976158144.
  A lower rate11.999999 gives2.00000024. Additional exact binary-rate controls are retained raw.

These isolate native clock/rate precision and rounding as the boundary disagreement, not an Anima
frame-boundary defect. The exact internal native accumulator/comparison routine remains unverified
from black-box captures. Neither native observations nor comparison tolerances were altered; the
existing canonical delta1 finding stays a finding. No time implementation was changed.

## Architecture, design and gaps

Core/web growth is limited to the optional typed guard parser and player-aware key compilation/
sampling hooks. All feature logic stays in nested, motion and host companions. Data, bind and
components runtime sources are untouched; shipped packages gain no runtime dependencies and core
stays DOM-free. Existing asset literal handling was retained rather than moving owned data code.
The shared markup compiler adds two delegates and unifies final-ease normalization for both key
spellings; motion owns element parsing and source locations. Vocabulary-only validation shells
avoid recompiling consumers with the temporary host-value model's incompatible inherited context.
This follows the graph/storage boundary in docs/research/rive-format-and-graph.md §6 and the
single parent/child step order in docs/research/rive-animation-and-state.md §C.

The decided design is unchanged. Broader inventory semantics requiring foreign-file component
instances and associated data are explicitly pending; this assignment requests the local-name API.
Canonical oracle input editing is forbidden by this task, so new scalar comparisons run in module
suites and the two central TODO probes retain their markers. Parent registration is still needed;
there is no new central-oracle completion claim. Rive's local commands reject both card=row and
card=box as no property at path (session retained); no host-write parity pass is fabricated.

All ten requested host-edit scaffold dry/run attempts hit the inherited lowercase-only module-name
validator. Existing nested/motion scaffolds were refreshed through their tool. The existing
host-edit module was extended directly; no validator or decided module name was changed.

## Verification

Frozen-source commands: every requested check exits0; exact commands/exits/durations are in
[verification/p5b8/checks.txt](verification/p5b8/checks.txt).

- Requested broad scope: **4471 passed / 66 TODO**, 177 passed files, 144.81s. Its nine browser
  files are listed but skipped by the inherited undefined-pattern behavior; four other skipped
  files contain only TODOs. No successful browser execution is inferred from that result.
- Explicit owned browser project: **52 passed**, all9 files, Chromium and Firefox, 52.54s.
  Combined executed assertions: **4523 passed / 66 TODO**.
- Four independently calculated conformance cases / **15 snapshots**; authored census431.
- Strict oracle: **exit0, 250 cases / 446 passing samples**, with **25 finding cases /
  28 finding samples** retained. New native scalar evidence: **5 exact observations** in module
  tests; all66 fresh readbacks are retained, including precision controls and setter rejections.
- Typecheck, ESLint, Prettier, module wiring, AniML, web artifacts and parity checks pass.
  AniML corpus474 files; web32 entries. Generated outputs were produced with their owning tools.
- Perf exits0: bell compile2.64ms; all9040 prefixes707ms; bell frame50.1µs; composite28.0µs;
  toolbar31.4µs and compile6.34ms. A controlled baseline A/B was not run; no comparative
  no-regression claim is made.

| Entry | Final min+gzip B | Unchanged limit B |
|---|---:|---:|
| core+web | **20362 (+174 vs20188)** | 30720 |
| full-featured | **108896 (+843 vs108053)** | 131072 |
| data | 8015 (baseline8024; source untouched) | 8192 |
| bind | 2038 (baseline2048; source untouched) | 2048 |
| components | 4051 (baseline4055; source untouched) | 4096 |
| motion | 6614 | 8192 |
| nested | 4445 | 5120 |
| host-values | 1211 | 2048 |
| host | 3463 | 4096 |
| host-edit | 3437 | 4096 |
| markup | 7949 | 8192 |

Rive-class113874/256000 B. Incremental gzip changes in untouched modules reflect the new shared
base measurement context; none of their runtime sources was changed. All module/aggregate limits
pass. Base changes consist only of the guard and sampling hooks; web base source is untouched.

The initial broad run's two failures were missing new diagnostic census fixtures and an incomplete
new guide XML example; both causes were corrected without changing assertions. A review also found
and fixed new key-element final-ease normalization, malformed-string parsing and inherited-method
lookup. Existing tests/limits stay intact. A new list test was corrected to the already-published
rule: retain ItemHandle and reacquire a scalar accessor after moving the item.

The requested broad scope lists but skips browser files when its per-project pattern is undefined.
All nine owned browser files therefore also run explicitly under the default browser project,
covering Chromium and Firefox at their unchanged limits. Raw initial failures and stale-bundle/
formatting diagnostics are preserved under verification/p5b8/initial; frozen-source results are
stored beside it. Comparative quiet-machine performance non-regression remains unverified.
