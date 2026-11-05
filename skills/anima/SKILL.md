---
name: anima
description: Animate icons with Anima — write AniML (.animl), check it with the anima CLI, build the .ani the web runtime plays. Use when asked to animate an icon or glyph (hover, press, click, toggle, loading states), to make an interactive icon for a web page, or to change an existing .animl/.ani file.
---

# Animating icons with Anima

Anima is an animation format for interactive icons. You write **AniML** (`.animl`, XML close to
SVG); `anima build` turns it into **`.ani`** (JSON), which `<anima-icon>` plays in the browser.
Everything is checked by the CLI: never guess whether an animation works, sample it.

The CLI documents itself. Read these before writing anything:

```sh
anima docs                 # the authoring guide (loop, geometry, timelines, states, mistakes)
anima docs --list          # its sections; fetch one with: anima docs <section>
anima docs markup          # the AniML reference
anima schema <type>        # what a node / paint / a11y / transition takes, both spellings
```

## The loop

1. **Start from the glyph.** `anima new <name> --glyph icon.svg -o icon.animl` (or
   `--glyphy <project>`; `glyphy export -f animl` writes the same file). The scaffold's rest frame is
   the glyph exactly; keep it that way (rest transforms at identity, added parts hidden at rest).
2. **Find the parts.** `anima new` reports how many subpaths (`M` commands) the glyph has. Split
   moving parts into separate `<path>` elements with `subpaths="…"` and render to see which index
   is which; `anima inspect` then shows each node's subpaths, pivot and what animates it.
3. **Write the motion.** Inputs (`<bool>`, `<number>`, `<trigger>`), `<timeline>`s with `<track>`
   keyframes (`time value [ease]` per line), `<layer>`s of `<state>`s with `<pose>` and `<on>`
   transitions, `<listener>`s for pointer events, `<a11y>` for role, label and activation.
   Set `pivot` on anything that rotates or scales.
4. **Validate.** `anima validate icon.animl` — every diagnostic has `file:line:col`, a code and
   usually a hint. Fix all errors before looking at motion.
5. **Check the motion as numbers.** `anima sample icon.animl -e "pointer move 10 10; advance 0.2 in
   20; snapshot"` prints values and states. Script the interaction the brief describes (hover,
   press, click, toggle mid-animation, leave, `--reduced-motion`) and compare against it.
6. **Look at it.** `anima render icon.animl -o sheet.png --sheet 8 -e "fire ring"` for a contact
   sheet; `--at t` for one frame. Compare the rest frame with the source glyph.
7. **Format and build.** `anima fmt --write icon.animl`, then `anima build icon.animl -o icon.ani`.

## Shipping it

```html
<script type="module" src="anima-icon.js"></script>
<anima-icon src="icon.ani"></anima-icon>
```

Or inline the markup in a page and run `anima build page.html` to compile every
`<script type="application/vnd.anima+xml">` inside `<anima-icon>`. Colours named in `<color>` are
CSS variables (`--anima-<name>`); `currentColor` follows the text colour.

## Habits that save time

- Interruptible, blended state transitions (`<on … blend="0.3">`) turn around smoothly when the
  user changes their mind; sample a mid-animation reversal to prove there is no jump.
- One layer per concern (e.g. toggle and hover/press) so their poses never fight; `anima inspect`
  shows which layer writes what.
- Reduced motion: timelines take `reducedMotion="end"` (or `skip`/`play`); check with
  `--reduced-motion`.
- Exit codes: 0 ok, 1 diagnostics, 2 usage. Add `--format=json` when a program reads the output.
