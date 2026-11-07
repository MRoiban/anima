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

## Data image resource selection

An image's discrete string `asset` slot can be bound to an image data property with `data bind`.
The JSON field and AniML name are both `asset`; `<bind target="pic.asset" value="$picture"/>`
uses the same slot as a JSON binding object. Rendering resolves a player-local replacement
catalog before model resources. An unavailable or non-image runtime ID uses the authored image
as a deterministic fallback; authored unknown/non-image assets retain their existing diagnostics.
