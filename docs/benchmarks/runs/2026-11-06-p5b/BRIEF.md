# Benchmark brief (P5b, lists and assets): the playlist

The same brief goes to fresh agents, one per format (AniML + the `anima` CLI; Rive's markup + the
Rive CLI's local tooling). Nothing below names a format's constructs.

## The scene

A 40 × 30 grid (Rive: a 480 × 360 artboard, 12 px per grid unit). Ink `#141413`, accent `#d97757`,
panel `#f0eee6`.

- **Track rows**, one per track in a list, stacked from y = 2 every 6 units. Each row is drawn by
  one reusable row design: a cover image (4 × 4 units at (2, y), the track's own 8 × 8 pixel-art
  image, drawn with **nearest-neighbour sampling** so pixels stay crisp), a title bar (a rectangle
  from (8, y + 0.5), height 1, width = 1 unit per character of the title, ink) and a duration bar
  (from (8, y + 2.5), height 1, width = duration in seconds ÷ 10, accent).
- **A counter** at the bottom right: a column of small dots (radius 0.4 at x = 38, from y = 28
  upwards every 1.2 units), one per track.

## Behaviour

All values below live in data the host page (or a test script) can read and write by name.

1. **Tracks as data.** A list of tracks, each with a title, a duration in seconds, a cover image
   and an audio clip: three to start (titles "Dawn", "Tide", "Ember"; durations 90, 150, 60 s),
   available without host setup. Use small self-made images and sounds (no third-party files).
2. **One row per track.** Rows are created from the one row design, one per list item, in list order.
3. **Host list edits.** When the host adds a track at the end, inserts one at index 1, removes one, or
   swaps two, the rows follow on the next frame, and a row's own state survives the move (a row
   that is highlighted stays highlighted when its track moves).
4. **Play on click.** Clicking a row plays that track's audio clip (a trimmed section of its sound
   file, e.g. 0.2 s to 1.0 s) and highlights that row (accent outline, stroke 0.3); clicking another
   row moves the highlight. Playback requests must be observable by the host or the test tool.
5. **Derived count.** The number of counter dots always equals the number of tracks, through
   adds and removes, without the host setting it separately.
6. **Crisp covers.** The cover images render with nearest-neighbour sampling at the row's size
   (an 8 × 8 image shown at 4 × 4 units shows hard pixel edges, no blur).

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
