# STATUS / VERIFY / METRIC / DEVIATIONS / PROBLEMS

STATUS: playground implementation complete in its owned scope. Parallel host API integration remains.
No push, PR or merge. No edits to core or `packages/web/src`; no Rive commands, source, docs text or
`.riv` access; no licence or runtime libraries added.

VERIFY: `npm run check` passed, 421 tests in 25 files, no skips. Includes 14 playground browser tests
(7 Chromium, 7 Firefox), 8 pure tests and 4 server tests; existing Chromium/Firefox runtime tests
also pass. Typecheck, ESLint, Prettier, size budgets, build-web freshness and 16 build-animl checks
passed. The actual CLI was started with `playground --port 0 --format=json`: HTTP 200, default bell,
`writable: false`. Five source-input → real icon DOM rebuild samples: 178, 273, 189, 183, 181 ms.

The first full check failed only on two existing web tests because the committed standalone demo
predated the branch's `Player.inspect()` addition. Regenerating it with `node tools/build-web.ts`
fixed the stale artifact; the final full check passed. Early test assumptions were corrected:
`fil` is at 32:51 and also causes a missing-fill diagnostic, and Node fetch does not override Host
(the rebinding test now uses `node:http`). No failures are suppressed.

METRIC: 13/15 tracked acceptance checks met on this checkout; 2 await the parallel host API.

| # | Acceptance item | Result / evidence |
|---|---|---|
| 1 | Visual/responsive valid, errors and dark views | Met: 9 real UI PNGs; mockup tokens/CSS reused; 1440×900, 1000×800, 390×844; page scrollWidth equals viewport at all widths. Source and timeline scroll internally. Mockup opened and inspected in Chromium; real images visually inspected. Final comparative design review belongs to the orchestrator. |
| 2 | Edit recompiles and updates within 300 ms | Met: 150 ms debounce; measured 178–273 ms over five real source → stage rebuilds. |
| 3 | Typo at exact line:column, last valid stage retained, repair clears | Met: both browser suites verify `bell.animl:32:51`, preserved real SVG and clearing diagnostics. |
| 4 | Inputs drive the player | Met: both browsers toggle hover and observe player input/scale changes; trigger and bounded numeric controls generated from the model. |
| 5 | Stage hover/click drives runtime interaction | Met: both browsers hover/click the actual element and observe hover/ringing. |
| 6 | Current state, previous state, transition and blend progress | Met: real model graphs and Player.inspect; both browsers verify ringing/current edge after Fire; progress text/bar follow inspect blend. State/transition text alternatives provided. |
| 7 | Timeline follows playing state | Met: timeline selected from inspect; real key times/hold diamonds and current player values; playhead follows the inspected local time. |
| 8 | Timeline sampling at selected time | Met: independent real-runtime sampled preview over rest pose; pure tests cover exact keys, endpoints, colours, boolean hold, no live mutation; browser scrub/step changes stage and playhead. |
| 9 | Save writes the opened file | Met: Ctrl-S writes temp file in both browsers; server rejects stale revisions and read-only example; disk change offers Reload. |
| 10 | Format reformats source | Met: Shift-Alt-F, both browser suites; .ani view is read-only and Copy uses compiled text. |
| 11 | Reduced-motion toggle reloads | Met: both browsers verify reducedMotion and endpoint state/value after Fire. |
| 12 | npm run check green | Met: final 421/421, no skips, full required chain. |
| 13 | Core+web size unchanged by playground | Met: 14962 B gzip before/after, 37293 B min; markup 5795 B gzip incremental; empty source diff in core/web. |
| 14 | Live Pause/Play and paused live clock during scrub | Pending: feature-detected host pause/play; live controls disabled until available. Independent scrub playback and sampled stage work. Exact live clock preservation awaits host API integration. |
| 15 | 1× / ¼× playback rate | Pending: feature-detected speed; controls disabled until available. |

DEVIATIONS:

- Serve-time esbuild produces self-contained HTML; no committed playground bundle or freshness
  check. Source is built in browser tests and optionally by `npm run build:playground`.
- More than six states use a vertical layout; all real transitions are shown (including transitions
  omitted from the mockup). Graphs are generated rather than special-cased SVG artwork.
- All actual tracks are available in a scrolling timeline rather than the mockup's six fake rows.
- Screenshots show the valid initial resting pose and actual compiler diagnostics/file size,
  rather than simulated ringing state, truncated source, invented diagnostics or mock size.
- Shared preview rejected the file URL as unsupported; requested headless Chromium fallback used.
- The workspace lock refresh also records the already-declared web → markup workspace dependency.

PROBLEMS: host API is absent on this implementation checkout. This agent did not edit web source.
Pause/resume/rate need re-verification after that parallel change lands; no other required steps
were skipped. Browser-level render matching is verified on Linux Chromium and Firefox; no separate
macOS run was performed. Dense large graphs use a basic layout, not an interactive graph editor.

Reproduce screenshots with `node packages/playground/test/capture.ts`. Each PNG has the exact
viewport dimensions in its filename group; these are viewport captures, not stitched full-page
screenshots. The page below the phone fold is covered by layout/browser checks.
