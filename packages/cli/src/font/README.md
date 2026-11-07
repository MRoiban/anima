# Tool fonts

This directory is Node-only tooling. `reader.ts` exposes `Font` and diagnostic-safe `readFont`;
`measure.ts` supplies the DESIGN §4 `ToolMeasurer`. `document.ts` loads local document faces,
builds subsets and installs the optional text-module seam. `svg.ts` turns rendered text into paths;
`browser.ts` owns the explicit Chromium fallback. `flatten.ts` freezes default text into geometry.

```sh
anima import-font fixtures/fonts/anima-test.ttf -o /tmp/local.ttf --chars 'AVé'
anima import-font --google 'Example:wght@400;600' -o /tmp/example.ttf --chars 'Hello'
anima validate scene.animl --font 'Example=/tmp/example.ttf'
anima sample scene.animl --font 'Example=/tmp/example.ttf' -e snapshot
anima render scene.animl --font 'Example=/tmp/example.ttf' -o /tmp/scene.png
anima render scene.animl --browser-text -o /tmp/complex.png
anima flatten scene.animl --node title -o /tmp/outlined.animl
```

Register fixtures for tool clients with `new ToolMeasurer()`, `register(family, new Font(bytes))`,
then call `measure(fontSpec, text)` or `outline(fontSpec, text, x, baseline)`. Register separate static
faces with weight/style arguments; variable `wght` comes from FontSpec.weight by default. No system
fonts are used by this measurer. The optional text module must export `setTextMeasurer` (or
`setMeasurer`) for CLI/conformance installation. See the spec's “Tool font processing” for limits.

Flatten accepts the text backend's inline font/paint CSS and whitespace/geometricPrecision hints, translating paint to SVG presentation attributes and removing text-only hints after outlining. Unsupported CSS still reports font-unsupported instead of silently dropping visible effects.
