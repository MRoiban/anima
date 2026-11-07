Format: Rive RML with two Luau logic scripts, authored using the local Rive CLI.

Wall time (first command to done): approximately 10½ minutes (2026-11-07 10:17–10:27:30 UTC, including cleanup and commit).

Check/validate/build/render runs: 15 (4 verify, 3 inspect, 8 headless command sessions). Errors seen: missing font file, 1 occurrence ([rml]); incompatible-bind-types, 5 occurrences in one inspect (boolean sources driving numeric opacity). All corrected. A schema lookup also returned unknown type "DataConverterBooleanToNumber", once; no such built-in converter exists. Final verify: 0 errors, 0 warnings; final inspect: problems []. Capture commands reported no errors. The renderer reported a depth/stencil MSAA fallback in 5 sessions; frames still rendered. The evidence assertion script initially failed once by mistaking the help text's description of an error response for an actual error; corrected to inspect response lines. Final result: 130 assertions passed.

Source size: 924 lines, 46683 characters (scene.rml, derived.luau, action.luau, rive.yaml, three interaction command scripts, commands-help.txt, verify-evidence.py). Excludes report, captured evidence, downloaded Roboto font and its license.

Brief items met (1–6), each with how you checked it:

1. Met. Initial data dump verifies all defaults. Host writes select panels, toggle mute, change each notification boolean, and clamp volume. Captures 30–32 verify both tab titles can change through data, update their semantic names, and remain actionable under their new names. Every visible label and semantic name is bound to string data. RML binds the corresponding text runs; rendered frames confirm labels.
2. Met. Captures 00–01 and 05–06 show the tab list, tab roles, selected flags and exclusion of inactive panel controls before and after Right/Left keys. Captures 20–23 additionally prove pointer and semantic tab selection. Assertions inspect tree roles, selection and panel presence, plus selectedTab data.
3. Not met in full. Captures 01–03 show slider role, changing spoken values "Volume 40 %" → "Volume 45 %" → "Volume 40 %", and corresponding data. Captures 24–27 verify semantic actions clamp at 0 and 100; 42–44 verify keyboard steps. Frames show the accent width following volume. Range and step are enforced in logic and stated in the semantic hint, but the tree has no structured numeric minimum, maximum or step metadata.
4. Met. Captures 03–05 show switchControl role and toggled semantic state following muted, with knob source positions 18 → 54 → 18. Frames show knob movement. Captures 45–46 additionally prove Space activation after pointer focus.
5. Met. Captures 00 and 07–12 show mixed, checked and unchecked parent semantics and all child states after semantic activations. Captures 33–35 prove parent activation from both mixed and unchecked states checks all children, and activation from checked clears them. Captures 51–54 prove parent/child Space activation. Frames show the mixed bar, solid checked boxes and empty unchecked boxes.
6. Met for the requested interaction evidence. proof.commands, extra.commands and keyboard.commands capture before/after accessibility trees and data around the tab arrow, slider increase/decrease, switch toggle, parent activation and child changes. All are stored in evidence/. verify-evidence.py checks the captured JSON independently of pixels; evidence/assertions.txt records 130 passing assertions. This does not establish the structured slider range metadata absent from item 3.

Items not met or approximated, and why:

- Item 3 is not met in full: SemanticData's documented schema has role, textual value and hint, but no numeric minimum/maximum/step properties. The hint says range 0–100 and step 5; this approximates a native range declaration. Interaction behavior and spoken value are verified.
- Numeric volume host writes are clamped on the next advance. The format's numeric data property itself does not declare a restricted range.

What was hardest; what the docs or diagnostics got wrong or left out:

- The difficult part was coordinating data, semantic states, focus and RML drawing order. A parent shape painted over its nested fill/knob despite successful checking; rendered captures revealed this. Moving those graphics to preceding siblings fixed it. The docs do describe this ordering, so this was an implementation mistake.
- verify initially accepted five boolean-to-opacity binds that inspect rejected. Both tools were needed, as the CLI docs advise. I changed those binds to numeric derived data.
- The text docs say a missing font file can pass silently, but this CLI emitted a precise missing-file error. Downloading the openly licensed Roboto font and including its license resolved it. An initial Python download stalled; curl succeeded.
- The schema exposes tri-state checks directly, but exposes slider ranges only through free text. No dedicated accessible numeric range declaration was found.
- FocusData's canTouch flag alone did not move keyboard focus when clicking these shapes in headless capture. Explicit click listeners with FocusActionTarget fixed this; before/after data then confirmed the keyboard controls. The docs did not make that extra wiring apparent for this setup.
- A guessed BooleanToNumber converter name was rejected by schema lookup; numeric derived properties avoided that conversion. No CLI update was required.
- The commit hook failed three times because its no-install npx invocation could not resolve Prettier locally. Standalone formatting passed. npm confirmation and a binary PATH entry did not fix package resolution. A temporary npx launcher selected the already cached Prettier 3.9.10 package, preserving the hook and its formatting checks; the launcher was removed afterward.
- No repository source, specs, examples or other runs were read. No .riv files were read or converted. Generated documentation scaffolds, .riv files and capture build folders were removed before committing. No publishing, remote Rive actions, push or PR creation was used.
