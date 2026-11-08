# Host-fit native probes

`python modules/host-fit/verification/capture.py` authors no files from upstream code or docs.
It runs the local headless command runner against the independently authored `native/scene.rml`
at a non-square 240×120 viewport, captures all eight fits, and deletes binary/build outputs unread.
Its final two intentionally unsupported commands are retained as evidence for the alignment and
artboard-size API skip. Capture failure still retains the session; the script requires every frame.

`modules/host-fit/test/web/fit.test.ts` draws the paired scene in SVG and canvas on Chromium and
Firefox, with the same opaque #1d1d1d background as the native capture. It compares **all RGBA
channels at every pixel**, without shifting, masking, edge exclusions or normalization. The fixed
flat-shape limit is a maximum channel delta of 2 and zero pixels over 2 (existing flat-shape rule).
The native output differs by at most one level of color dithering; all geometry edges are integers.
These tests also supply independent numeric matrix, pointer and semantic-box vectors with nonzero
viewBox origins, nine alignments, size overrides, host resize and a root-layout stub.

These are host/browser conformance cases: they do not change `Player.step` output or the document
draw frame without a layout provider. No new core vocabulary, schema entries or static-render CLI
options are invented for HTML attributes. `examples/tile.animl` and `tile.ani` are the paired scene;
use it with `<anima-icon fit="cover" alignment="bottom-right">`.

Full responsive layout is not claimed: P7-2 must consume `player.layoutSize` for root layout boxes.
The stub proves size propagation, zero-time reflow notification, reset and host isolation.
