# TEXT report

- Status: implementation complete; broad verification has out-of-ticket failures.
- Issues covered: #31, #35.
- Verify: final owned text/text-input scope passes 3,521 tests across 31 files (573 out-of-scope conformance cases skipped); #31 and #35 browser repros plus 12 rerun text browser cases pass; size exits 0; schema/AniML/parity, typechecks, lint and formatting pass. Broad changed runs found unrelated host/overlay failures and a JPEG pipeline timeout (see verification below).
- Sizes before → after (min+gzip): core+web 22,564 → 22,564; text 5,790 → 5,790; text-input 4,109 → 4,375 (ceiling 4,544); optional text-input-extra 0 → 881 (ceiling 2,048).
- Deviations: blink and scrolling use the optional heavy `text-input-extra` browser entry, as permitted by the ticket; CLI/tooling include its pure scrolling projection automatically. No separate registry feature is needed. The deterministic binding conformance case lives in the owned module test, rather than adding files outside this ticket's ownership under `spec/conformance/`.
- Open problems: broad changed verification is not green; failures outside ticket ownership are listed below. No performance timing claim under shared machine load.

## #31 — retained text paint

Repro: `modules/text/test/web/paint-repaint.test.ts` compiles a local-style text node and the exact `<bind target="lbl.fill.color" value="$m:fg"/>` expression. It changes `fg` from `#cecdc3` to `#ff0000` without touching the run, then changes every model colour, including stroke. SVG asserts the tspan's computed fill/stroke; canvas polls solid ink pixels after the repaint, with the declared fixture font loaded.

Cause/fix: already fixed by **bb989f1e**, confirmed with `git log -S 'const paints = new WeakMap'`. That commit compares resolved paints as well as layout. No text runtime code was changed or grown for this ticket.

Proof: `proof/31-before.txt`, `31-before.png`, `31-before-measurements.json` were captured at **bb989f1e^ (1acdaf07)** in `/tmp/anima-31-text-before` after an independent `npm ci`. The test failed with the exact reported computed fill, `rgb(206, 205, 195)`, instead of red. The temporary worktree was removed. `31-after.txt`, `31-after.png`, `31-after-measurements.json` record the current passing regression, including the updated red fill. PNGs are below 50 KB.

## #35 — native text fields

Repro: `modules/text-input/test/core/issue35.test.ts` originally failed on the unknown obscured binding address, absent option spellings and missing viewport clipping. The browser regression is `modules/text-input/test/web/issue35.test.ts`.

Fix:

- `textInput.obscured` is a bool address with the authored rest value. Masking and semantic redaction follow its resolved value. Native input type changes preserve offsets, selection direction and focus. Copy/cut follows the live value, including the existing clipboard host helper. Static multiline+obscured validation remains. Bound obscuring of a multiline field is ineffective, preventing a password textarea from leaking its value.
- `caretBlink` / `caret-blink` defaults on with the extra entry: 530 ms visible / 530 ms hidden; edits and caret moves restart visible. A focus-scoped timer repaints without changing `Player.step`, busy state or player time. Reduced motion, paused/static hosts and CLI/headless draws keep a steady caret. Blur/pause/reload/destroy stop timers.
- `selectionTextColor` / `selection-text-color` is a compatible preferred spelling of existing `selectedTextColor`. It takes precedence when both are present; omission retains foreground. Highlight and selected glyph paint stay independent.
- The optional extra entry projects a copy of the measured layout into the fixed field viewport: horizontal scrolling for unwrapped single-line fields and vertical scrolling for multiline fields. Glyphs and field boxes clip to the box. Scrolling neither changes measurement nor reflows siblings.

Spec: the text-input section of `spec/SPEC.md`, plus the linked normative `modules/text-input/SPEC.md`; generated JSON Schema includes the two new option spellings. Registry descriptors provide AniML and CLI schema support. New invalid option tests assert diagnostic code, exact pointer and message. Existing static multiline password diagnostics retain their hint tests.

Tests/proof: `proof/35-before.txt` records six missing-capability failures plus the pre-fix browser clipping failure. `35-before.png` and measurements show the same viewport without the extra projection; this comparable capture uses the base entry with new options/binding omitted. The earlier historical run at `1acdaf07` showed the same missing clip. `35-after.txt`, `35-after.png` and measurements cover the fix. Browser proof loads `fixtures/fonts/anima-test.ttf`, polls glyph pixels, and exercises SVG/canvas reveal, backward selection, copy suppression, selected glyph colour, both scroll axes, blink, restart, reduced motion, authored blink-off, pause and settled blur. Core tests include literal deterministic binding snapshot expectations and static steady-caret/idle settling assertions.

