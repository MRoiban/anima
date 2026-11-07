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
| tooling.render-presets | commands.test.ts: project defaults and explicit size precedence | Local configuration substitution; frame fit/viewport parity is recorded below. |
| tooling.sample-projects | commands.test.ts: bell/moon/progress copied and validated | Samples are Anima authored sources and instructions, not equivalent native assets. |
| tooling.scaffold | commands.test.ts: existing destination protected; cli.test.ts glyph scaffolds | Anima project/source generation; resulting files use its own authoring contract. |
| tooling.publish-local | commands.test.ts: validated .ani, runtime JS and HTML artifacts | Local, unsigned HTML export; no shared native publishing artifact or hosted service. |

## P3b-6 closure evidence (all seven former pending rows)

All seven implementations are closure-ready; statuses stay `planned` for the orchestrator's
phase closure. No old native reference, finding, limit, benchmark record or measurement input
was modified. New cases append to the central oracle manifest with exact limits fixed at zero.

| Row | Independent evidence |
|---|---|
| `tooling.headless-artboard` | `tests/oracle/tooling-headless-artboard`: native Other selection; CLI `--component other` matches the full 240×240 frame. |
| `tooling.headless-fit` | Four central `tooling-headless-fit-{contain,cover,fill,none}` cases; independently authored 120×60 red/blue geometry and native fit commands; CLI flags tested against the retained frames. |
| `tooling.headless-viewport` | `tooling-headless-viewport`: 120×60 artboard in 240×240 viewport; CLI dimensions and letterbox pixels match. |
| `tooling.headless-scale` | `tooling-headless-scale`: native 480×480 viewport downscaled 0.5 to 240×240; same CLI viewport/scale. |
| `tooling.pixel-probe` | `tooling-pixel-probe`: native probes report centre FF0000FF and corner FFFFFFFF; CLI RGBA reports `[0,0,255,255]` / `[255,255,255,255]`, and full frames match. |
| `tooling.headless-audio` | `tooling-leftovers.test.ts`: base/machine/motion/combined policies deliver five within-step occurrences 0.02/0.08/0.12/0.18/0.22 at advance(0.25), for a component and two repeats. Chromium PCM proves 3×12000×0.5×0.5=9000 at 0.024 and 0.124, silence outside clips; colliding root asset remains unused. Existing native audio skip applies: permitted local commands report triggers, not decoded/mixed PCM, so waveform equality is not a faithful observable. |
| `tooling.inspect-summary` | Valid linked fixture covers named bindings, lists, listeners, conditional machines, used/unused components/models/properties and focus; a separate base accessibility/focus fixture verifies input use. Empty machines no longer crash summary, named machines are traversed, and data references are parsed by model/path rather than substring matching, with named default instances, instantiated models and comments handled explicitly. Loader still rejects invalid documents before summary. |

The native oracle for `tooling.inspect-summary` is skipped: this table reports Anima JSON paths,
module declarations and loader diagnostics, which have no shared schema identity with native RML
inspection. The valid cross-feature fixtures independently test its linked graph and findings.

Each native frame is central 240×240; exact comparison limits are maxDiff 0 / 0 pixels over 0.
The central AniML describes final fitted geometry, while CLI flag tests use the original aspect
ratio and select the component independently. Source RML, commands, raw logs and untouched PNG
captures are retained per case; native build folders/binaries were removed. The initial capture
failed because front/back shape ordering occluded blue and native letterboxes clear to #1d1d1d;
fixing the authored ordering and explicitly matching the canvas background resolved those
fixture disagreements. No measured frame was blurred, cropped, recoloured or threshold-adjusted.
See docs/research/rive-web-runtime.md on separating viewport/host composition from scene geometry.

Native probes exposed the `none` anchor and full-output-background bugs. `none` now centres at
one pixel per authored unit, and explicit backgrounds cover letterboxes. SPEC was updated with
both corrections. Event fractions and emitting catalog metadata are tooling-only, eliminated
from browser builds; the legacy machine event seam is wrapped in tooling without modifying
P3b-4's machine event implementation. The existing root-only audio restriction is removed.

## P3b-3 historical implementation notes

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

## P3b-6 native measurements

| New case | Maximum channel delta | Pixels over 0 | Frame |
|---|---:|---:|---|
| headless-artboard | 0 | 0 | 240×240 |
| headless-fit-contain | 0 | 0 | 240×240 |
| headless-fit-cover | 0 | 0 | 240×240 |
| headless-fit-fill | 0 | 0 | 240×240 |
| headless-fit-none | 0 | 0 | 240×240 |
| headless-viewport | 0 | 0 | 240×240 |
| headless-scale | 0 | 0 | 240×240 |
| pixel-probe | 0 | 0 | 240×240 |

The initial, superseded fixture capture had max delta 255: contain/viewport 36,000 pixels,
cover 28,800, fill 14,400, none 52,200. Those numbers identified the documented front/back-order
and canvas-background mismatch; no passing-case limit or old finding was adjusted.
Native `probe` as a command was rejected; the accepted `--probe` startup flag produced the
retained two-point observations. Source-clock audio additionally tests target carry across a
transition at 0.05: a single advance(0.2) schedules emitted timeline audio at 0.02/0.07/0.15.

The earlier Verification section above is P3b-3's historical result. Current P3b-6 scope/static/
measurement results are recorded in `modules/tooling/REPORT.md` and its verification/p3b6 folder.

P3b-6 final verification: requested tooling/CLI/conformance/oracle scope 1,153 pass / 30 TODO;
changed scope 7,535 pass / 42 TODO including selected browser suites; zero failures in either.
Strict oracle 261 cases / 457 samples, all eight new frames exact. Full-featured runtime
112,330 → 112,661 B; all budgets pass. Complete figures and prior repaired failures are in the
P3b-6 tooling report and verification/checks.json.
