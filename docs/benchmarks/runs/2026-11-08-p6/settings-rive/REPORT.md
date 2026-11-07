Format: Rive markup (RML), with a local Luau Layout script for derived settings and knob animation.

Wall time (first command to done): About 7 minutes; first command 2026-11-07 22:39:17 UTC, final checks/report 22:46 UTC, followed by the local commit. Within 45 minutes.

Check/validate/build/render runs: 18 Rive runs: 5 verify, 4 inspect, 9 headless command captures. Errors seen: 66 nullable-property `[type]` errors in verify-01; 10 `err semantic-action: the scene refused it` responses across capture-05 and capture-07; one Python evidence-check `AssertionError`. Also one `states-overlap` inspection warning. All corrected. Final verify-05: 0 errors, 0 warnings; inspect-04: no problems; capture-09 and capture-08: no command errors; 77 evidence assertions pass. Each capture invocation counts once, including its build and all streamed tree/data/frame commands. Earlier capture-04 also exposed incorrect pointer/keyboard focus behavior without emitting a diagnostic; see evidence/run-accounting.json.

Source size: 1,024 lines, 52,272 characters across scene.rml, settings.luau, generate.py, check-evidence.py, commands.txt and commands-extra.txt. Includes the generated RML and its authoring helper; excludes scaffold configuration, copied test font, report and generated evidence.

Brief items met (1–6), each with how you checked it:

1. Met. Named settings have the specified defaults; all eight visible labels bind strings from the view model, and each control's accessible name binds the corresponding string. Captures 01, 12, 25 and 26 demonstrate defaults, renamed tab titles and host-written settings. Frames 01, 12 and 25 show bound label glyphs using the required geometric test font. check-evidence.py checks every text run's binding, the defaults and captured names/data.
2. Met. Trees 01→02 and 05b→06 show Right/Left changing the selected tab and exposed panel. The tree contains a tabList with two named tabs and selected-state flags. Capture 13 proves pointer selection; 22 proves accessibility activation. Solo removes the inactive panel from rendering and hit testing as well as semantics.
3. Partially met; see limitation below. Trees/data 02→03→04 prove semantic increase/decrease, spoken values “Volume 40 %”→“Volume 45 %”→“Volume 40 %”, and proportional fill widths. Captures 14→15 and 16→17 prove endpoint clamping; 18→19 prove keyboard stepping. Frame 03 supplements the tree/data evidence.
4. Met. Trees/data 02→05 show a switch named Mute becoming toggled and muted=true, with knobX moving from 3.6 to approximately 39.6 pixels relative to its track. Captures 19→20→21 prove pointer toggle and keyboard reversal. Knob movement eases over successive frames.
5. Met. Trees/data 01, 07–11 and 26–30 prove mixed, checked and unchecked parent states; parent activation from mixed and unchecked checks every child, while activation from checked clears them. Child actions update the aggregate. Assertions check semantic state flags, stored booleans, solid-fill opacity and mixed-bar opacity. Captures 22→23→24 also prove pointer/keyboard child toggling.
6. Met for the implemented behaviors. commands.txt and commands-extra.txt replay synthetic keys, pointer and accessibility actions, with before/after accessibility trees and data dumps. Final transcripts are capture-09 and capture-08; 77 independent assertions check their saved results. Frames are supplementary. The missing slider range metadata remains unproven.

Items not met or approximated, and why:

- Item 3 is partial: SemanticData exposes a slider role, spoken value and increase/decrease actions, but its available schema has no numeric accessibility minimum, maximum or step fields. The 0–100 range and step 5 are enforced and tested in behavior; machine-readable range/step metadata is absent.
- Labels use the stipulated anima-test.ttf geometric glyphs, so they are visible and data-bound but do not resemble ordinary letters.
- Evidence uses the CLI's runtime accessibility tree, not a platform screen-reader session.

What was hardest; what the docs or diagnostics got wrong or left out:

- First-declared drawable siblings paint on top. My initial layering hid the accent fills, unchecked interiors and tab labels; verify accepted it. Reversing the drawable order fixed the frames. The transforms docs explain this correctly.
- Pointer activation did not give these controls keyboard focus automatically. Explicit FocusActionTarget actions fixed subsequent keyboard input. After that correction, activating Mute correctly moved focus away from the Sound tab; the replay had to refocus Sound before testing Left. The failed command transcripts and one failed helper assertion are retained/accounted for.
- View-model getters return optional properties. The first script produced 66 type errors; asserting declared fields after guarding the absent initial view model resolved them. Diagnostics were accurate.
- Opacity alone does not remove controls from interaction; Solo provides the actual panel switch. Documentation correctly warns about accessibility visibility.
- No numeric slider range/step metadata was available in the inspected semantic schema. A clean build cannot establish that requirement.

Only local permitted Rive commands were used. No account operations, publishing, browser preview, or .riv reading/conversion occurred. Generated build directories, .riv files and scaffold documentation were removed before committing. No push or PR was requested or performed.
