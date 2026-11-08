# Styled input selection

JSON selectedTextColor / selectedTextStyle and AniML selected-text-color / selected-text-style
separate glyph paint from the selection background. A style reuses arbitrary declared fill/stroke
paints without reflowing text. Normative contract: modules/text-input/SPEC.md.

Original-font deterministic field and draw projections: spec/conformance/text-input-selection;
core diagnostics/round trips: test/core/text-input-selection.test.ts; both-engine SVG/canvas pixels:
test/web/selection.browser.test.ts. Native selected text disappears with both attempted drawable
authoring paths, so tests/oracle/text-input-selection/skip.json records the observation boundary
alongside the already documented selection-geometry difference. No passing raster budget is claimed.
