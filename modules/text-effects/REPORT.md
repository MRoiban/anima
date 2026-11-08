# P6-5 implementation report

P6-9a closure follow-up: [current report](../../tests/oracle/P6-9a-REPORT.md). This document
records the earlier implementation delivery.

Status: **partial**. Branch `t3/implement-p6-5`, based on `777c0a5d`. Final head is in the handoff
(`git log -1`). Local commit only: no push, PR, package publication or merge from p6.

## Rows

Closed: none. All fourteen remain planned:

- `text.modifier-translation`, `text.modifier-rotation`, `text.modifier-scale`,
  `text.modifier-opacity`, `text.modifier-origin`, `text.modifier-variation`,
  `text.modifier-follow-path`.
- `text.range-units`, `text.range-falloff`, `text.range-easing`, `text.range-combine`, `text.range-run`.
- `text.background`, `text.script-direction`.

The implementations have normative semantics, registry forms/aliases, diagnostics, fifteen
independent numeric conformance probes, AniML/JSON examples, CLI support and size evidence.
Thirteen native sources/captures use only the original generated font. Their raw baseline/pivot/
range differences remain unresolved; no accepted oracle manifest or threshold was assigned.
Direction has no authorable native override: its skip rationale awaits review. Variation also
lacks arbitrary-axis canvas drawing (wght maps to font weight). These are not closure-ready rows.

## Implementation, owner budget update and seams

The entry `web/text-effects` adds logical cluster transforms, opacity, origins, axes, local path
sampling/tangents, scoped glyph/word/line ranges, falloff/easing/combination, rounded run backgrounds
and browser bidi. The title-wave example reveals letters through translation/opacity over two
words. Its independent test checks hidden, partial and fully revealed frames. A negative-tracking
regression covers nonnegative background bounds when glyph positions reverse.

**No file in modules/text or modules/fonts is changed.** In particular, text/core/svg.ts is identical
to the starting HEAD; the base canvas drawer is unchanged. The orchestrator reported integration's
text at 6142/6144 B. I did not merge p6. The final approach costs zero bytes in text (local6053→6053):

- Static SVG uses a companion backend over the already exported text elements/attributes.
- The owned web adapter captures text root/frame pairs through the public ordering hook, then draws
  its owned subtree at the draw event. Layout/child identity caching survives a later separately
  bundled text drawer. Both import orders and a text bundle loaded after the model are tested.
- Canvas effects use the existing canvas shape hook. All code lives inside text-effects.
- No optional piece was moved out of text and no budget was raised.

Outside owned files: `tools/new-capability.ts` allows **existing** hyphenated module folders while
retaining identifier restrictions for creating new modules. Three markup test seams preserve
exhaustive attribute coverage, independent structural recovery and corpus count531→546.
No packages/markup/src implementation was edited. Generated adapters/exports, schema, module
lists and parity views were regenerated. `web/texteffects` is an export alias for the ordinary
unknown-feature import hint; the primary browser entry remains text-effects.

## Verification

The final command results and broad summary are in verification/checks.json. Focused final scope:
**2929 passed /550 filtered**, including Chromium and fifteen central conformance cases. The final core/CLI file set passes36/36. The final
owned browser file passes **4/4**, Chromium+Firefox, including late text import after load, real
pixels, retained animation, SVG/canvas matrices, opacity and detached-canvas direction resolution.
The unrelated native-canvas suite passes6/6 after isolating an intermediate backend-dispatch mistake.
Default generated-font CLI tool PNG rendering and browser-text rendering both exit0.

Full typecheck, owned-source ESLint, formatting, generated wiring/schema/parity/AniML/browser
artifact checks and all six size gates pass. Strict oracle exits0 on266 accepted cases/475 samples;
new native captures remain pending, not passing oracle cases. No existing measurement input,
finding, threshold, benchmark record or budget changed.

