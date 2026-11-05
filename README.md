# Anima

An open animation format, `.ani`, and a small web runtime for interactive icons.

- **Agent-first.** Plain JSON with a strict validator, deterministic playback, and a CLI that lets an
  agent check and see an animation without a browser.
- **Glyphy-native.** Coordinates are glyph grid units; Glyphy's path data is embedded as-is and
  animated in place.
- **Small.** Retained SVG, CSS theming, no wasm, no network calls, a loop that sleeps when nothing
  moves. Under 15 KB gzipped (budget 25 KB), strict validation included.

Status: format 0.1, core, CLI and web runtime in progress (see [`docs/PLAN.md`](docs/PLAN.md) and
[`docs/LOG.md`](docs/LOG.md)). [`spec/SPEC.md`](spec/SPEC.md) is the format;
[`docs/AUTHORING.md`](docs/AUTHORING.md) is the guide for writing animations;
[`examples/bell.ani`](examples/bell.ani) is the reference document: a bell that tilts on hover and
rings on click. Open [`examples/web/index.html`](examples/web/index.html) to play it.

```html
<anima-icon src="bell.ani" style="color: #141413; --anima-accent: #d97757"></anima-icon>
<script type="module" src="anima-icon.js"></script>
```

```sh
npm ci
npm run check                                   # typecheck, lint, format, tests, size budget
npx anima validate examples/bell.ani            # the CLI runs from source (Node 24)
npx anima render examples/bell.ani -o ring.png --sheet 8 -e "fire ring" --dark
node tools/build-web.ts                         # packages/web/dist/anima-icon.js + the demo page
```

Anima takes ideas from Rive's open-source runtimes (MIT) — see [`docs/research/`](docs/research/) —
but is an independent design and implementation and does not read `.riv` files.
