# P3c design: size round and P3b carry-overs

Decided by the orchestrator (2026-11-07) under the owner's size gates (`docs/PLAN.md` "Size gates",
final through P8) and the instruction to proceed on non-owner decisions, logging them in WORKLOG as
"decided, owner may revisit".

## 1. Targets

| Metric | Command | Baseline (end of P3b, main 38dd757) | Target |
|---|---|---:|---|
| runtime sum | `node tools/size.ts` | 109 971 B | **≤ 104 472 B** (−5 %, owner rule), measured at the end of P3c, carry-overs included |
| the other five gates | `node tools/size.ts` | core+web 20 622, scene 55 313, app-UI 91 158, authoring 11 949, Rive-class 115 473 | no gate grows; core+web may grow only by code moved out of several modules into one shared place, with the runtime sum falling by more |
| module budgets | `tools/modules.generated.ts` | 8 modules at ≥ 95 % | after the round, every budget reset to ≈ measured × 1.10 (rounded up to 64 B), never above 8 KB |
| frame and compile cost | `node tools/perf.ts` | bell frame 32.6 µs, toolbar 26.5 µs, bell compile 2.2 ms, toolbar compile 3.9 ms | within noise (≤ 3 %) |
| behaviour | `npm run check` | green | green: a size cut never changes behaviour (conformance, oracle, browser tests unchanged) |

## 2. Size round method

1. **Survey first** (`design/p3c/SIZE-SURVEY.md`): measure, per module, where its gzip bytes go and
   which helpers exist in more than one module or duplicate core; rank candidates by bytes saved in
   the runtime-sum bundle.
2. **Cut along the survey**, one owner per module per wave: shared helpers move to one internal
   place (a core export when every page benefits, else a shared optional module file imported by
   the modules that need it, so bundlers dedupe it); duplicated tables become one table; verbose
   strings stay behind `VERBOSE`; dead branches go.
3. **Budgets reset** last, by the orchestrator, to ≈ 10 % headroom.

## 3. Carry-overs (23 rows) — decisions

Recorded in WORKLOG as "decided, owner may revisit".

| Rows | Decision |
|---|---|
| `tooling.benchmark` | Anima has no WASM; report JS heap growth (`process.memoryUsage().heapUsed` delta and per-frame slope over the run) as the memory-growth figure. |
| `tooling.environment-doctor` | Add port availability (playground default), `anima.json` validity and browser/device emulation checks; authentication is reported as not applicable (Anima has no accounts). |
| `tooling.project-configuration` | `anima.json` gains `exclude` (globs) and `constants` (build-time values substituted into AniML attributes as `{{name}}`). |
| `tooling.render-presets` | Presets may describe frame sequences; `--preset a --preset b` runs a sequential queue; video output is WebM through headless Chromium's `MediaRecorder` (CLI only), PNG sequences otherwise. |
| `tooling.schema-lookup` | Filters `--animatable`, `--bindable`, `--inherited`; editor-only entries don't exist in Anima (no editor) and the filter reports that. |
| `tooling.test-assertions` | Script `group <name>` … `end`, `expect-error <code>` for the next command, and test-only sources excluded from `anima build` via `anima.json` `exclude`. |
| `components.library-*` (3) | The Rive CLI's library commands are banned (account), so no native probe can exist: evidenced skips with that reason. `library-models` additionally needs shared authored instances and enums from a library. |
| `host-api.deprecation-policy` | `AnimaIcon.warnings` accepts `{ off: [ids] }` besides `'once' \| 'always' \| 'off'`. |
| `host-api.performance-marks` | Marks `anima:load` and `anima:first-frame` (and measures between them) when marks are enabled. |
| `transforms.computed-transform-values` | `player.computed(id)` adds `local` and `root` coordinates (position, rotation, scale) besides the world matrix. |
| bindable artboards (4: `components.host-artboard-reference`, `data.host-artboard`, `host-api.bindable-artboards`, `host-api.data-artboard`) | A component handle from another loaded document (`icon.componentFrom(otherIcon, name)`) and assignment of a component together with its own data instance. |
| a11y (6) | Directional traversal and spatial focus: match the native choice (sibling before focusable ancestor) and record any remaining difference as a numbered finding; focus conditions: native capture; exact bounds: CLI computes exact path/stroke extents, the overlay uses `getBoundingClientRect()` plus half the stroke width (engine differences recorded); visibility matrix: complete the cases; low-level semantics: dependency-driven rebuild. |
| `a11y.web-overlay` | Position the overlay over canvas output using the canvas backend's node boxes. |
| Benchmark friction | `docs authoring` gets a table of contents and `docs authoring <section>`; `docs spec --list` lists spec sections; stale "pending" notes removed; a script diagnostic when an action targets a hidden or absent semantic node; a tab-list recipe (selection follows focus) in the a11y guide, as docs unless an option costs ≤ 20 B. |

Runtime carry-overs land after the size round's cuts, inside the reset budgets.

## 4. Size-round decision after the survey (2026-11-07)

`design/p3c/SIZE-SURVEY.md` measured 1 624 B of behaviour-preserving cuts (1.5 %) that grow no
other gate, and a 4 461 B runtime saving from moving the AniML authoring hooks that runtime modules
import today into the authoring class (authoring add-on 11 949 → ~14 322 B, under its 16 384 B
ceiling). **Decided (owner may revisit):** do both. The hooks are in-browser compiler code, which the
owner's gates put in the authoring add-on, out of page totals. §1's "no gate grows" is relaxed for the
authoring add-on only, which must stay ≤ 15 360 B (1 KB margin under its ceiling); `markup` is split
so every entry stays ≤ 8 KB. Pages that compile AniML in the browser must keep working unchanged.

| Ticket | Owns (files) | Measured saving |
|---|---|---:|
| P3c-4 authoring seam | `modules/{paint,surface,components,bind,convert,events,focus,motion,data}/web/index.ts`, `modules/*/web/markup.ts`, `modules/markup/` | 4 461 (runtime) |
| P3c-5 diagnostics: events/data/machine | survey T2 files | 578 |
| P3c-6 diagnostics: visual | survey T3 files (no clone sharing) | 561 |
| P3c-7 diagnostics: converter/bind + node pointers | survey T1 + T4 files | 447 |

## 5. Budget reset (2026-11-07, after P3c-4/5/7)

Every module budget was reset to ⌈measured × 1.10 / 64⌉ × 64 B, capped at the 8 KB module ceiling
(owner rule 2; values from `node tools/size.ts` on `p3c` after the authoring move and the event,
data, machine, converter and bind guards). Budgets went down where modules were far below them
(e.g. `mix` 5 120 → 1 856, `assetio` 2 048 → 768) and up where they sat at their limits (e.g. `a11y`
2 048 → 2 304). Two entries are capped by the ceiling with less than 10 % headroom: `markup` (authoring,
8 007 / 8 192) and `surface` (7 821 / 8 192); either must split before it grows. P3c-6's modules
(paint, composite, surface, mix, componentpaint, contour) only shrink, so their reset values stand.

Final reset after the carry-overs (same rule): `a11y` 2 496, `a11y-actions` 1 216, `a11y-dom` 2 176,
`canvas` 5 888, `composite` 4 160, `contour` 3 840, `data-host` 1 088, `focus` 3 456, `paint` 4 416,
`devtools` 448.