Registration before text initially crashed. The initializer now defers entries until text exists.
Its fresh-process regression passes. Twelve full-corpus arrival-order outputs have identical hashes
(51.0s under load); the earlier standalone test hit its unchanged30s deadline, not a schema mismatch.
A first broad run was8767pass/6fail/102TODO (one real arrival-order bug plus five timers). A second
run overlapped subsequent edits/artifact generation:8775pass/2fail/102TODO, superseded. A third was
stopped after the owner's zero-text-growth update replaced its drawing seam. Its intermediate
non-text backend dispatch failures recover in the final6/6 native-canvas retry.
Final owner-budget broad run: **8779 passed /2 failed /102 TODO**, 274 files passed,2 failed,13
skipped; Chromium and Firefox included. One base Chromium off-screen navigation hit its4000ms
limit and passed an isolated unchanged-limit retry. Module-order hit30000ms and still timed out
when isolated. It remains an unresolved deadline failure; the broad command is not green. No
runtime assertion failure remains in the owned tests. Final direct-order evidence is recorded
separately in verification/module-order-final-hashes.txt; it is not a passing timed test.

Other development failures were corrected without relaxing limits: missing tooling packages;
scaffolder hyphen/missing-doc stubs; missing generated AniML siblings, test API mistakes, contour's
attribute alias collision and independent decompile recovery gaps; a transient extra brace during
seam removal. Native packed flags initially compiled inert (inspect0); boolean authoring flags were
verified (translation mask4), recaptured and compared again. Missing screenshot directory/command
cwd errors were corrected. Generated build/binary artifacts were deleted without reading them.

Performance: the prescribed tool exits0 under shared load; current raw output is in verification/perf.txt.
**The controlled≤3% non-regression gate remains unverified.** Loaded timings cannot establish it.

## Sizes (min+gzip bytes)

| Entry | Before | After | Budget |
|---|---:|---:|---:|
| text | 6053 | 6053 | 6144 |
| text-effects, over text | 0 | 3361 | 4096 |
| markup-text-effects, over markup-text | 0 | 0 | 256 |
| text-host (unchanged) | 355 | 355 | 1024 |
| markup-text (unchanged) | 529 | 529 | 1024 |

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| Core+web | 21136 | 21136 | 24576 |
| Largest scene (30) | 53201 | 53201 | 65536 |
| App-UI fixed reference | 94068 | 94068 | 131072 |
| Runtime sum | 113443 | 116653 | 163840 |
| Authoring add-on | 15226 | 15226 | 16384 |
| Heavy | 119089 | 122306 | 256000 |

The unchanged APP_UI set includes text/fonts but not text-effects; integration owns adding it.
The standalone text-effects bundle is30550B, below the scene ceiling. Authoring also passes the
stricter15360B design cap. Bidi is **150B** (30550with,30400without), measured with identical terse
esbuild/terser/gzip settings and virtual source variants. This includes its registry, draw data,
SVG and canvas code; no base-text hook carries hidden cost. Earlier byte counts describe superseded
seam/state-isolation variants. The final source is at the owner's inclusive150B limit. Final API cleanup keeps the path sampler
internal as designed;36/36 core/CLI tests pass after it, and all three index/text/effects browser
bundles retain identical SHA-256 hashes and byte sizes (verification/bundle-proof.json).

## Deviations and problems

- Registered feature: `texteffects` (core feature names are alphanumeric); primary entry/folder:
  text-effects. The alias makes import hints resolve without changing every-page core code.
- JSON effects is AniML text-effects because contour already owns stroke's effects attribute;
  structural text-effect/text-range children remain concise.
- Canvas has wght drawing only; arbitrary variation axes remain incomplete. SVG emits axis settings.
- Effects split clusters, losing cross-cluster ligatures/joining; mixed-direction effects use logical
  order. Layout/selection/hit geometry does not move with decorative effects.
- The internal path sampler uses core's fixed12-subdivision cubic approximation. Matrix composition,
  range weights and these limits are normative in SPEC.md.
- Accepted native equivalence and controlled performance evidence remain open. No parity rows are
  promoted from scaffolding or numeric/browser tests alone.
