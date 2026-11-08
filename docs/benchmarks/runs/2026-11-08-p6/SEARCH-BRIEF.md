# Benchmark brief (P6, text): the search card

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

Fonts: no third-party font files may be added to the repository. Use the generated test font
`fixtures/fonts/anima-test.ttf` (simple geometric glyphs, original to this project) wherever a font
file is needed; browser rendering may use CSS family names.

## The scene

A 40 × 30 grid (Rive: a 480 × 360 artboard, 12 px per grid unit). Ink `#141413`, accent `#d97757`,
panel `#f0eee6`. A panel rectangle fills the grid.

- **Title** "Find a setting" at (2, 2), text size 2.5 units, ink.
- **Search field**: a rounded box at (2, 6), 36 × 4 units, ink outline; its text size 1.8 units.
  When empty it shows the placeholder "Search" in a lighter ink.
- **Results**: five label rows at (2, 12), (2, 15), (2, 18), (2, 21), (2, 24), each in a box
  14 units wide and 2.5 units tall, text size 1.8 units.
- **Count**: a line at (2, 27) reading "N results" (for example "5 results").

## Behaviour

All values below live in data the host page (or a test script) can read and write by name.

1. **Title wave on load.** When the scene starts, the title's letters wave in: each letter moves
   up into place from 1 unit below and fades from transparent to opaque, staggered across the word
   range so letters arrive one after another, finishing within 1.2 s.
2. **Labels from data.** The five labels are strings in data: "Notifications", "Network and
   connectivity preferences", "Sound", "Display brightness and colour", "Privacy". Each row shows
   its label; a label too long for its 14-unit box ends in an ellipsis ("…") instead of overflowing.
   Changing a label in data changes the drawn text.
3. **Typing filters.** Typing into the search field updates a `query` string in data. A row is
   shown only when its label contains the query (case-insensitive); an empty query shows all five.
4. **Count from data.** The number of shown rows is a number in data, and the count line reads
   "N results" from it (for example typing "so" leaves "Sound" → "1 results" is acceptable).
5. **Accessible field and labels.** Assistive technology sees a text field named "Search" (the
   placeholder may serve as the name) whose value follows `query`, and each shown row as text (or a
   list item) whose name is its label; hidden rows are not in the tree.
6. **Proof without pixels.** Show items 2–5 with your tools' typing / text-input commands and
   accessibility-tree capture: the tree and data before and after typing "o", then "so", then
   clearing the field, and after renaming a label in data. Rendered frames may be added (and are
   the only proof possible for item 1) but do not count as proof of items 2–5 on their own.

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
