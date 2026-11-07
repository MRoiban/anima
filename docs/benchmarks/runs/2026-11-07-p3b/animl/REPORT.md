Format: AniML, authored and checked through the `anima` CLI.

Wall time (first command to done): approximately 10 minutes (first command 2026-11-07 10:16:59 UTC; completed before the 45-minute limit).

Check/validate/build/render runs: 27 (includes sample; excludes help/docs/schema and formatting). Final verification: 10 successful CLI invocations, zero diagnostics, plus independent semantic-tree assertions. Earlier errors: `bad-attribute` ×1, `a11y-role-state` ×2, `misplaced-element` ×6, `data-path` ×2, `unknown-input` ×2, `script-expect` ×1, `script-usage` ×1. Startup/setup: CLI `ERR_MODULE_NOT_FOUND` ×9, loader stack overflow ×1, separate TypeScript availability probe `ERR_MODULE_NOT_FOUND` ×1. Unsupported docs topics `a11y` and `a11y-dom`, and schema topic `node-a11y`: once each. npm also warned about an unapproved esbuild postinstall. Two commit attempts failed because the hook’s npx could not find the locally installed Prettier (enabling npm acquisition did not help). A directory-local npx shim runs that same installed Prettier for the hook. Details: `evidence/diagnostics.json`; final commands: `evidence/runs.json`.

Source size: AniML scene 123 lines, 17,276 characters; exploratory AniML probe 7 lines, 454 characters. Authored generator, verifier and launcher/setup scripts: 278 lines, 14,564 characters. Counts exclude generated `.ani`, downloaded CLI documentation/schema, dependencies and evidence.

Brief items met (1–6), each with how you checked it:

1. **Not met.** All settings, titles and accessible names are data-backed and host-writable; initial values and host writes pass CLI assertions. However, visible labels are precomputed vector paths for the original strings. Renaming titles changes accessible names but hides the original visible labels rather than drawing replacement text. `evidence/host-data.script`, `.stdout` and `.trees.json` explicitly demonstrate this limitation.
2. **Met in CLI semantics.** Named tab list and tabs, selection, pointer selection, Left/Right navigation and panel visibility pass assertions. `evidence/tabs.script`, `.stdout`, `.trees.json` contain before/after trees. Browser/assistive-technology action dispatch was not independently exercised.
3. **Not met strictly.** Slider role, 0–100 bounds, step 5, key increase/decrease, clamping, dynamic phrase “Volume 40 %” and matching fill widths pass assertions in `evidence/slider.*`. The phrase is the accessible **label**, alongside a numeric value; a separate formatted spoken value and exact screen-reader utterance were not established.
4. **Met in CLI semantics.** Switch named Mute, checked state, Space/Enter and pointer toggles, and knob displacement pass assertions in `evidence/switch.*`.
5. **Met in CLI semantics.** Initial mixed, parent checks all, parent clears all, individual child changes and resulting mixed/checked states pass independent tree assertions. Drawn fill/bar states also pass CLI assertions in `evidence/checkboxes.*`.
6. **Met for the implemented interactions.** Saved semantic trees immediately before and after synthetic keyboard actions cover arrow tab switching, slider steps and limits, switch toggles, parent toggles and each child change. These are CLI `--semantics` captures, not pixel inferences. Rendered General, Sound and all-checked frames are supplementary evidence. Exact speech remains unproven as stated in item 3.

Items not met or approximated, and why:

Items 1 and 3 are not met for the reasons above. Visible text uses an original small vector bitmap alphabet because no text-rendering consumer was discoverable through the CLI. Host title renaming is deliberately tested as a failing product capability, not reported as supported text rendering. Verification covers the CLI/core semantic tree and synthetic input, not a browser accessibility tree or actual screen reader.

What was hardest; what the docs or diagnostics got wrong or left out:

The CLI initially could not run in the uninstalled checkout. `setup.sh`, `loader.mjs` and the `anima` launcher keep dependencies and workspace links inside this directory; no outside files were changed. Run `./setup.sh`, then `python3 verify.py` here to reproduce.

`docs --list` omits node accessibility topics; `docs a11y` and `docs a11y-dom` fail. The authoring guide and CLI spec refer to module files that the benchmark forbids reading directly. `schema a11y` advertises only the legacy root roles, while the full JSON schema exposes node tab/slider/checkbox roles and states; its relevant extracted object is saved as `evidence/node-a11y-schema.json`. Node `<a11y>` child syntax, data-bound labels, mixed-state spelling and action behavior required probes. The CLI docs provide semantic snapshots but no discoverable accessibility-action script command, so proof uses keyboard input. No text node or separate slider value-text field was discoverable.

Other corrections: grid is scalar, so rectangular geometry uses `viewBox`; bindings belong at document root; tabs reject checked state with a useful allowed-state hint; `$volume-5` parses as a hyphenated path and emits both `data-path` and `unknown-input` (rewritten as `$volume+-5`); slider ArrowRight had no automatic effect in the CLI probe, so explicit key listeners were added. `expect volumeFill.width` misleadingly fails as an unknown address although snapshots accept AniML property spellings; `expect volumeFill.w` succeeds. The failed probe assertion and every diagnostic count are retained in the diagnostic ledger; final verification is clean.
