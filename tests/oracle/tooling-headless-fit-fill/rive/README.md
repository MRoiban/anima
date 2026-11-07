# tooling-headless-fit-fill native capture

Independently authored RML, captured 2026-11-07 with the local headless runner:
`~/.rive/bin/rive . --commands=commands.txt`.
The unedited reference at `frames/0.png` is 240×240. Commands select the artboard, viewport and fit.
No native binary was read or converted. Build outputs were removed.
Central AniML explicitly describes the final fitted geometry; CLI flag wiring is tested independently
in packages/cli/test/tooling-leftovers.test.ts using the original 120×60 scene.
Integer rectangle boundaries permit an exact comparison (no tolerance).
