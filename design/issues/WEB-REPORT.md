# WEB report

- Status: complete on `issue-web`.
- Issues covered: #23, #24, #25, #27.
- Verify: final scoped run **89 files / 7,231 tests passed** in Chromium and Firefox, with oracle; size exit 0, type checks, lint, format and generated artifacts pass.
- Sizes before → after: core+web **22,564 → 22,770 B** min+gzip (+206 B; ceiling 24,576). Canvas **5,827 → 5,865 B** incremental (+38 B; budget 5,888).
- Deviations: generated standalone demo rebuilt for verification but omitted from commits because it is outside WEB ownership. No core stepping changes, threshold/budget increases, or PR.
- Open problems: none. Integration needs the generated demo rebuild noted under Requests.

## #23 — uniform non-square mapping

Repro: a filled clickable rectangle using Golem's switch dimensions/grid, wide
120×28/grid 120 and tall 120×180/grid 180 roots, nonzero origins and square bleed.
Both renderers also test wide/tall sources inside an explicitly square host.

Cause: each viewport axis was divided by grid separately despite the host already
having the viewBox aspect. Fix: non-square SVG viewports size their long axis from
the host/grid and keep their intrinsic aspect on the other axis. Percentage
translation places the origin at the same uniform scale. Explicit fit placement
disables that default translation. Square viewBoxes retain their original path.
Canvas uses the same uniform placement. Existing inverse CTM pointer mapping and
forward CTM accessibility mapping consume the corrected transform directly.

Measured SVG `getBoundingClientRect()` sizes in CSS pixels; all three zero-origin
scenes start at page `(16,16)` before and after:

| Engine | Scene | Before w×h | After w×h |
| --- | --- | --- | --- |
| Chromium | Golem switch sizing | 31×9.5625 | 31×17.21875 |
| Firefox | Golem switch sizing | 31×9.56667 | 31×17.21666 |
| Chromium | Wide | 120×6.53125 | 120×28 |
| Firefox | Wide | 120×6.53334 | 120×28 |
| Chromium | Tall | 79.984375×180 | 120×180 |
| Firefox | Tall | 80×180 | 120×180 |

Golem's viewport remains slightly smaller than its 31.5×17.5 host because grid 32
preserves the requested scale. A real mouse click at page `(134,30)`, 2 px inside
the wide host's far edge, now lands on the control in both engines and renderers;
it missed before. Tests also compare the semantic button's bounding box.

The broad run exposed a first-fix regression with an explicit square CSS host;
components failed again in isolation. Intrinsic SVG sizing and matching canvas
placement fixed it. Tests cover both orientations and nonzero origins at 10×
scale; both existing component tests passed in isolation afterwards.

Proof: `proof/23-{before,after}.txt`, `proof/23-{before,after}.png` and corresponding
`-firefox.png` crops (all under 50 KB). Text records drawing/semantic boxes and hits.
Decision: use the owner's long-axis/grid rule while retaining Glyphy grid/bleed
semantics (`docs/research/glyphy-compat.md` §1) and browser CTM inversion
(`docs/research/rive-web-runtime.md`, “Lessons” 5).

## #24 — pre-player input calls

Repro: pre-load and deferred `set/fire/set` calls, superseded asset-load completions,
a subsequent fresh player and an unknown name. Before: every call was lost.
Fix: one FIFO, drained once by the current load completion before stepping. Tests
observe exact invocation order, committed values and state. Unknown names use the
player's normal error path. Detached fixture documents avoid mutating the compile
cache's source. Proof: `proof/24-{before,after}.txt`.

Decision: use one host queue, matching the lazy-call recommendation in
`rive-web-runtime.md`, “Lessons” 13. `splice(0)` detaches the batch before applying it.

## #25 — settle

Repro: mount off, set on, resolve a once timeline and two blends before first paint.
Before: no API; the initial drawing remained off and later animated in.
Fix: step at dt=0 then 0.25 s until rest or 60 simulated seconds, discard events,
update the state notification baseline, draw and update ARIA. Preserve pause/speed/
reduced-motion settings and re-arm normal playback if still busy. Pre-player calls
queue once and resolve before drawing. The return is false when deferred or capped.

