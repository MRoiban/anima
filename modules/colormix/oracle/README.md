# Slot colour mixing — no faithful native counterpart

Rive's native colour tracks store literal colour channels; they do not expose two page CSS
variables whose values remain live while an independently addressed weight animates. A literal
colour track or two opacity-stacked shapes would test different semantics (especially alpha).
No Rive source, CLI documentation text or `.riv` files were used.

The independent browser oracle is CSS `color-mix(in srgb)` in Chromium and Firefox. The browser
regression compares computed SVG colours and canvas pixels at weights 0, 0.5 and 1, including
page overrides and transparent endpoints. CLI pixels use independently calculated sRGB values.
The conformance probe lives beside this note under `../conformance/`, tested in the module scope;
shared spec/conformance and parity mappings are outside this ticket's file ownership.
