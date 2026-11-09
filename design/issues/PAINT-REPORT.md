# PAINT report

- **Status:** implemented, with documented limits below. Broad verification is non-green.
- **Issues:** #26 and #30.
- **Verify:** focused core/CLI/markup and conformance pass; Chromium and Firefox switch proof pass. Broad conformance/oracle: 4,513 passed, 22 existing TODOs, one WebP timeout. The WebP test also timed out alone; rect-corners passed both runs. The WebP/rect-corners rerun later passed (2 tests). Required `changed`: 10,093 passed, 47 failed, 89 skipped and 34 TODO, across 406 files; predominantly timeouts. Complete size check exited 0; typecheck, lint, formatting and generated checks pass.
- **Sizes (min+gzip, incremental):** paint 4,055 → 4,052 B; paint-sampling 1,106 → 1,102 B over paint; markup-paint 382 → 382 B; corners absent → 437 B (target 1,024 B); colormix absent → 1,065 B; markup-colormix absent → 382 B. Base core+web 22,564 → 22,564 B.
- **Deviations:** descriptor child `<colorMix>` instead of adding `mix(...)` to the base colour parser; module-local conformance/oracle evidence within the assigned ownership; mix endpoints need hex slot defaults and use node fill/stroke rather than ordered paints.
- **Problems:** broad-run failures under shared load are detailed below. `currentColor` defaults require the seam listed in Requests. No threshold or budget was raised.

## #30 — small optional rectangle corners

**Repro:** `modules/corners/test/core/corners.test.ts` rejects the switch scene's `requires: ["corners"]` on the original HEAD with `unknown-feature` at `/requires/0`. `30-before.txt` records the failing test. The browser before proof imports only the unchanged base entry and observes the same rejection; its PNG is blank because loading failed.

**Cause:** rect corner declarations, numeric addresses and outline construction belonged to the whole paint entry.

**Fix:** the complete browser path is 26,619 → 26,616 B with paint, versus **23,001 B** with corners alone. `modules/corners/` contributes the tuple with feature `paint|corners`, ordinary numeric corner addresses, hit outlines and draw paths. Paint reuses the same entry/model/path construction, so existing paint-only scenes still work. Shared polygon/corner construction preserves the original arithmetic, path order, cubic controls, layout allocation and five-decimal formatting. When both features are declared, paint owns the draw operation to avoid duplicate path construction. Removed the duplicate fixed-stroke assignment from geometry: paint's existing `enhancePaint` already applies it.

**Proof:** `30-before.txt`, `30-before.png`, `30-after.txt`, `30-after.png`, and `30-oracle.json` under `design/issues/proof/`. The original rect-corners oracle remains **69/57,600 pixels over 16 = 0.11979166666666667%**, below the unchanged **0.12%** limit, maximum channel delta 70. Existing paint-shape-corners conformance remains unchanged. Additional tests compare paint-only, corners-only and both-feature SVG bytes at start/middle/end.

**Decided, owner may revisit:** corners owns the reusable geometric construction; paint retains compatibility by composing it rather than importing/registering the corners browser entry. This follows the metadata/module separation in `docs/research/rive-format-and-graph.md` and avoids changing the geometry to chase a raster tolerance.

## #26 — independently animated slot colour mixing

**Repro:** `modules/colormix/test/core/colormix.test.ts` fails on the original HEAD with `unknown-feature` at `/requires/0`; the same one-node scene now samples its numeric address and renders the mixed colour.

**Fix:** a node fill/stroke uses `mix: {a, b, t}` in place of `color`. Endpoints are hex literals or slots with hex defaults. The usual track/pose/bind address is `track.fill.mix.t`; the ordinary numeric pipeline clamps resolved values to 0..1. Rest weights outside the interval use `colormix-range`. Invalid endpoints use `colormix-color`; conflicting/ordered sources use `colormix-source`; registry checks handle missing, extra and wrongly typed arguments. Tests assert codes, pointers, messages and corrective hints for the new diagnostics.

AniML uses `<colorMix a="off" b="on" t="0.3"/>`, or `paint="stroke"`. The optional `markup-colormix` entry installs the existing structural engine; no base compiler source or full authoring entry grows. JSON and AniML examples live in `modules/colormix/examples/`. The module-local conformance case checks independently authored start/middle/end snapshots through `runScript`. CLI/schema wiring is generated from the manifest/registry.

