# Independent text probe

This source is independently authored. It uses only the original generated font at
`fixtures/fonts/anima-test.ttf`, reproduced by `node tools/test-font.ts`.

From this directory, run `~/.rive/bin/rive . --commands=commands.txt` to reproduce
`frames/0.png`. Delete generated `build/` and binary artifacts without reading them.
The artboard is 240 px square; 12 native pixels correspond to one Anima grid unit.

The raw comparison uses `anima render ../case.animl --font sans-serif=<repo>/fixtures/fonts/anima-test.ttf
--size 240 --background '#ffffff'`. Results are retained in
`modules/text/verification/native-comparison.json`. No accepted tolerance has been assigned;
this is a pending probe, not a completed oracle. Baseline, line-height and fitting differences
remain open. The run-list probe is only a literal-render control; it does not evidence native list binding.
