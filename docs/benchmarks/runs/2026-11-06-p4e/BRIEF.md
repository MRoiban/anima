# Benchmark brief (P4e, data): the scoreboard

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The scene

A 40 × 20 grid (Rive: a 480 × 240 artboard, 12 px per grid unit). Ink `#141413`, accent `#d97757`.

- **Three rows**, one per player, at y = 3, 8 and 13. Each row has a colour swatch (a circle of
  radius 1 at (2, y), filled with the player's colour) and a score bar: a rectangle from (5, y − 1),
  height 2, width 30 × score / 2000 (so 2000 points fill the 30-unit track), filled with the
  player's colour.
- **A slider** along the bottom: a track from (5, 18) to (35, 18), stroked 1 unit in ink, and a knob
  — a circle of radius 1 filled accent — at x = 5 + 30 × (Ada's score / 2000), y = 18.

## Behaviour

All values below live in a data model the host page (or a test script) can read and write by name
— not in hard-coded node values. No text needs to be rendered; formatted labels are string data.

1. **Players as data.** A list of three players, each with a name, a score and a colour: Ada 1250
   `#d97757`, Lin 980 `#6a9bcc`, Sam 40 `#788c5d`. This is the document's default data, available
   without any host setup.
2. **Bars follow scores.** Each bar's width and each swatch's and bar's colour follow its player's
   data; when the host changes a player's score or colour, the scene follows on the next frame.
3. **Formatted labels.** Each player exposes a read-only string label derived from the score: the
   score with thousands grouping and the suffix " pts" (1250 → "1,250 pts", 40 → "40 pts"). It
   updates whenever the score changes.
4. **Two-way slider.** Dragging the knob horizontally sets Ada's score continuously (0–2000,
   clamped to the track); when the host sets Ada's score, the knob moves to match.
5. **Leader.** The bar of the player with the highest score has an accent outline (stroke 0.5);
   exactly one bar has it, and it moves when the ranking changes (ties: the earlier player wins).
6. **Milestone.** Each time Ada's score rises from below 1500 to 1500 or more, a `milestone`
   signal fires once (observable by the host); it fires again only after the score has dropped
   below 1500 and crossed again.

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
