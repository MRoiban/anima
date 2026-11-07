Format: AniML, authored and checked with the anima CLI.

Wall time (first command to done): approximately 6 minutes, within the 45-minute limit (started 2026-11-07 14:54:45 UTC).

Check/validate/build/render runs: 17 (4 validate, 1 build, 6 sample, 6 render), plus 1 successful fmt. One validation error: `bad-attribute` at `/grid`, "expected a finite JSON number" (1); fixed `grid="40 30"` to `grid="40"`, with `viewBox="0 0 40 30"`. All subsequent scene checks passed. One additional attempted validation never reached the CLI: the verification script initially calculated the repository root incorrectly, causing `MODULE_NOT_FOUND` (1); fixed. Setup: missing-dependencies message (1), resolved by the authorized `npm ci` once. Discovery: `no schema topic "text"` (1). No sample assertion failures, build errors or render errors.

Source size: 129 lines, 9,913 characters of AniML (`settings.animl`; generated `.ani` excluded). Auxiliary authoring/verification Python and synthetic-input scripts: 233 lines, 22,751 characters. Evidence and report excluded.

Brief items met (1–6), each with how you checked it:

- 1: **Not met.** All required settings and titles are readable/writable named data, with the specified defaults. `selectedTab` uses 0 for General and 1 for Sound. Accessible names bind to string data. `host-data.txt` and its tree captures verify host writes, changed tab names, volume geometry and mute geometry. However, the visible lettering is fixed vector paths and does not follow string edits.
- 2: **Met.** `tabs.txt` proves a named tab list, initial selection, Right/Left arrow selection, semantic tap selection and pointer selection. Before/after trees show selected states and the disappearance/appearance of each panel's controls. CLI assertions check selection and visibility. Draw bindings select the accent tab.
- 3: **Met.** `slider.txt` proves slider role, numeric range 0–100, step 5 and spoken text `Volume 40 %`, then `Volume 45 %`. Keyboard and semantic increase/decrease actions update the number and fill width. Home/End and further semantic actions prove both clamps. Independent tree assertions check every recorded value, spoken text and range field.
- 4: **Met.** `switch.txt` proves switch role and name, keyboard Enter activation, semantic tap and pointer activation. Captures show checked state before/after; CLI assertions verify `muted` and knob translation 0/3, placing the 2.4-unit knob on either side of the 6 × 3 rounded track.
- 5: **Met.** `checkbox.txt` proves initial mixed state, mixed-to-all, checked-to-none, none-to-all, child changes producing mixed, and clearing the last checked child producing unchecked. Parent and child actions use semantic taps, keyboard Space and pointer input. Trees and independent assertions verify the aggregate checked state; CLI snapshots record ink-fill and mixed-bar visibility.
- 6: **Met.** The CLI's accessibility-tree captures are saved separately as `evidence/tabs-*-tree.json`, `slider-*-tree.json`, `switch-*-tree.json` and `checkbox-*-tree.json`. Their matching `.stdout` files contain combined semantic/geometry snapshots; the named `.txt` files record the synthetic actions in order. `verify.py` checks the CLI assertions and independently checks the captured trees. `evidence/assertions.json` records success. These are headless semantic trees, not browser platform accessibility captures. Rendered SVG/PNG frames are supplementary only.

Items not met or approximated, and why:

- Item 1 is not met: visible labels are original monoline path lettering, fixed in uppercase. No documented painted text node or live string-to-path consumer was found. Accessible labels do follow data, demonstrated by renaming General/Sound to Overview/Audio; painted titles retain their initial lettering.
- The scene uses a scalar grid of 40 and a 40 × 30 viewBox; all requested geometry is in those grid units. The Sound PNG is 480 × 360. The supplementary General PNG uses the CLI's default square output with letterboxing.

What was hardest; what the docs or diagnostics got wrong or left out:

- Discovering whether mutable visible text was possible: `schema text` gives a generic unknown-topic usage response, and `schema --search text` finds semantic text and converter text but no painted text node. The data authoring guide eventually explicitly states that text consumers remain unfinished. This prevents strict completion of item 1.
- The root grid field is scalar; the invalid two-number value produced a precise pointer/message but no hint about using viewBox for a rectangular scene.
- Full `docs authoring` and `docs markup` outputs are large enough to truncate in the tool response; focused topic queries were needed.
- The a11y documentation mixes an introductory "row remains planned" statement for bounds with later implemented bounds/action descriptions, making completion status unclear. Explicit bounds and the documented tab focus listeners worked in this scene.
- The action/derive scheduling rules were useful: parent activation reads the three writable children in one snapshot rather than relying on a potentially previous-step computed value. Tab focus listeners explicitly synchronize selection, as documented.
- Setup also reported 10 moderate npm audit vulnerabilities and an esbuild postinstall allowScripts warning; no dependency changes were made beyond the requested setup installation.
- Learning stayed within CLI help/docs/schema. No repository source, tests, examples, specs, module directories or other benchmark runs were inspected; only the supplied brief and this directory's files were read. No browser page, runtime imports, push or PR was used.
