Status: **partial**. Six rows closed; `a11y.tree-bounds` remains planned for final painted extents.
Branch: `t3/implement-p7-8-ticket`, based on `d5630dd5`. The delivery commit contains this report;
its SHA is in the final handoff and `git log -1`.

Rows closed:

- `text.font-metrics`: optional `fonts-info` exposes immutable face metrics, scalar coverage and
  effective axes/features through `icon.fonts.info` and headless `decodeFont`/`FontInfo`.
- `text.font-decoding`: immutable derived option views, changed variable outlines, context-free
  feature substitution and glyph paths share the CLI's original bounded OpenType reader. The
  Node container/subset helpers stay in the CLI; the common reader is DOM/Node-free.
- `text.input-selection`: selected text can use its own solid color or reuse a local/shared style's
  fill/stroke, including gradients, without changing font/layout. Both spellings, diagnostics,
  original-font draw conformance and SVG/canvas pixels in both engines are covered.
- `text.run-list`, `data.property-text-style`: the existing Anima implementation/tests pass. A
  different native authoring route still gives a literal run fallback or empty artboard-typed
  style value. Captures/dumps and row-specific skip reasons retain that observation limit.
- `text.flatten`: existing component/clip/mask/gradient/effect/reference behavior plus an independent
  live-text raster acceptance test. The live side uses resvg with the generated font and does not
  pass through `outlineSVG`; the flattened paths match exactly. Native headless conversion is an
  evidenced skip.

Row left:

- `a11y.tree-bounds`: tooling and optional `web/a11y-bounds` now share cubic derivative extrema,
  centered stroke width, caps, joins/miter-limit 4, circles/rounded rectangles and world transforms.
  Paint dependencies invalidate the cache, including a settled overlay after late registration.
  Explicit boxes win. The final clipped/masked, dash/trim, non-scaling/feather and actual text-ink
  extents are incomplete; measured logical text boxes remain. No full exact-painted claim is made.
  Native semantics exclude the stroke: painted rectangle boxes are `[44,50,32,20]`,
  `[74,50,32,20]`, `[104,50,32,20]`; native semantic boxes are approximately
  `[48,54,24,12]`, `[78,54,24,12]`, `[108,54,24,12]`. Animated-bounds lag did **not** reproduce
  with explicitly linear native keyframes. Earlier apparent lag from a hold-keyframe authoring
  attempt was not valid evidence and is not retained as a new finding.

Seams outside the owned files:

- `modules/a11y-dom/web/index.ts`: marked `seam(P7-8)`, refresh an overlay if the semantic snapshot
  changed without a step. It does not consume queued writes or re-enter stepping.
- `spec/SPEC.md`: marked normative link to the optional font API contract.
- `packages/markup/test/corpus.test.ts`: marked census 607 → 609 for two real font-option/API
  projections. Independent API metric/path expectations accompany those projections.
- Generated adapters/package exports, `packages/web/src/all-modules.ts`,
  `tools/modules.generated.ts`, `spec/schema/ani.schema.json`, and parity views were regenerated.
  No generated file was hand-edited. Inventory edits are limited to the seven owned status/reason
  fields. No WORKLOG/PLAN/LOG, measurement tool/input/budget, benchmark or finding.json was edited.

Verification (frozen runtime):

| Command | Result |
|---|---|
| `npm run test:scope -- fonts a11y text-input text --browser=chromium` | 3,648 pass, 0 fail, 530 skipped, 1 existing TODO; 65 files pass, 1 skipped |
| same scope with `--browser=firefox` | 3,648 pass, 0 fail, 530 skipped, 1 existing TODO; 65 files pass, 1 skipped |
| `npm run test:scope -- changed` | Exit 1: 9,811 pass, 3 fail (five-second Firefox timeouts), 34 TODO; 322 files pass, 3 fail, 12 skipped |
| Isolated full-file retries at unchanged limits | 22/22 assets pipeline, 10/10 nested components, 4/4 host-edit component tests; all three exit 0, both engines |
| `npm run typecheck` | Exit 0 |
| changed-source ESLint / Prettier | Exit 0 / 0 |
| `node tools/modules.ts --check` | Exit 0, no stale wiring |
| `node tools/parity.ts --check` | Exit 0, 1,238 rows; generated views current |
| `node tools/build-animl.ts --check` | Exit 0, 664 authored artifacts |
| `node tools/build-web.ts --check` | Exit 0, 68 entries |
| `node tools/oracle.ts --strict` | Exit 0; 324 completed cases / 540 samples; pre-existing findings retained |
| `node tools/size.ts` | Exit 0; every entry and all six gates pass |
| `node tools/perf.ts` | Exit 0; raw shared-load timings below, no controlled non-regression claim |

