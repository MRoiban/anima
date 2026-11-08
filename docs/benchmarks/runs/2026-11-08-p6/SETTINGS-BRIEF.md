# Settings card rerun (P6)

Unchanged brief from `../2026-11-07-p3b/BRIEF.md`, rerun after P6 (text) per the owner's P6 exit criterion: item 1 (visible labels from data) must now be met.

Fonts: no third-party font files may be added to the repository. Use the generated test font `fixtures/fonts/anima-test.ttf` (simple geometric glyphs, original to this project) wherever a font file is needed; browser rendering may use CSS family names.

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The scene

A 40 × 30 grid (Rive: a 480 × 360 artboard, 12 px per grid unit). Ink `#141413`, accent `#d97757`,
panel `#f0eee6`. A panel rectangle fills the grid.

- **Tabs**: two tab shapes at the top, "General" at (2, 2) and "Sound" at (14, 2), each 10 × 3 units;
  the selected tab is accent, the other ink outline.
- **General panel** (shown when General is selected): the **Notifications** group — a parent
  checkbox at (2, 8) and three child checkboxes ("Email", "Push", "SMS") at (4, 12), (4, 16),
  (4, 20); each box 2 × 2 units, filled ink when checked, a horizontal bar when mixed.
- **Sound panel** (shown when Sound is selected): a **volume** track from (2, 10) to (32, 10),
  height 1, with an accent fill of width `volume ÷ 100 × 30`; a **mute** switch at (2, 16), a 6 × 3
  rounded track with a 2.4-unit knob on the left when off and on the right when on.

## Behaviour

All values below live in data the host page (or a test script) can read and write by name.

1. **Settings as data.** `volume` (number 0–100, starts 40), `muted` (bool, false), the selected tab
   (General to start), three notification bools (Email true, Push false, SMS false), and the two tab
   titles as strings. Visible labels and accessible names come from this data, not from fixed text.
2. **Accessible tabs.** Assistive technology sees a tab list with two tabs named by their titles,
   the selected one marked selected. Selecting a tab (pointer, keyboard or accessibility action)
   shows its panel; Left/Right arrow keys move between the tabs.
3. **Accessible slider.** On the Sound panel the volume is exposed as a slider 0–100 in steps of 5,
   whose spoken value reads "Volume 40 %" (following the number). Increase/decrease actions (keys
   or accessibility actions) change `volume` by 5 within 0–100 and the drawn fill follows.
4. **Accessible switch.** The mute switch is exposed as a switch named "Mute" whose checked state
   follows `muted`; activating it toggles `muted` and moves the knob.
5. **Tri-state checkbox.** The parent "Notifications" checkbox is checked when all three children
   are, unchecked when none are, and **mixed** otherwise (as exposed to assistive technology and as
   drawn). Activating the parent checks all children when it was unchecked or mixed, and clears
   them when it was checked.
6. **Proof without pixels.** Show items 2–5 with your tools' accessibility-tree capture and
   synthetic keyboard / accessibility input: the tree before and after each action (tab switch by
   arrow key, slider steps, switch toggle, parent and child checkbox changes). Rendered frames may
   be added but do not count as proof on their own.

## Deliverable and report

Sources in your format, checked with its tools until they report no errors, plus `REPORT.md`:

```
Format:
Wall time (first command to done):
Check/validate/build/render runs: N  (errors seen, by code or message, with counts)
Source size: lines, characters (sources you wrote only)
Brief items met (1–6), each with how you checked it:
Items not met or approximated, and why:
What was hardest; what the docs or diagnostics got wrong or left out:
```
