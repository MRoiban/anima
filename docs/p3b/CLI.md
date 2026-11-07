# P3b-3 CLI implementation and closure

Implementation: `packages/cli/src/cli.ts`, `project.ts`, `doctor.ts`, `audio.ts`,
`render-options.ts`, `inspect-summary.ts`, `compare-png.ts`, `render.ts`, `encode.ts`.
Contract: SPEC “CLI projects and capture (tooling)”; guide: AUTHORING “Project defaults and headless tools”.
Examples: existing bell/moon/progress AniML and JSON pairs; tested as runnable copied projects.
These tools add no runtime syntax, feature registry entries or Player.step behavior.
Both registry spellings are indexed and accepted by schema lookup.

## Oracle skip notes for closure-ready tooling rows

| Row | Independent evidence | Why no faithful runtime oracle |
|---|---|---|
| tooling.pixel-compare | commands.test.ts: exact RGBA arrays, alpha, mean, tolerance and diff PNG | A standalone PNG arithmetic operation; no scene or native player output is involved. |
| tooling.schema-search | commands.test.ts: deterministic rank, registry field, diagnostic | Searches Anima's registry and diagnostic vocabulary, which has no shared native schema identity. |
| tooling.schema-lookup | commands.test.ts: markup field alias and unknown-field usage | Anima registry field lookup, not a cross-format runtime operation. |
| tooling.environment-doctor | commands.test.ts: missing browser fails; wiring command exercised | Local Node/cache/module wiring is specific to this repository and installation. |
| tooling.project-configuration | commands.test.ts: upward discovery, malformed configs, explicit flags | anima.json is a local tooling contract, not an animation runtime document. |
| tooling.multi-file-project | commands.test.ts: named library imports validated and rendered | AniML source composition uses its existing lexical import system; no binary/native library interchange. |
| tooling.render-presets | commands.test.ts: project defaults and explicit size precedence | Local configuration substitution; frame fit/viewport parity remains separately pending below. |
| tooling.sample-projects | commands.test.ts: bell/moon/progress copied and validated | Samples are Anima authored sources and instructions, not equivalent native assets. |
| tooling.scaffold | commands.test.ts: existing destination protected; cli.test.ts glyph scaffolds | Anima project/source generation; resulting files use its own authoring contract. |
| tooling.publish-local | commands.test.ts: validated .ani, runtime JS and HTML artifacts | Local, unsigned HTML export; no shared native publishing artifact or hosted service. |

## Pending rows and limitations

Keep `tooling.headless-artboard`, `tooling.headless-fit`, `tooling.headless-viewport`,
`tooling.headless-scale`, `tooling.pixel-probe` pending: implemented and unit tested, but new independent
native frame captures have not been collected. No native findings, benchmark records or thresholds
were changed. Existing oracle runner is verification only; it does not establish these new rows.

Keep `tooling.headless-audio` pending: root-asset offline mixing and browser-unavailable diagnostics
are tested. Scoped component/repeat assets fail explicitly; exact within-step timeline occurrence
scheduling is not exposed by the script API. The current CLI mixes at script step delivery times,
which avoids confusing a looping timeline's local event time with an absolute playback timestamp.

Keep `tooling.inspect-summary` pending: table dispatch, unused input/component/model/property and
reachability analysis exist, but static data/model usage analysis is conservative, and exhaustive
cross-feature wiring cases remain to be added. Invalid listener targets use the normal loader
failure path rather than returning a partial linked graph.

No generated project schema was added: the existing generator owns the runtime `.ani` schema,
where project configuration does not belong. Project validation lives in the CLI. Unused runtime
skeletons and TODO probes created by the required scaffolder runs were removed; all 17 dry/run
pairs succeeded. Shipped sources, budgets, measurement tools and protected modules are unchanged.

Parity bookkeeping: the generator rejects done rows in unfinished phases (P3b is not in FINISHED).
All statuses therefore remain planned, with implementation evidence updated for the ten rows above.
The orchestrator owns phase closure; no phase was relabelled to bypass validation.

## Verification

Final selected scope: 237/237 tests, 25/25 files, using one Vitest worker through a temporary
Node preload (recorded in `packages/cli/verification/p3b3/checks.json`). Timeouts and assertions
are unchanged. Earlier parallel runs hit existing five-second authoring/HTML/JPEG/WebP timeouts;
a timed-out encoder continuation also contaminated its following browser-call spy (3 vs 2 calls).
The final serial run passes that lifecycle assertion as well as all new command tests.

CLI typecheck, ESLint, formatting, module wiring (0 stale files), parity generation/check,
size and strict oracle all exit 0. Oracle references/findings and measurement inputs are unchanged.
No new native parity is implied by the existing oracle passing. Perf ran successfully under
concurrent load (bell frame 116.4 µs, toolbar 84.4 µs, bell compile 6.73 ms); there is no quiet paired
comparison or claimed ≤3% performance result.

No runtime modules were edited. Before → after bytes: core+web 20,362 → 20,362;
data 8,034 → 8,034; bind 2,038 → 2,038; components 4,051 → 4,051;
full-featured total 111,723 → 111,723. CLI tooling has no runtime byte limit.