The existing TODO is `a11y.tree-visibility`'s old diagnostic scaffold. Skips/TODOs are not passes.
Development failures were corrected before the green scoped runs: wrong test playback method,
non-addressable static snapshot fields, a wrong browser module name (its timeout reproduced in an
isolated run), a settled-overlay refresh gap, missing paint in a fixture, separate-bundle text-style
paint shapes pointing at an inactive registry, and canonical path attribute order. The paint-shape
fix consumes the live registry and keeps the main text entry below the ticket cap. Historical
failed runs remain in verification/p7-8; they are not delivery passes.

Sizes (min+gzip B; baseline measured before edits):

| Entry | Before | After | Budget |
|---|---:|---:|---:|
| fonts | 2,008 | 2,008 | 2,048 |
| fonts-text | 542 | 542 | 768 |
| fonts-options | 3,496 | 3,488 | 4,096 |
| fonts-info (new, optional) | 0 | 7,952 | 8,192 |
| a11y | 2,327 | 2,352 | 2,496 |
| a11y-text | 448 | 450 | 576 |
| a11y-bounds (new, optional) | 0 | 1,407 | 4,096 |
| a11y-actions (incidental shared delta) | 1,066 | 1,070 | 1,216 |
| a11y-dom (overlay seam) | 2,139 | 2,147 | 2,176 |
| text | 5,569 | 5,614 | ticket cap 5,632 (existing manifest 6,144 unchanged) |
| text-overflow | 413 | 413 | 768 |
| text-canvas | 323 | 323 | 768 |
| text-hit | 979 | 979 | 1,024 |
| text-host | 354 | 354 | 1,024 |
| markup-text | 526 | 526 | 1,024 |
| text-input | 3,668 | 3,900 | 4,096 |
| text-input-svg | 362 | 364 | 512 |
| text-input-clipboard | 121 | 121 | 512 |
| text-input-canvas | 104 | 101 | 256 |
| markup-text-input | −46 | −46 | 192 |

Incremental negative/different add-on deltas reflect bundle compression/sharing, not a claim of
source optimization. Existing budgets were not raised. The new optional metadata parser is not
in the app-UI reference set.

| Gate | Before | After | Ceiling |
|---|---:|---:|---:|
| core+web | 21,165 | 21,165 | 24,576 |
| largest scene (30) | 53,982 | 55,438 | 65,536 |
| app-UI | 104,505 | 104,578 | 131,072 |
| runtime sum | 128,157 | 138,626 | 163,840 |
| authoring | 14,899 | 14,899 | 16,384 (also below requested 15,360) |
| Rive-class | 138,167 | 148,857 | 256,000 |

Deviations / deliberate limits:

- The browser metadata API requires explicit SFNT TTF/OTF source bytes (or a face decoded through
  the controller after installing fonts-info). Normalize WOFF/WOFF2 with `anima import-font` for
  inspection; normal FontFace resource loading still accepts the browser's containers. Headless
  `new FontInfo(new Font(bytes))` also accepts the CLI's supported compressed inputs. External
  FontFace objects do not expose bytes. Face-table metrics do not evaluate MVAR. Glyphs use the
  reader's supported context-free GSUB subset; advances are individual, not a full shaping API.
- Selected glyphs use existing grapheme paint runs; a ligature across a paint boundary may reshape.
  A selected text-style reference reuses paint only; it is not a reference to a scene drawable.
  Native direct-Fill and nested-style selected-drawable retries both leave selected ink blank;
  this is an evidenced observation skip, not an observed native red-paint pass.
- Exact final painted semantic bounds are incomplete; the partial calculator stays optional in
  browsers rather than increasing the base semantic entry or changing layout's full entry.
- Shared byte parsing was moved from the CLI into the fonts module to avoid a second parser.
  The decision follows the bounded-reader/separate-heavy-text rationale in
  docs/research/rive-format-and-graph.md and docs/research/rive-web-runtime.md. No Rive source or
  documentation text, third-party font, native binary conversion, publication or PR was used.

Problems:

- One row remains planned, as above. No phase completion or green full-CI claim.
- Performance was measured on the shared machine: bell compile 3.98 ms, 9,040 prefixes 1,126 ms;
  bell/composite frames 56.0/41.5 µs; toolbar compile 5.81 ms and frame 41.1 µs. No pinned A/B run
  or ≤3% claim is made.
- Broad `changed` is not green as a single run: three Firefox tests reached their five-second
  limits under shared load (component-only asset preload, separate-bundle nested swaps and typed
  host-edit/keyframe locality). Each failing **file** passes when run alone, sequentially:
  `npx vitest run --project browser modules/assets/test/web/pipeline.test.ts` (22/22),
  `... modules/nested/test/web/nested.test.ts` (10/10), and
  `... modules/host-edit/test/web/components.test.ts` (4/4). See changed.txt and changed-retry-1/2/3.txt.
  This supports load-sensitive timeouts; it does not manufacture a green full run. Owned engine
  scopes passed without timeout changes. No thresholds, existing budgets or timeouts were raised.
- `anima docs fonts` includes callable API examples; both new capability examples validate through
  the CLI. The final static checks and artifact checks exit 0. No PR or push was attempted.
