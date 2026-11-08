# Original font option control

Run `node modules/fonts/test/capture-options.ts` from the repository root. This generates
an in-memory-derived original test font for the feature control, captures both controls
with local native commands, then deletes the temporary font and all generated binary/build
artifacts without reading them. The schema-derived scenes use 12 native pixels per Anima
unit and explicit leading. No third-party font or runtime source is used.

Axes use the original font at wght 400, 650 and 900; AB avoids the separate legacy-kern
difference. Features use context-free fi→W and 1→A substitutions from the original font
extension in `modules/fonts/test/features-font.ts`: liga1/tnum0 then liga0/tnum1.
The retained `legacy-kern` control (feature folder only) shows that native kern1 and kern0
do not change this variable fixture's legacy kern pair, whereas Anima/tool/browser honor
that table. It is a recorded native limitation, not a feature-rendering pass.

Raw comparisons: `modules/fonts/verification/p6-13/native-measurements.json`.
These probes stay pending until the orchestrator accepts strict-manifest limits.
