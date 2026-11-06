# Assets contract index

The normative contract is [spec/SPEC.md](../../spec/SPEC.md), chapters **assets**, **P5b asset
pipeline** and **Image wrapping (P5b)**. AniML field descriptors and JSON shapes live in
core/index.ts; source maps to src. Media byte access lives in modules/media; playback clips live
in modules/events. Sampling is optional paint-sampling/SVG or Canvas, never added to image-only
or audio-free entry points.

P5b-7 changes no declaration shape or deterministic player semantics. It supplies nearest clamp
edge extension, Canvas bilinear clamp and command-scoped CLI codec ownership. SVG combinations
without a faithful form report unsupported-render as specified in the normative chapter.

Evidence and native limitations are in REPORT.md and probes/row-dispositions.json. A native
skip describes a missing observation route; it is not evidence of native equality. Historical
failure measurements and all oracle limits remain unchanged.
