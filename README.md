# Anima

An open animation format, `.ani`, and a small web runtime for interactive icons.

- **Agent-first.** Plain JSON with a strict validator, deterministic playback, and a CLI that lets an
  agent check and see an animation without a browser.
- **Glyphy-native.** Coordinates are glyph grid units; Glyphy's path data is embedded as-is and
  animated in place.
- **Small.** Retained SVG, CSS theming, no wasm, no network calls, a loop that sleeps when nothing
  moves. Target: under 12 KB gzipped.

Status: design draft. See [`spec/SPEC.md`](spec/SPEC.md) for the format and
[`docs/PLAN.md`](docs/PLAN.md) for the roadmap. [`examples/bell.ani`](examples/bell.ani) is the
reference document: a bell that tilts on hover and rings on click.

```html
<anima-icon src="bell.ani" style="color: #141413; --anima-accent: #d97757"></anima-icon>
```

Anima takes ideas from Rive's open-source runtimes (MIT) — see [`docs/research/`](docs/research/) —
but is an independent design and implementation and does not read `.riv` files.
