# Asset host IO

Internal split of the assets browser entry: source resolution, policy and image preloading.
`@anima-format/web/assets` imports this entry automatically; no additional `requires` token
or document fields. Core remains pure and DOM-free. The independent byte budget measures
this IO separately; assets is measured over assetio. This follows the optional host consumer
boundary in [web research](../../docs/research/rive-web-runtime.md) §1.

Asset I/O composes a previously installed `AnimaIcon.loadAssets` loader rather than replacing it.
This preserves font preloading when the fonts entry arrives first. All composed loaders finish
before scene instantiation. No font decoding policy lives in assetio; it remains in fonts.
