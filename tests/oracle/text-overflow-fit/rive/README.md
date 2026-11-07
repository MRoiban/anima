# Original-font native comparison: text-overflow-fit

See [the P6 text probe report](../../TEXT-PROBES.md) for reproduction, exact measured
limits and the default-leading disagreement kept separately. Both scenes explicitly
specify 1-em leading, except where a baseline origin cancels the leading offset.
The original generated font is `fixtures/fonts/anima-test.ttf`; no system font is used.
The native font-size endpoint advances 1 ms past 1 s for its float clock boundary;
Anima samples exactly 1 s. No image is shifted or resampled.
