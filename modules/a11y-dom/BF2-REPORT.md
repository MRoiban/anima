# BF-2 — downstream keyboard, overlay and sizing fixes

Branch: `t3/fix-accessibility-overlay-input-sizing`; baseline: `efb624bd`.
Downstream inspected only with `git show f1373fd:<path>`; never modified.
No pushes, PRs, measurements-tool changes, budget changes, or P6-owned code edits.

## Findings and changes

| Bug | Reproduction and cause | Fix and regression |
| --- | --- | --- |
| B2 arrows | Confirmed in Chromium/Firefox with three tabs (`test/web/fixtures/bf2-tabs.json`). Input's host capture handler traversed logical focus before the tab-list handler roved again. | `modules/input/web/index.ts` leaves semantic keys to their native controls. `web/index.ts` focuses the chosen tab directly without the redundant sequential traversal. Test asserts one ArrowRight reaches tab1, logical/DOM focus agree, End and wrapping work. |
| B2 trigger Enter | **Not reproduced**: `bf2-buttons.json` works with input loaded and focus absent or present. The frozen kit has no semantic + button; its stepper exposes a slider and pointer listeners. | Retained tests assert exactly one trigger fire per Enter, Space release, and dispatched AT-style click. No speculative activation change. |
| B3 | Confirmed: tabs were divs and lacked native Enter/Space activation. | Tabs now use buttons with role tab in `web/index.ts`. Arrow keys move focus without changing selection; Enter/Space invoke the authored action. `modules/a11y/core/commands.ts` mirrors tab activation in tooling. `spec/conformance/a11y-manual-tabs` supplies independent expected values. `SPEC.md` documents manual activation and the focus-listener recipe for automatic activation. |
| B6 | Confirmed: overlay elements explicitly restored pointer-events:auto over the drawing. The no-input scene blocks legacy hover/press; input capture still routes events, but hit testing reaches the semantic button. | `web/index.ts` uses pointer-events:none on every semantic element. `bf2-pointer.json` proves drawing hit tests, hover/press, input drag, keyboard and directly dispatched AT-style clicks. |
| B7 | Default opacity already hides native range paint here; the reported visible artifact did not reproduce unchanged. Lifting opacity in `bf2-range.json` exposes the native range parts in both engines. | `web/index.ts` removes range appearance and zeroes thumb/track parts with shadow CSS. Default and opacity-lifted screenshots must match, all pixels remain drawing ink, and keyboard adjustment still works. The stylesheet is removed on cleanup. |
| B8 | Confirmed: SVG host fixed both dimensions to 1em, regardless of viewBox. | `packages/web/src/index.ts` defaults to width 1em and viewBox aspect-ratio with automatic height; retains existing SVG viewport/grid mapping. Author dimensions win. Scene tests cover 24×7 document and selected component, explicit width and explicit height. `spec/SPEC.md` and `docs/WEB.md` specify this. |

Existing overlay tests now dispatch semantic clicks directly instead of using
pointer hit testing, consistent with the decided overlay policy. The corpus test
count includes the new conformance scene. `examples/web/index.html` is regenerated.
The canvas renderer keeps its independent host sizing defaults; B8 changes the
default SVG path within the assigned core+web byte allowance.

The platform/core separation and browser input follow
`docs/research/rive-web-runtime.md` §3 and Lessons 5–6. Native buttons supply
Enter/Space activation through the platform. No Rive source, CLI documentation text or .riv files were used.

## Size gates

Official `node tools/size.ts`, gzip level 9, both exits 0:

| Gate | Before | After | Delta |
| --- | ---: | ---: | ---: |
| core + web | 20,622 | 20,635 | +13 |
| largest scene (30) | 52,122 | 52,153 | +31 |
| app-UI scene | 85,154 | 85,244 | +90 |
| runtime sum | 104,285 | 104,366 | +81 |
| authoring add-on | 14,544 | 14,543 | −1 |
| heavy / Rive-class | 109,904 | 109,982 | +78 |

| Owned module | Before | After | Budget |
| --- | ---: | ---: | ---: |
| focus | 3,095 | 3,093 | 3,456 |
| a11y | 2,226 | 2,225 | 2,496 |
| a11y-actions | 1,066 | 1,065 | 1,216 |
| a11y-dom | 1,948 | 1,993 | 2,176 |
| input | 6,444 | 6,467 | 7,104 |

Only a11y-dom, input keyboard routing and core+web runtime sources changed; a11y
also has a tooling-only key translation change. Incremental gzip changes in
unchanged modules arise from their shared base. All six gates and every module
budget pass; B8 is +13 B, below its +40 B allowance. See
`verification/bf2/size-before.txt` and `size-after.txt`.

The initial standalone probe used gzip's default level and was provisional;
it is not the official gate measurement. All thresholds and tools are unchanged.

## Verification

All 8,117 distinct selected non-TODO checks are verified across bounded slices;
40 existing TODOs remain. The 18 new BF-2 browser checks pass (9 per engine),
including pointer hit testing/drag, keyboard and AT-style activation, native range
paint and component sizing. The new headless manual-tabs case passes.

- Chromium changed scope: 6,698 passed, one scaffolder nested-command failure,
  1,418 Firefox cases skipped, 40 TODOs. The scaffolder retry passes 4/4 with
  `VITEST_MAX_WORKERS=2` and unchanged limits. This recovers the one failed check.
- Firefox browser project: 1,415 passed. The three lowercase-named native-paint
  cases are outside the case-sensitive `Firefox` filter; a separate `firefox`
  native-paint run passes 3/3. Together these cover all 1,418 Firefox cases.
- Unique coverage: 6,698 + 1 recovered scaffolder check + 1,415 + 3 = 8,117.
- Full typecheck, final web typecheck, owned ESLint, staged Prettier, module wiring,
  generated web and AniML artifact checks pass. No limits or thresholds changed.

The unfiltered changed run and both engine-filtered processes ended with SIGTERM
(143); its cause is unverified. Chromium emitted complete test totals before the
process ended; Firefox did not. A green monolithic command exit is **not** claimed.
The successful slices above complete the selected coverage. Raw failed/terminated
runs and isolated retries are retained in `verification/bf2/` and `checks.json`.
All Firefox timeouts from the earlier attempts, including component-paint and
nested bundle-order cases, pass in the final browser-only project run.

Initial corpus failures (new-case count and canonical source formatting) were
corrected. An overbroad sizing candidate changed vertical SVG percentages and
caused six real SVG/canvas mapping regressions; it was rejected. The final B8
change only sets the host aspect ratio, preserves viewport mapping and adds 13 B.
The rejected source's measurement and interrupted test log are retained explicitly.
A metadata JSON formatting warning was corrected before staging verification.

Baseline reproduction logs retain assertion failures and setup/test timeouts. The
refined baseline separates pointer/native-range checks from viewport mapping.
A controlled native-range probe removes only the new reset while lifting opacity:
Chromium exposes 6,789 non-drawing pixels, Firefox 15,421; normal opacity and the
active reset both produce zero (`verification/bf2/range-probe.txt`).

Perf and strict oracle measurements remain with the orchestrator; neither was run
here and no performance non-regression claim is made. The canvas renderer retains
its separate host sizing defaults; B8 covers the default SVG host.
