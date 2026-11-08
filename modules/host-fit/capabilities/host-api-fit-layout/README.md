# Responsive host layout

`<anima-icon fit="layout">` / `icon.fit='layout'` writes the host's CSS content dimensions to
`player.layoutSize`, already in grid units at one CSS pixel per grid unit. The layout pass now
consumes it for root containers; removal restores authored sizing. The paired scene demonstrates
nested fill text and hug height and uses only the project's generated font.

The host control has no scene registry entry or static CLI flag. Real root/child boxes, resizes,
restoration and independent native RGBA captures at 240x100 and 160x80 are verified in
`modules/host-fit/test/web/fit.test.ts` for SVG and canvas on both engines. This is its conformance
surface; a synthetic CLI script would not exercise a web host resize. Native sources, commands,
frames and sessions: `tests/oracle/host-api-fit-layout/rive/`.
