# Anima

An open animation format, `.ani`, and a small web runtime for interactive icons.

- **Agent-first.** AniML authoring markup compiled to JSON, with a strict validator, deterministic
  playback, and a CLI that lets an agent check and see an animation without a browser.
- **Glyphy-native.** Coordinates are glyph grid units; Glyphy's path data is embedded as-is and
  animated in place.
- **Small.** Retained SVG, CSS theming, no wasm, no network calls, a loop that sleeps when nothing
  moves. Under 15 KB gzipped (budget 25 KB), strict validation included.

Status: format 0.1, core, CLI and web runtime in progress (see [`docs/PLAN.md`](docs/PLAN.md) and
[`docs/LOG.md`](docs/LOG.md)). [`spec/SPEC.md`](spec/SPEC.md) is the format;
[`docs/AUTHORING.md`](docs/AUTHORING.md) is the guide for writing animations;
[`examples/bell.animl`](examples/bell.animl) is the reference source (compiled to
[`examples/bell.ani`](examples/bell.ani)): a bell that tilts on hover and
rings on click. See the [web host API](docs/WEB.md) for embedding and playback controls. Open [`examples/web/index.html`](examples/web/index.html) to play it.

Author in AniML and compile with `anima build examples/bell.animl`. A trimmed excerpt of the bell
source (geometry and other tracks omitted):

```xml
<anima version="0.1" name="bell" title="Bell" grid="20" viewBox="-2 -2 24 24">
  <!-- … colours, glyph, inputs and nodes … -->
  <ease name="settle" curve="cubic(0.2, 0, 0.3, 1)"/>
  <ease name="sway" curve="cubic(0.45, 0, 0.55, 1)"/>
  <timeline name="ring" duration="1.4" reducedMotion="end">
    <track target="swing.rotate">
      0         0         settle
      0.116667  17.1887   sway
      0.283333  -13.751   sway
      0.45      9.1673    sway
      0.616667  -5.7296   sway
      0.783333  3.1513    sway
      0.95      -1.1459   sway
      1.1       0
    </track>
    <!-- … other tracks … -->
  </timeline>
  <!-- … layers and listeners … -->
</anima>
```

```html
<anima-icon src="bell.ani" style="color: #141413; --anima-accent: #d97757"></anima-icon>
<script type="module" src="anima-icon.js"></script>
```

```sh
npm ci
npm run check                                   # typecheck, lint, format, tests, size budget
npx anima build examples/bell.animl              # compile the authored source to .ani
npx anima validate examples/bell.ani            # the CLI runs from source (Node 24)
npx anima render examples/bell.ani -o ring.png --sheet 8 -e "fire ring" --dark
node tools/build-web.ts                         # packages/web/dist/anima-icon.js + the demo page
```

Anima takes ideas from Rive's open-source runtimes (MIT) — see [`docs/research/`](docs/research/) —
but is an independent design and implementation and does not read `.riv` files.
