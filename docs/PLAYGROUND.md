# Playground

Run `node packages/cli/src/main.ts playground path/to/icon.animl` (or `anima playground`
from the workspace binary). The command prints its local URL. It binds only to `127.0.0.1`,
tries port 4519 and then the next free port; `--port 0` asks the OS for a free port.
Without a file it opens `examples/bell.animl` as a scratch example: you can edit the preview,
but Save is disabled and the server rejects writes. Stop with Ctrl-C.

`packages/playground` is a private workspace with plain TypeScript, DOM and SVG. It adds no
runtime libraries. `tools/build-playground.ts` bundles the real markup compiler and web runtime
with esbuild **when the server starts**, then embeds the bundle and CSS in one HTML page.
There is no committed generated playground bundle and therefore no artifact freshness check.
`npm run check` typechecks and tests the source, including building and serving that page in
Chromium and Firefox. `npm run build:playground` optionally writes an ignored `dist/index.html`;
the CLI always builds afresh, so it never serves that stale development output.

The textarea overlays an escaped syntax-highlighted pre. Edits compile after 150 ms; diagnostic
buttons select the compiler's 1-based line/column in the source. Invalid edits keep the last valid
icon and inspector model. `.ani` shows the last valid compiled output read-only. Format uses
`formatMarkup`, Copy .ani uses `compile().text`, Ctrl/Command-S saves, Shift-Alt-F formats.

Inputs and pointer interaction drive the real `<anima-icon>`. Graph structure comes from its
model; current state, previous state, blend progress and timeline time come from `Player.inspect()`.
Graphs use compact layers up to six states and a vertical list layout above six. Each graph has a
text description of its transitions. The timeline shows all real tracks in a vertically scrolling
panel; hold keys are hollow. Drag a lane or use the keyboard-accessible playhead range to scrub.
Step moves 1/60 second; Play in scrub mode previews that timeline; click the mode pill or press
Escape on the playhead to return to live playback.

Scrubbing pauses the live element, then loads another real `<anima-icon>` with the selected timeline
sampled through core `sampleTrack` over the document rest pose. It does not mutate the live player's
state or queued inputs. Unkeyed live hover poses do not leak into a sample. Reduced motion reloads
the live document; explicit scrub sampling still shows the requested time. Reset uses the host API
when available. Until the parallel host API lands, `pause`, `play` and `speed` are feature-detected;
Reset falls back to `load`, and input reads fall back to `player.get`. Live Pause/Play and rate controls stay disabled until that host API is present; the playground does not patch the web runtime or install a second live scheduler.

The server exposes only `GET /` and `GET/PUT /api/file`, for exactly the opened path. File revisions
are SHA-256 hashes. Polling once per second notices disk changes and offers Reload; it never
silently overwrites an editor draft. PUT checks the revision and returns 409 on a conflict; saves
are serialised across tabs. Reload asks before discarding unsaved text. Writes require JSON and the
local origin; the host header is checked as well. The server is a local development tool, not hosting.

Design decisions follow `design/playground/handoff.md` and its mockup. The separate sampled preview
keeps the state machine distinct from timeline sampling (research `rive-animation-and-state.md`,
lessons A.2/A.6); inspectors reuse the shared typed model (`rive-format-and-graph.md`, lessons §6).
The UI inspector schedules frames only while the live player or scrub preview is moving, and CSS
handles themes (`rive-web-runtime.md`, lessons 3/8); the single-file build adds no remote assets.

Screenshots: `node packages/playground/test/capture.ts` starts a real server against a temporary
bell file and writes `design/playground/impl/{1440,1000,390}-{valid,errors,dark}.png` at
1440×900, 1000×800 and 390×844. These show real compiler/runtime output, initially at rest rather
than the mockup's simulated ringing pose. The reference file is 117 lines including its trailing
newline; compiler output and diagnostics are shown as returned, rather than using mock data.