Tests cover paused/playing calls, first-paint silence, no delayed state event,
loop capping, deferred asset creation and normal playback after the cap.
Proof: `proof/25-{before,after}.txt`. Decision: use the player's rest signal
(`rive-web-runtime.md`, “Lessons” 3); timelines longer than 60 s may return false,
as documented. Core step semantics remain unchanged.

## #27 — renderer parts

Repro: page `::part(svg)`/`::part(canvas)` backgrounds matched nothing.
Fix: set `part` at renderer construction. Tests compare actual computed page styles
before/after `textRun()`, reload, a canvas switch and switch back. The existing
retained-SVG attribute cross-check now expects `part="svg"`.
Proof: `proof/27-{before,after}.txt`, PNGs and Firefox PNGs.

## Sizes

Per-issue incremental additions with the production esbuild/terser/gzip pipeline:

| Issue | Core+web Δ B | Canvas entry Δ B |
| --- | ---: | ---: |
| #23 (including explicit-host correction) | +68 | +29 |
| #24 (including FIFO cleanup) | +40 | +3 |
| #25 | +88 | +2 |
| #27 | +10 | +4 |
| Total | **+206** | **+38** |

The initial implementation measured 22,719 B core+web but overflowed
markup-libraries' incremental budget by 7 B. The explicit-host correction and
smaller FIFO drain restore it to **2,175/2,176 B**, without changing that entry.
Components is **3,454/3,456 B**; canvas is **5,865/5,888 B**. No budget was raised.
Final `node tools/size.ts` exits **0**, with every entry and top-level gate passing:

| Gate (min+gzip B) | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| Core+web | 22,564 | 22,770 | 24,576 |
| Largest scene | 57,505 | 57,739 | 65,536 |
| App-UI | 107,630 | 107,877 | 131,072 |
| Runtime sum | 133,491 | 133,760 | 163,840 |
| Authoring add-on | 15,006 | 15,017 | 16,384 |
| Rive-class | 152,563 | 152,874 | 256,000 |

Top-level before values except core+web come from `WORKLOG.md`; core+web, canvas
and markup-libraries were measured against the initial source. Per-issue values
were measured at implementation steps (historical canvas intermediates replayed
in memory from their commits). Shared-bundle compression affects entry deltas.
No per-frame code was added; shared-load timings are not ≤3% performance evidence.

## Verification

- Initial regressions: 8 expected failures across Chromium and Firefox on the unmodified runtime; saved before proof.
- Targeted run after explicit-host correction: **14 passed** (12 WEB regressions plus 2 existing component tests).
- Required `VITEST_MAX_WORKERS=2 npm run test:scope -- changed`: **385 files passed, 5 failed, 12 skipped; 7,614 tests passed, 17 failed, 2,582 skipped, 34 todo** under heavy shared load. Canvas setup and old host/overlay/asset tests hit timeouts. The component assertions were real and reproduced in isolation, then were fixed as described above.
- Final `VITEST_MAX_WORKERS=2 npm run test:scope -- web canvas components oracle`: **89 files passed; 7,231 tests passed, 599 skipped, 18 todo**, exit 0. This reruns every formerly failing browser file on the corrected frozen source, including the full canvas corpus. Oracle and square-viewBox checks pass with unchanged thresholds.
- `npm run lint`, `npm run format:check`, web/source and web/test TypeScript checks, `npm run gen`, `node tools/build-animl.ts --check` (674 scenes), `node tools/parity.ts --check`, browser build and full size check pass on the final source.
- Existing suite deadlines and pixel/oracle thresholds are unchanged. New tests have explicit 30 s limits; new setup uses 30 s and page operations 15 s. Early repro attempts also hit setup timeouts; isolated runs reached the expected failures and later passed.

## Requests

Integration should run `node tools/build-web.ts` to regenerate the standalone
`examples/web/index.html` demo. Local browser verification uses this generated demo;
it is outside WEB's owned files and is omitted from ticket commits.
