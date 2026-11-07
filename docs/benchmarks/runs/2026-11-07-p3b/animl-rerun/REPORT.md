Format: AniML, authored and checked with `node packages/cli/src/main.ts` (`anima`).

Wall time (first command to done): approximately 6 minutes (2026-11-07 12:03:32 UTC start; finished before the 12:48:32 UTC deadline).

Check/validate/build/render runs: 16 (3 validate, 9 sample, 1 build, 3 render: 5 early invocations and 11 saved harness invocations). Errors seen: missing-file message ×1, exit 2, after my generator failed with Python `KeyError: 'D'` ×1. No coded format diagnostics. Separately, initial help reported missing dependencies ×1; the authorized single `npm ci` resolved that. Final verification: all 11 harness CLI commands exited 0, validation returned `diagnostics: []`, and all independent semantic/data/geometry assertions passed. See `evidence/early-runs.md` and `evidence/runs.json`.

Source size: 507 lines, 55,738 characters total for sources written: `settings.animl` (129 lines, 29,915 characters), `make_scene.py`, `verify.py`, and six synthetic-input `.txt` scripts. Excludes compiled `.ani`, captures, renders, logs and report.

Brief items met (1–6), each with how you checked it:

1. **Not met.** Named settings, defaults, ranges, mutable tab-title strings and data-bound accessible names work. `host.txt` / `evidence/host.json` prove host writes, numeric clamping, panel changes and accessible-title changes to Basics/Audio. Visible labels are static vector paths, so changing title data does not redraw those labels. This violates the data-backed visible-label requirement.
2. **Met.** `tabs.txt` / `evidence/tabs.json` capture the tab list and selected states before and after Right/Left arrow selection and accessibility taps. Assertions verify selected-tab data, panel visibility and exclusion of hidden controls from the semantic tree. Explicit focus listeners implement automatic selection on arrow focus movement. `pointer.txt` / `evidence/pointer.json` additionally verify pointer selection in both directions.
3. **Met.** `slider.txt` / `evidence/slider.json` verify role, limits 0–100, step 5, numeric value and spoken `Volume N %` before and after keyboard and accessibility increase/decrease actions. Values 40→45→50→45→40, End→100, increase at 100, Home→0 and decrease at 0 are checked, along with fill width `volume * 0.3`.
4. **Met.** `switch.txt` / `evidence/switch.json` verify switch role, Mute name, checked state and knob translation before and after Enter, accessibility tap and Space. `pointer.txt` also verifies pointer toggling. The 6×3 rounded track and 2.4-unit knob are authored in AniML.
5. **Met.** `checkboxes.txt` / `evidence/checkboxes.json` verify parent mixed/checked/unchecked states, all three child values and drawn fill/bar visibility around every parent/child action. Parent Space checks all from mixed; parent tap clears all from checked; individual child taps exercise all aggregate states; parent taps from mixed and unchecked check all. Pointer parent/child changes are also checked.
6. **Met.** The six `.txt` scripts record synthetic input. Corresponding `evidence/*.json` captures contain full CLI accessibility trees before and after each tested action, plus named data and resolved drawing properties. Raw `.stdout` and `.stderr` preserve the tool output. `verify.py` independently asserts trees and geometry; `evidence/assertions.txt` records success. These are headless CLI semantic trees, not browser/OS accessibility captures. Rendered frames are supplemental only.

Items not met or approximated, and why:

- Item 1 is not met: no documented text-rendering node or per-character string consumer was discoverable through CLI docs/schema. I used handwritten vector bitmap labels instead. They appear in uppercase, are fixed at authoring time and do not follow runtime string changes. Accessible names do follow the strings.
- The drawing uses a 40×30 viewBox with grid 40 because the schema exposes grid as one number. The 480px square PNG contains a centered 480×360 panel with transparent top/bottom margins. Geometry within the panel uses the requested coordinates and colors; SVG captures preserve the 40×30 viewBox.
- No claim of native browser/screen-reader behavior is made; the required proof uses the CLI's documented semantic-tree and synthetic-input route.

What was hardest; what the docs or diagnostics got wrong or left out:

- Drawing mutable visible text was the largest format gap. Schema searches for text returned semantic roles/value-text/converters/cursors but no drawing primitive. Data docs explicitly describe text consumers as remaining work; derive documents no per-character converter. This prevents full completion of item 1 through the documented format.
- Tab-list arrows rove focus; they did not select my trigger-activated tabs automatically. The docs describe roving but do not give a complete automatic-selection tab recipe. Explicit `focus` listeners setting the selected-tab data solved it.
- Acting on the hidden slider/switch during the first sample produced no effect and no diagnostic while sample exited 0. I had to inspect the captured state to notice the failed interaction; later independent assertions prevent that false success.
- `sample --all` includes large path strings, making vector-label snapshots unwieldy. Selected addresses plus full semantic trees were much clearer.
- `docs authoring` was too long for the terminal output budget and truncated. Narrow topics (`a11y`, `agent-tools`, `derive`, `host`, `convert`, `markup`) and schema queries supplied the needed contracts. `docs spec --list` returned the same overall topic list rather than spec sections.
- Documentation is internally inconsistent about completion: convert's trailing text says data-backed keyframes remain pending, whereas the data authoring topic says they are implemented. The a11y page mixes partial/draft status, historical wave notes and current headless key behavior. Neither affected the checks claimed here, but both make capability discovery harder.
- Initial CLI help correctly identified missing dependencies. The first missing-file diagnostic correctly reflected my failed generator; the missing D was my own error. No format validation diagnostic needed correcting after source generation succeeded.
