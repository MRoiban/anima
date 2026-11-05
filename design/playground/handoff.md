# Playground handoff (P3)

**Design artifact:** `design/playground/mockup.html` (sha256 `5cb260be05ea…`, branch `p3-playground`).
Open it in a browser; the black "mock:" switch (bottom corner) shows the states: valid, errors,
scrubbing, dark. The switch is mockup chrome, not part of the product.

**Design status:** selected by the orchestrator (the owner asked for the playground; no separate
approval required). The mockup is the visual source of truth: raise a needed deviation with its
reason before changing it.

## Visual requirements

- **Tokens** (from `examples/web/template.html`, extended): `--paper --panel --ink --muted --faint
  --line --accent --accent-soft --ok/-soft --err/-soft --warn/-soft`, syntax `--tag --attr --val
  --com`; light and dark sets exactly as in the mockup's `:root` and `:root[data-theme='dark']`,
  plus `prefers-color-scheme` when no explicit theme is chosen (as the demo page does).
- **Type:** wordmark serif 20 px; UI sans 14 px; panel heads 12 px uppercase, letter-spacing
  0.06em, `--muted`; code mono 12.5 px / 1.6; values tabular-nums.
- **Layout (≥ 1100 px):** top bar; 3 columns `minmax(380px,1.15fr) minmax(320px,1fr)
  minmax(280px,0.85fr)`: Source (+ Problems below, ≤ 34 % height) | Preview (+ Inputs, events) |
  State machine; Timeline spans columns 2–3 at the bottom. Panels separated by 1 px `--line`.
- **Preview:** square tile, radius 22 px, 1 px `--line`, optional grid (24 cells over the viewBox),
  icon at 84 %; size row 16 / 24 / 48 / inverse chips; speed segment `1× ¼×`.
- **State graph:** per layer, an SVG graph: pill states (radius 14), current state filled
  `--accent` with white text, previous state dashed accent outline, entry dot + arrow into the
  initial state, edges `--faint` with mono 10.5 px condition labels, the live transition in
  `--accent` 2 px; under a blending layer a blend progress bar with percent.
- **Timeline:** head with timeline select, play/pause, step-frame, time `0.000 s`, mode pill
  (`live — follows the state machine` / `scrubbing — inputs paused`); ruler with ticks every
  0.1 s, labels every 0.2 s; one row per track: name (150 px), lane with keyframe diamonds
  (8 px, rotated square; `hold` keys hollow) and a segment line, current value (64 px, right);
  2 px accent playhead with a caret, draggable.
- **Problems:** rows `dot · file:line:col · message code-id / hint`; selected row `--panel`;
  the source line gets `--err-soft` and the token a wavy `--err` underline.
- **Errors keep the last valid build** on the stage, greyed (opacity 0.25, grayscale) with the
  note "showing the last valid build".

## Responsive and state requirements

- **1100 px and below:** 2 columns: Preview | State machine, then Source full width, then Timeline.
- **720 px and below:** one column: Preview, State machine, Source, Timeline; top bar wraps (file
  name on its own line); inputs one per row; no horizontal page scroll at 390 px (the code panel
  scrolls inside itself).
- **States:** valid; errors (problems listed, stage on last valid build); scrubbing (inputs
  paused, playhead under the user's control); dark theme; empty problems text "No problems. Every
  change is compiled as you type."; saving / saved / unsaved in the file label; a file changed on
  disk while open (reload prompt in the file label).

## Integration targets

- **Compile:** `compile()` from `@anima-format/markup` (`packages/markup/src/index.ts`) on every
  edit (debounced ~150 ms); diagnostics carry `line`, `column`, `code`, `message`, `hint`.
- **Play:** the real runtime: an `<anima-icon>` (`packages/web/src/index.ts`) loaded with
  `load(doc)`; the size chips are further `<anima-icon>`s on the same document. Inputs via
  `icon.set/fire/toggle`, read with `icon.player.get(name)`; events from `anima:event`.
- **State machine and timeline panels:** `Player.inspect()` (new in this branch,
  `packages/core/src/player.ts`, test `packages/core/test/inspect.test.ts`): per layer `state`,
  `prev`, `blend` (0–1 or null), `locked`, `timeline`, `time`. Graph structure from the model
  (`player.model.layers[].states[].on[]`) or from the compiled doc. Track rows from
  `model.timelines[].tracks` (times, values, eases); values from `player.values()`.
- **Scrubbing:** pauses the live player and shows the selected timeline at time *t* over the rest
  pose (sample with `sampleTrack`, exported from core); leaving scrub mode resumes live play.
- **Format / Copy .ani / Save:** `formatMarkup()`; `compile().text` to the clipboard; Save writes
  the file through the local server.
- **Server:** `anima playground [file.animl]` in `packages/cli`: `node:http` on 127.0.0.1 (port
  flag, default 4519, next free), serves the playground page and its bundle, `GET/PUT` the opened
  file (only that file), and a change notice when the file changes on disk. No dependencies.

## Simulations to replace

Everything in the mockup's `<script>`: the static SVG frame (→ live `<anima-icon>`), the
hand-written problems list (→ compile diagnostics), the fixed source (→ the opened file, editable),
the drawn graphs (→ generated from the model with a simple layered layout), the static tracks and
playhead (→ model timelines + `inspect()`), the mock switch (remove).

## Ownership

- Agent "playground": new `packages/playground/` (private workspace package, no runtime
  dependencies: a textarea over a highlighted `<pre>` for the editor, hand-written SVG graph
  layout), its build in `tools/` (esbuild, like `tools/build-web.ts`), `anima playground` in
  `packages/cli`, tests (unit + a Chromium/Firefox browser test). Must not change
  `packages/core` beyond reading, nor `packages/web/src` (request API additions instead).
- Agent "host API": `packages/web/src/index.ts` and its tests, the web API doc.

## Revisions after implementation

- Short windows (found at 1280×720 on the real build; the mockup had the same flaw): the preview
  tile is bounded by the window height too (`min(300px, 100%, 100vh − 560px)`, at least 140 px) and
  the Preview column scrolls, so the tile never overlaps the inputs. Updated in both.
- The timeline ruler keeps its first and last labels inside the lane; the editor's focus ring is a
  1 px inset accent line instead of 2 px.

## Acceptance

- Visual: screenshots of the real playground at 1440, 1000 and 390 px in valid, errors and dark
  states, side by side with the mockup's; layout, type, spacing and tokens match.
- Integration: editing the source recompiles and the stage updates within 300 ms; a typo shows
  the problem at the right line:column and keeps the last valid build; inputs drive the icon;
  hovering/clicking the stage icon drives it like a page would; the state graph highlights the
  current state and the live transition with blend progress; the timeline playhead follows the
  playing state's timeline; scrubbing shows the timeline at *t*; Save writes the file; Format
  reformats; reduced-motion toggle reloads with reduced motion.
- Checks: `npm run check` green; core + web budget unchanged except for host-API work.
- Open assumptions: graph layout for layers with more than ~6 states may need a vertical list
  fallback (agent decides, reports); no undo beyond the textarea's own.