Validation note: the unrestricted broad scope was stopped after simultaneous browser timeouts under shared load. Its failures are retained in the verification notes; isolated geometry runs identified and fixed rounding/fit issues, while outdated negative-tracking/opacity assertions were updated for clipping. Subsequent verification uses `VITEST_MAX_WORKERS=1`; the broad browser run was stopped after unrelated host and overlay failures, followed by `changed --no-browser` and focused browser reruns. No test deadline or budget was raised.

Decided, owner may revisit: preserve `selectedTextColor` as an alias instead of removing the P7 spelling; ignore a bound obscured=true on multiline fields while continuing to reject that static combination; expose the two heavier behaviors through an optional entry rather than exceeding the base budget. These choices retain the native proxy and sleeping scheduler design described in `docs/research/rive-web-runtime.md` §3 and its lessons for Anima.

## Requests

The orchestrator should reconcile the broad changed failures: `packages/web/test/browser.test.ts` initially had five Chromium failures, and its isolated matching-case rerun passed 9/10 but failed Firefox off-screen rAF accounting (8 callbacks vs 7). No text-input entry is loaded by that test. The broad run also reported four overlay failures in `modules/a11y-dom/test/web/overlay.test.ts`; this file is outside ticket ownership. The changed unit scope hit a 5 s JPEG pipeline timeout and a CLI bell-build timeout. The isolated asset pipeline rerun also timed out for JPEG and WebP (17/19 passed); these are recorded as timeouts, not diagnosed as source regressions. Both broad changed runs were stopped after their unrelated failures.

The orchestrator may move the module-local deterministic binding conformance case into `spec/conformance/` if a central fixture is preferred; the existing central conformance corpus remains unchanged.

## Size verification

`node tools/size.ts` completed with **exit code 0**. Entries: text 5,790/6,144 B (unchanged); text-input 4,109 → 4,375/4,544 B; text-input-extra 881/2,048 B. Baselines were independently rebuilt from the starting HEAD source with the shipped esbuild/terser settings. Aggregate gates: core+web 22,564/24,576; largest scene 57,505/65,536; app-UI 107,630/131,072; runtime sum 133,491/163,840; authoring 15,006/16,384; heavy 153,691/256,000 B. Only the heavy set grows (previously 152,563 B). The two earlier size attempts were terminated before completion to fix findings; neither was treated as a passing gate.

## Verification details

- `npm run gen`, `node tools/build-animl.ts --check` (674 AniML files), `node tools/parity.ts --check` (1,238 capabilities), generated wiring, and rebuilt browser cache passed.
- Core and web production typechecks passed; web test typecheck passed after tightening the compiled repro's non-null document type. `npm run lint` and `npm run format:check` exited 0.
- Initial scoped geometry run failed 5 tests; the isolated run reproduced all 5. Fixes preserve exact caret width, avoid unnecessary scroll padding for noncollapsed fitted selection, clamp boundary carets, and adjust negative-advance/opacity assertions for clipping. The subsequent text-input core run passed 62/62. A literal binding snapshot conformance test was then added; its first run exposed a missing initial `advance 0` in the test script, corrected before the final owned scope.
- The final combined repro run passed #31 but timed out #35 at 30 s under shared load. Twelve previously timed-out Chromium/Firefox text browser cases subsequently passed across five files (159.89 s including imports). The isolated #35 rerun passed in 14 s of test execution (22.67 s including imports). Both runs are reported; no deadline was raised.
- The first unbounded scope and later broad browser changed scope were stopped after failures; they are not reported as passing. The complete size run is valid and finished from frozen runtime sources.

Final owned verification: `VITEST_MAX_WORKERS=1 npm run test:scope -- text text-input --no-browser` exited **0**: 31 files passed, 3,521 tests passed, 573 skipped. This includes shared markup integration, CLI text tests, text-input core tests and the selected central conformance cases, plus the module-local binding golden case. The two issue browser repros and the 12 earlier text browser failures passed in the separate recorded runs. Broad changed browser and unit scopes remain qualified as described above; they were not claimed green.
