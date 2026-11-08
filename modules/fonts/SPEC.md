# Authored font options (normative, P6-13)

Text styles accept `axes` (four-character ASCII alphanumeric/space tags to finite numbers)
and `features` (tags to nonnegative integers). Declare `fonts` and `text`. The settings
are maps in JSON and JSON-valued AniML attributes, following MODULES §Generic AniML fields:

```xml
<anima version="0.1" name="axes-features" grid="20" requires="text fonts">
  <text id="label" x="2" y="2">
    <style id="body" font="Inter" size="2" axes='{"wght":650}' features='{"kern":0,"liga":1}'/>
    <run style="body" text="AB"/>
  </text>
</anima>
```

The fields work on local `<style>` and shared `<text-style>`. A local authored axis is
bindable/animatable at `label.styles.body.axes.wght` using the existing numeric timeline,
input-expression and data-bind rules. The axis must exist in the authored map. Features
are static; selecting another run style can switch the feature map. Explicit `wght` axes
win over style weight. Values outside the font's axis range clamp to its fvar endpoints.

Import `@anima-format/web/fonts-options` for browser option support (includes fonts-text
and text); import assets as usual for embedded fonts. Decoded byte/URL faces default to a `1 1000` weight descriptor, so a variable face's
`wght` is selectable through Canvas; an explicit descriptor overrides that range.
The resources-only fonts entry stays
independent of the text renderer. The optional adapter preserves layout invalidation and
readiness when a bound/animated axis changes. Per-glyph axes remain drawing effects and do
not reflow the underlying line; style axes participate in measurement and line layout.

SVG receives both `font-variation-settings` and `font-feature-settings`, including for
per-glyph effects. Canvas uses `wght` as its numeric CSS font weight and `kern` as
`fontKerning`. The weight fallback clamps to CSS’s 1–1000 range; fonts whose
weight axis exceeds that range require the native arbitrary-axis API or SVG. It feature-detects native `fontVariationSettings` / `fontFeatureSettings`.
On hosts without those APIs, other axes and arbitrary features are ignored by Canvas and
Canvas measurement. SVG still applies the full settings, but runtime line breaking/carets
use those fallback Canvas metrics and may differ from the drawn extents. The tool reader
measures its supported options; `anima render --browser-text` shapes the resulting SVG. No synthetic
property on an unsupported context is mistaken for platform support. These limitations
are a browser capability boundary, not a promise of a full shaping engine (see
`docs/research/rive-web-runtime.md` §1).

The tool reader uses fvar/avar/gvar interpolation, including phantom-point advances;
HVAR and unsupported variation formats retain `font-unsupported`. Unknown font axis tags
produce `font-axis`; nonfinite axes and invalid feature values are errors. Absent feature
tags produce a `font-feature` warning and have no effect. Four-character syntax and numeric
ranges are also enforced by the authoring registry. The deterministic tool supports kern
and context-free GSUB single, alternate and ligature substitutions (including extension
lookups). It applies lookup order from the font; complex flags/contextual lookups fail
with `font-unsupported` and a browser-rendering repair. Default ccmp/locl/rlig/liga/clig
features are enabled, other substitutions require an explicit feature value. Script/language
selection and complex-script shaping are not implemented; use the browser path. A ligature's
advance is assigned to its first grapheme; the tool does not invent internal caret metrics.
The implementation follows the primary [OpenType GSUB specification](https://learn.microsoft.com/en-us/typography/opentype/spec/gsub),
not another runtime's source. No Rive implementation algorithm is used.
