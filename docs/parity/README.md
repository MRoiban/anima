# Parity with Rive: inventory, matrix and roadmap

Goal: anything an agent or a designer can make with Rive, they can make with Anima — the Anima way:
readable names instead of numeric ids, one unit system (seconds, degrees, grid units), strict
diagnostics with pointers and hints, deterministic playback, and the `validate / inspect / sample /
render` loop. The icon path (spec 0.1, bell parity, `<anima-icon>`, the core + web budget)
stays as it is (its core + web budget is 25 KB since M4; 14.6 KB measured); everything new is an optional module declared in `requires`.

| File | What |
|---|---|
| [`inventory.json`](inventory.json) | **Source of truth.** One row per Rive capability: id, category, what it does (our words), the Rive mechanism (type, property and API names), kind (file content / runtime behaviour / runtime API / tooling), sources, and the Anima mapping. |
| [`INVENTORY.md`](INVENTORY.md) | The inventory by category, with sources. Generated. |
| [`MATRIX.md`](MATRIX.md) | Each capability → Anima construct, module, status, phase and proving test; by phase, then "Maybe / later" and "Won't do". Generated. |
| [`matrix.json`](matrix.json) | The mapping alone, for tools. Generated. |

Edit `inventory.json`, then run `node tools/parity.ts` (the test `tools/parity.test.ts` fails when
the views are stale or a row breaks the rules: unique ids, sources on every row, a reason for every
deferred / maybe-later / won't-do row, done ⇔ P0, maybe-later ⇔ "later").

## Method and sources (Phase A, 2026-11-05)

Four researchers covered the categories (each from every source), then the rows were merged,
de-duplicated and audited:

- The Rive CLI 1.9.0 (`~/.rive/bin/rive`): `rive --help` and every command's help; all 92 `rive docs`
  topics, including the `luau/*` and `animascript/*` API references; `rive schema --list`,
  `rive schema <Type> --all --json`, `--animatable` and `--bindable`. Read-only commands only.
- Rive's MIT runtimes, shallow clones read-only outside the repo: `rive-app/rive-runtime` @
  `1c8f5d3fe8d1c6bca1cfd7e40367b23aff9dba3f` (`include/rive/**`, generated `*_base.hpp`) and
  `rive-app/rive-wasm` @ `ada7b9f35f951ff491f65f5ffc74a3ed3c582203` (`js/src/**`, `rive.d.ts`).
- rive.app/docs for capability coverage (editor, runtimes per platform, data binding, layout,
  text, scripting, events, audio, accessibility).
- `docs/research/` in this repo.

Counts before merging: 1 275 rows; 37 cross-category duplicates were merged into one row each (the
merged ids are kept as `aliases`, their sources combined), leaving **1 238**. Every `done` claim was
checked against spec 0.1 and the code; one was downgraded (`state-machine.exit-time-seconds`: `@after`
counts time in the state, not in the source animation).

**Guardrails.** Descriptions are paraphrased; type, property and API names are cited as facts.
A check of every description against the full `rive docs` corpus (179 k words) found one shared
7-word run in 1 238 rows (ordinary phrasing). No `.riv` file was read. No account command was run.
No Rive code was copied; if an Anima algorithm ever follows Rive's MIT code closely, the spec will
say so and a `NOTICE` file will carry the attribution.

## What 0.1 already covers

173 of 1 238 capabilities (14 %) are done (111 in 0.1, AniML in P1, 15 in P3, 46 in P4a: paint and composite), concentrated where icons live: transforms (9/17), animation
(16/40), state machines (25/61), drawing and paint (20/125), input (13/93), host API (12/125). The
large categories with nothing yet are data binding (169), host API (125), scripting (96), text (61),
assets (50) and layout (49). `MATRIX.md` has the per-category table.

## Module split and size budgets

A module is a `requires` feature plus a browser module that registers itself with the runtime. A page
pays only for the modules its documents declare. Budgets are min+gzip, measured like the core budget
(`tools/size.ts`), each for the module alone on top of core + web.

| Module | Carries | Budget |
|---|---|---:|
| core + web | the 0.1 icon path (unchanged; 14.6 KB measured) | 25 KB |
| `markup` | the in-browser AniML compiler (optional; pages that ship `.ani` never load it); raised from 6 KB at P4a | 8 KB |
| `paint` | gradients (linear, radial, angular), feather, clipping and masks, blend modes, dashes, more shapes, image paints | 5 KB |
| `interaction` | blend states (1D, direct, additive), transition flags, drag, align target, keyboard, focus, gamepad, scroll | 4 KB |
| `events` | event payloads, open-URL events, audio events (Web Audio) | 2 KB |
| `data` | view models of every property type, lists, enums, binding in every direction, converters, formulas | 7 KB |
| `components` | nested artboards, per-instance data, component lists, libraries | 4 KB |
| `assets` | image, font, audio and blob assets; host loaders; embedded vs referenced | 2 KB |
| `text` | text, runs, styles, fonts, variable axes (browser text shaping, no font engine shipped) | 7 KB |
| `layout` | flex, grid, scrolling, responsive sizing | 7 KB |
| `rig` | bones, skinning, meshes, constraints, solo | 7 KB |
| `script` | the sandboxed scripting runtime (language chosen in P9) | 20 KB |
| `gpu` | shader effects and post-processing (WebGPU, WebGL2 fallback) | 10 KB |
| `canvas` | the Canvas2D/WebGL renderer for scenes SVG cannot do well | 8 KB |
| `a11y` | semantics beyond the element itself: roles per node, focus scopes, semantic actions | 3 KB |

Budgets are first estimates; each phase measures its module and records it in `docs/LOG.md`.

## Phase order

Weighted toward what the owner uses: the web runtime, AniML, Glyphy and the playground first. Since
2026-11-06 the goal is explicit — a smaller, agent-native Rive — and the order is P4a → P5 → Pc →
P4b–e → P3b → P6 → P7 → P8 → P9 → P10, each phase gated by the agent-native benchmark
(`docs/benchmarks/agent-native.md`).

| Phase | Scope | Why here |
|---|---|---|
| P0 | Done: 0.1, core, CLI, `<anima-icon>` (M0–M4) | — |
| P1 | AniML: compiler, decompiler, `anima build`, markup in every command, inline HTML | Every later feature is written once in the registry with both spellings. |
| P2 | M5: Glyphy export draft, two more glyphs in AniML, the head-to-head test | Proves the authoring loop on real glyphs before the model grows. |
| P3 | Playground/inspector (live AniML, state graph, timeline scrubber, input controls) and the web host API (fit/alignment, playback control, events, data access) | Moved ahead of the suggested order: it is the owner's main tool for seeing and tweaking, and it makes every later phase easier to check. |
| P3b | The rest of P3: the `a11y` module (roles, states and focus per node), authoring/drawing tools, headless CLI extras (touch, wheel, gamepad, data streams), timeline editing | Split off when the playground and host API shipped; scheduled after P4 unless a later phase needs a piece earlier. |
| P4a | `paint`, on the module system and the renderer-neutral draw layer | The most-used Rive features after the basics; the module pilot. |
| P5 | Components and assets | Moved up (owner): reuse is the main friction agents hit; per-instance inputs now, data-bound instances after P4e. |
| Pc | Canvas backend, minimal | Brought forward from P10 (owner): rigging and large scenes need it; SVG stays the icon default. |
| P4b–e | `motion`, `interaction`, `events`, `data` | The rest of the first block of Phase B. |
| P6 | Text | Needs assets (fonts) and binding. |
| P7 | Layout | Builds on text measurement and components. |
| P8 | Rigging | Independent of the above; least needed for UI work. |
| P9 | Scripting | Needs the hooks above to exist. |
| P10 | GPU effects, WebGL renderer | Last: heaviest and least needed for vector icons. |
| later | Native runtimes, editor round-trip, cloud tooling, low-level GPU API, 3D, parallel/network scripting, video export | Inventoried in full; the spec stays portable (normative step function, conformance cases, no web-only semantics in the format) so they stay possible. |

## Oracle tests

For each capability, the same small scene is written twice — in Rive's markup as a CLI project
(`tests/oracle/<case>/rive/`) and in AniML — and captured headlessly with `rive <dir> --commands`
(advance / pointer / data / screenshot / data-dump) and `anima sample` / `anima render`. Sampled
values are compared exactly where both expose them, frames within a tolerance.
`fixtures/bell/rive-reference/` is the first such case. Commands that touch the Rive account
(`--publish`, `--rev`, `push`, `pull`) are never used.

## Decisions for the owner

- Package names and npm scope (working names `@anima-format/*`), licence, making the repo public —
  unchanged from M0.
- Nothing else: no category is dropped; low-value areas are "maybe-later", not removed.