Draw data carries the resolved default colour plus neutral endpoint/weight metadata. SVG keeps CSS slot variables in `color-mix(in srgb, …)`; static SVG/CLI resolves defaults or explicit slot overrides to hex. Canvas uses its existing optional paint-source hook, with the owning host's computed slots available even on offscreen surfaces. Mixing uses **premultiplied sRGB and alpha**, unpremultiplies and rounds to eight-bit channels. Existing colour-track interpolation is unchanged.

**Proof:** `26-before.txt`, `26-before.png`, `26-after.txt`, `26-after.png` and `26-colours.json`. Chromium computed SVG colours and canvas pixels agree at weights 0/0.5/1: default black→white gives `[0,0,0,255]`, `[128,128,128,255]`, `[255,255,255,255]`; red→blue page overrides give `[255,0,0,255]`, `[128,0,128,255]`, `[0,0,255,255]`. There is one scene node. A transparent-red→blue midpoint produces `[0,0,255,128]`, proving premultiplied-alpha interpolation. Firefox repeats the checks. CLI PNG tests independently verify default midpoint pixels.

**Decided, owner may revisit:** use a separate mix object and number address, keeping the existing player slots and state blending described in `docs/research/rive-animation-and-state.md`. Retaining CSS slot references follows the host/theming boundary discussed in `docs/research/rive-web-runtime.md`. The structural child avoids a collision with the existing node-level `mix` attribute.

There is no faithful native oracle counterpart for two live page CSS variables mixed by an independently animated weight. `modules/colormix/oracle/README.md` records the skip and independent browser/CLI alternatives. The scaffolder was run in dry-run and write modes: the corners row correctly refused because it is complete; the scripting colour-utilities scaffold was used as a starting checklist, with its unrelated scripting/parity/global evidence changes removed. No scripting VM or parity completion is claimed.

## Verification and cost

The tree remained frozen during size and scoped test runs. Final gate values (bytes): core+web **22,564 / 24,576**; largest scene **57,505 / 65,536**; app-UI **107,621 / 131,072**; runtime sum **134,548 / 163,840**; authoring **15,009 / 16,384**; Rive-class **153,615 / 256,000**. Every per-entry budget passes. Raw measurements: `proof/30-sizes-before.txt` and `proof/30-sizes-after.txt`. Typecheck and lint passed. The first combined module run caught an AniML name collision, corrected by the structural descriptor, then passed all functional tests. A bell-prefix sweep timed out under shared load and passed alone (51 tests). Initial browser proof attempts timed out; moving expensive bundle preparation into `beforeAll` and capturing an explicitly sized blank failure frame produced passing proof.

The required broad `changed` run includes the full repository because generated core/all and package exports change. It completed non-green (22 files, 47 tests failed), mostly browser/fixture timeouts. The asset shader test that emitted `page.evaluate: Array(1)` passed both cases when isolated. The bell AniML prefix sweep passed 51 tests alone. Final `npm run test:scope -- paint corners colormix --no-browser` passed **16 files / 3,392 tests** (608 skipped). Final Chromium/Firefox switch checks passed 2/2; the new colormix core suite passed 17/17. A final regression also protects synthetic white/black mask paints from recolouring. No unrelated package source is edited. `proof/26-verify.txt` contains command results and the broad failure list; these failures are not claimed as proven unrelated bugs, nor as a green full check.

No base runtime implementation changed: core+web remains exactly 22,564 B and the standalone demo remains byte-identical. Optional draw modules are selected by document requirements; the base entry imports neither new feature. No new step hook runs. Paint geometry retains its existing calculations, with duplicate fixed-stroke work removed. **No measured ≤3% timing claim:** other agents and browser/build processes shared the machine throughout.

## Requests

- To support mix endpoints whose default is `currentColor` in static/CLI PNG output, expose the caller's resolved current colour to the static paint backend. `Paint.slot(name, fallback)` currently has no access to the CLI `Look.color`; silently assuming black would be wrong. The implementation explicitly diagnoses these defaults instead. Page overrides can still use `currentColor`.
- If a future syntax must be exactly `fill="mix(off, on, 0.3)"`, add an optional colour-reader seam before `Compiler.copyNode` validates colour attributes. The current registry-owned `<colorMix>` spelling meets this ticket without changing shared compiler sources.
- The integrator may promote `modules/colormix/conformance/` and its native skip note into shared conformance/oracle registries; those handwritten files are outside this ticket's ownership. Module tests already execute the local conformance case and retain the independent expectations.

The broad canvas suite emitted ignored metrics JSON which failed the final formatter; those two generated metrics files were cleaned before the formatting rerun. No canvas source or tracked artifact was edited.
